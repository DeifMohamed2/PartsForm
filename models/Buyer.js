const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');

// Address subdocument schema
const addressSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: [true, 'Address label is required'],
      trim: true,
      maxlength: [50, 'Label cannot exceed 50 characters'],
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters'],
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      maxlength: [100, 'State cannot exceed 100 characters'],
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      maxlength: [100, 'Country cannot exceed 100 characters'],
    },
    postalCode: {
      type: String,
      trim: true,
      maxlength: [20, 'Postal code cannot exceed 20 characters'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const buyerSchema = new mongoose.Schema(
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
      validate: {
        validator: function (value) {
          // Allow various phone formats with country codes
          return /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/.test(value.replace(/\s/g, ''));
        },
        message: 'Please provide a valid phone number',
      },
    },

    // Company Information
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      minlength: [2, 'Company name must be at least 2 characters'],
      maxlength: [100, 'Company name cannot exceed 100 characters'],
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      uppercase: true,
      minlength: [2, 'Country code must be 2 characters'],
      maxlength: [2, 'Country code must be 2 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      minlength: [2, 'City must be at least 2 characters'],
      maxlength: [100, 'City cannot exceed 100 characters'],
    },
    shippingAddress: {
      type: String,
      required: [true, 'Shipping address is required'],
      trim: true,
      minlength: [10, 'Shipping address must be at least 10 characters'],
      maxlength: [500, 'Shipping address cannot exceed 500 characters'],
    },

    // Delivery Addresses
    addresses: [addressSchema],

    // Security
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't include password in queries by default
    },

    // Preferences
    newsletter: {
      type: Boolean,
      default: false,
    },

    // Profile Image
    avatar: {
      type: String,
      default: null, // URL path to profile image
    },

    // Account Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
    },
    verificationExpires: {
      type: Date,
      select: false,
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

    // Timestamps for terms acceptance
    termsAcceptedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for better query performance
buyerSchema.index({ companyName: 1 });
buyerSchema.index({ country: 1 });
buyerSchema.index({ createdAt: -1 });

// Virtual for full name
buyerSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
buyerSchema.pre('save', async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return;

  // Generate salt and hash password
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
buyerSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
buyerSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Method to increment login attempts
buyerSchema.methods.incrementLoginAttempts = async function () {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }

  return await this.updateOne(updates);
};

// Method to reset login attempts on successful login
buyerSchema.methods.resetLoginAttempts = async function () {
  return await this.updateOne({
    $set: { loginAttempts: 0, lastLogin: Date.now() },
    $unset: { lockUntil: 1 },
  });
};

// Static method to find by email with password
buyerSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email }).select('+password');
};

const Buyer = mongoose.model('Buyer', buyerSchema);

module.exports = Buyer;
