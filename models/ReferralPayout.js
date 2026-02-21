const mongoose = require('mongoose');

/**
 * Referral Payout Schema
 * Tracks monthly payout batches to referral partners
 * Used for accounting and payment tracking
 */
const referralPayoutSchema = new mongoose.Schema(
  {
    // Payout Reference Number
    payoutNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Period Information
    periodMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    periodYear: {
      type: Number,
      required: true,
    },

    // Reference to Referral Partner
    referralPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReferralPartner',
      required: true,
      index: true,
    },

    // Financial Summary
    totalCommissions: {
      type: Number,
      required: true,
      default: 0,
    },
    approvedCommissions: {
      type: Number,
      required: true,
      default: 0,
    },
    rejectedCommissions: {
      type: Number,
      required: true,
      default: 0,
    },
    payoutAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'AED',
      uppercase: true,
    },

    // Commission Details
    commissions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReferralCommission',
    }],
    commissionsCount: {
      type: Number,
      default: 0,
    },

    // Payout Status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // Payment Details
    paymentMethod: {
      type: String,
      enum: ['bank', 'paypal', 'other'],
    },
    paymentReference: {
      type: String,
      trim: true,
    },
    paymentDate: {
      type: Date,
    },
    paymentNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Payment notes cannot exceed 1000 characters'],
    },

    // Bank Transfer Details (if applicable)
    bankTransfer: {
      bankName: String,
      accountName: String,
      accountNumber: String,
      iban: String,
      swiftCode: String,
      transactionId: String,
    },

    // Processing Information
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    processedAt: {
      type: Date,
    },

    // Admin Notes
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Admin notes cannot exceed 2000 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Generate payout number
referralPayoutSchema.statics.generatePayoutNumber = async function () {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Count existing payouts for this month
  const count = await this.countDocuments({
    createdAt: {
      $gte: new Date(year, now.getMonth(), 1),
      $lt: new Date(year, now.getMonth() + 1, 1),
    },
  });

  return `PAY-${year}${month}-${String(count + 1).padStart(4, '0')}`;
};

// Create payout batch for approved commissions
referralPayoutSchema.statics.createPayoutBatch = async function (partnerId, month, year, adminId) {
  const ReferralCommission = mongoose.model('ReferralCommission');
  const ReferralPartner = mongoose.model('ReferralPartner');

  // Get all approved commissions for this partner and period
  const commissions = await ReferralCommission.find({
    referralPartner: partnerId,
    periodMonth: month,
    periodYear: year,
    status: 'approved',
    payoutBatch: { $exists: false },
  });

  if (commissions.length === 0) {
    return null;
  }

  const partner = await ReferralPartner.findById(partnerId);
  if (!partner) {
    throw new Error('Referral partner not found');
  }

  // Calculate totals
  const payoutAmount = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const commissionIds = commissions.map(c => c._id);

  // Create payout record
  const payoutNumber = await this.generatePayoutNumber();
  
  const payout = new this({
    payoutNumber,
    periodMonth: month,
    periodYear: year,
    referralPartner: partnerId,
    totalCommissions: commissions.length,
    approvedCommissions: commissions.length,
    rejectedCommissions: 0,
    payoutAmount,
    currency: commissions[0]?.currency || 'AED',
    commissions: commissionIds,
    commissionsCount: commissions.length,
    paymentMethod: partner.paymentDetails?.preferredMethod || 'bank',
    processedBy: adminId,
  });

  await payout.save();

  // Update commissions with payout reference
  await ReferralCommission.updateMany(
    { _id: { $in: commissionIds } },
    { $set: { payoutBatch: payout._id } }
  );

  return payout;
};

// Mark payout as completed
referralPayoutSchema.methods.markAsCompleted = async function (paymentReference, paymentNotes, adminId) {
  const ReferralCommission = mongoose.model('ReferralCommission');

  this.status = 'completed';
  this.paymentReference = paymentReference;
  this.paymentNotes = paymentNotes;
  this.paymentDate = new Date();
  this.processedBy = adminId;
  this.processedAt = new Date();

  await this.save();

  // Update all commissions to paid
  await ReferralCommission.updateMany(
    { payoutBatch: this._id },
    { 
      $set: { 
        status: 'paid',
        paidAt: new Date(),
      } 
    }
  );

  // Update partner stats
  const ReferralPartner = mongoose.model('ReferralPartner');
  const partner = await ReferralPartner.findById(this.referralPartner);
  if (partner) {
    await partner.updateStats();
  }

  return this;
};

// Get monthly payout summary
referralPayoutSchema.statics.getMonthlySummary = async function (month, year) {
  return this.aggregate([
    {
      $match: {
        periodMonth: month,
        periodYear: year,
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$payoutAmount' },
      },
    },
  ]);
};

// Indexes
// Note: payoutNumber index is already created by unique: true
// Note: status index is already created by index: true in schema field
referralPayoutSchema.index({ referralPartner: 1, periodMonth: 1, periodYear: 1 });
referralPayoutSchema.index({ createdAt: -1 });

const ReferralPayout = mongoose.model('ReferralPayout', referralPayoutSchema);

module.exports = ReferralPayout;
