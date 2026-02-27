/**
 * Supplier Authentication Controller
 * Handles supplier login, profile management, and team operations
 * NOTE: Supplier accounts are created ONLY by admins - no self-registration
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Supplier = require('../models/Supplier');
const DataTable = require('../models/DataTable');
const DataRecord = require('../models/DataRecord');
const AuditLog = require('../models/AuditLog');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for supplier
 */
const generateToken = (supplier) => {
  return jwt.sign(
    {
      id: supplier._id,
      role: 'supplier',
      supplierRole: supplier.role,
      companyCode: supplier.companyCode,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Supplier login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find supplier with password
    const supplier = await Supplier.findOne({ email: email.toLowerCase() }).select('+password');

    if (!supplier) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if account is locked
    if (supplier.isLocked()) {
      const lockRemaining = Math.ceil((supplier.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked. Try again in ${lockRemaining} minutes.`,
      });
    }

    // Verify password
    const isValidPassword = await supplier.comparePassword(password);

    if (!isValidPassword) {
      // Increment login attempts
      supplier.loginAttempts += 1;
      
      // Lock account after 5 failed attempts
      if (supplier.loginAttempts >= 5) {
        supplier.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      }
      
      await supplier.save();

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        attemptsRemaining: Math.max(0, 5 - supplier.loginAttempts),
      });
    }

    // Check if account is active (admin-created accounts are pre-approved)
    if (!supplier.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact your administrator.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Check if this is first login (password needs to be changed)
    if (supplier.mustChangePassword) {
      // Generate a temporary token for password change
      const tempToken = jwt.sign(
        { id: supplier._id, mustChangePassword: true },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      return res.status(200).json({
        success: true,
        requirePasswordChange: true,
        message: 'Please change your password to continue',
        tempToken,
      });
    }

    // Reset login attempts and update last login
    supplier.loginAttempts = 0;
    supplier.lockUntil = undefined;
    supplier.lastLogin = new Date();
    await supplier.save();

    // Generate token
    const token = generateToken(supplier);

    // Set cookie
    res.cookie('supplierToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Audit log
    await AuditLog.log({
      actor: { type: 'supplier', id: supplier._id, name: supplier.contactName, email: supplier.email },
      action: 'supplier.login',
      resource: { type: 'supplier', id: supplier._id, name: supplier.companyName },
      supplier: supplier._id,
      status: 'success',
      request: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      supplier: {
        id: supplier._id,
        companyName: supplier.companyName,
        companyCode: supplier.companyCode,
        contactName: supplier.contactName,
        email: supplier.email,
        role: supplier.role,
        permissions: supplier.permissions,
      },
    });
  } catch (error) {
    logger.error('Supplier login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
    });
  }
};

/**
 * Logout
 */
const logout = async (req, res) => {
  try {
    // Audit log
    await AuditLog.log({
      actor: { type: 'supplier', id: req.supplier._id, name: req.supplier.contactName },
      action: 'supplier.logout',
      supplier: req.supplier._id,
      status: 'success',
    });

    res.cookie('supplierToken', '', {
      expires: new Date(0),
      httpOnly: true,
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
};

/**
 * Verify email
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const supplier = await Supplier.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken');

    if (!supplier) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification link',
      });
    }

    supplier.isEmailVerified = true;
    supplier.emailVerificationToken = undefined;
    supplier.emailVerificationExpires = undefined;
    await supplier.save();

    res.json({
      success: true,
      message: 'Email verified successfully. Your account is now pending admin approval.',
    });
  } catch (error) {
    logger.error('Email verification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Email verification failed',
    });
  }
};

/**
 * Forgot password - send reset link
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const supplier = await Supplier.findOne({ email: email.toLowerCase() });

    if (!supplier) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    supplier.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    supplier.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await supplier.save();

    // TODO: Send email with reset link
    logger.info(`Password reset token for ${email}: ${resetToken}`);

    res.json({
      success: true,
      message: 'If an account exists with this email, a reset link has been sent.',
    });
  } catch (error) {
    logger.error('Forgot password error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to process request',
    });
  }
};

/**
 * Reset password with token
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const supplier = await Supplier.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken');

    if (!supplier) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    supplier.password = password;
    supplier.passwordResetToken = undefined;
    supplier.passwordResetExpires = undefined;
    supplier.loginAttempts = 0;
    supplier.lockUntil = undefined;
    await supplier.save();

    // Audit log
    await AuditLog.log({
      actor: { type: 'supplier', id: supplier._id, name: supplier.contactName },
      action: 'supplier.password_change',
      supplier: supplier._id,
      status: 'success',
    });

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });
  } catch (error) {
    logger.error('Reset password error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
    });
  }
};

/**
 * Get current profile
 */
const getProfile = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.supplier._id);

    res.json({
      success: true,
      supplier: {
        id: supplier._id,
        companyName: supplier.companyName,
        companyCode: supplier.companyCode,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        role: supplier.role,
        permissions: supplier.permissions,
        isTeamMember: supplier.isTeamMember,
        sftpConfig: {
          enabled: supplier.sftpConfig?.enabled,
          host: supplier.sftpConfig?.host,
          remotePath: supplier.sftpConfig?.remotePath,
          exportSchedule: supplier.sftpConfig?.exportSchedule,
        },
        quotas: supplier.quotas,
        settings: supplier.settings,
        lastLogin: supplier.lastLogin,
        createdAt: supplier.createdAt,
      },
    });
  } catch (error) {
    logger.error('Get profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
    });
  }
};

/**
 * Update profile
 */
const updateProfile = async (req, res) => {
  try {
    const { contactName, phone, address, settings } = req.body;

    const supplier = await Supplier.findById(req.supplier._id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    if (contactName) supplier.contactName = contactName;
    if (phone !== undefined) supplier.phone = phone;
    if (address) supplier.address = { ...supplier.address, ...address };
    if (settings) supplier.settings = { ...supplier.settings, ...settings };

    await supplier.save();

    // Audit log
    await AuditLog.log({
      actor: { type: 'supplier', id: supplier._id, name: supplier.contactName },
      action: 'supplier.settings_update',
      supplier: supplier._id,
      status: 'success',
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      supplier: {
        contactName: supplier.contactName,
        phone: supplier.phone,
        address: supplier.address,
        settings: supplier.settings,
      },
    });
  } catch (error) {
    logger.error('Update profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};

/**
 * Change password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new passwords are required',
      });
    }

    const supplier = await Supplier.findById(req.supplier._id).select('+password');

    const isValid = await supplier.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    supplier.password = newPassword;
    await supplier.save();

    // Audit log
    await AuditLog.log({
      actor: { type: 'supplier', id: supplier._id, name: supplier.contactName },
      action: 'supplier.password_change',
      supplier: supplier._id,
      status: 'success',
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Change password error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
    });
  }
};

/**
 * First login password change (uses temp token from login)
 * This handles the case where admin created the account with a temporary password
 */
const firstLoginChangePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required',
      });
    }

    // Validate password requirements
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    // The tempToken was verified by middleware, supplier is attached
    const supplier = await Supplier.findById(req.supplier._id).select('+password');

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    if (!supplier.mustChangePassword) {
      return res.status(400).json({
        success: false,
        message: 'Password change not required',
      });
    }

    // Update password and clear the flag
    supplier.password = newPassword;
    supplier.mustChangePassword = false;
    supplier.loginAttempts = 0;
    supplier.lockUntil = undefined;
    supplier.lastLogin = new Date();
    await supplier.save();

    // Generate a full token for the user
    const token = generateToken(supplier);

    // Set cookie
    res.cookie('supplierToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Audit log
    await AuditLog.log({
      actor: { type: 'supplier', id: supplier._id, name: supplier.contactName },
      action: 'supplier.first_login_password_change',
      supplier: supplier._id,
      status: 'success',
      request: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
      token,
      supplier: {
        id: supplier._id,
        companyName: supplier.companyName,
        companyCode: supplier.companyCode,
        contactName: supplier.contactName,
        email: supplier.email,
        role: supplier.role,
        permissions: supplier.permissions,
      },
    });
  } catch (error) {
    logger.error('First login password change error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
    });
  }
};

/**
 * Generate API key
 */
const generateApiKey = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.supplier.getEffectiveSupplierId());
    
    const apiKey = supplier.generateApiKey();
    await supplier.save();

    // Audit log
    await AuditLog.log({
      actor: { type: 'supplier', id: req.supplier._id, name: req.supplier.contactName },
      action: 'supplier.api_key_generate',
      supplier: supplier._id,
      status: 'success',
    });

    res.json({
      success: true,
      message: 'API key generated. Store it securely - you won\'t be able to see it again.',
      apiKey, // Only show once
    });
  } catch (error) {
    logger.error('Generate API key error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to generate API key',
    });
  }
};

/**
 * Revoke API key
 */
const revokeApiKey = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.supplier.getEffectiveSupplierId());
    
    supplier.apiKey = undefined;
    supplier.apiKeyCreatedAt = undefined;
    await supplier.save();

    res.json({
      success: true,
      message: 'API key revoked',
    });
  } catch (error) {
    logger.error('Revoke API key error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke API key',
    });
  }
};

/**
 * Get dashboard data
 */
const getDashboard = async (req, res) => {
  try {
    const supplierId = req.supplier.getEffectiveSupplierId();

    const [tables, recordStats, recentActivity] = await Promise.all([
      // Get tables with record counts
      DataTable.find({ supplier: supplierId, status: 'active' })
        .select('name slug stats.recordCount stats.lastImportAt stats.lastExportAt')
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
      
      // Get total records
      DataRecord.countDocuments({ supplier: supplierId, status: 'active' }),

      // Get recent activity
      AuditLog.find({ supplier: supplierId })
        .select('action createdAt details.message status')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    // Get statistics
    const supplier = await Supplier.findById(supplierId);

    res.json({
      success: true,
      dashboard: {
        tables: {
          count: tables.length,
          list: tables,
        },
        records: {
          total: recordStats,
        },
        quotas: supplier.quotas,
        sftpConfig: {
          enabled: supplier.sftpConfig?.enabled,
          lastExport: supplier.sftpConfig?.exportSchedule?.lastExport,
          nextExport: supplier.sftpConfig?.exportSchedule?.nextExport,
        },
        recentActivity,
      },
    });
  } catch (error) {
    logger.error('Get dashboard error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data',
    });
  }
};

// ==================== TEAM MANAGEMENT ====================

/**
 * Get team members
 */
const getTeamMembers = async (req, res) => {
  try {
    const supplierId = req.supplier.getEffectiveSupplierId();

    // Only parent supplier (admin) can manage team
    if (req.supplier.parentSupplier) {
      return res.status(403).json({
        success: false,
        message: 'Only the primary account can manage team members',
      });
    }

    const members = await Supplier.find({ parentSupplier: supplierId })
      .select('contactName email role permissions isActive lastLogin createdAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      members,
      count: members.length,
    });
  } catch (error) {
    logger.error('Get team members error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get team members',
    });
  }
};

/**
 * Invite team member
 */
const inviteTeamMember = async (req, res) => {
  try {
    const { contactName, email, role, permissions } = req.body;

    if (!contactName || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required',
      });
    }

    const supplierId = req.supplier.getEffectiveSupplierId();
    const parentSupplier = await Supplier.findById(supplierId);

    // Check if email already exists
    const existing = await Supplier.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(12).toString('hex');

    const member = new Supplier({
      companyName: parentSupplier.companyName,
      companyCode: `${parentSupplier.companyCode}_${Date.now()}`,
      contactName,
      email: email.toLowerCase(),
      password: tempPassword,
      role: role || 'supplier_editor',
      permissions: permissions || ['read_data', 'write_data'],
      parentSupplier: supplierId,
      isEmailVerified: true, // Team members don't need email verification
      isApproved: true, // Auto-approved since parent is approved
      isActive: true,
    });

    await member.save();

    // TODO: Send invitation email with temp password
    logger.info(`Team member invited: ${email}, temp password: ${tempPassword}`);

    // Audit log
    await AuditLog.log({
      actor: { type: 'supplier', id: req.supplier._id, name: req.supplier.contactName },
      action: 'supplier.team_member_add',
      resource: { type: 'supplier', id: member._id, name: contactName },
      supplier: supplierId,
      status: 'success',
    });

    res.status(201).json({
      success: true,
      message: 'Team member invited successfully',
      member: {
        id: member._id,
        contactName: member.contactName,
        email: member.email,
        role: member.role,
        permissions: member.permissions,
      },
    });
  } catch (error) {
    logger.error('Invite team member error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to invite team member',
    });
  }
};

/**
 * Update team member
 */
const updateTeamMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { role, permissions, isActive } = req.body;

    const supplierId = req.supplier.getEffectiveSupplierId();

    const member = await Supplier.findOne({
      _id: memberId,
      parentSupplier: supplierId,
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }

    if (role) member.role = role;
    if (permissions) member.permissions = permissions;
    if (isActive !== undefined) member.isActive = isActive;

    await member.save();

    res.json({
      success: true,
      message: 'Team member updated',
      member: {
        id: member._id,
        contactName: member.contactName,
        email: member.email,
        role: member.role,
        permissions: member.permissions,
        isActive: member.isActive,
      },
    });
  } catch (error) {
    logger.error('Update team member error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update team member',
    });
  }
};

/**
 * Remove team member
 */
const removeTeamMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const supplierId = req.supplier.getEffectiveSupplierId();

    const member = await Supplier.findOne({
      _id: memberId,
      parentSupplier: supplierId,
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found',
      });
    }

    await member.deleteOne();

    // Audit log
    await AuditLog.log({
      actor: { type: 'supplier', id: req.supplier._id, name: req.supplier.contactName },
      action: 'supplier.team_member_remove',
      resource: { type: 'supplier', id: member._id, name: member.contactName },
      supplier: supplierId,
      status: 'success',
    });

    res.json({
      success: true,
      message: 'Team member removed',
    });
  } catch (error) {
    logger.error('Remove team member error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to remove team member',
    });
  }
};

module.exports = {
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
  firstLoginChangePassword,
  generateApiKey,
  revokeApiKey,
  getDashboard,
  getTeamMembers,
  inviteTeamMember,
  updateTeamMember,
  removeTeamMember,
};
