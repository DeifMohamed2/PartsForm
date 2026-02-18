/**
 * Referral Code Model
 * Represents individual referral codes with validity periods
 * Each partner can have multiple codes with different rates and periods
 * 
 * IMPORTANT: Referral codes are used at BUYER REGISTRATION, not at checkout.
 * When a buyer signs up with a code, they become permanently linked to the partner.
 * All future orders from that buyer generate commissions for the linked partner.
 */

const mongoose = require('mongoose');

const referralCodeSchema = new mongoose.Schema({
  // Reference to the partner who owns this code
  referralPartner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReferralPartner',
    required: true,
    index: true
  },

  // Unique referral code
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },

  // Code name/label for easy identification
  name: {
    type: String,
    trim: true,
    default: ''
  },

  // Commission rate for this specific code (% of order total)
  commissionRate: {
    type: Number,
    required: true,
    min: 0,
    max: 50,
    default: 5
  },

  // Discount rate for buyers using this code (% off order)
  buyerDiscountRate: {
    type: Number,
    required: true,
    min: 0,
    max: 30,
    default: 3
  },

  // Validity period
  validFrom: {
    type: Date,
    required: true,
    default: Date.now
  },

  validUntil: {
    type: Date,
    required: false,
    default: null // null = no expiration
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'active',
    index: true
  },

  // Usage limits (optional) - Total number of buyers who can register with this code
  maxUses: {
    type: Number,
    default: null // null = unlimited registrations
  },

  // Usage statistics
  stats: {
    totalUses: { type: Number, default: 0 },
    totalOrderValue: { type: Number, default: 0 },
    totalCommissionGenerated: { type: Number, default: 0 },
    totalDiscountGiven: { type: Number, default: 0 },
    uniqueBuyers: { type: Number, default: 0 }
  },

  // Admin notes
  notes: {
    type: String,
    default: ''
  },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },

  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
referralCodeSchema.index({ validFrom: 1, validUntil: 1 });
referralCodeSchema.index({ referralPartner: 1, status: 1 });
referralCodeSchema.index({ code: 1, status: 1 });

/**
 * Check if code is currently valid (within validity period and active)
 */
referralCodeSchema.methods.isValid = function() {
  const now = new Date();
  // If validUntil is null, code never expires
  const notExpired = this.validUntil === null || now <= this.validUntil;
  return (
    this.status === 'active' &&
    now >= this.validFrom &&
    notExpired
  );
};

/**
 * Check if code has reached usage limit
 * Note: null or 0 means unlimited uses
 */
referralCodeSchema.methods.hasReachedLimit = function() {
  // null or 0 means unlimited
  if (this.maxUses === null || this.maxUses === 0) return false;
  return this.stats.totalUses >= this.maxUses;
};

/**
 * Update code status based on validity period
 */
referralCodeSchema.methods.updateStatusFromValidity = async function() {
  const now = new Date();
  
  // Only expire if validUntil is set and has passed
  if (this.status === 'active' && this.validUntil && now > this.validUntil) {
    this.status = 'expired';
    await this.save();
  }
  
  return this.status;
};

/**
 * Update usage statistics
 */
referralCodeSchema.methods.updateStats = async function(orderTotal, commissionAmount, discountAmount, isNewBuyer = false) {
  this.stats.totalUses += 1;
  this.stats.totalOrderValue += orderTotal;
  this.stats.totalCommissionGenerated += commissionAmount;
  this.stats.totalDiscountGiven += discountAmount;
  
  if (isNewBuyer) {
    this.stats.uniqueBuyers += 1;
  }
  
  await this.save();
};

/**
 * Static: Generate unique referral code
 */
referralCodeSchema.statics.generateCode = async function(prefix = '') {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  let exists = true;
  
  while (exists) {
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    code = prefix ? `${prefix.toUpperCase()}-${randomPart}` : randomPart;
    exists = await this.findOne({ code });
  }
  
  return code;
};

/**
 * Static: Find valid code by code string
 */
referralCodeSchema.statics.findValidCode = async function(codeString) {
  const now = new Date();
  
  // Find code that is active, has started, and either has no expiration or hasn't expired
  const code = await this.findOne({
    code: codeString.toUpperCase().trim(),
    status: 'active',
    validFrom: { $lte: now },
    $or: [
      { validUntil: null },
      { validUntil: { $gte: now } }
    ]
  }).populate('referralPartner', 'firstName lastName email status');
  
  if (!code) return null;
  
  // Check if partner is still active
  if (!code.referralPartner || code.referralPartner.status !== 'active') {
    return null;
  }
  
  // Check usage limit
  if (code.hasReachedLimit()) {
    return null;
  }
  
  return code;
};

/**
 * Static: Get all codes for a partner
 */
referralCodeSchema.statics.getPartnerCodes = async function(partnerId, includeExpired = false) {
  const query = { referralPartner: partnerId };
  
  if (!includeExpired) {
    query.status = { $ne: 'expired' };
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

/**
 * Static: Update expired codes (run periodically)
 */
referralCodeSchema.statics.updateExpiredCodes = async function() {
  const now = new Date();
  
  // Only update codes that have a validUntil date and it has passed
  const result = await this.updateMany(
    {
      status: 'active',
      validUntil: { $ne: null, $lt: now }
    },
    {
      $set: { status: 'expired' }
    }
  );
  
  return result.modifiedCount;
};

/**
 * Static: Get codes expiring soon (for notifications)
 */
referralCodeSchema.statics.getExpiringCodes = async function(daysAhead = 7) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  
  return this.find({
    status: 'active',
    validUntil: { $gte: now, $lte: futureDate }
  }).populate('referralPartner', 'firstName lastName email');
};

// Virtual for remaining validity days
referralCodeSchema.virtual('remainingDays').get(function() {
  // If no expiration date, return null or very large number
  if (!this.validUntil) return null;
  const now = new Date();
  if (now > this.validUntil) return 0;
  return Math.ceil((this.validUntil - now) / (1000 * 60 * 60 * 24));
});

// Virtual for validity status text
referralCodeSchema.virtual('validityStatus').get(function() {
  const now = new Date();
  if (now < this.validFrom) return 'upcoming';
  // If no expiration date, it's active (never expires)
  if (!this.validUntil) return 'active';
  if (now > this.validUntil) return 'expired';
  return 'active';
});

// Enable virtuals in JSON
referralCodeSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

const ReferralCode = mongoose.model('ReferralCode', referralCodeSchema);

module.exports = ReferralCode;
