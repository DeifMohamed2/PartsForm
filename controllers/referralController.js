/**
 * Referral Controller
 * Handles admin management of referral partners, commissions, and payouts
 */

const crypto = require('crypto');
const ReferralPartner = require('../models/ReferralPartner');
const ReferralCommission = require('../models/ReferralCommission');
const ReferralPayout = require('../models/ReferralPayout');
const ReferralCode = require('../models/ReferralCode');
const Order = require('../models/Order');
const Buyer = require('../models/Buyer');
const emailService = require('../services/emailService');

// ==========================================
// ADMIN - REFERRAL PARTNER MANAGEMENT
// ==========================================

/**
 * Get referral management dashboard page
 */
const getReferralDashboard = async (req, res) => {
  try {
    // Get summary statistics
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const [
      totalPartners,
      activePartners,
      pendingCommissions,
      pendingApplications,
      monthCommissions,
    ] = await Promise.all([
      ReferralPartner.countDocuments({ status: { $ne: 'pending' } }),
      ReferralPartner.countDocuments({ status: 'active' }),
      ReferralCommission.countDocuments({ status: 'pending' }),
      ReferralPartner.countDocuments({ status: 'pending' }),
      ReferralCommission.aggregate([
        {
          $match: {
            periodMonth: currentMonth,
            periodYear: currentYear,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$commissionAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const monthlyStats = monthCommissions[0] || { total: 0, count: 0 };

    res.render('admin/referrals/dashboard', {
      title: 'Referral Management',
      admin: req.user,
      activePage: 'referrals',
      stats: {
        totalPartners,
        activePartners,
        pendingCommissions,
        pendingApplications,
        monthlyCommissionTotal: monthlyStats.total,
        monthlyReferralCount: monthlyStats.count,
      },
      currentMonth,
      currentYear,
    });
  } catch (error) {
    console.error('Error loading referral dashboard:', error);
    res.status(500).render('error', {
      message: 'Failed to load referral dashboard',
      error: error.message,
    });
  }
};

/**
 * Get referral partners list page
 */
const getReferralPartners = async (req, res) => {
  try {
    res.render('admin/referrals/partners', {
      title: 'Referral Partners',
      admin: req.user,
      activePage: 'referrals',
    });
  } catch (error) {
    console.error('Error loading partners page:', error);
    res.status(500).render('error', {
      message: 'Failed to load partners page',
      error: error.message,
    });
  }
};

/**
 * Get referral partner create page
 */
const getReferralPartnerCreate = async (req, res) => {
  try {
    res.render('admin/referrals/partner-create', {
      title: 'Create Referral Partner',
      admin: req.user,
      activePage: 'referrals',
    });
  } catch (error) {
    console.error('Error loading create page:', error);
    res.status(500).render('error', {
      message: 'Failed to load create page',
      error: error.message,
    });
  }
};

/**
 * Get referral partner details page
 */
const getReferralPartnerDetails = async (req, res) => {
  try {
    const partner = await ReferralPartner.findById(req.params.id);
    if (!partner) {
      return res.status(404).render('error', {
        message: 'Referral partner not found',
      });
    }

    // Get recent commissions
    const recentCommissions = await ReferralCommission.find({
      referralPartner: partner._id,
    })
      .populate('buyer', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(10);

    res.render('admin/referrals/partner-details', {
      title: `Partner: ${partner.fullName}`,
      admin: req.user,
      activePage: 'referrals',
      partner,
      recentCommissions,
    });
  } catch (error) {
    console.error('Error loading partner details:', error);
    res.status(500).render('error', {
      message: 'Failed to load partner details',
      error: error.message,
    });
  }
};

/**
 * Get referral partner edit page
 */
const getReferralPartnerEdit = async (req, res) => {
  try {
    const partner = await ReferralPartner.findById(req.params.id);
    if (!partner) {
      return res.status(404).render('error', {
        message: 'Referral partner not found',
      });
    }

    res.render('admin/referrals/partner-edit', {
      title: `Edit: ${partner.fullName}`,
      admin: req.user,
      activePage: 'referrals',
      partner,
    });
  } catch (error) {
    console.error('Error loading edit page:', error);
    res.status(500).render('error', {
      message: 'Failed to load edit page',
      error: error.message,
    });
  }
};

// ==========================================
// ADMIN - REFERRAL PARTNERS API
// ==========================================

/**
 * Get referral partners list (API)
 */
const getPartnersApi = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    if (search) {
      // Search by name or email
      // To search by referral code, use the Referral Codes page
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [partners, total] = await Promise.all([
      ReferralPartner.find(query)
        .select('-password -passwordResetToken -passwordResetExpires')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      ReferralPartner.countDocuments(query),
    ]);

    res.json({
      success: true,
      partners,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch partners',
      error: error.message,
    });
  }
};

/**
 * Create referral partner (API)
 */
const createPartner = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      commissionRate,
      buyerDiscountRate,
      paymentDetails,
      address,
      adminNotes,
      sendWelcomeEmail,
    } = req.body;

    // Check if email already exists
    const existingPartner = await ReferralPartner.findOne({ email: email.toLowerCase() });
    if (existingPartner) {
      return res.status(400).json({
        success: false,
        message: 'A referral partner with this email already exists',
      });
    }

    // Generate unique referral code prefix based on name
    const baseCode = (firstName.substring(0, 3) + lastName.substring(0, 3)).toUpperCase();
    const referralCodeString = await ReferralCode.generateCode(baseCode);

    const partner = new ReferralPartner({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password,
      commissionRate: commissionRate || 5,
      buyerDiscountRate: buyerDiscountRate || 3,
      paymentDetails,
      address,
      adminNotes,
      createdBy: req.user._id,
    });

    await partner.save();

    // Create default ReferralCode document for the partner
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const defaultCode = new ReferralCode({
      referralPartner: partner._id,
      code: referralCodeString,
      name: 'Default',
      commissionRate: partner.commissionRate,
      buyerDiscountRate: partner.buyerDiscountRate,
      validFrom: now,
      validUntil: oneMonthLater,
      status: 'active',
      maxUses: null, // null = unlimited registrations
      notes: 'Auto-generated default code',
      createdBy: req.user._id,
    });

    await defaultCode.save();

    // Send welcome email if requested
    let emailSent = false;
    if (sendWelcomeEmail) {
      const baseUrl = process.env.BASE_URL || 'https://partsform.com';
      const loginUrl = `${baseUrl}/partner/login`;

      try {
        await emailService.sendEmail({
          to: partner.email,
          subject: 'Welcome to PARTSFORM Partner Program - Your Account is Ready!',
          html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">
          
          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(43, 82, 120, 0.12);">
                
                <!-- Logo Header -->
                <tr>
                  <td style="background-color: #2b5278; padding: 40px 32px; text-align: center;">
                    <img src="${baseUrl}/images/PARTSFORM-LOGO.png" alt="PARTSFORM" width="200" style="display: block; margin: 0 auto 20px; max-width: 200px; height: auto;">
                    <p style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff;">Welcome to PARTSFORM!</p>
                    <p style="margin: 8px 0 0 0; font-size: 15px; color: rgba(255, 255, 255, 0.85);">Your Partner Account is Ready</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 20px 0; font-size: 17px; color: #1a2b3d; line-height: 1.5;">
                      Hi <strong>${partner.firstName}</strong>,
                    </p>
                    
                    <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                      Welcome to the PARTSFORM Partner Program! Your account has been created and you can now start earning commissions by sharing your referral code.
                    </p>
                    
                    <!-- Credentials Box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Your Login Credentials</p>
                          
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 8px 0; border-bottom: 1px solid #dcfce7;">
                                <span style="font-size: 14px; color: #166534;">Email:</span>
                              </td>
                              <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #dcfce7;">
                                <strong style="font-size: 14px; color: #15803d;">${partner.email}</strong>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; border-bottom: 1px solid #dcfce7;">
                                <span style="font-size: 14px; color: #166534;">Password:</span>
                              </td>
                              <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #dcfce7;">
                                <code style="font-size: 14px; color: #15803d; background-color: rgba(255, 255, 255, 0.6); padding: 4px 8px; border-radius: 4px;">${password}</code>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;">
                                <span style="font-size: 14px; color: #166534;">Referral Code:</span>
                              </td>
                              <td style="padding: 8px 0; text-align: right;">
                                <strong style="font-size: 14px; color: #15803d;">${referralCodeString}</strong>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- CTA Button -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="text-align: center; padding-bottom: 24px;">
                          <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: #2b5278; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(43, 82, 120, 0.3);">
                            Log In to Your Dashboard →
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                      <strong>Important:</strong> For security, we recommend changing your password after your first login.
                    </p>
                    
                    <!-- Commission Info -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1a2b3d;">Your Partner Benefits:</p>
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr><td style="padding: 4px 0; font-size: 14px; color: #475569;">• <strong>${partner.commissionRate}%</strong> commission on referred orders</td></tr>
                            <tr><td style="padding: 4px 0; font-size: 14px; color: #475569;">• <strong>${partner.buyerDiscountRate}%</strong> discount for your referrals</td></tr>
                            <tr><td style="padding: 4px 0; font-size: 14px; color: #475569;">• Real-time tracking dashboard</td></tr>
                            <tr><td style="padding: 4px 0; font-size: 14px; color: #475569;">• Monthly payouts</td></tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                Questions? Just reply to this email.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} PARTSFORM. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          `,
          text: `
Welcome to PARTSFORM Partner Program!

Hi ${partner.firstName},

Welcome to the PARTSFORM Partner Program! Your account has been created and you can now start earning commissions.

YOUR LOGIN CREDENTIALS:
- Email: ${partner.email}
- Password: ${password}
- Referral Code: ${referralCodeString}

Log in to your dashboard: ${loginUrl}

YOUR PARTNER BENEFITS:
- ${partner.commissionRate}% commission on referred orders
- ${partner.buyerDiscountRate}% discount for your referrals
- Real-time tracking dashboard
- Monthly payouts

Important: For security, we recommend changing your password after your first login.

Questions? Reply to this email or contact our partner support.

© ${new Date().getFullYear()} PARTSFORM. All rights reserved.
          `,
        });
        emailSent = true;
      } catch (emailError) {
        console.error('Failed to send partner welcome email:', emailError);
        // Don't fail the creation if email fails
      }
    }

    // Remove sensitive data from response
    const partnerResponse = partner.toObject();
    delete partnerResponse.password;
    // Add the referral code from the ReferralCode document
    partnerResponse.referralCode = defaultCode.code;

    res.status(201).json({
      success: true,
      message: sendWelcomeEmail 
        ? (emailSent ? 'Partner created and welcome email sent!' : 'Partner created but email failed to send')
        : 'Referral partner created successfully',
      partner: partnerResponse,
      emailSent,
    });
  } catch (error) {
    console.error('Error creating partner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create referral partner',
      error: error.message,
    });
  }
};

/**
 * Update referral partner (API)
 */
const updatePartner = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      phone,
      commissionRate,
      buyerDiscountRate,
      paymentDetails,
      address,
      adminNotes,
      newPassword,
      sendPasswordEmail,
    } = req.body;

    const partner = await ReferralPartner.findById(id);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Referral partner not found',
      });
    }

    // Update fields
    if (firstName) partner.firstName = firstName;
    if (lastName) partner.lastName = lastName;
    if (phone) partner.phone = phone;
    if (commissionRate !== undefined) partner.commissionRate = commissionRate;
    if (buyerDiscountRate !== undefined) partner.buyerDiscountRate = buyerDiscountRate;
    if (paymentDetails) partner.paymentDetails = { ...partner.paymentDetails, ...paymentDetails };
    if (address) partner.address = { ...partner.address, ...address };
    if (adminNotes !== undefined) partner.adminNotes = adminNotes;

    // Handle password change
    let passwordChanged = false;
    let emailSent = false;
    
    if (newPassword && newPassword.length >= 8) {
      partner.password = newPassword; // Will be hashed by the pre-save hook
      passwordChanged = true;
    }

    await partner.save();

    // Send password email if requested
    if (passwordChanged && sendPasswordEmail) {
      try {
        const baseUrl = process.env.BASE_URL || 'https://partsform.com';
        const loginUrl = `${baseUrl}/partner/login`;
        
        await emailService.sendEmail({
          to: partner.email,
          subject: 'PARTSFORM Partner Portal - Your Password Has Been Updated',
          html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">
          
          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(43, 82, 120, 0.12);">
                
                <!-- Logo Header -->
                <tr>
                  <td style="background-color: #2b5278; padding: 40px 32px; text-align: center;">
                    <img src="${baseUrl}/images/PARTSFORM-LOGO.png" alt="PARTSFORM" width="200" style="display: block; margin: 0 auto 20px; max-width: 200px; height: auto;">
                    <p style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff;">Password Updated</p>
                    <p style="margin: 8px 0 0 0; font-size: 15px; color: rgba(255, 255, 255, 0.85);">Your account credentials have been changed</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 20px 0; font-size: 17px; color: #1a2b3d; line-height: 1.5;">
                      Hi <strong>${partner.firstName}</strong>,
                    </p>
                    
                    <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                      Your partner portal password has been updated by an administrator. Please use the new credentials below to access your dashboard.
                    </p>
                    
                    <!-- Credentials Box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Your New Credentials</p>
                          
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 8px 0; border-bottom: 1px solid #dcfce7;">
                                <span style="font-size: 14px; color: #166534;">Email:</span>
                              </td>
                              <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #dcfce7;">
                                <strong style="font-size: 14px; color: #15803d;">${partner.email}</strong>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;">
                                <span style="font-size: 14px; color: #166534;">New Password:</span>
                              </td>
                              <td style="padding: 8px 0; text-align: right;">
                                <code style="font-size: 14px; color: #15803d; background-color: rgba(255, 255, 255, 0.6); padding: 4px 8px; border-radius: 4px;">${newPassword}</code>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- CTA Button -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="text-align: center; padding-bottom: 24px;">
                          <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: #2b5278; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(43, 82, 120, 0.3);">
                            Log In to Your Dashboard →
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                      If you did not request this change, please contact us immediately.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} PARTSFORM. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          `,
          text: `Hi ${partner.firstName},\n\nYour partner portal password has been updated.\n\nNew Credentials:\n- Email: ${partner.email}\n- Password: ${newPassword}\n\nLog in: ${loginUrl}\n\nIf you did not request this change, please contact us immediately.`
        });
        emailSent = true;
      } catch (emailError) {
        console.error('Error sending password email:', emailError);
        // Don't fail the whole operation if email fails
      }
    }

    res.json({
      success: true,
      message: 'Referral partner updated successfully',
      partner,
      passwordChanged,
      emailSent,
    });
  } catch (error) {
    console.error('Error updating partner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update referral partner',
      error: error.message,
    });
  }
};

/**
 * Update partner status (API)
 */
const updatePartnerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, suspensionReason } = req.body;

    const partner = await ReferralPartner.findById(id);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Referral partner not found',
      });
    }

    partner.status = status;
    if (status === 'suspended' && suspensionReason) {
      partner.suspensionReason = suspensionReason;
    } else {
      partner.suspensionReason = undefined;
    }

    await partner.save();

    res.json({
      success: true,
      message: `Partner ${status === 'active' ? 'activated' : status === 'suspended' ? 'suspended' : 'deactivated'} successfully`,
      partner,
    });
  } catch (error) {
    console.error('Error updating partner status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update partner status',
      error: error.message,
    });
  }
};

/**
 * Delete referral partner (API)
 */
const deletePartner = async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await ReferralPartner.findById(id);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Referral partner not found',
      });
    }

    // Check for existing commissions
    const commissionCount = await ReferralCommission.countDocuments({
      referralPartner: id,
    });

    if (commissionCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete partner with ${commissionCount} existing commission(s). Consider deactivating instead.`,
      });
    }

    await ReferralPartner.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Referral partner deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting partner:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete referral partner',
      error: error.message,
    });
  }
};

/**
 * Regenerate referral code - Creates a new ReferralCode for the partner
 */
const regenerateReferralCode = async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await ReferralPartner.findById(id);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Referral partner not found',
      });
    }

    // Generate a new code
    const baseCode = (partner.firstName.substring(0, 3) + partner.lastName.substring(0, 3)).toUpperCase();
    const newCode = await ReferralCode.generateCode(baseCode);

    // Create new ReferralCode document
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const referralCode = new ReferralCode({
      referralPartner: partner._id,
      code: newCode,
      name: 'Regenerated',
      commissionRate: partner.commissionRate,
      buyerDiscountRate: partner.buyerDiscountRate,
      validFrom: now,
      validUntil: oneMonthLater,
      status: 'active',
      maxUses: 0, // Unlimited registrations
      notes: 'Regenerated code',
      createdBy: req.user._id,
    });

    await referralCode.save();

    res.json({
      success: true,
      message: 'New referral code created successfully',
      referralCode: newCode,
      codeId: referralCode._id,
    });
  } catch (error) {
    console.error('Error regenerating code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create new referral code',
      error: error.message,
    });
  }
};

// ==========================================
// ADMIN - COMMISSION MANAGEMENT
// ==========================================

/**
 * Get commissions management page
 */
const getCommissions = async (req, res) => {
  try {
    res.render('admin/referrals/commissions', {
      title: 'Referral Commissions',
      admin: req.user,
      activePage: 'referrals',
    });
  } catch (error) {
    console.error('Error loading commissions page:', error);
    res.status(500).render('error', {
      message: 'Failed to load commissions page',
      error: error.message,
    });
  }
};

/**
 * Get commissions list (API)
 */
const getCommissionsApi = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      partnerId,
      month,
      year,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (partnerId) query.referralPartner = partnerId;
    if (month) query.periodMonth = parseInt(month);
    if (year) query.periodYear = parseInt(year);

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [commissions, total] = await Promise.all([
      ReferralCommission.find(query)
        .populate('referralPartner', 'firstName lastName email referralCode')
        .populate('buyer', 'firstName lastName email companyName')
        .populate('reviewedBy', 'firstName lastName')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      ReferralCommission.countDocuments(query),
    ]);

    res.json({
      success: true,
      commissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching commissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commissions',
      error: error.message,
    });
  }
};

/**
 * Review commission (approve/reject) (API)
 */
const reviewCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason, rejectionDetails, notes } = req.body;

    const commission = await ReferralCommission.findById(id);
    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found',
      });
    }

    if (commission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot review commission with status: ${commission.status}`,
      });
    }

    commission.reviewedBy = req.user._id;
    commission.reviewedAt = new Date();
    commission.reviewNotes = notes;

    if (action === 'approve') {
      commission.status = 'approved';
    } else if (action === 'reject') {
      commission.status = 'rejected';
      commission.rejectionReason = rejectionReason;
      commission.rejectionDetails = rejectionDetails;
    }

    await commission.save();

    // Update partner stats
    const partner = await ReferralPartner.findById(commission.referralPartner);
    if (partner) {
      await partner.updateStats();
    }

    res.json({
      success: true,
      message: `Commission ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      commission,
    });
  } catch (error) {
    console.error('Error reviewing commission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review commission',
      error: error.message,
    });
  }
};

/**
 * Bulk review commissions (API)
 */
const bulkReviewCommissions = async (req, res) => {
  try {
    const { commissionIds, action, rejectionReason, rejectionDetails, notes } = req.body;

    if (!commissionIds || !Array.isArray(commissionIds) || commissionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Commission IDs are required',
      });
    }

    let result;
    if (action === 'approve') {
      result = await ReferralCommission.bulkApprove(commissionIds, req.user._id, notes);
    } else if (action === 'reject') {
      result = await ReferralCommission.bulkReject(
        commissionIds,
        req.user._id,
        rejectionReason,
        rejectionDetails
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject".',
      });
    }

    res.json({
      success: true,
      message: `${result.modifiedCount} commission(s) ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error bulk reviewing commissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk review commissions',
      error: error.message,
    });
  }
};

/**
 * Get commission statistics (API)
 */
const getCommissionStats = async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const stats = await ReferralCommission.aggregate([
      {
        $match: {
          periodMonth: targetMonth,
          periodYear: targetYear,
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

    const formattedStats = {
      pending: { count: 0, totalCommission: 0, totalOrderValue: 0 },
      approved: { count: 0, totalCommission: 0, totalOrderValue: 0 },
      rejected: { count: 0, totalCommission: 0, totalOrderValue: 0 },
      paid: { count: 0, totalCommission: 0, totalOrderValue: 0 },
      cancelled: { count: 0, totalCommission: 0, totalOrderValue: 0 },
    };

    stats.forEach(s => {
      if (formattedStats[s._id]) {
        formattedStats[s._id] = {
          count: s.count,
          totalCommission: s.totalCommission,
          totalOrderValue: s.totalOrderValue,
        };
      }
    });

    res.json({
      success: true,
      month: targetMonth,
      year: targetYear,
      stats: formattedStats,
    });
  } catch (error) {
    console.error('Error fetching commission stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission stats',
      error: error.message,
    });
  }
};

// ==========================================
// ADMIN - PAYOUT MANAGEMENT
// ==========================================

/**
 * Get payouts management page
 */
const getPayouts = async (req, res) => {
  try {
    res.render('admin/referrals/payouts', {
      title: 'Referral Payouts',
      admin: req.user,
      activePage: 'referrals',
    });
  } catch (error) {
    console.error('Error loading payouts page:', error);
    res.status(500).render('error', {
      message: 'Failed to load payouts page',
      error: error.message,
    });
  }
};

/**
 * Get payouts list (API)
 */
const getPayoutsApi = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      partnerId,
      month,
      year,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (partnerId) query.referralPartner = partnerId;
    if (month) query.periodMonth = parseInt(month);
    if (year) query.periodYear = parseInt(year);

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payouts, total] = await Promise.all([
      ReferralPayout.find(query)
        .populate('referralPartner', 'firstName lastName email referralCode paymentDetails')
        .populate('processedBy', 'firstName lastName')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      ReferralPayout.countDocuments(query),
    ]);

    res.json({
      success: true,
      payouts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payouts',
      error: error.message,
    });
  }
};

/**
 * Create payout batch for a partner (API)
 */
const createPayout = async (req, res) => {
  try {
    const { partnerId, month, year } = req.body;

    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();

    const payout = await ReferralPayout.createPayoutBatch(
      partnerId,
      targetMonth,
      targetYear,
      req.user._id
    );

    if (!payout) {
      return res.status(400).json({
        success: false,
        message: 'No approved commissions found for this period',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Payout batch created successfully',
      payout,
    });
  } catch (error) {
    console.error('Error creating payout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payout batch',
      error: error.message,
    });
  }
};

/**
 * Process payout (mark as completed) (API)
 */
const processPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentReference, paymentNotes } = req.body;

    const payout = await ReferralPayout.findById(id);
    if (!payout) {
      return res.status(404).json({
        success: false,
        message: 'Payout not found',
      });
    }

    if (payout.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Payout has already been completed',
      });
    }

    await payout.markAsCompleted(paymentReference, paymentNotes, req.user._id);

    res.json({
      success: true,
      message: 'Payout processed successfully',
      payout,
    });
  } catch (error) {
    console.error('Error processing payout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payout',
      error: error.message,
    });
  }
};

/**
 * Get partners ready for payout (API)
 */
const getPartnersReadyForPayout = async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    // Get all approved commissions grouped by partner
    const partnersWithApproved = await ReferralCommission.aggregate([
      {
        $match: {
          status: 'approved',
          periodMonth: targetMonth,
          periodYear: targetYear,
          payoutBatch: { $exists: false },
        },
      },
      {
        $group: {
          _id: '$referralPartner',
          totalCommission: { $sum: '$commissionAmount' },
          commissionsCount: { $sum: 1 },
          totalOrderValue: { $sum: '$orderTotal' },
        },
      },
      {
        $lookup: {
          from: 'referralpartners',
          localField: '_id',
          foreignField: '_id',
          as: 'partner',
        },
      },
      {
        $unwind: '$partner',
      },
      {
        $project: {
          _id: 1,
          totalCommission: 1,
          commissionsCount: 1,
          totalOrderValue: 1,
          partner: {
            firstName: 1,
            lastName: 1,
            email: 1,
            paymentDetails: 1,
          },
        },
      },
      {
        $sort: { totalCommission: -1 },
      },
    ]);

    res.json({
      success: true,
      month: targetMonth,
      year: targetYear,
      partners: partnersWithApproved,
    });
  } catch (error) {
    console.error('Error fetching partners ready for payout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch partners ready for payout',
      error: error.message,
    });
  }
};

// ==========================================
// BUYER - REFERRAL CODE VALIDATION
// ==========================================

/**
 * Validate referral code (for checkout)
 * Now uses ReferralCode model for proper validity checking
 */
const validateReferralCode = async (req, res) => {
  try {
    const { code, orderTotal } = req.body;
    const buyerId = req.user?._id;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Referral code is required',
      });
    }

    // Use ReferralCode model to find valid code (checks status, dates, etc.)
    const referralCode = await ReferralCode.findValidCode(code);

    if (!referralCode) {
      // Fallback: check if it exists but is expired/invalid
      const existingCode = await ReferralCode.findOne({ code: code.toUpperCase() });
      if (existingCode) {
        if (existingCode.status === 'expired') {
          return res.status(400).json({
            success: false,
            message: 'This referral code has expired',
          });
        }
        if (existingCode.status === 'inactive') {
          return res.status(400).json({
            success: false,
            message: 'This referral code is no longer active',
          });
        }
        const now = new Date();
        if (now < existingCode.validFrom) {
          return res.status(400).json({
            success: false,
            message: 'This referral code is not yet active',
          });
        }
        if (existingCode.validUntil && now > existingCode.validUntil) {
          return res.status(400).json({
            success: false,
            message: 'This referral code has expired',
          });
        }
      }
      
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code',
      });
    }

    // Note: minimumOrderAmount and maxUsesPerBuyer checks removed
    // Codes are now used at registration, not at checkout

    // Get partner info
    const partner = referralCode.referralPartner;

    res.json({
      success: true,
      message: 'Referral code is valid',
      discount: {
        rate: referralCode.buyerDiscountRate,
        partnerName: partner.firstName,
      },
      codeDetails: {
        code: referralCode.code,
        codeName: referralCode.name,
        commissionRate: referralCode.commissionRate,
        buyerDiscountRate: referralCode.buyerDiscountRate,
        validUntil: referralCode.validUntil,
      },
    });
  } catch (error) {
    console.error('Error validating referral code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate referral code',
      error: error.message,
    });
  }
};

/**
 * Get referral partner by code (internal use)
 * Updated to use ReferralCode model
 */
const getPartnerByCode = async (code) => {
  if (!code) return null;
  
  // First try to find via ReferralCode model
  const referralCode = await ReferralCode.findValidCode(code);
  if (referralCode && referralCode.referralPartner) {
    // Return partner with code info attached
    const partner = await ReferralPartner.findById(referralCode.referralPartner._id);
    if (partner) {
      partner._referralCode = referralCode; // Attach the code document for rate info
    }
    return partner;
  }
  
  // Fallback to partner's default code
  return ReferralPartner.findOne({
    referralCode: code.toUpperCase(),
    status: 'active',
  });
};

// ==========================================
// REFERRAL CODE MANAGEMENT (Multiple codes per partner with validity periods)
// ==========================================

/**
 * Get referral code create page for a partner
 */
const getCodeCreatePage = async (req, res) => {
  try {
    const partner = await ReferralPartner.findById(req.params.partnerId);
    if (!partner) {
      return res.status(404).render('error', {
        message: 'Partner not found',
        error: 'The referral partner does not exist',
      });
    }

    res.render('admin/referrals/code-create', {
      title: 'Create Referral Code',
      admin: req.user,
      activePage: 'referrals',
      partner,
    });
  } catch (error) {
    console.error('Error loading code create page:', error);
    res.status(500).render('error', {
      message: 'Failed to load page',
      error: error.message,
    });
  }
};

/**
 * Get referral code edit page
 */
const getCodeEditPage = async (req, res) => {
  try {
    const code = await ReferralCode.findById(req.params.codeId);
    if (!code) {
      return res.status(404).render('error', {
        message: 'Referral code not found',
        error: 'The referral code does not exist',
      });
    }

    const partner = await ReferralPartner.findById(code.referralPartner);

    res.render('admin/referrals/code-edit', {
      title: 'Edit Referral Code',
      admin: req.user,
      activePage: 'referrals',
      code,
      partner,
    });
  } catch (error) {
    console.error('Error loading code edit page:', error);
    res.status(500).render('error', {
      message: 'Failed to load page',
      error: error.message,
    });
  }
};

/**
 * Get all codes for a partner (API)
 */
const getPartnerCodesApi = async (req, res) => {
  try {
    const { partnerId } = req.params;
    
    // Get the partner to check the default code
    const partner = await ReferralPartner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found',
      });
    }
    
    const codes = await ReferralCode.find({ referralPartner: partnerId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      codes: codes.map(code => ({
        id: code._id,
        code: code.code,
        name: code.name,
        isDefault: code.name === 'Default', // Check if this is the default code
        commissionRate: code.commissionRate,
        buyerDiscountRate: code.buyerDiscountRate,
        validFrom: code.validFrom,
        validUntil: code.validUntil,
        hasExpiration: code.validUntil !== null,
        status: code.status,
        isValid: code.isValid(),
        validityStatus: code.validityStatus,
        remainingDays: code.remainingDays,
        maxUses: code.maxUses || 0,
        currentUses: code.stats?.totalRegistrations || 0,
        stats: code.stats,
        createdAt: code.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching partner codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch codes',
      error: error.message,
    });
  }
};

/**
 * Create a new referral code for a partner
 */
const createReferralCode = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const {
      code,
      name,
      commissionRate,
      buyerDiscountRate,
      validFrom,
      validUntil,
      maxUses,
      notes,
    } = req.body;

    // Verify partner exists
    const partner = await ReferralPartner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found',
      });
    }

    // Generate code if not provided
    let finalCode = code;
    if (!finalCode) {
      finalCode = await ReferralCode.generateCode(partner.firstName.substring(0, 3).toUpperCase());
    }

    // Create the code
    // Note: maxUses of 0 or null means unlimited
    const newCode = new ReferralCode({
      referralPartner: partnerId,
      code: finalCode.toUpperCase(),
      name: name || 'Default',
      commissionRate: commissionRate || partner.commissionRate || 5,
      buyerDiscountRate: buyerDiscountRate || partner.buyerDiscountRate || 5,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      maxUses: maxUses === undefined || maxUses === '' ? null : parseInt(maxUses) || 0,
      notes,
      createdBy: req.user._id,
      status: 'active',
    });

    await newCode.save();

    res.status(201).json({
      success: true,
      message: 'Referral code created successfully',
      code: {
        id: newCode._id,
        code: newCode.code,
        name: newCode.name,
        validFrom: newCode.validFrom,
        validUntil: newCode.validUntil,
      },
    });
  } catch (error) {
    console.error('Error creating referral code:', error);
    
    // Handle duplicate code error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'This code already exists. Please use a different code.',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create referral code',
      error: error.message,
    });
  }
};

/**
 * Update a referral code
 */
const updateReferralCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    const {
      name,
      commissionRate,
      buyerDiscountRate,
      validFrom,
      validUntil,
      maxUses,
      status,
      notes,
    } = req.body;

    const code = await ReferralCode.findById(codeId);
    if (!code) {
      return res.status(404).json({
        success: false,
        message: 'Referral code not found',
      });
    }

    // Update fields
    if (name !== undefined) code.name = name;
    if (commissionRate !== undefined) code.commissionRate = commissionRate;
    if (buyerDiscountRate !== undefined) code.buyerDiscountRate = buyerDiscountRate;
    if (validFrom !== undefined) code.validFrom = validFrom ? new Date(validFrom) : null;
    if (validUntil !== undefined) code.validUntil = validUntil ? new Date(validUntil) : null;
    if (maxUses !== undefined) code.maxUses = maxUses;
    if (status !== undefined) code.status = status;
    if (notes !== undefined) code.notes = notes;
    
    code.lastModifiedBy = req.user._id;

    // Update status based on validity if not manually set
    if (status === undefined) {
      code.updateStatusFromValidity();
    }

    await code.save();

    res.json({
      success: true,
      message: 'Referral code updated successfully',
      code: {
        id: code._id,
        code: code.code,
        name: code.name,
        status: code.status,
        isValid: code.isValid(),
      },
    });
  } catch (error) {
    console.error('Error updating referral code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update referral code',
      error: error.message,
    });
  }
};

/**
 * Delete a referral code (soft delete - set to inactive)
 */
const deleteReferralCode = async (req, res) => {
  try {
    const { codeId } = req.params;

    const code = await ReferralCode.findById(codeId);
    if (!code) {
      return res.status(404).json({
        success: false,
        message: 'Referral code not found',
      });
    }

    // Soft delete - set to inactive
    code.status = 'inactive';
    code.lastModifiedBy = req.user._id;
    await code.save();

    res.json({
      success: true,
      message: 'Referral code deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting referral code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete referral code',
      error: error.message,
    });
  }
};

/**
 * Get codes expiring soon (for admin dashboard notifications)
 */
const getExpiringCodesApi = async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days) || 7;
    const codes = await ReferralCode.getExpiringCodes(daysAhead);

    res.json({
      success: true,
      codes: codes.map(code => ({
        id: code._id,
        code: code.code,
        name: code.name,
        partnerId: code.referralPartner._id,
        partnerName: `${code.referralPartner.firstName} ${code.referralPartner.lastName}`,
        validUntil: code.validUntil,
        remainingDays: code.remainingDays,
      })),
    });
  } catch (error) {
    console.error('Error fetching expiring codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expiring codes',
      error: error.message,
    });
  }
};

/**
 * Update all expired codes status (admin utility)
 */
const updateExpiredCodesApi = async (req, res) => {
  try {
    const result = await ReferralCode.updateExpiredCodes();

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} expired codes`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error updating expired codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update expired codes',
      error: error.message,
    });
  }
};

/**
 * Generate a unique referral code (API)
 */
const generateCodeApi = async (req, res) => {
  try {
    const { prefix } = req.query;
    const code = await ReferralCode.generateCode(prefix);

    res.json({
      success: true,
      code,
    });
  } catch (error) {
    console.error('Error generating code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate code',
      error: error.message,
    });
  }
};

// ==========================================
// PARTNER APPLICATIONS MANAGEMENT
// ==========================================

/**
 * Get partner applications page
 */
const getPartnerApplications = async (req, res) => {
  try {
    res.render('admin/referrals/applications', {
      title: 'Partner Applications',
      admin: req.user,
      activePage: 'referrals',
    });
  } catch (error) {
    console.error('Error loading applications page:', error);
    res.status(500).render('error', {
      message: 'Failed to load applications page',
      error: error.message,
    });
  }
};

/**
 * Get partner applications list (API)
 */
const getApplicationsApi = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'pending';
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'applicationDetails.submittedAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    // Build query
    const query = { status };
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { 'applicationDetails.companyName': searchRegex },
      ];
    }

    // Get total count
    const total = await ReferralPartner.countDocuments(query);

    // Get applications
    const applications = await ReferralPartner.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      applications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error in getApplicationsApi:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load applications',
    });
  }
};

/**
 * Get application details (API)
 */
const getApplicationDetails = async (req, res) => {
  try {
    const application = await ReferralPartner.findById(req.params.id).lean();
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    res.json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('Error in getApplicationDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load application details',
    });
  }
};

/**
 * Approve partner application
 * Sets admin-provided password and sends welcome email
 */
const approveApplication = async (req, res) => {
  try {
    const { password, commissionRate, buyerDiscountRate } = req.body;
    
    // Validate password
    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 8 characters',
      });
    }
    
    const partner = await ReferralPartner.findById(req.params.id);
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    if (partner.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This application has already been processed',
      });
    }

    // Update partner status and set password
    partner.status = 'active';
    partner.password = password; // Will be hashed by the pre-save hook
    if (commissionRate) partner.commissionRate = commissionRate;
    if (buyerDiscountRate) partner.buyerDiscountRate = buyerDiscountRate;
    partner.applicationDetails.reviewedAt = new Date();
    partner.applicationDetails.reviewedBy = req.user._id;
    
    await partner.save();

    // Create default ReferralCode document for the partner
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    // Generate a new code for this partner
    const baseCode = (partner.firstName.substring(0, 3) + partner.lastName.substring(0, 3)).toUpperCase();
    const referralCodeString = await ReferralCode.generateCode(baseCode);

    // Check if a default code already exists for this partner
    const existingCode = await ReferralCode.findOne({ referralPartner: partner._id, name: 'Default' });
    let defaultCodeString = referralCodeString;
    
    if (!existingCode) {
      const defaultCode = new ReferralCode({
        referralPartner: partner._id,
        code: referralCodeString,
        name: 'Default',
        commissionRate: partner.commissionRate,
        buyerDiscountRate: partner.buyerDiscountRate,
        validFrom: now,
        validUntil: oneMonthLater,
        status: 'active',
        maxUses: null, // null = unlimited
        maxUsesPerBuyer: null, // null = unlimited
        minimumOrderAmount: 0,
        notes: 'Auto-generated default code on approval',
        createdBy: req.user._id,
      });

      await defaultCode.save();
    } else {
      defaultCodeString = existingCode.code;
    }

    // Determine the base URL for the login link
    const baseUrl = process.env.BASE_URL || 'https://partsform.com';
    const loginUrl = `${baseUrl}/partner/login`;

    // Send welcome email with credentials
    try {
      await emailService.sendEmail({
        to: partner.email,
        subject: 'Welcome to PARTSFORM Partner Program - Your Account is Ready!',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">
          
          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(43, 82, 120, 0.12);">
                
                <!-- Logo Header -->
                <tr>
                  <td style="background-color: #2b5278; padding: 40px 32px; text-align: center;">
                    <img src="${baseUrl}/images/PARTSFORM-LOGO.png" alt="PARTSFORM" width="200" style="display: block; margin: 0 auto 20px; max-width: 200px; height: auto;">
                    <p style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff;">Partner Account Approved!</p>
                    <p style="margin: 8px 0 0 0; font-size: 15px; color: rgba(255, 255, 255, 0.85);">Welcome to the PARTSFORM Partner Program</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 20px 0; font-size: 17px; color: #1a2b3d; line-height: 1.5;">
                      Hi <strong>${partner.firstName}</strong>,
                    </p>
                    
                    <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                      Great news! Your application has been approved. You can now log in to your partner dashboard and start earning commissions.
                    </p>
                    
                    <!-- Credentials Box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Your Login Credentials</p>
                          
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 8px 0; border-bottom: 1px solid #dcfce7;">
                                <span style="font-size: 14px; color: #166534;">Email:</span>
                              </td>
                              <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #dcfce7;">
                                <strong style="font-size: 14px; color: #15803d;">${partner.email}</strong>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; border-bottom: 1px solid #dcfce7;">
                                <span style="font-size: 14px; color: #166534;">Password:</span>
                              </td>
                              <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #dcfce7;">
                                <code style="font-size: 14px; color: #15803d; background-color: rgba(255, 255, 255, 0.6); padding: 4px 8px; border-radius: 4px;">${password}</code>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;">
                                <span style="font-size: 14px; color: #166534;">Referral Code:</span>
                              </td>
                              <td style="padding: 8px 0; text-align: right;">
                                <strong style="font-size: 14px; color: #15803d;">${defaultCodeString}</strong>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- CTA Button -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="text-align: center; padding-bottom: 24px;">
                          <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: #2b5278; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(43, 82, 120, 0.3);">
                            Log In to Your Dashboard →
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                      <strong>Important:</strong> For security, we recommend changing your password after your first login.
                    </p>
                    
                    <!-- Commission Info -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1a2b3d;">Your Partner Benefits:</p>
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr><td style="padding: 4px 0; font-size: 14px; color: #475569;">• <strong>${partner.commissionRate}%</strong> commission on referred orders</td></tr>
                            <tr><td style="padding: 4px 0; font-size: 14px; color: #475569;">• <strong>${partner.buyerDiscountRate}%</strong> discount for your referrals</td></tr>
                            <tr><td style="padding: 4px 0; font-size: 14px; color: #475569;">• Real-time tracking dashboard</td></tr>
                            <tr><td style="padding: 4px 0; font-size: 14px; color: #475569;">• Monthly payouts</td></tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                Questions? Just reply to this email.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} PARTSFORM. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
        text: `
Welcome to PARTSFORM Partner Program!

Hi ${partner.firstName},

Great news! Your application to join the PARTSFORM Referral Partner Program has been approved.

YOUR LOGIN CREDENTIALS:
- Email: ${partner.email}
- Password: ${password}
- Referral Code: ${defaultCodeString}

Log in to your dashboard: ${loginUrl}

YOUR PARTNER BENEFITS:
- ${partner.commissionRate}% commission on referred orders
- ${partner.buyerDiscountRate}% discount for your referrals
- Real-time tracking dashboard
- Monthly payouts

Important: For security, we recommend changing your password after your first login.

Questions? Reply to this email or contact our partner support.

© ${new Date().getFullYear()} PARTSFORM. All rights reserved.
        `,
      });
    } catch (emailError) {
      console.error('Failed to send partner welcome email:', emailError);
      // Don't fail the approval if email fails - admin can resend manually
    }

    res.json({
      success: true,
      message: 'Application approved successfully. Login credentials have been sent to the partner.',
      partner: {
        _id: partner._id,
        fullName: partner.fullName,
        email: partner.email,
        referralCode: defaultCodeString,
      },
    });
  } catch (error) {
    console.error('Error in approveApplication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve application',
    });
  }
};

/**
 * Reject partner application
 */
const rejectApplication = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const partner = await ReferralPartner.findById(req.params.id);
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    if (partner.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This application has already been processed',
      });
    }

    // Update partner status
    partner.status = 'inactive';
    partner.applicationDetails.reviewedAt = new Date();
    partner.applicationDetails.reviewedBy = req.user._id;
    partner.applicationDetails.rejectionReason = reason || 'Application not approved';
    
    await partner.save();

    res.json({
      success: true,
      message: 'Application rejected',
    });
  } catch (error) {
    console.error('Error in rejectApplication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject application',
    });
  }
};

/**
 * Get pending applications count (API)
 */
const getPendingApplicationsCount = async (req, res) => {
  try {
    const count = await ReferralPartner.countDocuments({ status: 'pending' });
    
    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Error in getPendingApplicationsCount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending applications count',
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Dashboard
  getReferralDashboard,
  
  // Partner Pages
  getReferralPartners,
  getReferralPartnerCreate,
  getReferralPartnerDetails,
  getReferralPartnerEdit,
  
  // Partner API
  getPartnersApi,
  createPartner,
  updatePartner,
  updatePartnerStatus,
  deletePartner,
  regenerateReferralCode,
  
  // Commission Pages & API
  getCommissions,
  getCommissionsApi,
  reviewCommission,
  bulkReviewCommissions,
  getCommissionStats,
  
  // Payout Pages & API
  getPayouts,
  getPayoutsApi,
  createPayout,
  processPayout,
  getPartnersReadyForPayout,
  
  // Referral Code Management (Multiple codes with validity periods)
  getCodeCreatePage,
  getCodeEditPage,
  getPartnerCodesApi,
  createReferralCode,
  updateReferralCode,
  deleteReferralCode,
  getExpiringCodesApi,
  updateExpiredCodesApi,
  generateCodeApi,
  
  // Partner Applications
  getPartnerApplications,
  getApplicationsApi,
  getApplicationDetails,
  approveApplication,
  rejectApplication,
  getPendingApplicationsCount,
  
  // Buyer validation
  validateReferralCode,
  
  // Internal utility
  getPartnerByCode,
};
