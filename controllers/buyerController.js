// Buyer Controller
// This file contains all buyer-related controller functions

const Buyer = require('../models/Buyer');
const { processProfileImage, deleteOldProfileImage } = require('../utils/fileUploader');

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
        isVerified: buyer.isVerified,
        newsletter: buyer.newsletter,
        avatar: buyer.avatar,
        memberSince: memberSince,
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
 * Get Support Tickets page
 */
const getTicketsPage = async (req, res) => {
  try {
    res.render('buyer/tickets', {
      title: 'Support Tickets | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getTicketsPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load tickets page',
    });
  }
};

/**
 * Get Create Ticket page
 */
const getCreateTicketPage = async (req, res) => {
  try {
    res.render('buyer/create-ticket', {
      title: 'Create Support Ticket | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getCreateTicketPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load create ticket page',
    });
  }
};

/**
 * Get Ticket Details page
 */
const getTicketDetailsPage = async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    res.render('buyer/ticket-details', {
      title: `Ticket #${ticketId} | PARTSFORM`,
      ticketId: ticketId,
    });
  } catch (error) {
    console.error('Error in getTicketDetailsPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load ticket details page',
    });
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

    // Update buyer's avatar in database
    buyer.avatar = imageInfo.url;
    await buyer.save();

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

// Export controller functions
module.exports = {
  getBuyerMain,
  getAutomotiveSearchPage,
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
  getTicketsPage,
  getCreateTicketPage,
  getTicketDetailsPage,
  uploadAvatar,
  updateProfile,
};

