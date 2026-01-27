// Admin Controller
// This file contains all admin-related controller functions

const Integration = require('../models/Integration');
const Part = require('../models/Part');
const ftpService = require('../services/ftpService');
const syncService = require('../services/syncService');
const schedulerService = require('../services/schedulerService');
const elasticsearchService = require('../services/elasticsearchService');

/**
 * Get module from query parameter and get module-specific data
 */
const getModuleData = (req) => {
  const module = req.query.module || null;
  
  // Module configurations - now automotive only
  const moduleConfigs = {
    automotive: {
      name: 'Automotive',
      icon: 'car',
      color: '#0ea5e9',
      filterIndustry: 'automotive'
    }
  };

  return {
    currentModule: module,
    moduleConfig: module ? moduleConfigs[module] : null
  };
};

/**
 * Filter data by module
 */
const filterByModule = (data, module, industryField = 'industry') => {
  if (!module) return data;
  return data.filter(item => item[industryField] === module);
};

/**
 * Get Admin Dashboard page
 */
const getAdminDashboard = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Get mock data from app locals
    const partsDatabase = req.app.locals.partsDatabase || {};
    const ticketsDatabase = req.app.locals.ticketsDatabase || [];

    // Calculate statistics
    const allParts = Object.values(partsDatabase).flat();
    const totalProducts = allParts.length;
    const totalTickets = ticketsDatabase.length;
    const openTickets = ticketsDatabase.filter(t => t.status === 'open').length;
    
    // Mock orders data - automotive only
    const allOrders = [
      { id: 'ORD-2025-1247', customer: 'AutoMax Germany', amount: 45200, status: 'processing', industry: 'automotive', date: '2025-12-26' },
      { id: 'ORD-2025-1246', customer: 'Premium Auto Parts', amount: 12800, status: 'shipped', industry: 'automotive', date: '2025-12-26' },
      { id: 'ORD-2025-1245', customer: 'Euro Auto Systems', amount: 89500, status: 'delivered', industry: 'automotive', date: '2025-12-25' },
      { id: 'ORD-2025-1244', customer: 'PartsWorld Inc', amount: 156000, status: 'processing', industry: 'automotive', date: '2025-12-25' },
      { id: 'ORD-2025-1243', customer: 'AutoParts Express', amount: 8750, status: 'pending', industry: 'automotive', date: '2025-12-24' },
      { id: 'ORD-2025-1242', customer: 'Car Components Ltd', amount: 67300, status: 'shipped', industry: 'automotive', date: '2025-12-24' },
      { id: 'ORD-2025-1241', customer: 'Drive Parts Co', amount: 234000, status: 'pending', industry: 'automotive', date: '2025-12-23' },
      { id: 'ORD-2025-1240', customer: 'Motor Supply Inc', amount: 19500, status: 'delivered', industry: 'automotive', date: '2025-12-23' },
    ];

    // Filter orders by module if selected
    const recentOrders = filterByModule(allOrders, currentModule);

    // Calculate module-specific or overall stats
    const calculateModuleStats = (industry) => {
      const orders = industry ? allOrders.filter(o => o.industry === industry) : allOrders;
      return {
        orders: orders.length,
        revenue: orders.reduce((sum, o) => sum + o.amount, 0),
        growth: 24
      };
    };

    const moduleStats = currentModule ? calculateModuleStats(currentModule) : null;
    
    // Mock statistics for dashboard
    const stats = {
      totalOrders: currentModule ? moduleStats.orders : 1247,
      totalRevenue: currentModule ? moduleStats.revenue : 2847562,
      activeUsers: currentModule ? Math.floor(892 / 3) : 892,
      pendingTickets: openTickets,
      totalProducts: totalProducts,
      growth: currentModule ? moduleStats.growth : 22,
      
      // Automotive-specific stats
      automotive: { orders: 1247, revenue: 2847562, growth: 24, topParts: ['Brake Systems', 'Engine Components', 'Suspension'] }
    };

    // Mock chart data - automotive focused
    const getChartData = () => {
      return {
        revenueLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        revenueData: [180000, 220000, 195000, 280000, 310000, 275000, 320000, 350000, 295000, 380000, 420000, 285000],
        orderLabels: ['Engine Parts', 'Brakes', 'Suspension', 'Electrical', 'Body Parts'],
        orderData: [320, 280, 195, 165, 135]
      };
    };

    // Mock tickets data - automotive only
    const allTickets = [
      { id: 'TKT-001', subject: 'Brake pad compatibility issue', category: 'Product', status: 'open', priority: 'high', orderNumber: 'ORD-2025-1246', industry: 'automotive', createdAt: '2025-12-26', messages: [{}, {}] },
      { id: 'TKT-002', subject: 'Urgent engine part needed', category: 'Shipping', status: 'open', priority: 'urgent', orderNumber: 'ORD-2025-1247', industry: 'automotive', createdAt: '2025-12-26', messages: [{}, {}, {}] },
      { id: 'TKT-003', subject: 'Transmission part delivery delay', category: 'Shipping', status: 'in-progress', priority: 'medium', orderNumber: 'ORD-2025-1245', industry: 'automotive', createdAt: '2025-12-25', messages: [{}] },
      { id: 'TKT-004', subject: 'Engine component return request', category: 'Returns', status: 'open', priority: 'medium', orderNumber: 'ORD-2025-1243', industry: 'automotive', createdAt: '2025-12-25', messages: [{}, {}] },
      { id: 'TKT-005', subject: 'Brake system certification docs', category: 'Documentation', status: 'resolved', priority: 'low', orderNumber: 'ORD-2025-1244', industry: 'automotive', createdAt: '2025-12-24', messages: [{}, {}, {}, {}] },
      { id: 'TKT-006', subject: 'Suspension part warranty claim', category: 'Warranty', status: 'in-progress', priority: 'high', orderNumber: 'ORD-2025-1242', industry: 'automotive', createdAt: '2025-12-24', messages: [{}, {}] },
      { id: 'TKT-007', subject: 'Suspension kit wrong size', category: 'Product', status: 'resolved', priority: 'medium', orderNumber: 'ORD-2025-1240', industry: 'automotive', createdAt: '2025-12-23', messages: [{}] },
      { id: 'TKT-008', subject: 'Alternator not working', category: 'Technical', status: 'open', priority: 'high', orderNumber: 'ORD-2025-1241', industry: 'automotive', createdAt: '2025-12-23', messages: [{}, {}, {}] },
      { id: 'TKT-009', subject: 'Body panel missing parts', category: 'Shipping', status: 'resolved', priority: 'medium', orderNumber: 'ORD-2025-1242', industry: 'automotive', createdAt: '2025-12-22', messages: [{}, {}] },
    ];

    const tickets = filterByModule(allTickets, currentModule);

    res.render('admin/dashboard', {
      title: currentModule ? `${moduleConfig.name} Dashboard | PARTSFORM Admin` : 'Admin Dashboard | PARTSFORM',
      activePage: 'dashboard',
      currentModule,
      moduleConfig,
      stats,
      recentOrders,
      chartData: getChartData(),
      tickets
    });
  } catch (error) {
    console.error('Error in getAdminDashboard:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load admin dashboard' });
  }
};

/**
 * Get Orders Management page
 */
const getOrdersManagement = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Mock orders data with priority field - automotive only
    const allOrders = [
      { id: 'ORD-2025-1247', customer: 'AutoMax Germany', email: 'orders@automax.de', amount: 45200, status: 'processing', industry: 'automotive', date: '2025-12-26', time: '09:30 AM', items: 3, priority: 'critical' },
      { id: 'ORD-2025-1246', customer: 'Premium Auto Parts', email: 'procurement@premiumauto.com', amount: 12800, status: 'shipped', industry: 'automotive', date: '2025-12-26', time: '11:15 AM', items: 5, priority: 'normal' },
      { id: 'ORD-2025-1245', customer: 'Euro Auto Systems', email: 'supply@euroauto.eu', amount: 89500, status: 'delivered', industry: 'automotive', date: '2025-12-25', time: '02:45 PM', items: 2, priority: 'urgent' },
      { id: 'ORD-2025-1244', customer: 'PartsWorld Inc', email: 'parts@partsworld.com', amount: 156000, status: 'processing', industry: 'automotive', date: '2025-12-25', time: '10:00 AM', items: 8, priority: 'critical' },
      { id: 'ORD-2025-1243', customer: 'Car Components Ltd', email: 'orders@carcomponents.com', amount: 8750, status: 'pending', industry: 'automotive', date: '2025-12-24', time: '03:30 PM', items: 12, priority: 'normal' },
      { id: 'ORD-2025-1242', customer: 'Drive Parts Co', email: 'purchasing@driveparts.com', amount: 67300, status: 'shipped', industry: 'automotive', date: '2025-12-24', time: '08:45 AM', items: 4, priority: 'urgent' },
      { id: 'ORD-2025-1241', customer: 'Motor Supply Inc', email: 'supply@motorsupply.com', amount: 234000, status: 'pending', industry: 'automotive', date: '2025-12-23', time: '01:20 PM', items: 6, priority: 'normal' },
      { id: 'ORD-2025-1240', customer: 'AutoParts Express', email: 'parts@autoexpress.com', amount: 19500, status: 'delivered', industry: 'automotive', date: '2025-12-23', time: '04:00 PM', items: 8, priority: 'normal' },
    ];

    // Store orders in app locals for other functions to access
    req.app.locals.ordersDatabase = allOrders;

    const orders = filterByModule(allOrders, currentModule);

    res.render('admin/orders', {
      title: currentModule ? `${moduleConfig.name} Orders | PARTSFORM Admin` : 'Orders Management | PARTSFORM',
      activePage: 'orders',
      currentModule,
      moduleConfig,
      orders
    });
  } catch (error) {
    console.error('Error in getOrdersManagement:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load orders' });
  }
};

/**
 * Get Order Details page
 */
const getOrderDetails = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    const orderId = req.params.id;
    
    // Get orders from database or use default
    const allOrders = req.app.locals.ordersDatabase || [
      { id: 'ORD-2025-1247', customer: 'AutoMax Germany', email: 'orders@automax.de', amount: 45200, status: 'processing', industry: 'automotive', date: '2025-12-26', time: '09:30 AM', items: 3, priority: 'critical' },
      { id: 'ORD-2025-1246', customer: 'Premium Auto Parts', email: 'procurement@premiumauto.com', amount: 12800, status: 'shipped', industry: 'automotive', date: '2025-12-26', time: '11:15 AM', items: 5, priority: 'normal' },
    ];
    
    // Find the order
    const order = allOrders.find(o => o.id === orderId);
    
    if (!order) {
      return res.status(404).render('error', { title: 'Error', error: 'Order not found' });
    }

    res.render('admin/order-details', {
      title: `Order ${orderId} | PARTSFORM Admin`,
      activePage: 'orders',
      currentModule,
      moduleConfig,
      order
    });
  } catch (error) {
    console.error('Error in getOrderDetails:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load order details' });
  }
};

/**
 * Get Order Create page
 */
const getOrderCreate = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);

    res.render('admin/order-create', {
      title: 'Create Order | PARTSFORM Admin',
      activePage: 'orders',
      currentModule,
      moduleConfig
    });
  } catch (error) {
    console.error('Error in getOrderCreate:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load create order page' });
  }
};

/**
 * Get Order Edit page
 */
const getOrderEdit = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    const orderId = req.params.id;
    
    // Get orders from database or use default
    const allOrders = req.app.locals.ordersDatabase || [
      { id: 'ORD-2025-1247', customer: 'AutoMax Germany', email: 'orders@automax.de', amount: 45200, status: 'processing', industry: 'automotive', date: '2025-12-26', time: '09:30 AM', items: 3, priority: 'critical' },
    ];
    
    // Find the order
    const order = allOrders.find(o => o.id === orderId);
    
    if (!order) {
      return res.status(404).render('error', { title: 'Error', error: 'Order not found' });
    }

    res.render('admin/order-edit', {
      title: `Edit Order ${orderId} | PARTSFORM Admin`,
      activePage: 'orders',
      currentModule,
      moduleConfig,
      order
    });
  } catch (error) {
    console.error('Error in getOrderEdit:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load edit order page' });
  }
};

/**
 * Delete Order (API)
 */
const deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // In production, delete from database
    // For now, just return success
    res.json({ success: true, message: `Order ${orderId} deleted successfully` });
  } catch (error) {
    console.error('Error in deleteOrder:', error);
    res.status(500).json({ success: false, error: 'Failed to delete order' });
  }
};

/**
 * Get Tickets Management page
 */
const getTicketsManagement = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Enhanced mock tickets with messages, unread counts, customer info
    const defaultTickets = [
      { 
        id: 'TKT-001', 
        subject: 'Delayed Shipment Inquiry', 
        category: 'Shipping Issue', 
        status: 'open', 
        priority: 'high',
        orderNumber: 'ORD-2025-1247',
        customerName: 'John Smith',
        customerEmail: 'john.smith@automax.com',
        industry: 'automotive',
        createdAt: '2025-12-26T10:30:00Z',
        unreadCount: 2,
        lastMessage: { content: 'Any update on the shipping status?', time: '2 hours ago' },
        messages: [
          { sender: 'customer', content: 'Hi, I placed an order 3 days ago but haven\'t received shipping confirmation yet. Can you please check?', time: '2025-12-24T14:00:00Z' },
          { sender: 'admin', content: 'Hello! I\'m looking into this for you. Could you please confirm your order number?', time: '2025-12-24T15:30:00Z' },
          { sender: 'customer', content: 'The order number is ORD-2025-1247. Thanks for your help!', time: '2025-12-24T16:00:00Z' },
          { sender: 'customer', content: 'Any update on the shipping status?', time: '2025-12-26T08:30:00Z' }
        ]
      },
      { 
        id: 'TKT-002', 
        subject: 'Wrong Part Received', 
        category: 'Product Quality', 
        status: 'in-progress', 
        priority: 'urgent',
        orderNumber: 'ORD-2025-1246',
        customerName: 'Maria Garcia',
        customerEmail: 'maria@automax.de',
        industry: 'automotive',
        createdAt: '2025-12-25T09:15:00Z',
        unreadCount: 0,
        lastMessage: { content: 'We are processing your replacement.', time: '1 day ago' },
        messages: [
          { sender: 'customer', content: 'I received the wrong part. I ordered a fuel pump but got a water pump instead.', time: '2025-12-25T09:15:00Z' },
          { sender: 'admin', content: 'We apologize for the mix-up. We are processing your replacement immediately.', time: '2025-12-25T10:00:00Z' }
        ]
      },
      { 
        id: 'TKT-003', 
        subject: 'Return Authorization Request', 
        category: 'Return Request', 
        status: 'open', 
        priority: 'medium',
        orderNumber: 'ORD-2025-1242',
        customerName: 'Robert Chen',
        customerEmail: 'r.chen@heavyduty.com',
        industry: 'machinery',
        createdAt: '2025-12-24T16:45:00Z',
        unreadCount: 1,
        lastMessage: { content: 'I need to return unused parts from my order.', time: '3 days ago' },
        messages: [
          { sender: 'customer', content: 'I need to return some unused parts from my recent order. How do I proceed?', time: '2025-12-24T16:45:00Z' }
        ]
      },
      { 
        id: 'TKT-004', 
        subject: 'Technical Specifications Query', 
        category: 'Technical Support', 
        status: 'resolved', 
        priority: 'low',
        orderNumber: 'ORD-2025-1244',
        customerName: 'Sarah Johnson',
        customerEmail: 'sarah@partsworld.com',
        industry: 'automotive',
        createdAt: '2025-12-23T11:20:00Z',
        unreadCount: 0,
        lastMessage: { content: 'Perfect, that answers my question!', time: '4 days ago' },
        messages: [
          { sender: 'customer', content: 'Could you provide detailed specifications for the hydraulic assembly unit?', time: '2025-12-23T11:20:00Z' },
          { sender: 'admin', content: 'Of course! Here are the specifications...', time: '2025-12-23T12:00:00Z' },
          { sender: 'customer', content: 'Perfect, that answers my question!', time: '2025-12-23T13:00:00Z' }
        ]
      },
      { 
        id: 'TKT-005', 
        subject: 'Invoice Discrepancy', 
        category: 'Billing', 
        status: 'in-progress', 
        priority: 'high',
        orderNumber: 'ORD-2025-1243',
        customerName: 'Michael Brown',
        customerEmail: 'mbrown@premiumauto.com',
        industry: 'automotive',
        createdAt: '2025-12-22T14:30:00Z',
        unreadCount: 0,
        lastMessage: { content: 'Our accounting team is reviewing this.', time: '5 days ago' },
        messages: [
          { sender: 'customer', content: 'The invoice amount doesn\'t match the quoted price. Please clarify.', time: '2025-12-22T14:30:00Z' },
          { sender: 'admin', content: 'Our accounting team is reviewing this. We\'ll get back to you shortly.', time: '2025-12-22T15:00:00Z' }
        ]
      },
      { 
        id: 'TKT-006', 
        subject: 'Equipment Compatibility Question', 
        category: 'Technical Support', 
        status: 'open', 
        priority: 'medium',
        orderNumber: 'ORD-2025-1242',
        customerName: 'David Wilson',
        customerEmail: 'd.wilson@constplus.com',
        industry: 'machinery',
        createdAt: '2025-12-27T08:00:00Z',
        unreadCount: 1,
        lastMessage: { content: 'Will this part work with my CAT 320?', time: '1 hour ago' },
        messages: [
          { sender: 'customer', content: 'Will this part work with my CAT 320 excavator? I need to confirm before ordering.', time: '2025-12-27T08:00:00Z' }
        ]
      }
    ];
    
    // Always use defaultTickets to ensure data is available
    // Store in app.locals for other functions to use
    req.app.locals.ticketsDatabase = defaultTickets;

    const tickets = filterByModule(defaultTickets, currentModule);
    
    res.render('admin/tickets', {
      title: currentModule ? `${moduleConfig.name} Tickets | PARTSFORM Admin` : 'Tickets Management | PARTSFORM',
      activePage: 'tickets',
      currentModule,
      moduleConfig,
      tickets
    });
  } catch (error) {
    console.error('Error in getTicketsManagement:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load tickets' });
  }
};

/**
 * Get Ticket Details/Chat page
 */
const getTicketDetails = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    const ticketId = req.params.id;
    
    const ticketsDatabase = req.app.locals.ticketsDatabase || [];
    const ticket = ticketsDatabase.find(t => t.id === ticketId);
    
    if (!ticket) {
      return res.status(404).render('error', { title: 'Error', error: 'Ticket not found' });
    }

    res.render('admin/ticket-details', {
      title: `Ticket ${ticketId} | PARTSFORM Admin`,
      activePage: 'tickets',
      currentModule,
      moduleConfig,
      ticket
    });
  } catch (error) {
    console.error('Error in getTicketDetails:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load ticket' });
  }
};

/**
 * Post reply to ticket
 */
const postTicketReply = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { message } = req.body;
    
    const ticketsDatabase = req.app.locals.ticketsDatabase || [];
    const ticket = ticketsDatabase.find(t => t.id === ticketId);
    
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    
    // Add message
    if (!ticket.messages) ticket.messages = [];
    ticket.messages.push({
      sender: 'admin',
      content: message,
      time: new Date().toISOString()
    });
    
    // Update last message
    ticket.lastMessage = { content: message, time: 'Just now' };
    
    res.json({ success: true, message: 'Reply sent' });
  } catch (error) {
    console.error('Error in postTicketReply:', error);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
};

/**
 * Update ticket status
 */
const updateTicketStatus = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status } = req.body;
    
    const ticketsDatabase = req.app.locals.ticketsDatabase || [];
    const ticket = ticketsDatabase.find(t => t.id === ticketId);
    
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    
    ticket.status = status;
    
    res.json({ success: true, message: `Ticket status updated to ${status}` });
  } catch (error) {
    console.error('Error in updateTicketStatus:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
};

/**
 * Get Users Management page (users are global, not filtered by module)
 */
const getUsersManagement = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Mock users data - global, all automotive
    const allUsers = [
      { id: 1, name: 'John Smith', email: 'john.smith@automax.com', company: 'AutoMax Germany', orders: 23, totalSpent: 245000, status: 'active', joined: '2024-03-15', industry: 'automotive', phone: '+1 (555) 123-4567' },
      { id: 2, name: 'Maria Garcia', email: 'maria@premiumauto.com', company: 'Premium Auto Parts', orders: 45, totalSpent: 89000, status: 'active', joined: '2024-01-22', industry: 'automotive', phone: '+49 30 123456' },
      { id: 3, name: 'Robert Chen', email: 'r.chen@euroauto.eu', company: 'Euro Auto Systems', orders: 12, totalSpent: 456000, status: 'active', joined: '2024-06-10', industry: 'automotive', phone: '+1 (555) 987-6543' },
      { id: 4, name: 'Sarah Johnson', email: 'sarah@partsworld.com', company: 'PartsWorld Inc', orders: 67, totalSpent: 1250000, status: 'active', joined: '2023-11-05', industry: 'automotive', phone: '+1 (555) 456-7890' },
      { id: 5, name: 'Michael Brown', email: 'mbrown@carcomponents.com', company: 'Car Components Ltd', orders: 34, totalSpent: 67500, status: 'inactive', joined: '2024-02-28', industry: 'automotive', phone: '+1 (555) 321-0987' },
      { id: 6, name: 'Emma Wilson', email: 'emma@driveparts.com', company: 'Drive Parts Co', orders: 18, totalSpent: 234000, status: 'active', joined: '2024-04-19', industry: 'automotive', phone: '+1 (555) 654-3210' },
      { id: 7, name: 'David Lee', email: 'd.lee@motorsupply.com', company: 'Motor Supply Inc', orders: 56, totalSpent: 345000, status: 'active', joined: '2024-05-12', industry: 'automotive', phone: '+1 (555) 789-0123' },
      { id: 8, name: 'Lisa Anderson', email: 'lisa@autoexpress.com', company: 'AutoParts Express', orders: 29, totalSpent: 567000, status: 'active', joined: '2024-02-08', industry: 'automotive', phone: '+1 (555) 234-5678' },
    ];
    
    // Store in app.locals for other functions
    req.app.locals.usersDatabase = allUsers;

    res.render('admin/users', {
      title: 'Users Management | PARTSFORM',
      activePage: 'users',
      currentModule,
      moduleConfig,
      users: allUsers  // No filtering - all users
    });
  } catch (error) {
    console.error('Error in getUsersManagement:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load users' });
  }
};

/**
 * Get User Details page
 */
const getUserDetails = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    const userId = parseInt(req.params.id);
    
    const usersDatabase = req.app.locals.usersDatabase || [];
    const user = usersDatabase.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).render('error', { title: 'Error', error: 'User not found' });
    }

    res.render('admin/user-details', {
      title: `${user.name} | PARTSFORM Admin`,
      activePage: 'users',
      currentModule,
      moduleConfig,
      user
    });
  } catch (error) {
    console.error('Error in getUserDetails:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load user' });
  }
};

/**
 * Get User Create page
 */
const getUserCreate = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);

    res.render('admin/user-create', {
      title: 'Create User | PARTSFORM Admin',
      activePage: 'users',
      currentModule,
      moduleConfig
    });
  } catch (error) {
    console.error('Error in getUserCreate:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load form' });
  }
};

/**
 * Get User Edit page
 */
const getUserEdit = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    const userId = parseInt(req.params.id);
    
    const usersDatabase = req.app.locals.usersDatabase || [];
    const user = usersDatabase.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).render('error', { title: 'Error', error: 'User not found' });
    }

    res.render('admin/user-edit', {
      title: `Edit ${user.name} | PARTSFORM Admin`,
      activePage: 'users',
      currentModule,
      moduleConfig,
      user
    });
  } catch (error) {
    console.error('Error in getUserEdit:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load user' });
  }
};

/**
 * Update user status
 */
const updateUserStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { status } = req.body;
    
    const usersDatabase = req.app.locals.usersDatabase || [];
    const user = usersDatabase.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    user.status = status;
    
    res.json({ success: true, message: `User status updated to ${status}` });
  } catch (error) {
    console.error('Error in updateUserStatus:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
};

/**
 * Bulk update users
 */
const bulkUpdateUsers = async (req, res) => {
  try {
    const { userIds, status } = req.body;
    
    const usersDatabase = req.app.locals.usersDatabase || [];
    
    userIds.forEach(userId => {
      const user = usersDatabase.find(u => u.id === userId);
      if (user) {
        user.status = status;
      }
    });
    
    res.json({ success: true, message: `${userIds.length} users updated to ${status}` });
  } catch (error) {
    console.error('Error in bulkUpdateUsers:', error);
    res.status(500).json({ success: false, error: 'Failed to update users' });
  }
};

/**
 * Delete user
 */
const deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    let usersDatabase = req.app.locals.usersDatabase || [];
    const userIndex = usersDatabase.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    usersDatabase.splice(userIndex, 1);
    req.app.locals.usersDatabase = usersDatabase;
    
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
};

/**
 * Get Payments Management page
 */
const getPaymentsManagement = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Mock payments data - automotive only
    const allPayments = [
      { id: 'PAY-2025-001', orderId: 'ORD-2025-1247', customer: 'AutoMax Germany', amount: 45200, method: 'wire', status: 'completed', date: '2025-12-26', industry: 'automotive' },
      { id: 'PAY-2025-002', orderId: 'ORD-2025-1246', customer: 'Premium Auto Parts', amount: 12800, method: 'credit_card', status: 'completed', date: '2025-12-26', industry: 'automotive' },
      { id: 'PAY-2025-003', orderId: 'ORD-2025-1245', customer: 'Euro Auto Systems', amount: 89500, method: 'wire', status: 'pending', date: '2025-12-25', industry: 'automotive' },
      { id: 'PAY-2025-004', orderId: 'ORD-2025-1244', customer: 'PartsWorld Inc', amount: 156000, method: 'letter_of_credit', status: 'processing', date: '2025-12-25', industry: 'automotive' },
      { id: 'PAY-2025-005', orderId: 'ORD-2025-1243', customer: 'Car Components Ltd', amount: 8750, method: 'credit_card', status: 'completed', date: '2025-12-24', industry: 'automotive' },
      { id: 'PAY-2025-006', orderId: 'ORD-2025-1242', customer: 'Drive Parts Co', amount: 67300, method: 'wire', status: 'completed', date: '2025-12-24', industry: 'automotive' },
    ];

    const payments = filterByModule(allPayments, currentModule);

    res.render('admin/payments', {
      title: currentModule ? `${moduleConfig.name} Payments | PARTSFORM Admin` : 'Payments Management | PARTSFORM',
      activePage: 'payments',
      currentModule,
      moduleConfig,
      payments
    });
  } catch (error) {
    console.error('Error in getPaymentsManagement:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load payments' });
  }
};

/**
 * Get Payment Details page
 */
const getPaymentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentModule, moduleConfig } = getModuleData(req);
    
    const payments = {
      'PAY-2025-001': { id: 'PAY-2025-001', orderId: 'ORD-2025-1247', customer: 'AutoMax Germany', amount: 45200, method: 'wire', status: 'completed', date: 'Dec 26, 2025' },
      'PAY-2025-002': { id: 'PAY-2025-002', orderId: 'ORD-2025-1246', customer: 'Premium Auto Parts', amount: 12800, method: 'credit_card', status: 'completed', date: 'Dec 26, 2025' },
      'PAY-2025-003': { id: 'PAY-2025-003', orderId: 'ORD-2025-1245', customer: 'Euro Auto Systems', amount: 89500, method: 'wire', status: 'pending', date: 'Dec 25, 2025' },
      'PAY-2025-004': { id: 'PAY-2025-004', orderId: 'ORD-2025-1244', customer: 'PartsWorld Inc', amount: 156000, method: 'letter_of_credit', status: 'processing', date: 'Dec 25, 2025' },
    };

    const payment = payments[id] || {
      id: id,
      orderId: 'ORD-001',
      customer: 'Unknown Customer',
      amount: 0,
      method: 'wire',
      status: 'pending',
      date: new Date().toLocaleDateString()
    };

    res.render('admin/payment-details', {
      title: `Payment ${id} | PARTSFORM Admin`,
      activePage: 'payments',
      currentModule,
      moduleConfig,
      payment
    });
  } catch (error) {
    console.error('Error in getPaymentDetails:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load payment details' });
  }
};

/**
 * Get Payment Create page
 */
const getPaymentCreate = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);

    res.render('admin/payment-create', {
      title: 'Record Payment | PARTSFORM Admin',
      activePage: 'payments',
      currentModule,
      moduleConfig
    });
  } catch (error) {
    console.error('Error in getPaymentCreate:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load create page' });
  }
};

/**
 * Get AOG Cases Management page (Aviation specific)
 */
const getAOGManagement = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Mock AOG cases data
    const aogCases = [
      { id: 'AOG-2025-001', aircraft: 'Boeing 737-800', registration: 'N12345', partNumber: 'PN-789456', description: 'Main Landing Gear Actuator', priority: 'critical', status: 'in_progress', customer: 'Delta Airlines', eta: '4 hours', created: '2025-12-26 14:30' },
      { id: 'AOG-2025-002', aircraft: 'Airbus A320', registration: 'D-ABCD', partNumber: 'PN-123789', description: 'APU Starter Motor', priority: 'high', status: 'sourcing', customer: 'Lufthansa', eta: '8 hours', created: '2025-12-26 10:15' },
      { id: 'AOG-2025-003', aircraft: 'Embraer E190', registration: 'PP-PJE', partNumber: 'PN-456123', description: 'Hydraulic Pump Assembly', priority: 'critical', status: 'shipped', customer: 'LATAM Airlines', eta: '2 hours', created: '2025-12-25 22:00' },
      { id: 'AOG-2025-004', aircraft: 'Boeing 777-300', registration: 'HL7782', partNumber: 'PN-987654', description: 'Engine Bleed Air Valve', priority: 'medium', status: 'delivered', customer: 'Korean Air', eta: 'Delivered', created: '2025-12-25 08:45' },
    ];

    res.render('admin/aog', {
      title: 'AOG Cases Management | PARTSFORM Admin',
      activePage: 'aog',
      currentModule: 'aviation',
      moduleConfig: { name: 'Aviation', icon: 'plane', color: '#0ea5e9' },
      aogCases
    });
  } catch (error) {
    console.error('Error in getAOGManagement:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load AOG cases' });
  }
};

/**
 * Get Admin Settings page
 */
const getAdminSettings = async (req, res) => {
  try {
    res.render('admin/settings', {
      title: 'Admin Settings | PARTSFORM',
      activePage: 'settings',
      currentModule: null,
      moduleConfig: null
    });
  } catch (error) {
    console.error('Error in getAdminSettings:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load settings' });
  }
};

/**
 * Get Integrations Management page
 */
const getIntegrationsManagement = async (req, res) => {
  try {
    const { currentModule: queryModule, moduleConfig: queryConfig } = getModuleData(req);
    // Default to automotive if no module is specified
    const currentModule = queryModule || 'automotive';
    const { moduleConfig } = getModuleData({ query: { module: currentModule } });
    
    // Get all integrations from database
    const integrations = await Integration.find({}).sort({ createdAt: -1 }).lean();
    
    // Get statistics
    const stats = {
      totalConnections: integrations.length,
      activeConnections: integrations.filter(i => i.status === 'active').length,
      totalRecords: integrations.reduce((sum, i) => sum + (i.stats?.totalRecords || 0), 0),
      lastSync: integrations.reduce((latest, i) => {
        if (i.lastSync?.date && (!latest || new Date(i.lastSync.date) > new Date(latest))) {
          return i.lastSync.date;
        }
        return latest;
      }, null),
    };
    
    // Get Elasticsearch stats if available
    let esStats = null;
    if (elasticsearchService.isAvailable) {
      esStats = await elasticsearchService.getStats();
    }
    
    res.render('admin/integrations', {
      title: 'Integrations - Admin',
      activePage: 'integrations',
      currentModule,
      moduleConfig,
      integrations,
      stats,
      esStats,
    });
  } catch (error) {
    console.error('Error in getIntegrationsManagement:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load integrations' });
  }
};

/**
 * Get Integration Create page
 */
const getIntegrationCreate = async (req, res) => {
  try {
    const { currentModule: queryModule, moduleConfig: queryConfig } = getModuleData(req);
    // Default to automotive if no module is specified
    const currentModule = queryModule || 'automotive';
    const { moduleConfig } = getModuleData({ query: { module: currentModule } });
    
    res.render('admin/integration-create', {
      title: 'New Connection - Admin',
      activePage: 'integrations',
      currentModule,
      moduleConfig,
      integration: null, // For create mode
    });
  } catch (error) {
    console.error('Error in getIntegrationCreate:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load connection create page' });
  }
};

/**
 * Get Integration Edit page
 */
const getIntegrationEdit = async (req, res) => {
  try {
    const { currentModule: queryModule } = getModuleData(req);
    const currentModule = queryModule || 'automotive';
    const { moduleConfig } = getModuleData({ query: { module: currentModule } });
    
    const integration = await Integration.findById(req.params.id);
    if (!integration) {
      return res.status(404).render('error', { title: 'Not Found', error: 'Integration not found' });
    }
    
    res.render('admin/integration-create', {
      title: 'Edit Connection - Admin',
      activePage: 'integrations',
      currentModule,
      moduleConfig,
      integration: integration.toSafeJSON(),
    });
  } catch (error) {
    console.error('Error in getIntegrationEdit:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load connection edit page' });
  }
};

/**
 * Create new integration (API)
 */
const createIntegration = async (req, res) => {
  try {
    const data = req.body;
    
    // Handle both nested format (from frontend) and flat format
    const ftpData = data.ftp || {};
    const apiData = data.api || {};
    const googleSheetsData = data.googleSheets || {};
    const syncScheduleData = data.syncSchedule || {};
    const optionsData = data.options || {};
    
    const integration = new Integration({
      name: data.name,
      type: data.type || 'ftp',
      status: data.isEnabled === false ? 'inactive' : 'active',
      ftp: data.type === 'ftp' ? {
        host: ftpData.host || data.ftpHost,
        port: parseInt(ftpData.port || data.ftpPort) || 21,
        username: ftpData.username || data.ftpUsername,
        password: ftpData.password || data.ftpPassword,
        secure: ftpData.protocol === 'ftps' || ftpData.protocol === 'sftp' || data.ftpSecure === true,
        remotePath: ftpData.remotePath || data.ftpRemotePath || '/',
        filePattern: ftpData.filePattern || data.ftpFilePattern || '*.csv',
      } : undefined,
      api: data.type === 'api' ? {
        // Basic Configuration
        name: apiData.name || data.apiName,
        apiType: apiData.apiType || 'rest',
        baseUrl: apiData.baseUrl || data.apiBaseUrl,
        
        // Authentication
        authType: apiData.authType || data.apiAuthType || 'api-key',
        authHeader: apiData.authHeader || data.apiAuthHeader || 'X-API-Key',
        apiKey: apiData.apiKey || data.apiKey,
        username: apiData.username,
        password: apiData.password,
        
        // OAuth2 Configuration
        oauth2: apiData.oauth2 || undefined,
        
        // Endpoints Configuration
        endpoints: apiData.endpoints || [],
        
        // Pagination Configuration
        pagination: apiData.pagination || { type: 'none' },
        
        // Data Configuration
        dataPath: apiData.dataPath,
        fieldMapping: apiData.fieldMapping,
        
        // Request Configuration
        headers: apiData.headers || {},
        rateLimit: parseInt(apiData.rateLimit) || 60,
        timeout: parseInt(apiData.timeout) || 30000,
        
        // Error Handling
        errorHandling: apiData.errorHandling || {
          retryOnError: true,
          maxRetries: 3,
          retryDelay: 1000
        },
        
        // GraphQL specific
        graphqlEndpoint: apiData.graphqlEndpoint,
        graphqlQuery: apiData.graphqlQuery,
        graphqlVariables: apiData.graphqlVariables
      } : undefined,
      googleSheets: data.type === 'google-sheets' ? {
        spreadsheetId: googleSheetsData.spreadsheetId || data.sheetsSpreadsheetId,
        sheetName: googleSheetsData.sheetName || data.sheetsSheetName || 'Sheet1',
        range: googleSheetsData.range || data.sheetsRange || 'A:Z',
      } : undefined,
      syncSchedule: {
        enabled: syncScheduleData.enabled !== undefined ? syncScheduleData.enabled : (data.syncEnabled !== 'false' && data.syncEnabled !== false),
        frequency: syncScheduleData.frequency || data.syncFrequency || 'daily',
        time: syncScheduleData.time || data.syncTime || '08:00',
      },
      options: {
        autoSync: optionsData.autoSync !== undefined ? optionsData.autoSync : (data.autoSync === 'true' || data.autoSync === true || data.isEnabled !== false),
        notifyOnComplete: optionsData.notifyOnComplete !== undefined ? optionsData.notifyOnComplete : (data.notifyOnComplete !== 'false' && data.notifyOnComplete !== false),
        deltaSync: optionsData.deltaSync !== undefined ? optionsData.deltaSync : (data.deltaSync === 'true' || data.deltaSync === true),
        retryOnFail: optionsData.retryOnFail !== undefined ? optionsData.retryOnFail : (data.retryOnFail !== 'false' && data.retryOnFail !== false),
        maxRetries: optionsData.maxRetries || 3,
      },
      createdBy: req.admin?._id,
    });
    
    await integration.save();
    
    // Schedule if enabled
    if (integration.syncSchedule.enabled) {
      await schedulerService.scheduleIntegration(integration);
    }

    // Auto-sync immediately after creation if autoSync is enabled
    if (integration.options.autoSync) {
      console.log(`🚀 Starting automatic sync for newly created integration: ${integration.name}`);
      // Fire and forget - don't wait for sync to complete
      syncService.syncIntegration(integration._id).catch(error => {
        console.error(`Auto-sync failed for ${integration._id}:`, error.message);
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Integration created successfully',
      integration: integration.toSafeJSON(),
      autoSyncStarted: integration.options.autoSync,
    });
  } catch (error) {
    console.error('Error creating integration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update integration (API)
 */
const updateIntegration = async (req, res) => {
  try {
    const data = req.body;
    const integration = await Integration.findById(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }
    
    // Handle both nested format (from frontend) and flat format
    const ftpData = data.ftp || {};
    const syncScheduleData = data.syncSchedule || {};
    
    // Update fields
    integration.name = data.name || integration.name;
    integration.status = data.isEnabled === false ? 'inactive' : (data.isEnabled === true ? 'active' : integration.status);
    
    if (integration.type === 'ftp') {
      integration.ftp = {
        ...integration.ftp,
        host: ftpData.host || data.ftpHost || integration.ftp.host,
        port: parseInt(ftpData.port || data.ftpPort) || integration.ftp.port,
        username: ftpData.username || data.ftpUsername || integration.ftp.username,
        password: ftpData.password || data.ftpPassword || integration.ftp.password,
        secure: ftpData.protocol ? (ftpData.protocol === 'ftps' || ftpData.protocol === 'sftp') : 
                (data.ftpSecure !== undefined ? (data.ftpSecure === 'true' || data.ftpSecure === true) : integration.ftp.secure),
        remotePath: ftpData.remotePath || data.ftpRemotePath || integration.ftp.remotePath,
        filePattern: ftpData.filePattern || data.ftpFilePattern || integration.ftp.filePattern,
      };
    }
    
    integration.syncSchedule = {
      enabled: syncScheduleData.enabled !== undefined ? syncScheduleData.enabled : 
               (data.syncEnabled !== 'false' && data.syncEnabled !== false),
      frequency: syncScheduleData.frequency || data.syncFrequency || integration.syncSchedule.frequency,
      time: syncScheduleData.time || data.syncTime || integration.syncSchedule.time,
    };
    
    integration.options = {
      autoSync: data.autoSync === 'true' || data.autoSync === true,
      notifyOnComplete: data.notifyOnComplete !== 'false',
      deltaSync: data.deltaSync === 'true' || data.deltaSync === true,
      retryOnFail: data.retryOnFail !== 'false',
    };
    
    integration.updatedBy = req.admin?._id;
    await integration.save();
    
    // Reschedule
    await schedulerService.rescheduleIntegration(integration._id);
    
    res.json({
      success: true,
      message: 'Integration updated successfully',
      integration: integration.toSafeJSON(),
    });
  } catch (error) {
    console.error('Error updating integration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete integration (API)
 */
const deleteIntegration = async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }
    
    // Stop scheduler
    schedulerService.stopIntegration(integration._id);
    
    // Clear associated data
    await syncService.clearIntegrationData(integration._id);
    
    // Delete integration
    await Integration.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Integration deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Test integration connection (API)
 */
const testIntegrationConnection = async (req, res) => {
  try {
    let data = req.body;
    let result;
    
    // If testing an existing integration, fetch real credentials from DB (password is masked in toSafeJSON)
    if (data._id) {
      const existingIntegration = await Integration.findById(data._id);
      if (existingIntegration) {
        // Use real password from database, not the masked one
        data = existingIntegration.toObject();
      }
    }
    
    // Handle nested ftp object from frontend
    const ftpData = data.ftp || {};
    
    if (data.type === 'ftp' || (!data.type && (data.ftpHost || ftpData.host))) {
      const credentials = {
        host: ftpData.host || data.ftpHost,
        port: parseInt(ftpData.port || data.ftpPort) || 21,
        username: ftpData.username || data.ftpUsername,
        password: ftpData.password || data.ftpPassword,
        secure: ftpData.protocol ? (ftpData.protocol === 'ftps' || ftpData.protocol === 'sftp') : 
                (data.ftpSecure === 'true' || data.ftpSecure === true),
        remotePath: ftpData.remotePath || data.ftpRemotePath || '/',
        filePattern: ftpData.filePattern || data.ftpFilePattern || '*.csv',
      };
      
      console.log('Testing FTP connection:', { host: credentials.host, port: credentials.port, username: credentials.username });
      result = await ftpService.testConnection(credentials);
      
      // Ensure proper response format
      if (result.success) {
        return res.json({
          success: true,
          message: result.message || 'Connection successful',
          data: {
            filesCount: result.filesFound || 0,
            message: result.message
          }
        });
      } else {
        return res.json({
          success: false,
          error: result.message || result.error || 'Connection failed'
        });
      }
    } else if (data.type === 'api') {
      // API connection test - use the professional apiService
      const apiService = require('../services/apiService');
      const apiData = data.api || {};
      
      // Build test configuration
      const testConfig = {
        baseUrl: apiData.baseUrl || data.apiBaseUrl,
        apiType: apiData.apiType || 'rest',
        authType: apiData.authType || 'none',
        authHeader: apiData.authHeader || 'X-API-Key',
        apiKey: apiData.apiKey,
        username: apiData.username,
        password: apiData.password,
        headers: apiData.headers || {},
        // Use first endpoint path for testing if available
        testEndpoint: apiData.endpoints && apiData.endpoints.length > 0 
          ? apiData.endpoints[0].path 
          : undefined,
      };

      // Handle OAuth2
      if (apiData.oauth2) {
        testConfig.oauth2 = apiData.oauth2;
      }
      
      if (!testConfig.baseUrl) {
        return res.json({
          success: false,
          error: 'API base URL is required'
        });
      }

      console.log('Testing API connection:', { 
        baseUrl: testConfig.baseUrl, 
        authType: testConfig.authType,
        testEndpoint: testConfig.testEndpoint 
      });
      
      result = await apiService.testConnection(testConfig);
      
      return res.json({
        success: result.success,
        message: result.message || (result.success ? 'Connection successful' : 'Connection failed'),
        error: result.error,
        status: result.status,
        estimatedRecords: result.estimatedRecords,
        data: {
          status: result.status,
          contentType: result.contentType,
          estimatedRecords: result.estimatedRecords,
          details: result.details
        }
      });
    } else if (data.type === 'google-sheets') {
      // Google Sheets test - validate spreadsheet ID format
      const gsData = data.googleSheets || {};
      const spreadsheetId = gsData.spreadsheetId || data.gsSpreadsheetId;
      
      if (!spreadsheetId) {
        return res.json({
          success: false,
          error: 'Spreadsheet ID is required'
        });
      }
      
      // Extract spreadsheet ID from URL if full URL is provided
      let extractedId = spreadsheetId;
      const urlMatch = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (urlMatch) {
        extractedId = urlMatch[1];
      }
      
      // Basic validation of spreadsheet ID format
      const isValidFormat = /^[a-zA-Z0-9_-]+$/.test(extractedId);
      return res.json({
        success: isValidFormat,
        message: isValidFormat ? 'Spreadsheet ID format is valid' : 'Invalid spreadsheet ID format',
        data: { spreadsheetId: extractedId }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported integration type for testing',
      });
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Sync integration (API)
 */
const syncIntegration = async (req, res) => {
  try {
    const integrationId = req.params.id;
    
    // Check if already syncing
    if (syncService.isSyncing(integrationId)) {
      return res.status(409).json({
        success: false,
        error: 'Sync already in progress',
      });
    }
    
    // Start sync in background
    syncService.syncIntegration(integrationId).then(result => {
      console.log('Sync completed:', result);
    }).catch(error => {
      console.error('Sync error:', error);
    });
    
    res.json({
      success: true,
      message: 'Sync started',
      integrationId,
    });
  } catch (error) {
    console.error('Error starting sync:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get sync status (API) - includes real-time progress
 */
const getSyncStatus = async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id).lean();
    
    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }
    
    const integrationId = integration._id.toString();
    const isSyncing = syncService.isSyncing(integrationId);
    const progress = syncService.getSyncProgress ? syncService.getSyncProgress(integrationId) : null;
    
    res.json({
      success: true,
      isSyncing,
      progress: isSyncing ? progress : null,
      lastSync: integration.lastSync,
      status: integration.status,
      stats: integration.stats,
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get real-time sync progress (API) - for polling
 */
const getSyncProgress = async (req, res) => {
  try {
    const integrationId = req.params.id;
    const isSyncing = syncService.isSyncing(integrationId);
    const progress = syncService.getSyncProgress ? syncService.getSyncProgress(integrationId) : null;
    
    if (!isSyncing && !progress) {
      // If not syncing and no progress, check the integration for last sync info
      const integration = await Integration.findById(integrationId).lean();
      if (!integration) {
        return res.status(404).json({ success: false, error: 'Integration not found' });
      }
      
      return res.json({
        success: true,
        isSyncing: false,
        progress: null,
        lastSync: integration.lastSync,
        status: integration.status,
      });
    }
    
    res.json({
      success: true,
      isSyncing,
      progress,
    });
  } catch (error) {
    console.error('Error getting sync progress:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get all integrations (API)
 */
const getIntegrations = async (req, res) => {
  try {
    const integrations = await Integration.find({}).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      integrations: integrations.map(i => i.toSafeJSON()),
    });
  } catch (error) {
    console.error('Error getting integrations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get single integration (API)
 */
const getIntegration = async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }
    
    res.json({
      success: true,
      integration: integration.toSafeJSON(),
    });
  } catch (error) {
    console.error('Error getting integration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get detailed sync information including file sizes and estimated time (API)
 */
const getSyncDetails = async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    
    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }

    // Calculate estimated sync time based on file sizes and past performance
    let estimatedTime = 0;
    let totalFileSize = 0;
    const fileDetails = [];

    if (integration.lastSync?.files && integration.lastSync.files.length > 0) {
      // Calculate average sync speed (bytes per second)
      const lastSyncDuration = integration.lastSync.duration || 1000; // Default 1 second
      const lastTotalSize = integration.lastSync.files.reduce((sum, f) => sum + (f.size || 0), 0);
      const avgSpeed = lastTotalSize > 0 ? lastTotalSize / (lastSyncDuration / 1000) : 1024 * 100; // 100KB/s default

      // Process each file
      for (const file of integration.lastSync.files) {
        const fileSize = file.size || 0;
        const fileSizeKB = (fileSize / 1024).toFixed(2);
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        const estimatedFileTime = Math.ceil(fileSize / avgSpeed);

        estimatedTime += estimatedFileTime;
        totalFileSize += fileSize;

        fileDetails.push({
          name: file.name,
          size: fileSize,
          sizeFormatted: fileSize > 1024 * 1024 
            ? `${fileSizeMB} MB` 
            : fileSize > 1024 
            ? `${fileSizeKB} KB` 
            : `${fileSize} B`,
          records: file.records || 0,
          status: file.status || 'pending',
          estimatedTime: estimatedFileTime,
          estimatedTimeFormatted: formatDuration(estimatedFileTime),
        });
      }
    }

    const totalSizeFormatted = totalFileSize > 1024 * 1024
      ? `${(totalFileSize / (1024 * 1024)).toFixed(2)} MB`
      : totalFileSize > 1024
      ? `${(totalFileSize / 1024).toFixed(2)} KB`
      : `${totalFileSize} B`;

    const estimatedTimeFormatted = formatDuration(estimatedTime);

    res.json({
      success: true,
      integration: {
        id: integration._id,
        name: integration.name,
        type: integration.type,
        status: integration.status,
      },
      syncInfo: {
        totalFileSize,
        totalSizeFormatted,
        estimatedTime, // in seconds
        estimatedTimeFormatted,
        fileCount: fileDetails.length,
        totalRecords: fileDetails.reduce((sum, f) => sum + (f.records || 0), 0),
        files: fileDetails,
      },
      lastSync: integration.lastSync ? {
        date: integration.lastSync.date,
        status: integration.lastSync.status,
        duration: integration.lastSync.duration,
        durationFormatted: formatDuration(integration.lastSync.duration / 1000),
        recordsProcessed: integration.lastSync.recordsProcessed,
        recordsInserted: integration.lastSync.recordsInserted,
        recordsUpdated: integration.lastSync.recordsUpdated,
      } : null,
    });
  } catch (error) {
    console.error('Error getting sync details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Helper function to format duration
 */
const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0s';
  
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${minutes}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

/**
 * Get Parts Analytics page
 */
const getPartsAnalytics = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Mock analytics data
    const analyticsData = {
      totalSearches: 47892,
      partsViewed: 12456,
      purchases: 3847,
      conversionRate: 23.4,
      missedOpportunities: 1234,
      trendingParts: 89
    };
    
    // Most searched parts
    const mostSearchedParts = [
      { name: 'Ceramic Brake Pads Set', partNumber: 'BP-4521-CER', searches: 2847, conversion: 68, status: 'available', category: 'brake' },
      { name: 'Alternator Assembly 150A', partNumber: 'ALT-7890-PRO', searches: 2156, conversion: 72, status: 'available', category: 'engine' },
      { name: 'Front Strut Assembly', partNumber: 'SUS-3456-FR', searches: 1892, conversion: 45, status: 'limited', category: 'suspension' },
      { name: 'Spark Plug Platinum Set', partNumber: 'SP-1234-PLT', searches: 1654, conversion: 78, status: 'available', category: 'electrical' },
      { name: 'Oil Filter Premium', partNumber: 'OF-7890-PRO', searches: 1423, conversion: 28, status: 'out-of-stock', category: 'body' }
    ];
    
    // Missed opportunities (searched but not bought)
    const missedOpportunities = [
      { name: 'Turbocharger Assembly', reason: 'Not in inventory', searches: 847 },
      { name: 'LED Headlight Kit', reason: 'Price too high', searches: 623 },
      { name: 'Performance Exhaust System', reason: 'Out of stock frequently', searches: 512 },
      { name: 'Cold Air Intake Kit', reason: 'Compatibility issues', searches: 398 },
      { name: 'Racing Clutch Kit', reason: 'Limited fitment options', searches: 287 }
    ];
    
    // Top purchased parts
    const topPurchasedParts = [
      { name: 'Ceramic Brake Pads Set', category: 'Brake Systems', orders: 1847, revenue: 165000 },
      { name: 'Alternator Assembly', category: 'Electrical', orders: 1456, revenue: 298000 },
      { name: 'Oil Filter Premium', category: 'Filters', orders: 1234, revenue: 24000 },
      { name: 'Front Strut Assembly', category: 'Suspension', orders: 987, revenue: 145000 }
    ];
    
    res.render('admin/parts-analytics', {
      title: 'Parts Analytics | PARTSFORM Admin',
      activePage: 'parts-analytics',
      currentModule,
      moduleConfig,
      analyticsData,
      mostSearchedParts,
      missedOpportunities,
      topPurchasedParts
    });
  } catch (error) {
    console.error('Error in getPartsAnalytics:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load parts analytics' });
  }
};

/**
 * Get AOG Case Details page
 */
const getAOGCaseDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Mock AOG case data (in production, fetch from database)
    const aogCases = {
      'AOG-2025-001': { id: 'AOG-2025-001', aircraft: 'Boeing 737-800', registration: 'N12345', partNumber: 'PN-789456', description: 'Main Landing Gear Actuator', priority: 'critical', status: 'in_progress', customer: 'Delta Airlines', eta: '4 hours', created: '2025-12-26 14:30' },
      'AOG-2025-002': { id: 'AOG-2025-002', aircraft: 'Airbus A320', registration: 'D-ABCD', partNumber: 'PN-123789', description: 'APU Starter Motor', priority: 'high', status: 'sourcing', customer: 'Lufthansa', eta: '8 hours', created: '2025-12-26 10:15' },
      'AOG-2025-003': { id: 'AOG-2025-003', aircraft: 'Embraer E190', registration: 'PP-PJE', partNumber: 'PN-456123', description: 'Hydraulic Pump Assembly', priority: 'critical', status: 'shipped', customer: 'LATAM Airlines', eta: '2 hours', created: '2025-12-25 22:00' },
      'AOG-2025-004': { id: 'AOG-2025-004', aircraft: 'Boeing 777-300', registration: 'HL7782', partNumber: 'PN-987654', description: 'Engine Bleed Air Valve', priority: 'medium', status: 'delivered', customer: 'Korean Air', eta: 'Delivered', created: '2025-12-25 08:45' },
    };

    const aogCase = aogCases[id] || {
      id: id,
      aircraft: 'Unknown Aircraft',
      registration: 'N/A',
      partNumber: 'N/A',
      description: 'Case not found',
      priority: 'medium',
      status: 'sourcing',
      customer: 'Unknown',
      eta: 'N/A',
      created: new Date().toISOString()
    };

    res.render('admin/aog-case-details', {
      title: `AOG Case ${id} | PARTSFORM Admin`,
      activePage: 'aog',
      currentModule: 'aviation',
      moduleConfig: { name: 'Aviation', icon: 'plane', color: '#0ea5e9' },
      aogCase
    });
  } catch (error) {
    console.error('Error in getAOGCaseDetails:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load AOG case details' });
  }
};
/**
 * Get AOG Case Create page
 */
const getAOGCaseCreate = async (req, res) => {
  try {
    res.render('admin/aog-case-create', {
      title: 'Create AOG Case | PARTSFORM Admin',
      activePage: 'aog',
      currentModule: 'aviation',
      moduleConfig: { name: 'Aviation', icon: 'plane', color: '#0ea5e9' }
    });
  } catch (error) {
    console.error('Error in getAOGCaseCreate:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load create page' });
  }
};

/**
 * Get AOG Case Edit page
 */
const getAOGCaseEdit = async (req, res) => {
  try {
    const { id } = req.params;
    
    const aogCases = {
      'AOG-2025-001': { id: 'AOG-2025-001', aircraft: 'Boeing 737-800', registration: 'N12345', partNumber: 'PN-789456', description: 'Main Landing Gear Actuator', priority: 'critical', status: 'in_progress', customer: 'Delta Airlines', eta: '4 hours', created: '2025-12-26 14:30' },
      'AOG-2025-002': { id: 'AOG-2025-002', aircraft: 'Airbus A320', registration: 'D-ABCD', partNumber: 'PN-123789', description: 'APU Starter Motor', priority: 'high', status: 'sourcing', customer: 'Lufthansa', eta: '8 hours', created: '2025-12-26 10:15' },
      'AOG-2025-003': { id: 'AOG-2025-003', aircraft: 'Embraer E190', registration: 'PP-PJE', partNumber: 'PN-456123', description: 'Hydraulic Pump Assembly', priority: 'critical', status: 'shipped', customer: 'LATAM Airlines', eta: '2 hours', created: '2025-12-25 22:00' },
      'AOG-2025-004': { id: 'AOG-2025-004', aircraft: 'Boeing 777-300', registration: 'HL7782', partNumber: 'PN-987654', description: 'Engine Bleed Air Valve', priority: 'medium', status: 'delivered', customer: 'Korean Air', eta: 'Delivered', created: '2025-12-25 08:45' },
    };

    const aogCase = aogCases[id] || {
      id: id,
      aircraft: 'Unknown Aircraft',
      registration: 'N/A',
      partNumber: 'N/A',
      description: 'Case not found',
      priority: 'medium',
      status: 'sourcing',
      customer: 'Unknown',
      eta: 'N/A',
      created: new Date().toISOString()
    };

    res.render('admin/aog-case-edit', {
      title: `Edit AOG Case ${id} | PARTSFORM Admin`,
      activePage: 'aog',
      currentModule: 'aviation',
      moduleConfig: { name: 'Aviation', icon: 'plane', color: '#0ea5e9' },
      aogCase
    });
  } catch (error) {
    console.error('Error in getAOGCaseEdit:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load edit page' });
  }
};

// Export controller functions
module.exports = {
  getAdminDashboard,
  getOrdersManagement,
  getOrderDetails,
  getOrderCreate,
  getOrderEdit,
  deleteOrder,
  getTicketsManagement,
  getTicketDetails,
  postTicketReply,
  updateTicketStatus,
  getUsersManagement,
  getUserDetails,
  getUserCreate,
  getUserEdit,
  updateUserStatus,
  bulkUpdateUsers,
  deleteUser,
  getPaymentsManagement,
  getPaymentDetails,
  getPaymentCreate,
  getAdminSettings,
  getIntegrationsManagement,
  getIntegrationCreate,
  getIntegrationEdit,
  getPartsAnalytics,
  // Integration API functions
  createIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegrationConnection,
  syncIntegration,
  getSyncStatus,
  getSyncProgress,
  getSyncDetails,
  getIntegrations,
  getIntegration,
};

