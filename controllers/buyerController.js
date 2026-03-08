// Buyer Controller
// This file contains all buyer-related controller functions

const Buyer = require('../models/Buyer');
const Order = require('../models/Order');
const Claim = require('../models/Claim');
const Part = require('../models/Part');
const { processProfileImage, deleteOldProfileImage } = require('../utils/fileUploader');
const socketService = require('../services/socketService');
const { getEffectiveMarkup, applyMarkupToPrice } = require('../utils/priceMarkup');
const referralService = require('../services/referralService');

// Parts Analytics tracking service
let partsAnalyticsService = null;
try {
  partsAnalyticsService = require('../services/partsAnalyticsService');
} catch (err) {
  console.warn('⚠️ Parts analytics service not available:', err.message);
}

/**
 * Get buyer dashboard/main page
 */
const getBuyerMain = async (req, res) => {
  try {
    res.render('buyer/search-automotive', {
      title: 'Buyer Portal - Main | PARTSFORM',
      industry: 'automotive',
      industryName: 'Automotive',
    });
  } catch (error) {
    console.error('Error in getBuyerMain:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load buyer page',
    });
  }
};

/**
 * Get Automotive industry-specific search page
 */
const getAutomotiveSearchPage = async (req, res) => {
  try {
    res.render('buyer/search-automotive', {
      title: 'Automotive Parts Search | PARTSFORM',
      industry: 'automotive',
      industryName: 'Automotive',
    });
  } catch (error) {
    console.error('Error in getAutomotiveSearchPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load automotive search page',
    });
  }
};

/**
 * Get Search V2 page - New design
 */
const getSearchV2Page = async (req, res) => {
  try {
    res.render('buyer/search-v2', {
      title: 'Find Automotive Parts | PARTSFORM',
      industry: 'automotive',
      industryName: 'Automotive',
    });
  } catch (error) {
    console.error('Error in getSearchV2Page:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load search page',
    });
  }
};

/**
 * Get Affiliate Program page
 */
const getAffiliatePage = async (req, res) => {
  try {
    res.render('buyer/affiliate', {
      title: 'Affiliate Program | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getAffiliatePage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load affiliate page',
    });
  }
};

/**
 * Get My Orders page
 */
const getOrdersPage = async (req, res) => {
  try {
    // Orders are loaded from localStorage by the frontend JavaScript
    res.render('buyer/orders', {
      title: 'My Orders | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getOrdersPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load orders page',
    });
  }
};

/**
 * Get Payment page
 */
const getPaymentPage = async (req, res) => {
  try {
    res.render('buyer/payment', {
      title: 'Payment | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getPaymentPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load payment page',
    });
  }
};

/**
 * Get Delivery page
 */
const getDeliveryPage = async (req, res) => {
  try {
    res.render('buyer/delivery', {
      title: 'Delivery | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getDeliveryPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load delivery page',
    });
  }
};

/**
 * Get Contacts page
 */
const getContactsPage = async (req, res) => {
  try {
    res.render('buyer/contacts', {
      title: 'Contacts | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getContactsPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load contacts page',
    });
  }
};

/**
 * Get Shopping Cart page
 */
const getCartPage = async (req, res) => {
  try {
    res.render('buyer/cart', {
      title: 'Shopping Cart | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getCartPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load shopping cart page',
    });
  }
};

/**
 * Get Checkout page
 */
const getCheckoutPage = async (req, res) => {
  try {
    res.render('buyer/checkout', {
      title: 'Secure Checkout | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getCheckoutPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load checkout page',
    });
  }
};

/**
 * Get Order Details page
 */
const getOrderDetailsPage = async (req, res) => {
  try {
    res.render('buyer/order-details', {
      title: 'Order Details | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getOrderDetailsPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load order details page',
    });
  }
};

/**
 * Get Profile page
 */
const getProfilePage = async (req, res) => {
  try {
    const buyer = req.user;

    // Count orders for this buyer
    const totalOrders = await Order.countDocuments({ buyer: buyer._id });

    // Calculate member since year
    const memberSince = buyer.createdAt ? new Date(buyer.createdAt).getFullYear() : new Date().getFullYear();

    // Format password last changed (use updatedAt as approximation or specific field if available)
    const passwordLastChanged = buyer.updatedAt ? Math.floor((Date.now() - new Date(buyer.updatedAt)) / (1000 * 60 * 60 * 24)) : 30;

    res.render('buyer/profile', {
      title: 'Profile | PARTSFORM',
      buyer: {
        id: buyer._id,
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        fullName: `${buyer.firstName} ${buyer.lastName}`,
        email: buyer.email,
        phone: buyer.phone,
        companyName: buyer.companyName,
        country: buyer.country,
        city: buyer.city,
        shippingAddress: buyer.shippingAddress,
        isActive: buyer.isActive,
        newsletter: buyer.newsletter,
        avatar: buyer.avatar,
        memberSince: memberSince,
        totalOrders: totalOrders,
        passwordLastChanged: passwordLastChanged,
        createdAt: buyer.createdAt,
        lastLogin: buyer.lastLogin,
      },
    });
  } catch (error) {
    console.error('Error in getProfilePage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load profile page',
    });
  }
};

/**
 * Get Settings page
 */
const getSettingsPage = async (req, res) => {
  try {
    res.render('buyer/settings', {
      title: 'Settings | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getSettingsPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load settings page',
    });
  }
};

/**
 * Get Claim Support page
 */
const getClaimsPage = async (req, res) => {
  try {
    res.render('buyer/claims', {
      title: 'Claim Support | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getClaimsPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load claims page',
    });
  }
};

/**
 * Get Create Claim page
 * Excludes orders that already have active claims (open or in-progress)
 */
const getCreateClaimPage = async (req, res) => {
  try {
    const buyerId = req.user._id;

    // Get buyer's orders
    const allOrders = await Order.find({ buyer: buyerId })
      .select('orderNumber status createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Get order numbers that have active claims (open or in-progress)
    const orderNumbers = allOrders.map(o => o.orderNumber);
    const claimsOnOrders = await Claim.find({
      buyer: buyerId,
      orderNumber: { $in: orderNumbers },
      status: { $in: ['open', 'in-progress'] }
    })
      .select('orderNumber')
      .lean();

    const orderNumbersWithActiveClaims = new Set(claimsOnOrders.map(c => c.orderNumber));

    // Filter out orders that already have active claims
    const orders = allOrders.filter(o => !orderNumbersWithActiveClaims.has(o.orderNumber));

    res.render('buyer/create-claim', {
      title: 'Create Claim | PARTSFORM',
      orders: orders
    });
  } catch (error) {
    console.error('Error in getCreateClaimPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load create claim page',
    });
  }
};

/**
 * Get Claim Details page
 */
const getClaimDetailsPage = async (req, res) => {
  try {
    const claimId = req.params.claimId;
    
    // Find the claim and verify ownership
    const claim = await Claim.findOne({
      ticketNumber: claimId,
      buyer: req.user._id
    }).lean();

    if (!claim) {
      return res.status(404).render('error', {
        title: 'Claim Not Found | PARTSFORM',
        error: 'Claim not found or you do not have access to it',
      });
    }

    res.render('buyer/claim-details', {
      title: `Claim #${claimId} | PARTSFORM`,
      claimId: claimId,
      claim: claim
    });
  } catch (error) {
    console.error('Error in getClaimDetailsPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load claim details page',
    });
  }
};

/**
 * Get claims list API
 * GET /buyer/api/claims
 */
const getClaimsApi = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const buyerId = req.user._id;

    // Build query
    const query = { buyer: buyerId };
    
    if (status && status !== '') {
      query.status = status;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { ticketNumber: searchRegex },
        { subject: searchRegex },
        { orderNumber: searchRegex },
        { category: searchRegex }
      ];
    }

    // Get claims with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [claims, total] = await Promise.all([
      Claim.find(query)
        .select('ticketNumber subject category status priority orderNumber createdAt updatedAt messages unreadByBuyer lastMessageAt lastMessageBy')
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Claim.countDocuments(query)
    ]);

    // Format claims for frontend
    const formattedClaims = claims.map(claim => ({
      id: claim.ticketNumber,
      subject: claim.subject,
      category: claim.category,
      status: claim.status,
      priority: claim.priority,
      orderNumber: claim.orderNumber || 'N/A',
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt || claim.lastMessageAt,
      messageCount: claim.messages ? claim.messages.length : 0,
      unreadCount: claim.unreadByBuyer || 0,
      lastMessageBy: claim.lastMessageBy
    }));

    // Get status counts for statistics
    const [openCount, inProgressCount, resolvedCount, closedCount] = await Promise.all([
      Claim.countDocuments({ buyer: buyerId, status: 'open' }),
      Claim.countDocuments({ buyer: buyerId, status: 'in-progress' }),
      Claim.countDocuments({ buyer: buyerId, status: 'resolved' }),
      Claim.countDocuments({ buyer: buyerId, status: 'closed' })
    ]);

    res.json({
      success: true,
      claims: formattedClaims,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        open: openCount,
        'in-progress': inProgressCount,
        resolved: resolvedCount,
        closed: closedCount
      }
    });
  } catch (error) {
    console.error('Error in getClaimsApi:', error);
    res.status(500).json({ success: false, error: 'Failed to load claims' });
  }
};

/**
 * Get claim details API
 * GET /buyer/api/claims/:claimId
 */
const getClaimDetailsApi = async (req, res) => {
  try {
    const claimId = req.params.claimId;
    const buyerId = req.user._id;
    
    const claim = await Claim.findOne({
      ticketNumber: claimId,
      buyer: buyerId
    }).lean();

    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    // Mark messages as read by buyer
    await Claim.updateOne(
      { _id: claim._id },
      { 
        $set: { 
          unreadByBuyer: 0,
          'messages.$[elem].readByBuyer': true 
        } 
      },
      { 
        arrayFilters: [{ 'elem.sender': 'admin' }] 
      }
    );

    // Format response
    const formattedClaim = {
      id: claim.ticketNumber,
      subject: claim.subject,
      description: claim.description,
      category: claim.category,
      status: claim.status,
      priority: claim.priority,
      orderNumber: claim.orderNumber || 'N/A',
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
      lastMessageAt: claim.lastMessageAt,
      attachments: claim.attachments || [],
      messages: claim.messages.map(msg => ({
        id: msg._id,
        sender: msg.sender,
        senderName: msg.senderName,
        content: msg.content,
        attachments: msg.attachments || [],
        timestamp: msg.createdAt,
        read: msg.readByBuyer
      }))
    };

    res.json({ success: true, claim: formattedClaim });
  } catch (error) {
    console.error('Error in getClaimDetailsApi:', error);
    res.status(500).json({ success: false, error: 'Failed to load claim' });
  }
};

/**
 * Create a new claim
 * POST /buyer/api/claims
 */
const createClaim = async (req, res) => {
  try {
    const buyer = req.user;
    const { subject, category, description, orderNumber, priority } = req.body;

    // Validate required fields
    if (!subject || !category || !description) {
      return res.status(400).json({
        success: false,
        error: 'Subject, category, and description are required'
      });
    }

    // Prevent duplicate claims: if orderNumber provided, check for existing active claim
    if (orderNumber && orderNumber.trim()) {
      const existingClaim = await Claim.findOne({
        buyer: buyer._id,
        orderNumber: orderNumber.trim(),
        status: { $in: ['open', 'in-progress'] }
      });
      if (existingClaim) {
        return res.status(400).json({
          success: false,
          error: 'This order already has an active claim. Please use the existing claim or wait until it is resolved.',
          claimId: existingClaim.ticketNumber
        });
      }
    }

    // Generate claim number
    const claimNumber = await Claim.generateTicketNumber();

    // Handle file attachments if any
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: `/uploads/claims/${file.filename}`
        });
      }
    }

    // Create the claim
    const claim = new Claim({
      ticketNumber: claimNumber,
      subject: subject.trim(),
      category,
      priority: priority || 'medium',
      description: description.trim(),
      buyer: buyer._id,
      buyerName: `${buyer.firstName} ${buyer.lastName}`.trim() || buyer.email,
      buyerEmail: buyer.email,
      orderNumber: orderNumber || null,
      attachments,
      messages: [{
        sender: 'buyer',
        senderName: `${buyer.firstName} ${buyer.lastName}`.trim() || 'Customer',
        senderId: buyer._id,
        senderModel: 'Buyer',
        content: description.trim(),
        attachments,
        readByAdmin: false,
        readByBuyer: true,
        createdAt: new Date()
      }],
      lastMessageAt: new Date(),
      lastMessageBy: 'buyer'
    });

    await claim.save();

    // Notify admins about new claim via socket
    socketService.notifyNewClaim(claim);

    res.status(201).json({
      success: true,
      message: 'Claim created successfully',
      claim: {
        id: claim.ticketNumber,
        subject: claim.subject,
        status: claim.status,
        createdAt: claim.createdAt
      }
    });
  } catch (error) {
    console.error('Error in createClaim:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create claim'
    });
  }
};

/**
 * Send a message in a claim
 * POST /buyer/api/claims/:claimId/messages
 */
const sendClaimMessage = async (req, res) => {
  try {
    const claimId = req.params.claimId;
    const buyer = req.user;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    // Find the claim
    const claim = await Claim.findOne({
      ticketNumber: claimId,
      buyer: buyer._id
    });

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    // Do not allow sending messages to resolved or closed claims
    if (['resolved', 'closed'].includes(claim.status)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot send messages to a resolved or closed claim'
      });
    }

    // Handle file attachments if any
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: `/uploads/claims/${file.filename}`
        });
      }
    }

    // Add the message
    const newMessage = await claim.addMessage({
      sender: 'buyer',
      senderName: `${buyer.firstName} ${buyer.lastName}`.trim() || 'Customer',
      senderId: buyer._id,
      content: message.trim(),
      attachments
    });

    // Emit socket event for real-time update
    socketService.emitToClaim(claimId, 'message-received', {
      claimId,
      message: {
        id: newMessage._id,
        sender: 'buyer',
        senderName: `${buyer.firstName} ${buyer.lastName}`.trim() || 'Customer',
        content: message.trim(),
        attachments,
        timestamp: newMessage.createdAt
      }
    });

    // Notify admins
    socketService.emitToAdmins('claim-new-message', {
      claimId,
      claimNumber: claim.ticketNumber,
      subject: claim.subject,
      message: {
        sender: 'buyer',
        senderName: `${buyer.firstName} ${buyer.lastName}`.trim() || 'Customer',
        content: message.trim().substring(0, 100),
        timestamp: newMessage.createdAt
      }
    });

    res.json({
      success: true,
      message: {
        id: newMessage._id,
        sender: 'buyer',
        senderName: `${buyer.firstName} ${buyer.lastName}`.trim() || 'Customer',
        content: message.trim(),
        attachments,
        timestamp: newMessage.createdAt
      }
    });
  } catch (error) {
    console.error('Error in sendClaimMessage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
};

/**
 * Mark claim messages as read
 * PUT /buyer/api/claims/:claimId/read
 */
const markClaimAsRead = async (req, res) => {
  try {
    const claimId = req.params.claimId;
    const buyerId = req.user._id;

    const claim = await Claim.findOne({
      ticketNumber: claimId,
      buyer: buyerId
    });

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    await claim.markAsRead('buyer');

    // Notify via socket
    socketService.emitToClaim(claimId, 'messages-marked-read', {
      claimId,
      readBy: 'buyer'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error in markClaimAsRead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark as read'
    });
  }
};

/**
 * Get user's preferred currency
 * GET /buyer/api/settings/currency
 */
const getPreferredCurrency = async (req, res) => {
  try {
    const buyer = req.user;
    res.json({
      success: true,
      currency: buyer.preferredCurrency || 'USD',
    });
  } catch (error) {
    console.error('Error in getPreferredCurrency:', error);
    res.status(500).json({ success: false, error: 'Failed to get currency preference' });
  }
};

/**
 * Update user's preferred currency
 * PUT /buyer/api/settings/currency
 */
const updatePreferredCurrency = async (req, res) => {
  try {
    const buyer = req.user;
    const { currency } = req.body;

    // Validate currency code (ORIGINAL shows prices in their original database currency)
    const validCurrencies = ['ORIGINAL', 'USD', 'EUR', 'GBP', 'AED', 'JPY', 'CNY', 'RUB', 'CAD', 'AUD', 'CHF', 'INR', 'KRW', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'PLN', 'THB', 'MYR', 'MXN', 'BRL', 'ZAR', 'TRY', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'EGP', 'PKR', 'PHP', 'IDR', 'VND', 'NZD', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'UAH'];
    
    if (!currency || !validCurrencies.includes(currency.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid currency code',
      });
    }

    const updated = await Buyer.findByIdAndUpdate(
      buyer._id,
      { preferredCurrency: currency.toUpperCase() },
      { new: true, runValidators: false }
    );

    res.json({
      success: true,
      message: 'Currency preference updated successfully',
      currency: updated.preferredCurrency,
    });
  } catch (error) {
    console.error('Error in updatePreferredCurrency:', error);
    res.status(500).json({ success: false, message: 'Failed to update currency preference' });
  }
};

/**
 * Upload avatar image
 * POST /buyer/profile/avatar
 */
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded',
      });
    }

    const buyer = req.user;

    // Process the uploaded file
    const imageInfo = processProfileImage(req.file);

    if (!imageInfo) {
      return res.status(400).json({
        success: false,
        message: 'Failed to process uploaded image',
      });
    }

    // Delete old avatar if exists
    if (buyer.avatar) {
      await deleteOldProfileImage(buyer.avatar);
    }

    // Update only avatar field (avoids full-document validation that can fail on other fields e.g. country)
    await Buyer.findByIdAndUpdate(buyer._id, { avatar: imageInfo.url });

    res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        avatar: imageInfo.url,
        filename: imageInfo.filename,
      },
    });
  } catch (error) {
    console.error('Error in uploadAvatar:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image. Please try again.',
    });
  }
};

/**
 * Update profile information
 * PUT /buyer/profile
 */
const updateProfile = async (req, res) => {
  try {
    const buyer = req.user;
    const { firstName, lastName, phone, companyName, city, shippingAddress } = req.body;

    // Fields that can be updated
    const allowedUpdates = {};

    if (firstName) allowedUpdates.firstName = firstName.trim();
    if (lastName) allowedUpdates.lastName = lastName.trim();
    if (phone) allowedUpdates.phone = phone.trim();
    if (companyName) allowedUpdates.companyName = companyName.trim();
    if (city) allowedUpdates.city = city.trim();
    if (shippingAddress) allowedUpdates.shippingAddress = shippingAddress.trim();

    // Update buyer
    Object.assign(buyer, allowedUpdates);
    await buyer.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        fullName: `${buyer.firstName} ${buyer.lastName}`,
        phone: buyer.phone,
        companyName: buyer.companyName,
        city: buyer.city,
        shippingAddress: buyer.shippingAddress,
      },
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update profile. Please try again.',
    });
  }
};

/**
 * Change password
 * PUT /buyer/profile/password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All password fields are required',
      });
    }

    // Check if new password matches confirmation
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match',
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long',
      });
    }

    // Get buyer with password
    const buyer = await Buyer.findById(req.user._id).select('+password');
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isMatch = await buyer.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Check if new password is same as current
    const isSamePassword = await buyer.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
    }

    // Update password
    buyer.password = newPassword;
    await buyer.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Error in changePassword:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password. Please try again.',
    });
  }
};

// ====================================
// ORDER MANAGEMENT API FUNCTIONS
// ====================================

/**
 * Validate and refresh cart items with server-calculated prices
 * POST /buyer/api/cart/validate
 * Ensures prices are current and markup is applied
 */
const validateCartItems = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.json({
        success: true,
        validatedItems: [],
        totalAmount: 0,
        markupPercentage: 0
      });
    }

    // Get buyer with markup percentage
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Get the buyer's effective markup percentage
    const markupPercentage = await getEffectiveMarkup(buyer);

    // Validate and calculate prices server-side
    const validatedItems = [];
    const invalidItems = [];

    for (const item of items) {
      const partNumber = (item.code || item.partNumber || '').trim();
      const supplier = (item.supplier || '').trim();
      
      let dbPart = null;
      
      // Strategy 1: Try by MongoDB _id if available (most reliable)
      if (item._id) {
        try {
          const mongoose = require('mongoose');
          if (mongoose.Types.ObjectId.isValid(item._id)) {
            dbPart = await Part.findById(item._id).lean();
          }
        } catch (e) {
          // Invalid ObjectId, skip
        }
      }
      
      // Strategy 2: Try exact partNumber + supplier match
      if (!dbPart && partNumber) {
        const escapedPartNumber = partNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const partQuery = {
          partNumber: { $regex: `^${escapedPartNumber}$`, $options: 'i' }
        };
        
        if (supplier) {
          const escapedSupplier = supplier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          partQuery.supplier = { $regex: `^${escapedSupplier}$`, $options: 'i' };
        }
        
        dbPart = await Part.findOne(partQuery).lean();
      }
      
      // Strategy 3: Try partNumber only (fallback when supplier doesn't match exactly)
      if (!dbPart && partNumber) {
        const escapedPartNumber = partNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        dbPart = await Part.findOne({
          partNumber: { $regex: `^${escapedPartNumber}$`, $options: 'i' }
        }).lean();
      }
      
      if (dbPart) {
        const originalPrice = parseFloat(dbPart.price) || 0;
        const markedUpPrice = applyMarkupToPrice(originalPrice, markupPercentage);
        
        validatedItems.push({
          ...item,
          _id: dbPart._id,
          code: dbPart.partNumber,
          partNumber: dbPart.partNumber,
          description: dbPart.description || item.description,
          brand: dbPart.brand || item.brand,
          supplier: dbPart.supplier || item.supplier,
          price: markedUpPrice,
          originalPrice: originalPrice,
          currency: item.currency || 'AED',
          weight: parseFloat(dbPart.weight) || parseFloat(item.weight) || 0,
          stock: dbPart.stock || item.stock || 'N/A',
          validated: true
        });
      } else {
        // Part not found - include with warning flag
        validatedItems.push({
          ...item,
          validated: false,
          warning: 'Part not found in database - price may be outdated'
        });
        invalidItems.push(partNumber);
      }
    }

    const totalAmount = validatedItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

    res.json({
      success: true,
      validatedItems,
      totalAmount,
      markupPercentage,
      invalidItems: invalidItems.length > 0 ? invalidItems : undefined
    });
  } catch (error) {
    console.error('Error validating cart items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate cart items',
      error: error.message
    });
  }
};

/**
 * Validate checkout - check cart items before proceeding
 * POST /buyer/api/checkout/validate
 * Expects cart items in request body
 * Each item is individual (no quantity grouping)
 */
const validateCheckout = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const { items } = req.body;

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty'
      });
    }

    // Get buyer with markup percentage
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Get the buyer's effective markup percentage
    const markupPercentage = await getEffectiveMarkup(buyer);

    // SECURITY: Validate and recalculate prices server-side
    const validatedItems = [];
    const invalidItems = [];

    for (const item of items) {
      const partNumber = (item.code || item.partNumber || '').trim();
      const supplier = (item.supplier || '').trim();
      
      let dbPart = null;
      
      // Strategy 1: Try by MongoDB _id if available (most reliable)
      if (item._id) {
        try {
          const mongoose = require('mongoose');
          if (mongoose.Types.ObjectId.isValid(item._id)) {
            dbPart = await Part.findById(item._id).lean();
          }
        } catch (e) {
          // Invalid ObjectId, skip
        }
      }
      
      // Strategy 2: Try exact partNumber + supplier match
      if (!dbPart && partNumber) {
        const escapedPartNumber = partNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const partQuery = {
          partNumber: { $regex: `^${escapedPartNumber}$`, $options: 'i' }
        };
        
        if (supplier) {
          const escapedSupplier = supplier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          partQuery.supplier = { $regex: `^${escapedSupplier}$`, $options: 'i' };
        }
        
        dbPart = await Part.findOne(partQuery).lean();
      }
      
      // Strategy 3: Try partNumber only (fallback when supplier doesn't match exactly)
      if (!dbPart && partNumber) {
        const escapedPartNumber = partNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        dbPart = await Part.findOne({
          partNumber: { $regex: `^${escapedPartNumber}$`, $options: 'i' }
        }).lean();
      }
      
      if (dbPart) {
        const originalPrice = parseFloat(dbPart.price) || 0;
        const markedUpPrice = applyMarkupToPrice(originalPrice, markupPercentage);
        
        validatedItems.push({
          ...item,
          _id: dbPart._id,
          code: dbPart.partNumber,
          partNumber: dbPart.partNumber,
          description: dbPart.description || item.description,
          brand: dbPart.brand || item.brand,
          supplier: dbPart.supplier || item.supplier,
          price: markedUpPrice, // Server-calculated price with markup
          originalPrice: originalPrice,
          currency: item.currency || 'AED',
          weight: parseFloat(dbPart.weight) || parseFloat(item.weight) || 0,
          stock: dbPart.stock || item.stock || 'N/A'
        });
      } else {
        invalidItems.push({
          partNumber: partNumber,
          supplier: supplier,
          reason: 'Part not found in database'
        });
      }
    }

    // If any items were invalid, return error
    if (invalidItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${invalidItems.length} item(s) could not be validated`,
        invalidItems
      });
    }

    // Calculate totals with validated prices
    const totalItems = validatedItems.length;
    const totalAmount = validatedItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const totalWeight = validatedItems.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);

    res.json({
      success: true,
      message: 'Cart is valid for checkout',
      cart: {
        itemsCount: validatedItems.length,
        totalItems,
        totalAmount,
        totalWeight
      },
      validatedItems, // Return validated items with server-calculated prices
      markupPercentage
    });
  } catch (error) {
    console.error('Error validating checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate checkout',
      error: error.message
    });
  }
};

/**
 * Create order from cart items
 * POST /buyer/api/orders/create
 * Expects cart items and payment info in request body
 * Each item is stored individually in the order
 */
const createOrder = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const { items, paymentType, paymentMethod, fee, notes, shippingAddress } = req.body;

    // Validate input
    if (!paymentType || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment type and method are required'
      });
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart items are required'
      });
    }

    // Validate shipping address
    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.street || !shippingAddress.city) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required'
      });
    }

    // Get buyer with markup percentage
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Get the buyer's effective markup percentage (from buyer or system default)
    const markupPercentage = await getEffectiveMarkup(buyer);

    // FAST VALIDATION: Use batch queries instead of sequential
    console.log('[Order] Processing', items.length, 'items');
    
    // Collect all part numbers and _ids for batch lookup
    const partNumbers = [];
    const objectIds = [];
    const mongoose = require('mongoose');
    
    items.forEach(item => {
      const partNumber = (item.code || item.partNumber || '').trim().toUpperCase();
      if (partNumber) partNumbers.push(partNumber);
      if (item._id && mongoose.Types.ObjectId.isValid(item._id)) {
        objectIds.push(new mongoose.Types.ObjectId(item._id));
      }
    });

    // Batch fetch all parts at once
    let dbParts = [];
    if (objectIds.length > 0 || partNumbers.length > 0) {
      const query = { $or: [] };
      if (objectIds.length > 0) query.$or.push({ _id: { $in: objectIds } });
      if (partNumbers.length > 0) query.$or.push({ partNumber: { $in: partNumbers } });
      
      dbParts = await Part.find(query).lean();
      console.log('[Order] Batch fetched', dbParts.length, 'parts from DB');
    }

    // Create lookup maps for fast matching
    const partsByIdMap = new Map();
    const partsByNumberMap = new Map();
    dbParts.forEach(part => {
      if (part._id) partsByIdMap.set(part._id.toString(), part);
      if (part.partNumber) {
        const key = part.partNumber.toUpperCase();
        if (!partsByNumberMap.has(key)) partsByNumberMap.set(key, []);
        partsByNumberMap.get(key).push(part);
      }
    });

    // Process items with fast lookups
    const validatedItems = [];
    let validationWarnings = 0;

    for (const item of items) {
      const partNumber = (item.code || item.partNumber || '').trim().toUpperCase();
      const supplier = (item.supplier || '').trim();
      
      let dbPart = null;
      
      // Try _id first (most reliable)
      if (item._id) {
        dbPart = partsByIdMap.get(item._id.toString());
      }
      
      // Try partNumber match
      if (!dbPart && partNumber) {
        const candidates = partsByNumberMap.get(partNumber) || [];
        // Prefer matching supplier if available
        if (supplier) {
          dbPart = candidates.find(p => 
            (p.supplier || '').toLowerCase() === supplier.toLowerCase()
          );
        }
        // Fall back to first match
        if (!dbPart && candidates.length > 0) {
          dbPart = candidates[0];
        }
      }
      
      if (dbPart) {
        // Found in database - use DB price with markup applied
        const originalPrice = parseFloat(dbPart.price) || 0;
        const markedUpPrice = applyMarkupToPrice(originalPrice, markupPercentage);
        
        validatedItems.push({
          ...item,
          _id: dbPart._id,
          code: dbPart.partNumber,
          partNumber: dbPart.partNumber,
          description: dbPart.description || item.description,
          brand: dbPart.brand || item.brand,
          supplier: dbPart.supplier || item.supplier,
          price: markedUpPrice,
          originalPrice: originalPrice,
          currency: item.currency || 'AED',
          weight: parseFloat(dbPart.weight) || parseFloat(item.weight) || 0,
          stock: dbPart.stock || item.stock || 'N/A',
          markupApplied: markupPercentage
        });
      } else {
        // Part not found - still accept with client price (logged for review)
        console.log('[Order] Warning: Using client price for:', partNumber);
        validationWarnings++;
        validatedItems.push({
          ...item,
          code: item.code || item.partNumber,
          partNumber: item.code || item.partNumber,
          price: parseFloat(item.price) || 0,
          currency: item.currency || 'AED',
          weight: parseFloat(item.weight) || 0,
          validationWarning: 'Price not verified from database'
        });
      }
    }

    if (validationWarnings > 0) {
      console.log('[Order] Completed with', validationWarnings, 'validation warnings');
    }

    // Create order from validated cart items with server-calculated prices
    const paymentInfo = {
      type: paymentType,
      method: paymentMethod,
      fee: parseFloat(fee) || 0,
      notes: notes || '',
      shippingAddress: {
        addressId: shippingAddress.addressId,
        label: shippingAddress.label,
        fullName: shippingAddress.fullName,
        phone: shippingAddress.phone,
        street: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        country: shippingAddress.country,
        postalCode: shippingAddress.postalCode || '',
        notes: shippingAddress.notes || ''
      }
    };

    // Handle referral - use buyer's linked referral from registration
    let referralData = null;
    const orderSubtotal = validatedItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
    
    // Check if buyer has a referral linked from registration
    if (buyer.registrationReferral && buyer.registrationReferral.code && buyer.registrationReferral.partnerId) {
      // Verify partner is still active
      const ReferralPartner = require('../models/ReferralPartner');
      const partner = await ReferralPartner.findById(buyer.registrationReferral.partnerId);
      
      if (partner && partner.status === 'active') {
        const discountRate = buyer.registrationReferral.discountRate || 0;
        const discountAmount = orderSubtotal * (discountRate / 100);
        
        referralData = {
          code: buyer.registrationReferral.code,
          codeId: buyer.registrationReferral.codeId,
          partnerId: buyer.registrationReferral.partnerId,
          discountRate: discountRate,
          discountAmount: Math.round(discountAmount * 100) / 100,
          commissionRate: buyer.registrationReferral.commissionRate || 5
        };
        paymentInfo.referral = referralData;
        console.log('[Order] Buyer registration referral applied:', referralData.code, 'discount:', referralData.discountAmount);
      } else {
        console.log('[Order] Buyer has referral but partner is inactive');
      }
    }

    const order = await Order.createFromCartItems(buyer, validatedItems, paymentInfo);

    // Track purchase in analytics (non-blocking)
    if (partsAnalyticsService && order) {
      partsAnalyticsService.trackPurchase(order)
        .catch(err => console.error('[Analytics] Purchase tracking error:', err.message));
    }

    // Process referral commission if referral was applied
    if (referralData && order) {
      try {
        await referralService.processOrderReferral(order, referralData, buyer);
      } catch (refErr) {
        console.error('[Order] Error processing referral commission:', refErr);
        // Don't fail the order, just log the error
      }
    }

    res.json({
      success: true,
      message: 'Order created successfully',
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.pricing.total,
        subtotal: order.pricing.subtotal,
        fee: order.pricing.processingFee,
        paymentType: order.payment.type,
        paymentMethod: order.payment.method,
        amountDue: order.payment.amountDue,
        itemsCount: order.totalItems,
        createdAt: order.createdAt,
        type: order.type,
        shippingAddress: order.shipping
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

/**
 * Get buyer's registration referral
 * GET /buyer/api/referral/status
 * Returns the referral data linked to buyer at registration time (if any)
 */
const getReferralStatus = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const buyer = await Buyer.findById(buyerId).select('registrationReferral');
    
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Check if buyer has a linked referral
    if (buyer.registrationReferral && buyer.registrationReferral.code) {
      // Verify partner is still active
      const ReferralPartner = require('../models/ReferralPartner');
      const partner = await ReferralPartner.findById(buyer.registrationReferral.partnerId);
      
      const isPartnerActive = partner && partner.status === 'active';
      
      return res.json({
        success: true,
        hasReferral: true,
        referral: {
          code: buyer.registrationReferral.code,
          partnerName: buyer.registrationReferral.partnerName,
          partnerId: buyer.registrationReferral.partnerId,
          discountRate: buyer.registrationReferral.discountRate || 0,
          commissionRate: buyer.registrationReferral.commissionRate || 0,
          registeredAt: buyer.registrationReferral.registeredAt,
          isActive: isPartnerActive // Partner must be active for commission to apply
        }
      });
    }

    // No referral linked
    return res.json({
      success: true,
      hasReferral: false,
      referral: null
    });
  } catch (error) {
    console.error('Error getting referral status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting referral status'
    });
  }
};

/**
 * Validate a referral code
 * POST /buyer/api/referral/validate
 * Expects { code, orderTotal } in request body
 * Now returns codeId for codes with validity periods
 * @deprecated Use registration flow instead - codes are applied at signup, not checkout
 */
const validateReferralCode = async (req, res) => {
  try {
    const { code, orderTotal } = req.body;
    const buyerId = req.user?._id || null;
    
    if (!code) {
      return res.json({
        success: true,
        valid: false,
        message: 'Please enter a referral code'
      });
    }
    
    const result = await referralService.validateReferralCode(code, orderTotal || 0, buyerId);
    
    res.json({
      success: true,
      valid: result.valid,
      message: result.message,
      referral: result.referral
    });
  } catch (error) {
    console.error('Error validating referral code:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Error validating referral code'
    });
  }
};

/**
 * Get buyer's orders with filtering and pagination
 * GET /buyer/api/orders
 */
const getOrders = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const {
      status,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    const query = { buyer: buyerId };

    // Status filter
    if (status) {
      query.status = status;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom + 'T00:00:00');
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo + 'T23:59:59');
      }
    }

    // Search filter (order number or item description)
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'items.partNumber': { $regex: search, $options: 'i' } },
        { 'items.description': { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Order.countDocuments(query)
    ]);

    // Get active claims for these orders (open or in-progress only)
    const orderNumbers = orders.map(o => o.orderNumber);
    const activeClaims = await Claim.find({
      buyer: buyerId,
      orderNumber: { $in: orderNumbers },
      status: { $in: ['open', 'in-progress'] }
    })
      .select('orderNumber ticketNumber')
      .lean();

    const orderToClaim = {};
    activeClaims.forEach(c => {
      orderToClaim[c.orderNumber] = { id: c.ticketNumber };
    });

    // Format orders for response
    const formattedOrders = orders.map(order => {
      const claimInfo = orderToClaim[order.orderNumber];
      return {
        orderNumber: order.orderNumber,
        date: order.createdAt,
        status: order.status,
        items: order.items,
        itemsCount: order.totalItems,
        itemsPreview: (order.items || []).slice(0, 3).map(item => item.description || item.partNumber),
        amount: order.pricing.total,
        total: order.pricing.total,
        paymentStatus: order.payment.status,
        type: order.type,
        category: order.type,
        hasActiveClaim: !!claimInfo,
        claimId: claimInfo ? claimInfo.id : null
      };
    });

    // Get status counts
    const statusCounts = await Order.aggregate([
      { $match: { buyer: buyerId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0
    };

    statusCounts.forEach(item => {
      if (item._id === 'pending') stats.pending = item.count;
      else if (item._id === 'processing') stats.processing = item.count;
      else if (item._id === 'completed' || item._id === 'delivered') {
        stats.completed += item.count;
      }
    });

    res.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      stats
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders',
      error: error.message
    });
  }
};

/**
 * Get order details
 * GET /buyer/api/orders/:orderNumber
 */
const getOrderDetails = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const { orderNumber } = req.params;

    // Find order
    const order = await Order.findOne({
      orderNumber,
      buyer: buyerId
    }).populate('buyer', 'firstName lastName email phone companyName');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if order has active claim
    const activeClaim = await Claim.findOne({
      buyer: buyerId,
      orderNumber: order.orderNumber,
      status: { $in: ['open', 'in-progress'] }
    })
      .select('ticketNumber')
      .lean();

    res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        hasActiveClaim: !!activeClaim,
        claimId: activeClaim ? activeClaim.ticketNumber : null,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,

        // Items with complete details
        items: order.items,
        totalItems: order.totalItems,
        totalWeight: order.totalWeight,

        // Pricing
        pricing: order.pricing,

        // Payment
        payment: order.payment,

        // Shipping
        shipping: order.shipping,

        // Timeline
        timeline: order.timeline,

        // Additional info
        notes: order.notes,
        type: order.type,
        priority: order.priority,
        cancellation: order.cancellation
      }
    });
  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order details',
      error: error.message
    });
  }
};

/**
 * Cancel order
 * PUT /buyer/api/orders/:orderNumber/cancel
 */
const cancelOrder = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const { orderNumber } = req.params;
    const { reason } = req.body;

    // Find order
    const order = await Order.findOne({
      orderNumber,
      buyer: buyerId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Cancel order
    await order.cancelOrder(reason || 'Cancelled by buyer', 'Buyer');

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        cancellation: order.cancellation
      }
    });
  } catch (error) {
    console.error('Error cancelling order:', error);

    if (error.message === 'Order cannot be cancelled') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
};

/**
 * Process payment for order
 * POST /buyer/api/orders/:orderNumber/payment
 */
const processPayment = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const { orderNumber } = req.params;
    const { transactionId, amount, method, status, notes } = req.body;

    // Find order
    const order = await Order.findOne({
      orderNumber,
      buyer: buyerId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Add payment transaction
    order.addPaymentTransaction({
      transactionId,
      amount: parseFloat(amount),
      method: method || order.payment.method,
      status: status || 'completed',
      notes: notes || ''
    });

    // Update order status if payment is completed
    if (order.payment.status === 'paid' && order.status === 'pending') {
      await order.updateStatus('processing', 'Payment received, order is being processed');
    }

    await order.save();

    res.json({
      success: true,
      message: 'Payment processed successfully',
      order: {
        orderNumber: order.orderNumber,
        paymentStatus: order.payment.status,
        amountPaid: order.payment.amountPaid,
        amountDue: order.payment.amountDue,
        status: order.status
      }
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: error.message
    });
  }
};

// ====================================
// ADDRESS MANAGEMENT API
// ====================================

/**
 * Get all addresses for the authenticated buyer
 * Refactored with robust error handling and logging
 */
const getAddresses = async (req, res) => {
  try {
    // Verify user is authenticated
    if (!req.user || !req.user._id) {
      console.error('[getAddresses] No authenticated user found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Always fetch fresh from database to avoid stale data
    const buyer = await Buyer.findById(req.user._id)
      .select('addresses')
      .lean()
      .maxTimeMS(10000); // 10 second timeout

    if (!buyer) {
      console.error('[getAddresses] Buyer not found for ID:', req.user._id);
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Ensure addresses is an array
    const buyerAddresses = Array.isArray(buyer.addresses) ? buyer.addresses : [];

    // Sort addresses: default first, then by creation date (newest first)
    const addresses = buyerAddresses.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    // Return successful response
    return res.json({
      success: true,
      addresses: addresses,
      count: addresses.length
    });
  } catch (error) {
    console.error('[getAddresses] Error:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch addresses',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Add a new address
 */
const addAddress = async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.user._id);
    
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    const { label, fullName, phone, street, city, state, country, postalCode, notes, isDefault } = req.body;

    // Validate required fields
    if (!label || !fullName || !phone || !street || !city || !state || !country) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // If this is the first address or marked as default, set it as default
    const shouldBeDefault = buyer.addresses.length === 0 || isDefault;

    // If new address is default, remove default from all others
    if (shouldBeDefault) {
      buyer.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    // Create new address
    const newAddress = {
      label,
      fullName,
      phone,
      street,
      city,
      state,
      country,
      postalCode: postalCode || '',
      notes: notes || '',
      isDefault: shouldBeDefault
    };

    buyer.addresses.push(newAddress);
    await buyer.save();

    // Get the newly added address (it will be the last one)
    const addedAddress = buyer.addresses[buyer.addresses.length - 1];

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      address: addedAddress
    });
  } catch (error) {
    console.error('Error adding address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add address',
      error: error.message
    });
  }
};

/**
 * Update an existing address
 */
const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const buyer = await Buyer.findById(req.user._id);
    
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    const addressIndex = buyer.addresses.findIndex(addr => addr._id.toString() === addressId);
    
    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const { label, fullName, phone, street, city, state, country, postalCode, notes, isDefault } = req.body;

    // If this address is being set as default, remove default from others
    if (isDefault) {
      buyer.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    // Update address fields
    if (label) buyer.addresses[addressIndex].label = label;
    if (fullName) buyer.addresses[addressIndex].fullName = fullName;
    if (phone) buyer.addresses[addressIndex].phone = phone;
    if (street) buyer.addresses[addressIndex].street = street;
    if (city) buyer.addresses[addressIndex].city = city;
    if (state) buyer.addresses[addressIndex].state = state;
    if (country) buyer.addresses[addressIndex].country = country;
    buyer.addresses[addressIndex].postalCode = postalCode || '';
    buyer.addresses[addressIndex].notes = notes || '';
    buyer.addresses[addressIndex].isDefault = isDefault || false;

    await buyer.save();

    res.json({
      success: true,
      message: 'Address updated successfully',
      address: buyer.addresses[addressIndex]
    });
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update address',
      error: error.message
    });
  }
};

/**
 * Delete an address
 */
const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const buyer = await Buyer.findById(req.user._id);
    
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    const addressIndex = buyer.addresses.findIndex(addr => addr._id.toString() === addressId);
    
    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    const wasDefault = buyer.addresses[addressIndex].isDefault;
    
    // Remove the address
    buyer.addresses.splice(addressIndex, 1);

    // If deleted address was default and there are other addresses, make the first one default
    if (wasDefault && buyer.addresses.length > 0) {
      buyer.addresses[0].isDefault = true;
    }

    await buyer.save();

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete address',
      error: error.message
    });
  }
};

/**
 * Set an address as default
 */
const setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const buyer = await Buyer.findById(req.user._id);
    
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    const addressIndex = buyer.addresses.findIndex(addr => addr._id.toString() === addressId);
    
    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Remove default from all addresses
    buyer.addresses.forEach(addr => {
      addr.isDefault = false;
    });

    // Set the selected address as default
    buyer.addresses[addressIndex].isDefault = true;

    await buyer.save();

    res.json({
      success: true,
      message: 'Default address updated successfully',
      address: buyer.addresses[addressIndex]
    });
  } catch (error) {
    console.error('Error setting default address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default address',
      error: error.message
    });
  }
};

// Export controller functions
module.exports = {
  getBuyerMain,
  getAutomotiveSearchPage,
  getSearchV2Page,
  getAffiliatePage,
  getOrdersPage,
  getPaymentPage,
  getDeliveryPage,
  getContactsPage,
  getCartPage,
  getCheckoutPage,
  getOrderDetailsPage,
  getProfilePage,
  getSettingsPage,
  getClaimsPage,
  getCreateClaimPage,
  getClaimDetailsPage,
  uploadAvatar,
  updateProfile,
  changePassword,

  // Order Management API
  validateCartItems,
  validateCheckout,
  createOrder,
  validateReferralCode,
  getReferralStatus,
  getOrders,
  getOrderDetails,
  cancelOrder,
  processPayment,

  // Address Management API
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,

  // Claims API
  getClaimsApi,
  getClaimDetailsApi,
  createClaim,
  sendClaimMessage,
  markClaimAsRead,

  // Currency Preference API
  getPreferredCurrency,
  updatePreferredCurrency,
};

