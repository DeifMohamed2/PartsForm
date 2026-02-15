/**
 * Partner Portal Controller
 * Handles referral partner authentication and dashboard
 */

const jwt = require('jsonwebtoken');
const ReferralPartner = require('../models/ReferralPartner');
const ReferralCommission = require('../models/ReferralCommission');
const ReferralPayout = require('../models/ReferralPayout');
const ReferralCode = require('../models/ReferralCode');
const Order = require('../models/Order');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Get partner login page
 */
const getLoginPage = async (req, res) => {
  try {
    // Check if already logged in
    const token = req.cookies?.partner_token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'referral_partner') {
          return res.redirect('/partner/dashboard');
        }
      } catch (e) {
        // Token invalid, show login
      }
    }

    res.render('partner/login', {
      title: 'Partner Login | PARTSFORM',
      error: req.query.error || null
    });
  } catch (error) {
    console.error('Error in getLoginPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load login page'
    });
  }
};

/**
 * Process partner login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find partner
    const partner = await ReferralPartner.findOne({ 
      email: email.toLowerCase() 
    }).select('+password');

    if (!partner) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isMatch = await partner.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if active
    if (partner.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active. Please contact support.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: partner._id, 
        role: 'referral_partner',
        email: partner.email 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
    partner.lastLogin = new Date();
    await partner.save();

    // Set cookie
    res.cookie('partner_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      redirectUrl: '/partner/dashboard'
    });
  } catch (error) {
    console.error('Error in partner login:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

/**
 * Partner logout
 */
const logout = (req, res) => {
  res.cookie('partner_token', '', { 
    expires: new Date(0), 
    httpOnly: true 
  });
  res.redirect('/partner/login');
};

/**
 * Get partner dashboard
 */
const getDashboard = async (req, res) => {
  try {
    const partner = req.user;
    
    // Get current month/year
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get this month's stats
    const monthlyStats = await ReferralCommission.getMonthlySummary(
      partner._id,
      currentMonth,
      currentYear
    );

    // Get all-time stats
    const allTimeStats = await ReferralCommission.aggregate([
      { $match: { referralPartner: partner._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalEarnings: { $sum: '$commissionAmount' },
          pendingEarnings: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, '$commissionAmount', 0]
            }
          },
          approvedEarnings: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, '$commissionAmount', 0]
            }
          },
          paidEarnings: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, '$commissionAmount', 0]
            }
          }
        }
      }
    ]);

    // Get recent commissions
    const recentCommissions = await ReferralCommission.find({ referralPartner: partner._id })
      .populate('order', 'orderNumber pricing.total createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get pending payouts
    const pendingPayouts = await ReferralPayout.find({
      referralPartner: partner._id,
      status: 'pending'
    }).sort({ createdAt: -1 }).lean();

    // Get partner's referral codes (new system with validity periods)
    const partnerCodes = await ReferralCode.find({
      referralPartner: partner._id,
      status: { $in: ['active', 'inactive'] }
    }).sort({ createdAt: -1 }).lean();

    res.render('partner/dashboard', {
      title: 'Partner Dashboard | PARTSFORM',
      partner,
      monthlyStats,
      allTime: allTimeStats[0] || {
        totalOrders: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
        approvedEarnings: 0,
        paidEarnings: 0
      },
      recentCommissions,
      pendingPayouts,
      partnerCodes,
      currentMonth: now.toLocaleString('default', { month: 'long', year: 'numeric' })
    });
  } catch (error) {
    console.error('Error in getDashboard:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load dashboard'
    });
  }
};

/**
 * Get partner commissions page
 */
const getCommissions = async (req, res) => {
  try {
    const partner = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const status = req.query.status || '';

    // Build query
    const query = { referralPartner: partner._id };
    if (status) {
      query.status = status;
    }

    // Get commissions with pagination
    const total = await ReferralCommission.countDocuments(query);
    const commissions = await ReferralCommission.find(query)
      .populate('order', 'orderNumber pricing.total status createdAt')
      .populate('buyer', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.render('partner/commissions', {
      title: 'My Commissions | PARTSFORM',
      partner,
      commissions,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
      status
    });
  } catch (error) {
    console.error('Error in getCommissions:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load commissions'
    });
  }
};

/**
 * Get partner payouts page
 */
const getPayouts = async (req, res) => {
  try {
    const partner = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    // Get payouts with pagination
    const total = await ReferralPayout.countDocuments({ referralPartner: partner._id });
    const payouts = await ReferralPayout.find({ referralPartner: partner._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Calculate totals
    const totals = await ReferralPayout.aggregate([
      { $match: { referralPartner: partner._id } },
      {
        $group: {
          _id: null,
          totalPaid: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$payoutAmount', 0] }
          },
          totalPending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$payoutAmount', 0] }
          }
        }
      }
    ]);

    res.render('partner/payouts', {
      title: 'My Payouts | PARTSFORM',
      partner,
      payouts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
      totals: totals[0] || { totalPaid: 0, totalPending: 0 }
    });
  } catch (error) {
    console.error('Error in getPayouts:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load payouts'
    });
  }
};

/**
 * Get partner profile page
 */
const getProfile = async (req, res) => {
  try {
    const partner = req.user;

    // Get partner's referral codes
    const partnerCodes = await ReferralCode.find({
      referralPartner: partner._id,
      status: { $in: ['active', 'inactive'] }
    }).sort({ createdAt: -1 }).lean();

    res.render('partner/profile', {
      title: 'My Profile | PARTSFORM',
      partner,
      partnerCodes
    });
  } catch (error) {
    console.error('Error in getProfile:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load profile'
    });
  }
};

/**
 * Update partner profile
 */
const updateProfile = async (req, res) => {
  try {
    const partner = req.user;
    const { firstName, lastName, phone, paymentDetails } = req.body;

    // Update fields
    if (firstName) partner.firstName = firstName;
    if (lastName) partner.lastName = lastName;
    if (phone) partner.phone = phone;
    if (paymentDetails) {
      partner.paymentDetails = {
        ...partner.paymentDetails,
        ...paymentDetails
      };
    }

    await partner.save();

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

/**
 * Change partner password
 */
const changePassword = async (req, res) => {
  try {
    const partner = await ReferralPartner.findById(req.user._id).select('+password');
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new password are required'
      });
    }

    // Verify current password
    const isMatch = await partner.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    partner.password = newPassword;
    await partner.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error in changePassword:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

/**
 * Get partner stats API
 */
const getStats = async (req, res) => {
  try {
    const partner = req.user;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get monthly stats
    const monthlyStats = await ReferralCommission.getMonthlySummary(
      partner._id,
      currentMonth,
      currentYear
    );

    // Get all-time stats
    const allTimeStats = await ReferralCommission.aggregate([
      { $match: { referralPartner: partner._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalEarnings: { $sum: '$commissionAmount' },
          pendingEarnings: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, '$commissionAmount', 0]
            }
          },
          approvedEarnings: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, '$commissionAmount', 0]
            }
          },
          paidEarnings: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, '$commissionAmount', 0]
            }
          }
        }
      }
    ]);

    // Get the partner's active referral code
    const activeCode = await ReferralCode.findOne({
      referralPartner: partner._id,
      status: 'active'
    }).lean();

    res.json({
      success: true,
      stats: {
        monthly: monthlyStats,
        allTime: allTimeStats[0] || {
          totalOrders: 0,
          totalEarnings: 0,
          pendingEarnings: 0,
          approvedEarnings: 0,
          paidEarnings: 0
        },
        partner: {
          referralCode: activeCode?.code || null,
          commissionRate: partner.commissionRate,
          buyerDiscountRate: partner.buyerDiscountRate
        }
      }
    });
  } catch (error) {
    console.error('Error in getStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load stats'
    });
  }
};

module.exports = {
  getLoginPage,
  login,
  logout,
  getDashboard,
  getCommissions,
  getPayouts,
  getProfile,
  updateProfile,
  changePassword,
  getStats
};
