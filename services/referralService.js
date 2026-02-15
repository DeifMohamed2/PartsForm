/**
 * Referral Service
 * Handles referral code validation, commission calculations, and referral tracking
 * 
 * IMPORTANT: Referral codes are now used at BUYER REGISTRATION, not at checkout.
 * When a buyer signs up with a code, they become permanently linked to the partner.
 * All future orders from that buyer generate commissions for the linked partner.
 */

const ReferralPartner = require('../models/ReferralPartner');
const ReferralCommission = require('../models/ReferralCommission');
const ReferralCode = require('../models/ReferralCode');

/**
 * Validate a referral code for REGISTRATION
 * This is the primary validation method - codes are used when buyers create accounts
 * @param {string} code - Referral code to validate
 * @returns {Object} - Validation result with partner and code details for linking
 */
async function validateReferralCodeForRegistration(code) {
  try {
    if (!code || typeof code !== 'string') {
      return {
        valid: false,
        message: 'Please enter a referral code'
      };
    }

    const cleanCode = code.trim().toUpperCase();
    
    // Find valid code in ReferralCode model
    const referralCodeDoc = await ReferralCode.findValidCode(cleanCode);
    
    if (!referralCodeDoc) {
      return {
        valid: false,
        message: 'Invalid or expired referral code'
      };
    }

    // Found valid code - get partner info
    const partner = await ReferralPartner.findById(referralCodeDoc.referralPartner);
    
    if (!partner || partner.status !== 'active') {
      return {
        valid: false,
        message: 'Referral partner is not active'
      };
    }

    // Return data for linking buyer to this referral
    return {
      valid: true,
      referral: {
        code: referralCodeDoc.code,
        codeId: referralCodeDoc._id,
        codeName: referralCodeDoc.name,
        partnerId: partner._id,
        partnerName: `${partner.firstName} ${partner.lastName}`.trim(),
        discountRate: referralCodeDoc.buyerDiscountRate || 0,
        commissionRate: referralCodeDoc.commissionRate || 5,
        validUntil: referralCodeDoc.validUntil,
        remainingDays: referralCodeDoc.remainingDays
      }
    };
  } catch (error) {
    console.error('[ReferralService] Registration validation error:', error);
    return {
      valid: false,
      message: 'Error validating referral code'
    };
  }
}

/**
 * Update code statistics when a buyer registers with this code
 * @param {ObjectId} codeId - The ReferralCode document ID
 */
async function recordCodeUsageOnRegistration(codeId) {
  try {
    const referralCode = await ReferralCode.findById(codeId);
    if (referralCode) {
      // Increment usage stats
      referralCode.stats.totalUses += 1;
      referralCode.stats.uniqueBuyers += 1;
      await referralCode.save();
    }
  } catch (error) {
    console.error('[ReferralService] Error recording code usage:', error);
  }
}

/**
 * Validate a referral code - now checks validity periods
 * @param {string} code - Referral code to validate
 * @param {number} orderTotal - Order total for calculating discount
 * @param {string} buyerId - Optional buyer ID for per-buyer usage limits
 * @returns {Object} - Validation result with partner and code details
 * @deprecated Use validateReferralCodeForRegistration instead - codes are now used at registration
 */
async function validateReferralCode(code, orderTotal = 0, buyerId = null) {
  try {
    if (!code || typeof code !== 'string') {
      return {
        valid: false,
        message: 'Please enter a referral code'
      };
    }

    const cleanCode = code.trim().toUpperCase();
    
    // Try to find in ReferralCode model first (new system with validity periods)
    const referralCodeDoc = await ReferralCode.findValidCode(cleanCode, buyerId);
    
    if (referralCodeDoc) {
      // Found valid code in new system
      const partner = await ReferralPartner.findById(referralCodeDoc.referralPartner);
      
      if (!partner || partner.status !== 'active') {
        return {
          valid: false,
          message: 'Referral partner is not active'
        };
      }

      // Calculate discount amount using code-specific rate
      const discountRate = referralCodeDoc.buyerDiscountRate || 0;
      const discountAmount = orderTotal * (discountRate / 100);

      return {
        valid: true,
        referral: {
          code: referralCodeDoc.code,
          codeId: referralCodeDoc._id,
          codeName: referralCodeDoc.name,
          partnerId: partner._id,
          partnerName: `${partner.firstName} ${partner.lastName}`.trim(),
          discountRate: discountRate,
          discountAmount: Math.round(discountAmount * 100) / 100,
          commissionRate: referralCodeDoc.commissionRate,
          validUntil: referralCodeDoc.validUntil,
          remainingDays: referralCodeDoc.remainingDays
        }
      };
    }
    
    // Code not found in ReferralCode model
    return {
      valid: false,
      message: 'Invalid or expired referral code'
    };
  } catch (error) {
    console.error('[ReferralService] Validation error:', error);
    return {
      valid: false,
      message: 'Error validating referral code'
    };
  }
}

/**
 * Process referral for a completed order
 * Creates commission record and updates partner/code stats
 * Commission starts as 'pending' - only approved when order is confirmed/completed
 * @param {Object} order - The order object
 * @param {Object} referralData - Referral data from the order
 * @param {Object} buyer - The buyer who placed the order
 * @returns {Object} - Commission creation result
 */
async function processOrderReferral(order, referralData, buyer) {
  try {
    if (!referralData || !referralData.code || !referralData.partnerId) {
      return { success: false, message: 'Invalid referral data' };
    }

    // Verify partner is still active
    const partner = await ReferralPartner.findById(referralData.partnerId);
    if (!partner || partner.status !== 'active') {
      console.log('[ReferralService] Partner not found or inactive:', referralData.partnerId);
      return { success: false, message: 'Referral partner not found or inactive' };
    }

    // Check if commission already exists for this order
    const existingCommission = await ReferralCommission.findOne({ order: order._id });
    if (existingCommission) {
      console.log('[ReferralService] Commission already exists for order:', order.orderNumber);
      return { success: false, message: 'Commission already exists' };
    }

    // Check for fraud: buyer using their own referral code
    if (buyer.email && partner.email && buyer.email.toLowerCase() === partner.email.toLowerCase()) {
      console.log('[ReferralService] Fraud detection: Buyer using own referral code', buyer.email);
      return { 
        success: false, 
        message: 'Cannot use your own referral code',
        flagged: true
      };
    }

    // Get ReferralCode document if codeId provided
    let referralCodeDoc = null;
    if (referralData.codeId) {
      referralCodeDoc = await ReferralCode.findById(referralData.codeId);
      
      // Verify code is still valid
      if (referralCodeDoc && !referralCodeDoc.isValid()) {
        console.log('[ReferralService] Referral code no longer valid:', referralData.code);
        // Still process with partner defaults, but log the issue
        referralCodeDoc = null;
      }
    }

    // Create commission record (starts as 'pending')
    // Commission will be auto-approved when order status changes to 'completed' or 'delivered'
    const commission = await ReferralCommission.createFromOrder(
      order,
      partner,
      buyer,
      referralCodeDoc
    );

    // Update partner stats
    await partner.updateStats();

    console.log('[ReferralService] Commission created (pending confirmation):', {
      orderId: order.orderNumber,
      partner: `${partner.firstName} ${partner.lastName}`,
      code: referralData.code,
      amount: commission.commissionAmount,
      status: commission.status
    });

    return {
      success: true,
      commission: {
        id: commission._id,
        amount: commission.commissionAmount,
        status: commission.status,
        message: 'Commission created - will be approved when order is confirmed'
      }
    };
  } catch (error) {
    console.error('[ReferralService] Error processing order referral:', error);
    return { success: false, message: 'Error processing referral commission' };
  }
}

/**
 * Get partner by referral code - checks both ReferralCode and ReferralPartner
 * @param {string} code - Referral code
 * @returns {Object|null} - Partner or null
 */
async function getPartnerByCode(code) {
  try {
    if (!code) return null;
    
    const cleanCode = code.trim().toUpperCase();
    
    // First check ReferralCode model
    const referralCodeDoc = await ReferralCode.findValidCode(cleanCode);
    if (referralCodeDoc) {
      const partner = await ReferralPartner.findOne({
        _id: referralCodeDoc.referralPartner,
        status: 'active'
      });
      if (partner) {
        // Attach the code document to partner for reference
        partner._referralCodeDoc = referralCodeDoc;
        return partner;
      }
    }
    
    // Fallback to old system
    return await ReferralPartner.findOne({
      referralCode: cleanCode,
      status: 'active'
    });
  } catch (error) {
    console.error('[ReferralService] Error getting partner by code:', error);
    return null;
  }
}

/**
 * Update commission status when order status changes
 * Now auto-approves commission when order is completed/delivered
 * @param {string} orderId - Order ID
 * @param {string} orderStatus - New order status
 */
async function updateCommissionForOrderStatus(orderId, orderStatus) {
  try {
    const commission = await ReferralCommission.findOne({ order: orderId });
    if (!commission) return;

    // Use the model's updateOrderStatus method which handles auto-approval
    // Commission will be auto-approved when order is 'completed' or 'delivered'
    await ReferralCommission.updateOrderStatus(orderId, orderStatus, true);
    
    // Update partner stats
    const partner = await ReferralPartner.findById(commission.referralPartner);
    if (partner) {
      await partner.updateStats();
    }
    
    console.log('[ReferralService] Commission status updated for order:', {
      orderId,
      orderStatus,
      commissionId: commission._id
    });
  } catch (error) {
    console.error('[ReferralService] Error updating commission status:', error);
  }
}

/**
 * Get commission statistics for a partner
 * @param {string} partnerId - Partner ID
 * @returns {Object} - Statistics
 */
async function getPartnerStats(partnerId) {
  try {
    const partner = await ReferralPartner.findById(partnerId);
    if (!partner) return null;

    // Get partner's active code
    const activeCode = await ReferralCode.findOne({
      referralPartner: partnerId,
      status: 'active'
    }).lean();

    // Get monthly commission data
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const monthlyStats = await ReferralCommission.getMonthlySummary(
      partnerId,
      currentMonth,
      currentYear
    );

    // Get all-time stats
    const allTimeStats = await ReferralCommission.aggregate([
      { $match: { referralPartner: partner._id } },
      {
        $group: {
          _id: null,
          totalCommissions: { $sum: 1 },
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

    return {
      partner: {
        id: partner._id,
        name: `${partner.firstName} ${partner.lastName}`,
        code: activeCode?.code || null,
        commissionRate: partner.commissionRate,
        buyerDiscountRate: partner.buyerDiscountRate
      },
      stats: partner.stats,
      monthly: monthlyStats,
      allTime: allTimeStats[0] || {
        totalCommissions: 0,
        totalEarnings: 0,
        pendingEarnings: 0,
        approvedEarnings: 0,
        paidEarnings: 0
      }
    };
  } catch (error) {
    console.error('[ReferralService] Error getting partner stats:', error);
    return null;
  }
}

/**
 * Get all referral codes for a partner
 * @param {string} partnerId - Partner ID
 * @returns {Array} - List of referral codes
 */
async function getPartnerCodes(partnerId) {
  try {
    return await ReferralCode.getPartnerCodes(partnerId);
  } catch (error) {
    console.error('[ReferralService] Error getting partner codes:', error);
    return [];
  }
}

/**
 * Create a new referral code for a partner
 * @param {Object} codeData - Code data including partnerId, rates, validity
 * @param {string} adminId - Admin creating the code
 * @returns {Object} - Created code or error
 */
async function createReferralCode(codeData, adminId) {
  try {
    // Generate code if not provided
    const code = codeData.code || await ReferralCode.generateCode(codeData.prefix);
    
    const newCode = new ReferralCode({
      referralPartner: codeData.partnerId,
      code: code,
      name: codeData.name || 'Default',
      commissionRate: codeData.commissionRate || 5,
      buyerDiscountRate: codeData.buyerDiscountRate || 5,
      validFrom: codeData.validFrom || new Date(),
      validUntil: codeData.validUntil,
      maxUses: codeData.maxUses || 0,
      notes: codeData.notes,
      createdBy: adminId
    });
    
    await newCode.save();
    return { success: true, code: newCode };
  } catch (error) {
    console.error('[ReferralService] Error creating referral code:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Update expired codes status
 * Should be called periodically (e.g., daily cron job)
 */
async function updateExpiredCodes() {
  try {
    const result = await ReferralCode.updateExpiredCodes();
    console.log('[ReferralService] Updated expired codes:', result.modifiedCount);
    return result;
  } catch (error) {
    console.error('[ReferralService] Error updating expired codes:', error);
    return null;
  }
}

/**
 * Get codes expiring soon (for admin notifications)
 * @param {number} daysAhead - Number of days to look ahead
 * @returns {Array} - List of expiring codes
 */
async function getExpiringCodes(daysAhead = 7) {
  try {
    return await ReferralCode.getExpiringCodes(daysAhead);
  } catch (error) {
    console.error('[ReferralService] Error getting expiring codes:', error);
    return [];
  }
}

/**
 * Calculate monthly commission for valid period only
 * Only counts commissions where the order was within the code's validity period
 * @param {string} partnerId - Partner ID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Object} - Monthly commission summary
 */
async function getMonthlyCommissionWithinValidity(partnerId, month, year) {
  try {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    
    // Get all commissions for the month that are approved/paid
    const commissions = await ReferralCommission.find({
      referralPartner: partnerId,
      periodMonth: month,
      periodYear: year,
      status: { $in: ['approved', 'paid'] }
    }).populate('referralCodeRef');
    
    let validCommissionTotal = 0;
    let validCommissionCount = 0;
    
    for (const commission of commissions) {
      // If commission has a referralCodeRef, check validity period
      if (commission.referralCodeRef) {
        const codeValidFrom = commission.referralCodeRef.validFrom;
        const codeValidUntil = commission.referralCodeRef.validUntil;
        const orderDate = commission.createdAt;
        
        // Check if order was placed within code's validity period
        const isWithinValidity = 
          (!codeValidFrom || orderDate >= codeValidFrom) &&
          (!codeValidUntil || orderDate <= codeValidUntil);
        
        if (isWithinValidity) {
          validCommissionTotal += commission.commissionAmount;
          validCommissionCount++;
        }
      } else {
        // No code reference, count it (legacy orders)
        validCommissionTotal += commission.commissionAmount;
        validCommissionCount++;
      }
    }
    
    return {
      month,
      year,
      totalCommissions: commissions.length,
      validCommissions: validCommissionCount,
      totalAmount: validCommissionTotal
    };
  } catch (error) {
    console.error('[ReferralService] Error calculating monthly commission:', error);
    return null;
  }
}

module.exports = {
  validateReferralCode,
  validateReferralCodeForRegistration,
  recordCodeUsageOnRegistration,
  processOrderReferral,
  getPartnerByCode,
  updateCommissionForOrderStatus,
  getPartnerStats,
  getPartnerCodes,
  createReferralCode,
  updateExpiredCodes,
  getExpiringCodes,
  getMonthlyCommissionWithinValidity
};
