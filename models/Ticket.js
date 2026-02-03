const mongoose = require('mongoose');

/**
 * Attachment Schema
 * For file attachments in messages
 */
const attachmentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

/**
 * Message Schema
 * For individual messages in a ticket conversation
 */
const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['buyer', 'admin'],
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'messages.senderModel'
  },
  senderModel: {
    type: String,
    enum: ['Buyer', 'Admin']
  },
  content: {
    type: String,
    required: true
  },
  attachments: [attachmentSchema],
  readByAdmin: {
    type: Boolean,
    default: false
  },
  readByBuyer: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

/**
 * Ticket Schema
 * Main ticket document for support system
 */
const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Shipping Issue',
      'Order Issue', 
      'Product Inquiry',
      'Payment',
      'Documentation',
      'Technical Issue',
      'Return Request',
      'General'
    ]
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    default: 'open'
  },
  // Associated buyer
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    required: true
  },
  buyerName: {
    type: String,
    required: true
  },
  buyerEmail: {
    type: String,
    required: true
  },
  // Associated order (optional)
  orderNumber: {
    type: String,
    trim: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  // Initial description
  description: {
    type: String,
    required: true
  },
  // Initial attachments
  attachments: [attachmentSchema],
  // Messages thread
  messages: [messageSchema],
  // Admin assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  assignedToName: String,
  // Unread counts for notifications
  unreadByAdmin: {
    type: Number,
    default: 1  // Initial ticket counts as unread
  },
  unreadByBuyer: {
    type: Number,
    default: 0
  },
  // Metadata
  industry: {
    type: String,
    default: 'automotive'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  lastMessageBy: {
    type: String,
    enum: ['buyer', 'admin']
  },
  resolvedAt: Date,
  closedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
// Note: ticketNumber index is already created by unique: true
ticketSchema.index({ buyer: 1, status: 1 });
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ orderNumber: 1 });
ticketSchema.index({ lastMessageAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });

// Virtual for message count
ticketSchema.virtual('messageCount').get(function() {
  return this.messages ? this.messages.length : 0;
});

// Virtual for formatted ticket ID
ticketSchema.virtual('id').get(function() {
  return this.ticketNumber;
});

/**
 * Generate unique ticket number
 */
ticketSchema.statics.generateTicketNumber = async function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Find the last ticket number for this month
  const lastTicket = await this.findOne({
    ticketNumber: new RegExp(`^TKT-${year}${month}`)
  }).sort({ ticketNumber: -1 });

  let nextNumber = 1;
  if (lastTicket) {
    const lastNumber = parseInt(lastTicket.ticketNumber.split('-')[2], 10);
    nextNumber = lastNumber + 1;
  }

  return `TKT-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
};

/**
 * Add a message to the ticket
 */
ticketSchema.methods.addMessage = async function(messageData) {
  const message = {
    sender: messageData.sender,
    senderName: messageData.senderName,
    senderId: messageData.senderId,
    senderModel: messageData.sender === 'buyer' ? 'Buyer' : 'Admin',
    content: messageData.content,
    attachments: messageData.attachments || [],
    readByAdmin: messageData.sender === 'admin',
    readByBuyer: messageData.sender === 'buyer',
    createdAt: new Date()
  };

  this.messages.push(message);
  this.lastMessageAt = new Date();
  this.lastMessageBy = messageData.sender;

  // Update unread counts
  if (messageData.sender === 'buyer') {
    this.unreadByAdmin += 1;
  } else {
    this.unreadByBuyer += 1;
  }

  // Update status if admin replies to open ticket
  if (messageData.sender === 'admin' && this.status === 'open') {
    this.status = 'in-progress';
  }

  await this.save();
  return this.messages[this.messages.length - 1];
};

/**
 * Mark messages as read
 */
ticketSchema.methods.markAsRead = async function(reader) {
  if (reader === 'admin') {
    this.unreadByAdmin = 0;
    this.messages.forEach(msg => {
      if (msg.sender === 'buyer') {
        msg.readByAdmin = true;
      }
    });
  } else if (reader === 'buyer') {
    this.unreadByBuyer = 0;
    this.messages.forEach(msg => {
      if (msg.sender === 'admin') {
        msg.readByBuyer = true;
      }
    });
  }
  await this.save();
};

/**
 * Update ticket status
 */
ticketSchema.methods.updateStatus = async function(newStatus, updatedBy) {
  this.status = newStatus;
  
  if (newStatus === 'resolved') {
    this.resolvedAt = new Date();
  } else if (newStatus === 'closed') {
    this.closedAt = new Date();
  }

  // Add system message for status change
  const statusMessage = {
    sender: updatedBy,
    senderName: updatedBy === 'admin' ? 'Support Team' : 'System',
    content: `Ticket status changed to ${newStatus.replace('-', ' ')}`,
    readByAdmin: true,
    readByBuyer: true,
    createdAt: new Date()
  };
  this.messages.push(statusMessage);
  this.lastMessageAt = new Date();

  await this.save();
};

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
