/**
 * Socket.io Service
 * Handles real-time communication for the ticket/chat system
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

// Store active connections by user type and ID
const connections = {
  buyers: new Map(),    // Map<buyerId, Set<socketId>>
  admins: new Map(),    // Map<adminId, Set<socketId>>
  tickets: new Map()    // Map<ticketId, Set<socketId>> - users currently viewing a ticket
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

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
      socket.userData = {
        authenticated: true,
        userId: decoded.id,
        userType: decoded.type || 'buyer', // 'buyer' or 'admin'
        email: decoded.email
      };
      next();
    } catch (error) {
      console.log('Socket auth error:', error.message);
      socket.userData = { authenticated: false };
      next();
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} - ${socket.userData.authenticated ? socket.userData.email : 'unauthenticated'}`);

    // Register user connection
    if (socket.userData.authenticated) {
      registerConnection(socket);
    }

    // Join a ticket room for real-time updates
    socket.on('join-ticket', (ticketId) => {
      if (!socket.userData.authenticated) return;
      
      socket.join(`ticket:${ticketId}`);
      
      // Track who's viewing this ticket
      if (!connections.tickets.has(ticketId)) {
        connections.tickets.set(ticketId, new Set());
      }
      connections.tickets.get(ticketId).add(socket.id);
      
      console.log(`User ${socket.userData.email} joined ticket room: ${ticketId}`);
      
      // Emit typing indicator presence
      socket.to(`ticket:${ticketId}`).emit('user-joined', {
        userId: socket.userData.userId,
        userType: socket.userData.userType
      });
    });

    // Leave a ticket room
    socket.on('leave-ticket', (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
      
      if (connections.tickets.has(ticketId)) {
        connections.tickets.get(ticketId).delete(socket.id);
        if (connections.tickets.get(ticketId).size === 0) {
          connections.tickets.delete(ticketId);
        }
      }
      
      socket.to(`ticket:${ticketId}`).emit('user-left', {
        userId: socket.userData.userId,
        userType: socket.userData.userType
      });
    });

    // Typing indicator
    socket.on('typing', ({ ticketId, isTyping }) => {
      if (!socket.userData.authenticated) return;
      
      socket.to(`ticket:${ticketId}`).emit('user-typing', {
        userId: socket.userData.userId,
        userType: socket.userData.userType,
        isTyping
      });
    });

    // Handle new message (real-time broadcast)
    socket.on('new-message', (data) => {
      if (!socket.userData.authenticated) return;
      
      // Broadcast to all users in the ticket room
      io.to(`ticket:${data.ticketId}`).emit('message-received', {
        ...data.message,
        ticketId: data.ticketId
      });

      // Also notify the buyer/admin if they're not in the room
      notifyNewMessage(data.ticketId, data.message, socket.userData);
    });

    // Handle message read
    socket.on('messages-read', ({ ticketId, userType }) => {
      if (!socket.userData.authenticated) return;
      
      socket.to(`ticket:${ticketId}`).emit('messages-marked-read', {
        ticketId,
        readBy: userType
      });
    });

    // Handle status update
    socket.on('status-updated', ({ ticketId, status }) => {
      if (!socket.userData.authenticated) return;
      
      io.to(`ticket:${ticketId}`).emit('ticket-status-changed', {
        ticketId,
        status,
        updatedBy: socket.userData.userType
      });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      unregisterConnection(socket);
    });
  });

  console.log('🔌 Socket.io initialized');
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

  // Remove from any ticket rooms
  connections.tickets.forEach((sockets, ticketId) => {
    sockets.delete(socket.id);
    if (sockets.size === 0) {
      connections.tickets.delete(ticketId);
    }
  });
};

/**
 * Notify a user about a new message
 */
const notifyNewMessage = (ticketId, message, sender) => {
  // If sender is buyer, notify admins
  // If sender is admin, notify the buyer
  // This is for showing notifications on the tickets list page
  
  if (sender.userType === 'buyer') {
    // Notify all connected admins
    connections.admins.forEach((socketIds, adminId) => {
      socketIds.forEach(socketId => {
        io.to(socketId).emit('ticket-new-message', {
          ticketId,
          message,
          fromBuyer: true
        });
      });
    });
  } else {
    // Notify the specific buyer
    // We'd need to know the buyer ID for this ticket
    // This will be handled by the controller when saving messages
  }
};

/**
 * Emit event to a specific ticket room
 */
const emitToTicket = (ticketId, event, data) => {
  if (io) {
    io.to(`ticket:${ticketId}`).emit(event, data);
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
 * Emit new ticket notification
 */
const notifyNewTicket = (ticket) => {
  emitToAdmins('ticket-created', {
    ticketId: ticket.ticketNumber,
    subject: ticket.subject,
    buyerName: ticket.buyerName,
    category: ticket.category,
    priority: ticket.priority
  });
};

/**
 * Emit ticket update notification
 */
const notifyTicketUpdate = (ticketId, updateType, data) => {
  emitToTicket(ticketId, 'ticket-updated', {
    ticketId,
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
 * Get users currently viewing a ticket
 */
const getTicketViewers = (ticketId) => {
  return connections.tickets.has(ticketId) ? 
    Array.from(connections.tickets.get(ticketId)) : [];
};

module.exports = {
  initialize,
  getIO,
  emitToTicket,
  emitToBuyer,
  emitToAdmins,
  notifyNewTicket,
  notifyTicketUpdate,
  isUserOnline,
  getTicketViewers
};
