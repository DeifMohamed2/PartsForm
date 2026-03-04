/**
 * Socket.io Service
 * Handles real-time communication for the claim/chat system
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io = null;

// Store active connections by user type and ID
const connections = {
  buyers: new Map(),    // Map<buyerId, Set<socketId>>
  admins: new Map(),    // Map<adminId, Set<socketId>>
  claims: new Map()    // Map<claimId, Set<socketId>> - users currently viewing a claim
};

/**
 * Initialize Socket.io server
 * @param {http.Server} server - HTTP server instance
 */
const initialize = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        // Allow connection but mark as unauthenticated
        socket.userData = { authenticated: false };
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userData = {
        authenticated: true,
        userId: decoded.id,
        userType: decoded.type || 'buyer', // 'buyer' or 'admin'
        email: decoded.email
      };
      next();
    } catch (error) {
      logger.warn('Socket auth failed', { error: error.message });
      socket.userData = { authenticated: false };
      next();
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info('Socket connected', {
      socketId: socket.id,
      user: socket.userData.authenticated ? socket.userData.email : 'unauthenticated',
    });

    // Register user connection
    if (socket.userData.authenticated) {
      registerConnection(socket);
    }

    // Join a claim room for real-time updates
    socket.on('join-claim', (claimId) => {
      if (!socket.userData.authenticated) return;
      
      socket.join(`claim:${claimId}`);
      
      // Track who's viewing this claim
      if (!connections.claims.has(claimId)) {
        connections.claims.set(claimId, new Set());
      }
      connections.claims.get(claimId).add(socket.id);
      
      logger.debug('User joined claim room', { user: socket.userData.email, claimId });
      
      // Emit typing indicator presence
      socket.to(`claim:${claimId}`).emit('user-joined', {
        userId: socket.userData.userId,
        userType: socket.userData.userType
      });
    });

    // Leave a claim room
    socket.on('leave-claim', (claimId) => {
      socket.leave(`claim:${claimId}`);
      
      if (connections.claims.has(claimId)) {
        connections.claims.get(claimId).delete(socket.id);
        if (connections.claims.get(claimId).size === 0) {
          connections.claims.delete(claimId);
        }
      }
      
      socket.to(`claim:${claimId}`).emit('user-left', {
        userId: socket.userData.userId,
        userType: socket.userData.userType
      });
    });

    // Typing indicator
    socket.on('typing', ({ claimId, isTyping }) => {
      if (!socket.userData.authenticated) return;
      
      socket.to(`claim:${claimId}`).emit('user-typing', {
        userId: socket.userData.userId,
        userType: socket.userData.userType,
        isTyping
      });
    });

    // Handle new message (real-time broadcast)
    socket.on('new-message', (data) => {
      if (!socket.userData.authenticated) return;
      
      // Broadcast to all users in the claim room
      io.to(`claim:${data.claimId}`).emit('message-received', {
        ...data.message,
        claimId: data.claimId
      });

      // Also notify the buyer/admin if they're not in the room
      notifyNewMessage(data.claimId, data.message, socket.userData);
    });

    // Handle message read
    socket.on('messages-read', ({ claimId, userType }) => {
      if (!socket.userData.authenticated) return;
      
      socket.to(`claim:${claimId}`).emit('messages-marked-read', {
        claimId,
        readBy: userType
      });
    });

    // Handle status update
    socket.on('status-updated', ({ claimId, status }) => {
      if (!socket.userData.authenticated) return;
      
      io.to(`claim:${claimId}`).emit('claim-status-changed', {
        claimId,
        status,
        updatedBy: socket.userData.userType
      });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { socketId: socket.id });
      unregisterConnection(socket);
    });
  });

  logger.info('Socket.io initialized');
  return io;
};

/**
 * Register a user connection
 */
const registerConnection = (socket) => {
  const { userId, userType } = socket.userData;
  const connectionMap = userType === 'admin' ? connections.admins : connections.buyers;
  
  if (!connectionMap.has(userId)) {
    connectionMap.set(userId, new Set());
  }
  connectionMap.get(userId).add(socket.id);
};

/**
 * Unregister a user connection
 */
const unregisterConnection = (socket) => {
  if (!socket.userData.authenticated) return;
  
  const { userId, userType } = socket.userData;
  const connectionMap = userType === 'admin' ? connections.admins : connections.buyers;
  
  if (connectionMap.has(userId)) {
    connectionMap.get(userId).delete(socket.id);
    if (connectionMap.get(userId).size === 0) {
      connectionMap.delete(userId);
    }
  }

  // Remove from any claim rooms
  connections.claims.forEach((sockets, claimId) => {
    sockets.delete(socket.id);
    if (sockets.size === 0) {
      connections.claims.delete(claimId);
    }
  });
};

/**
 * Notify a user about a new message
 */
const notifyNewMessage = (claimId, message, sender) => {
  // If sender is buyer, notify admins
  // If sender is admin, notify the buyer
  // This is for showing notifications on the claims list page
  
  if (sender.userType === 'buyer') {
    // Notify all connected admins
    connections.admins.forEach((socketIds, adminId) => {
      socketIds.forEach(socketId => {
        io.to(socketId).emit('claim-new-message', {
          claimId,
          message,
          fromBuyer: true
        });
      });
    });
  } else {
    // Notify the specific buyer
    // We'd need to know the buyer ID for this claim
    // This will be handled by the controller when saving messages
  }
};

/**
 * Emit event to a specific claim room
 */
const emitToClaim = (claimId, event, data) => {
  if (io) {
    io.to(`claim:${claimId}`).emit(event, data);
  }
};

/**
 * Emit event to a specific buyer
 */
const emitToBuyer = (buyerId, event, data) => {
  if (io && connections.buyers.has(buyerId.toString())) {
    connections.buyers.get(buyerId.toString()).forEach(socketId => {
      io.to(socketId).emit(event, data);
    });
  }
};

/**
 * Emit event to all admins
 */
const emitToAdmins = (event, data) => {
  if (io) {
    connections.admins.forEach((socketIds) => {
      socketIds.forEach(socketId => {
        io.to(socketId).emit(event, data);
      });
    });
  }
};

/**
 * Emit new claim notification
 */
const notifyNewClaim = (claim) => {
  emitToAdmins('claim-created', {
    claimId: claim.ticketNumber,
    subject: claim.subject,
    buyerName: claim.buyerName,
    category: claim.category,
    priority: claim.priority
  });
};

/**
 * Emit claim update notification
 */
const notifyClaimUpdate = (claimId, updateType, data) => {
  emitToClaim(claimId, 'claim-updated', {
    claimId,
    updateType,
    ...data
  });
};

/**
 * Get the Socket.io instance
 */
const getIO = () => io;

/**
 * Check if a user is online
 */
const isUserOnline = (userId, userType) => {
  const connectionMap = userType === 'admin' ? connections.admins : connections.buyers;
  return connectionMap.has(userId.toString()) && connectionMap.get(userId.toString()).size > 0;
};

/**
 * Get users currently viewing a claim
 */
const getClaimViewers = (claimId) => {
  return connections.claims.has(claimId) ? 
    Array.from(connections.claims.get(claimId)) : [];
};

module.exports = {
  initialize,
  getIO,
  emitToClaim: emitToClaim, // Alias maintained for compatibility
  emitToClaim: emitToClaim, // Alias maintained for compatibility // Alias for claim support
  emitToBuyer,
  emitToAdmins,
  notifyNewClaim,
  
  notifyClaimUpdate,
  
  isUserOnline,
  getClaimViewers
};
