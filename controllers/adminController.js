// Admin Controller
// This file contains all admin-related controller functions

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
    
    res.render('admin/integrations', {
      title: 'Integrations - Admin',
      activePage: 'integrations',
      currentModule,
      moduleConfig
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
      moduleConfig
    });
  } catch (error) {
    console.error('Error in getIntegrationCreate:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load connection create page' });
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
  getIntegrationCreate
};

