// Buyer Controller
// This file contains all buyer-related controller functions

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
    res.render('buyer/profile', {
      title: 'Profile | PARTSFORM',
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
};

