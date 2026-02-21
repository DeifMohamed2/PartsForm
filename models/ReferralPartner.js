const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');
const crypto = require('crypto');

/**
 * Referral Partner Schema
 * Stores referral partner accounts created by Admin
 * Each partner has a unique referral code to track referrals
 */
const referralPartnerSchema = new mongoose.Schema(
  {
    // Personal Information
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => validator.isEmail(value),
        message: 'Please provide a valid email address',
      },
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },

    // Security - Password is NOT required for pending applications
    // Password is set by admin when approving the application
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },

    // Commission Settings
    commissionRate: {
      type: Number,
      required: true,
      min: [0, 'Commission rate cannot be negative'],
      max: [50, 'Commission rate cannot exceed 50%'],
      default: 5, // Default 5% commission
    },
    buyerDiscountRate: {
      type: Number,
      required: true,
      min: [0, 'Buyer discount rate cannot be negative'],
      max: [30, 'Buyer discount rate cannot exceed 30%'],
      default: 3, // Default 3% discount for buyers
    },

    // Bank/Payment Details for Payouts
    paymentDetails: {
      bankName: {
        type: String,
        trim: true,
      },
      accountName: {
        type: String,
        trim: true,
      },
      accountNumber: {
        type: String,
        trim: true,
      },
      iban: {
        type: String,
        trim: true,
        uppercase: true,
      },
      swiftCode: {
        type: String,
        trim: true,
        uppercase: true,
      },
      paypalEmail: {
        type: String,
        trim: true,
        lowercase: true,
      },
      preferredMethod: {
        type: String,
        enum: ['bank', 'paypal', 'other'],
        default: 'bank',
      },
      otherDetails: {
        type: String,
        trim: true,
      },
    },

    // Address Information
    address: {
      street: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
      },
      postalCode: {
        type: String,
        trim: true,
      },
    },

    // Statistics (updated by system)
    stats: {
      totalReferrals: {
        type: Number,
        default: 0,
      },
      successfulReferrals: {
        type: Number,
        default: 0,
      },
      pendingCommission: {
        type: Number,
        default: 0,
      },
      paidCommission: {
        type: Number,
        default: 0,
      },
      rejectedCommission: {
        type: Number,
        default: 0,
      },
      totalOrderValue: {
        type: Number,
        default: 0,
      },
    },

    // Account Status
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'pending'],
      default: 'active',
    },
    suspensionReason: {
      type: String,
      trim: true,
    },

    // Application Details (for self-registration)
    applicationDetails: {
      companyName: {
        type: String,
        trim: true,
      },
      website: {
        type: String,
        trim: true,
      },
      businessType: {
        type: String,
        enum: ['individual', 'company', 'agency', 'influencer', 'other'],
      },
      audienceSize: {
        type: String,
        enum: ['small', 'medium', 'large', 'enterprise'],
      },
      marketingChannels: [{
        type: String,
        enum: ['website', 'social_media', 'email', 'content', 'ppc', 'offline', 'other'],
      }],
      experience: {
        type: String,
        trim: true,
        maxlength: [2000, 'Experience description cannot exceed 2000 characters'],
      },
      motivation: {
        type: String,
        trim: true,
        maxlength: [2000, 'Motivation description cannot exceed 2000 characters'],
      },
      submittedAt: {
        type: Date,
      },
      reviewedAt: {
        type: Date,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
      },
      rejectionReason: {
        type: String,
        trim: true,
      },
    },

    // Password Reset
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
    },

    // Login Tracking
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },

    // Notes (Admin only)
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Admin notes cannot exceed 2000 characters'],
    },

    // Created by (Admin reference)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
referralPartnerSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password (only if password is provided)
referralPartnerSchema.pre('save', async function () {
  // Validation: active partners being created must have a password
  if (this.status === 'active' && !this.password && this.isNew) {
    throw new Error('Active partners must have a password');
  }

  // Skip password hashing if password is not modified or not set
  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = new Date();
});

// Compare password method
referralPartnerSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if password was changed after JWT was issued
referralPartnerSchema.methods.passwordChangedAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

// Generate password reset token
referralPartnerSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return resetToken;
};

// Check if account is locked
referralPartnerSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Increment login attempts
referralPartnerSchema.methods.incrementLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  } else {
    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= 5) {
      updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 }; // Lock for 30 minutes
    }
    await this.updateOne(updates);
  }
};

// Reset login attempts on successful login
referralPartnerSchema.methods.resetLoginAttempts = async function () {
  await this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 },
  });
};

// Update statistics
referralPartnerSchema.methods.updateStats = async function () {
  const ReferralCommission = mongoose.model('ReferralCommission');
  
  const stats = await ReferralCommission.aggregate([
    { $match: { referralPartner: this._id } },
    {
      $group: {
        _id: null,
        totalReferrals: { $sum: 1 },
        successfulReferrals: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
        },
        pendingCommission: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$commissionAmount', 0] },
        },
        paidCommission: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$commissionAmount', 0] },
        },
        rejectedCommission: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, '$commissionAmount', 0] },
        },
        totalOrderValue: { $sum: '$orderTotal' },
      },
    },
  ]);

  if (stats.length > 0) {
    this.stats = {
      totalReferrals: stats[0].totalReferrals || 0,
      successfulReferrals: stats[0].successfulReferrals || 0,
      pendingCommission: stats[0].pendingCommission || 0,
      paidCommission: stats[0].paidCommission || 0,
      rejectedCommission: stats[0].rejectedCommission || 0,
      totalOrderValue: stats[0].totalOrderValue || 0,
    };
  }
  
  await this.save();
};

// Indexes
// Note: email index is already created by unique: true
referralPartnerSchema.index({ createdAt: -1 });

const ReferralPartner = mongoose.model('ReferralPartner', referralPartnerSchema);

module.exports = ReferralPartner;
