const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');

/**
 * Supplier Model
 * Represents suppliers who can upload and manage their parts data
 * Multi-tenant: Each supplier sees only their own data
 */
const supplierSchema = new mongoose.Schema(
  {
    // Company Information
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },
    companyCode: {
      type: String,
      required: [true, 'Company code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [2, 'Company code must be at least 2 characters'],
      maxlength: [20, 'Company code cannot exceed 20 characters'],
      match: [/^[A-Z0-9_-]+$/, 'Company code can only contain letters, numbers, underscores, and hyphens'],
    },
    
    // Contact Person
    contactName: {
      type: String,
      required: [true, 'Contact name is required'],
      trim: true,
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
      trim: true,
    },
    
    // Address
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      postalCode: { type: String, trim: true },
    },
    
    // Authentication
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    
    // Role and Permissions
    role: {
      type: String,
      enum: ['supplier_admin', 'supplier_editor', 'supplier_viewer'],
      default: 'supplier_admin',
    },
    permissions: {
      type: [String],
      enum: [
        'read_data',           // View data
        'write_data',          // Create/edit data
        'delete_data',         // Delete data
        'import_data',         // Import from files
        'export_data',         // Export to files
        'manage_tables',       // Create/manage table schemas
        'manage_users',        // Invite/manage team members
        'manage_sftp',         // Configure SFTP settings
        'view_audit_logs',     // View audit history
      ],
      default: ['read_data', 'write_data', 'import_data', 'export_data'],
    },
    
    // Parent supplier (for team members)
    parentSupplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    
    // SFTP Configuration (per supplier)
    sftpConfig: {
      enabled: { type: Boolean, default: false },
      host: { type: String, trim: true },
      port: { type: Number, default: 22 },
      username: { type: String, trim: true },
      password: { type: String, select: false },
      privateKey: { type: String, select: false },
      remotePath: { type: String, default: '/', trim: true },
      exportSchedule: {
        enabled: { type: Boolean, default: false },
        cronExpression: { type: String, default: '0 2 * * *' }, // Daily at 2 AM
        lastExport: { type: Date },
        nextExport: { type: Date },
      },
    },
    
    // Data Quotas
    quotas: {
      maxTables: { type: Number, default: 10 },
      maxRecordsPerTable: { type: Number, default: 100000 },
      maxStorageBytes: { type: Number, default: 1073741824 }, // 1GB
      currentStorageBytes: { type: Number, default: 0 },
    },
    
    // Account Status
    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: { type: Date },
    
    // Verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    
    // Password Reset
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordChangedAt: { type: Date },
    
    // Login Tracking
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    
    // API Access
    apiKey: { type: String, unique: true, sparse: true, select: false },
    apiKeyCreatedAt: { type: Date },
    apiRateLimit: { type: Number, default: 1000 }, // requests per hour
    
    // Settings
    settings: {
      timezone: { type: String, default: 'UTC' },
      dateFormat: { type: String, default: 'YYYY-MM-DD' },
      numberFormat: { type: String, default: 'en-US' },
      defaultCurrency: { type: String, default: 'USD' },
      notifications: {
        emailOnImport: { type: Boolean, default: true },
        emailOnExport: { type: Boolean, default: true },
        emailOnError: { type: Boolean, default: true },
      },
    },
    
    // FTP Access (for data uploads via FTP)
    ftpAccess: {
      enabled: { type: Boolean, default: false },
      username: { type: String, trim: true },
      password: { type: String, select: false },
      directory: { type: String, default: '/suppliers' },
      lastAccess: { type: Date },
      createdAt: { type: Date },
    },
    
    // Force password change on first login
    mustChangePassword: { type: Boolean, default: false },
    
    // Notes (admin only)
    adminNotes: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.apiKey;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
supplierSchema.index({ companyName: 'text', contactName: 'text' });
supplierSchema.index({ isActive: 1, isApproved: 1 });
supplierSchema.index({ parentSupplier: 1 });
supplierSchema.index({ 'sftpConfig.exportSchedule.nextExport': 1 });

// Virtual for full display name
supplierSchema.virtual('displayName').get(function () {
  return `${this.companyName} (${this.companyCode})`;
});

// Virtual to check if this is a team member
supplierSchema.virtual('isTeamMember').get(function () {
  return !!this.parentSupplier;
});

// Pre-save middleware to hash password and FTP password
supplierSchema.pre('save', async function () {
  // Hash main password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    if (!this.isNew) {
      this.passwordChangedAt = new Date();
    }
  }
  
  // Hash FTP password if modified (using SHA-256 for FTP library compatibility)
  if (this.isModified('ftpAccess.password') && this.ftpAccess?.password) {
    const crypto = require('crypto');
    // Only hash if the password isn't already a 64-char hex string (already hashed)
    if (this.ftpAccess.password.length !== 64) {
      this.ftpAccess.password = crypto
        .createHash('sha256')
        .update(this.ftpAccess.password)
        .digest('hex');
    }
  }
});

// Method to compare password
supplierSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
supplierSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Method to generate API key
supplierSchema.methods.generateApiKey = function () {
  const crypto = require('crypto');
  this.apiKey = 'sk_' + crypto.randomBytes(32).toString('hex');
  this.apiKeyCreatedAt = new Date();
  return this.apiKey;
};

// Method to check permission
supplierSchema.methods.hasPermission = function (permission) {
  if (this.role === 'supplier_admin') return true;
  return this.permissions.includes(permission);
};

// Method to get effective supplier ID (parent or self)
supplierSchema.methods.getEffectiveSupplierId = function () {
  return this.parentSupplier || this._id;
};

// Static method to find by API key
supplierSchema.statics.findByApiKey = async function (apiKey) {
  return this.findOne({ apiKey, isActive: true, isApproved: true }).select('+apiKey');
};

const Supplier = mongoose.model('Supplier', supplierSchema);

module.exports = Supplier;
