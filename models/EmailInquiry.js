/**
 * Email Inquiry Model
 * Tracks automated email inquiries from customers
 * Stores extracted parts, search results, and quotation status
 */
const mongoose = require('mongoose');

const extractedPartSchema = new mongoose.Schema({
  partNumber: {
    type: String,
    required: true,
    index: true,
  },
  quantity: {
    type: Number,
    default: 1,
  },
  brand: String,
  description: String,
  confidence: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium',
  },
  originalText: String,
  // Search results for this part
  searchResults: [{
    partId: String, // Can be ObjectId string or Elasticsearch composite ID
    partNumber: String,
    brand: String,
    supplier: String,
    price: Number,
    currency: {
      type: String,
      default: 'AED',
    },
    quantity: Number,
    deliveryDays: Number,
    selected: {
      type: Boolean,
      default: false,
    },
  }],
  found: {
    type: Boolean,
    default: false,
  },
  bestMatch: {
    partId: String, // Can be ObjectId string or Elasticsearch composite ID
    partNumber: String,
    brand: String,
    supplier: String,
    price: Number,
    currency: String,
    quantity: Number,
    deliveryDays: Number,
    reason: String,
  },
});

const emailAttachmentSchema = new mongoose.Schema({
  filename: String,
  contentType: String,
  size: Number,
  path: String, // Local storage path
  processed: {
    type: Boolean,
    default: false,
  },
  partsExtracted: {
    type: Number,
    default: 0,
  },
});

const emailInquirySchema = new mongoose.Schema({
  // Email Information
  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  from: {
    email: {
      type: String,
      required: true,
      index: true,
    },
    name: String,
  },
  to: {
    email: String,
    name: String,
  },
  subject: String,
  body: {
    text: String, // Plain text version
    html: String, // HTML version
  },
  receivedAt: {
    type: Date,
    required: true,
    index: true,
  },
  
  // Processing Status
  status: {
    type: String,
    enum: [
      'received',           // Email received, not yet processed
      'acknowledged',       // Auto-reply sent
      'processing',         // AI is extracting parts
      'searching',          // Searching for parts
      'quotation_ready',    // Quotation prepared
      'quotation_sent',     // Quotation sent to customer
      'order_created',      // Customer converted to order
      'failed',             // Processing failed
      'spam',               // Marked as spam/not an inquiry
    ],
    default: 'received',
    index: true,
  },
  
  // Attachments
  attachments: [emailAttachmentSchema],
  
  // Extracted Parts
  extractedParts: [extractedPartSchema],
  totalPartsRequested: {
    type: Number,
    default: 0,
  },
  totalPartsFound: {
    type: Number,
    default: 0,
  },
  totalPartsNotFound: {
    type: Number,
    default: 0,
  },
  
  // AI Analysis
  aiAnalysis: {
    summary: String,
    customerIntent: String,
    urgency: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    language: {
      type: String,
      default: 'en',
    },
    suggestions: [String],
    processingNotes: [String],
  },
  
  // Quotation Details
  quotation: {
    generatedAt: Date,
    sentAt: Date,
    totalAmount: Number,
    currency: {
      type: String,
      default: 'AED',
    },
    itemCount: Number,
    validUntil: Date,
    emailContent: String, // HTML content sent
    quotationNumber: String,
  },
  
  // Linked Buyer (if exists)
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    index: true,
  },
  
  // Order Reference (if converted)
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  
  // Processing Metrics
  processingTime: {
    acknowledgementSent: Number, // ms to send auto-reply
    partsExtracted: Number, // ms to extract parts
    searchCompleted: Number, // ms to search all parts
    quotationGenerated: Number, // ms to generate quotation
    totalTime: Number, // total ms from receive to quotation sent
  },
  
  // Error Tracking
  error: {
    message: String,
    stack: String,
    occurredAt: Date,
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  
  // Admin Notes
  adminNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // Flags
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal',
    index: true,
  },
  
}, {
  timestamps: true,
});

// Indexes for efficient queries
emailInquirySchema.index({ status: 1, receivedAt: -1 });
emailInquirySchema.index({ 'from.email': 1, receivedAt: -1 });
emailInquirySchema.index({ createdAt: -1 });
emailInquirySchema.index({ isRead: 1, status: 1 });

// Virtual for display name
emailInquirySchema.virtual('senderDisplayName').get(function() {
  return this.from.name || this.from.email;
});

// Static methods
emailInquirySchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  
  const result = {
    total: 0,
    received: 0,
    acknowledged: 0,
    processing: 0,
    searching: 0,
    quotation_ready: 0,
    quotation_sent: 0,
    order_created: 0,
    failed: 0,
    spam: 0,
  };
  
  stats.forEach(s => {
    result[s._id] = s.count;
    result.total += s.count;
  });
  
  return result;
};

emailInquirySchema.statics.getUnreadCount = function() {
  return this.countDocuments({ isRead: false, status: { $nin: ['spam', 'archived'] } });
};

emailInquirySchema.statics.getPendingInquiries = function() {
  return this.find({
    status: { $in: ['received', 'acknowledged'] },
  }).sort({ receivedAt: -1 });
};

// Instance methods
emailInquirySchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

emailInquirySchema.methods.addNote = function(note, adminId) {
  this.adminNotes.push({
    note,
    addedBy: adminId,
    addedAt: new Date(),
  });
  return this.save();
};

emailInquirySchema.methods.updateStatus = async function(newStatus, additionalData = {}) {
  this.status = newStatus;
  Object.assign(this, additionalData);
  return this.save();
};

// Generate unique quotation number
emailInquirySchema.methods.generateQuotationNumber = function() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `QT-${year}${month}${day}-${random}`;
};

const EmailInquiry = mongoose.model('EmailInquiry', emailInquirySchema);

module.exports = EmailInquiry;
