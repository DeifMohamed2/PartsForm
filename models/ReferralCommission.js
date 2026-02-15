const mongoose = require('mongoose');

/**
 * Referral Commission Schema
 * Tracks individual commissions earned from referral purchases
 * Used for monthly payout calculations and admin review
 */
const referralCommissionSchema = new mongoose.Schema(
  {
    // Reference to Referral Partner
    referralPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReferralPartner',
      required: true,
      index: true,
    },

    // Reference to Order
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true, // One commission per order
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
    },

    // Reference to Buyer who used the code
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer',
      required: true,
    },
    buyerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    buyerName: {
      type: String,
      trim: true,
    },

    // Financial Details
    orderTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    orderSubtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    commissionRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    commissionAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    buyerDiscountRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    buyerDiscountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'AED',
      uppercase: true,
    },

    // Referral Code Used
    referralCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    // Reference to the ReferralCode document (for validity tracking)
    referralCodeRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReferralCode',
    },

    // Commission Status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'paid', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // Review Information
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Review notes cannot exceed 1000 characters'],
    },

    // Rejection/Cancellation Reason
    rejectionReason: {
      type: String,
      enum: [
        'fraudulent_activity',
        'self_referral',
        'duplicate_account',
        'order_cancelled',
        'order_refunded',
        'invalid_order',
        'policy_violation',
        'other',
      ],
    },
    rejectionDetails: {
      type: String,
      trim: true,
    },

    // Payout Information
    payoutBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReferralPayout',
    },
    paidAt: {
      type: Date,
    },

    // Month/Year for reporting (calculated from order date)
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

    // Order completion tracking
    orderStatus: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'],
      default: 'pending',
    },
    orderCompletedAt: {
      type: Date,
    },

    // Fraud Detection Flags
    flags: {
      isSuspicious: {
        type: Boolean,
        default: false,
      },
      suspicionReasons: [{
        type: String,
        enum: [
          'same_ip_address',
          'same_device',
          'similar_email_pattern',
          'rapid_referrals',
          'same_payment_method',
          'unusual_location',
          'high_value_first_order',
        ],
      }],
      ipAddress: String,
      deviceFingerprint: String,
      checkTimestamp: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Static method to create commission from order
// Now accepts referralCodeDoc (ReferralCode document) for specific code rates
referralCommissionSchema.statics.createFromOrder = async function (order, referralPartner, buyer, referralCodeDoc = null) {
  const now = new Date();
  
  // Calculate commission based on order subtotal (before fees/shipping)
  const orderSubtotal = order.pricing.subtotal || 0;
  const orderTotal = order.pricing.total || 0;
  
  // Use rates from ReferralCode if provided, otherwise fall back to partner defaults
  const commissionRate = referralCodeDoc ? referralCodeDoc.commissionRate : referralPartner.commissionRate;
  const buyerDiscountRate = referralCodeDoc ? referralCodeDoc.buyerDiscountRate : referralPartner.buyerDiscountRate;
  const codeString = referralCodeDoc ? referralCodeDoc.code : 'UNKNOWN';
  
  const commissionAmount = (orderSubtotal * commissionRate) / 100;
  const buyerDiscountAmount = (orderSubtotal * buyerDiscountRate) / 100;

  const commission = new this({
    referralPartner: referralPartner._id,
    order: order._id,
    orderNumber: order.orderNumber,
    buyer: buyer._id,
    buyerEmail: buyer.email,
    buyerName: `${buyer.firstName} ${buyer.lastName}`,
    orderTotal: orderTotal,
    orderSubtotal: orderSubtotal,
    commissionRate: commissionRate,
    commissionAmount: commissionAmount,
    buyerDiscountRate: buyerDiscountRate,
    buyerDiscountAmount: buyerDiscountAmount,
    currency: order.pricing.currency || 'AED',
    referralCode: codeString,
    referralCodeRef: referralCodeDoc ? referralCodeDoc._id : null,
    status: 'pending',
    orderStatus: order.status,
    periodMonth: now.getMonth() + 1, // 1-12
    periodYear: now.getFullYear(),
  });

  await commission.save();
  
  // Update code statistics if referralCodeDoc provided
  if (referralCodeDoc && referralCodeDoc.updateStats) {
    await referralCodeDoc.updateStats(orderSubtotal, commissionAmount);
  }
  
  return commission;
};

// Get monthly summary for a partner
referralCommissionSchema.statics.getMonthlySummary = async function (partnerId, month, year) {
  return this.aggregate([
    {
      $match: {
        referralPartner: new mongoose.Types.ObjectId(partnerId),
        periodMonth: month,
        periodYear: year,
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalCommission: { $sum: '$commissionAmount' },
        totalOrderValue: { $sum: '$orderTotal' },
      },
    },
  ]);
};

// Get all pending commissions for a month (for admin review)
referralCommissionSchema.statics.getPendingForMonth = async function (month, year) {
  return this.find({
    periodMonth: month,
    periodYear: year,
    status: 'pending',
  })
    .populate('referralPartner', 'firstName lastName email referralCode')
    .populate('buyer', 'firstName lastName email companyName')
    .populate('order', 'orderNumber status pricing')
    .sort({ createdAt: -1 });
};

// Bulk approve commissions
referralCommissionSchema.statics.bulkApprove = async function (commissionIds, adminId, notes) {
  return this.updateMany(
    { _id: { $in: commissionIds }, status: 'pending' },
    {
      $set: {
        status: 'approved',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNotes: notes || 'Bulk approved',
      },
    }
  );
};

// Bulk reject commissions
referralCommissionSchema.statics.bulkReject = async function (commissionIds, adminId, reason, details) {
  return this.updateMany(
    { _id: { $in: commissionIds }, status: 'pending' },
    {
      $set: {
        status: 'rejected',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: reason,
        rejectionDetails: details,
      },
    }
  );
};

// Update commission status when order status changes
// Auto-approves commission when order is completed/delivered
referralCommissionSchema.statics.updateOrderStatus = async function (orderId, newStatus, autoApprove = true) {
  const commission = await this.findOne({ order: orderId });
  
  if (!commission) return null;

  commission.orderStatus = newStatus;
  
  // Auto-cancel commission if order is cancelled
  if (newStatus === 'cancelled' && commission.status === 'pending') {
    commission.status = 'cancelled';
    commission.rejectionReason = 'order_cancelled';
    commission.rejectionDetails = 'Order was cancelled by buyer or admin';
  }
  
  // Auto-approve commission when order is confirmed (completed/delivered)
  // This implements the requirement: commission only on confirmed orders
  if ((newStatus === 'completed' || newStatus === 'delivered') && commission.status === 'pending') {
    commission.orderCompletedAt = new Date();
    
    if (autoApprove) {
      commission.status = 'approved';
      commission.reviewedAt = new Date();
      commission.reviewNotes = `Auto-approved: Order ${newStatus}`;
    }
  }

  await commission.save();
  return commission;
};

// Indexes for efficient queries
referralCommissionSchema.index({ referralPartner: 1, periodMonth: 1, periodYear: 1 });
referralCommissionSchema.index({ status: 1, periodMonth: 1, periodYear: 1 });
referralCommissionSchema.index({ order: 1 });
referralCommissionSchema.index({ buyer: 1 });
referralCommissionSchema.index({ orderNumber: 1 });
referralCommissionSchema.index({ createdAt: -1 });

const ReferralCommission = mongoose.model('ReferralCommission', referralCommissionSchema);

module.exports = ReferralCommission;
