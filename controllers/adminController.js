// Admin Controller
// This file contains all admin-related controller functions

/**
 * Get module from query parameter and get module-specific data
 */
const getModuleData = (req) => {
  const module = req.query.module || null;
  
  // Module configurations
  const moduleConfigs = {
    automotive: {
      name: 'Automotive',
      icon: 'car',
      color: '#dc2626',
      filterIndustry: 'automotive'
    },
    aviation: {
      name: 'Aviation',
      icon: 'plane',
      color: '#0ea5e9',
      filterIndustry: 'aviation'
    },
    machinery: {
      name: 'Heavy Machinery',
      icon: 'construction',
      color: '#eab308',
      filterIndustry: 'machinery'
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
    
    // Mock orders data
    const allOrders = [
      { id: 'ORD-2025-1247', customer: 'Aerotech Industries', amount: 45200, status: 'processing', industry: 'aviation', date: '2025-12-26' },
      { id: 'ORD-2025-1246', customer: 'AutoMax Germany', amount: 12800, status: 'shipped', industry: 'automotive', date: '2025-12-26' },
      { id: 'ORD-2025-1245', customer: 'Heavy Duty Corp', amount: 89500, status: 'delivered', industry: 'machinery', date: '2025-12-25' },
      { id: 'ORD-2025-1244', customer: 'SkyLine Aviation', amount: 156000, status: 'processing', industry: 'aviation', date: '2025-12-25' },
      { id: 'ORD-2025-1243', customer: 'Premium Auto Parts', amount: 8750, status: 'pending', industry: 'automotive', date: '2025-12-24' },
      { id: 'ORD-2025-1242', customer: 'Construction Plus', amount: 67300, status: 'shipped', industry: 'machinery', date: '2025-12-24' },
      { id: 'ORD-2025-1241', customer: 'AirCraft Solutions', amount: 234000, status: 'pending', industry: 'aviation', date: '2025-12-23' },
      { id: 'ORD-2025-1240', customer: 'Euro Auto Systems', amount: 19500, status: 'delivered', industry: 'automotive', date: '2025-12-23' },
    ];

    // Filter orders by module if selected
    const recentOrders = filterByModule(allOrders, currentModule);

    // Calculate module-specific or overall stats
    const calculateModuleStats = (industry) => {
      const orders = industry ? allOrders.filter(o => o.industry === industry) : allOrders;
      return {
        orders: orders.length,
        revenue: orders.reduce((sum, o) => sum + o.amount, 0),
        growth: industry === 'automotive' ? 24 : industry === 'aviation' ? 31 : industry === 'machinery' ? 18 : 22
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
      
      // Industry-specific stats (for non-filtered view)
      automotive: { orders: 523, revenue: 1245000, growth: 24, topParts: ['Brake Systems', 'Engine Components', 'Suspension'] },
      aviation: { orders: 189, revenue: 892000, growth: 31, topParts: ['Turbine Blades', 'Landing Gear', 'Avionics'] },
      machinery: { orders: 312, revenue: 710562, growth: 18, topParts: ['Hydraulic Pumps', 'Gearboxes', 'Excavator Parts'] }
    };

    // Mock chart data - filtered by module
    const getChartData = () => {
      if (currentModule === 'automotive') {
        return {
          revenueLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          revenueData: [85000, 95000, 88000, 120000, 135000, 115000, 140000, 155000, 125000, 165000, 180000, 125000],
          orderLabels: ['Brake Systems', 'Engine Parts', 'Suspension', 'Body Parts', 'Electronics'],
          orderData: [180, 150, 95, 58, 40]
        };
      } else if (currentModule === 'aviation') {
        return {
          revenueLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          revenueData: [65000, 78000, 72000, 95000, 110000, 98000, 115000, 125000, 105000, 140000, 155000, 105000],
          orderLabels: ['Turbine Parts', 'Landing Gear', 'Avionics', 'Hydraulics', 'Interior'],
          orderData: [65, 48, 38, 25, 13]
        };
      } else if (currentModule === 'machinery') {
        return {
          revenueLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          revenueData: [55000, 62000, 58000, 78000, 88000, 75000, 92000, 100000, 82000, 110000, 120000, 85000],
          orderLabels: ['Hydraulic Pumps', 'Gearboxes', 'Excavator Parts', 'Crane Components', 'Bearings'],
          orderData: [110, 85, 65, 32, 20]
        };
      } else {
        return {
          revenueLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          revenueData: [180000, 220000, 195000, 280000, 310000, 275000, 320000, 350000, 295000, 380000, 420000, 285000],
          orderLabels: ['Automotive', 'Aviation', 'Machinery'],
          orderData: [523, 189, 312]
        };
      }
    };

    // Mock tickets data with industry assignments
    const allTickets = [
      { id: 'TKT-001', subject: 'Brake pad compatibility issue', category: 'Product', status: 'open', priority: 'high', orderNumber: 'ORD-2025-1246', industry: 'automotive', createdAt: '2025-12-26', messages: [{}, {}] },
      { id: 'TKT-002', subject: 'AOG - Urgent turbine part needed', category: 'AOG', status: 'open', priority: 'urgent', orderNumber: 'ORD-2025-1247', industry: 'aviation', createdAt: '2025-12-26', messages: [{}, {}, {}] },
      { id: 'TKT-003', subject: 'Hydraulic pump delivery delay', category: 'Shipping', status: 'in-progress', priority: 'medium', orderNumber: 'ORD-2025-1245', industry: 'machinery', createdAt: '2025-12-25', messages: [{}] },
      { id: 'TKT-004', subject: 'Engine component return request', category: 'Returns', status: 'open', priority: 'medium', orderNumber: 'ORD-2025-1243', industry: 'automotive', createdAt: '2025-12-25', messages: [{}, {}] },
      { id: 'TKT-005', subject: 'Landing gear certification docs', category: 'Documentation', status: 'resolved', priority: 'low', orderNumber: 'ORD-2025-1244', industry: 'aviation', createdAt: '2025-12-24', messages: [{}, {}, {}, {}] },
      { id: 'TKT-006', subject: 'Excavator part warranty claim', category: 'Warranty', status: 'in-progress', priority: 'high', orderNumber: 'ORD-2025-1242', industry: 'machinery', createdAt: '2025-12-24', messages: [{}, {}] },
      { id: 'TKT-007', subject: 'Suspension kit wrong size', category: 'Product', status: 'resolved', priority: 'medium', orderNumber: 'ORD-2025-1240', industry: 'automotive', createdAt: '2025-12-23', messages: [{}] },
      { id: 'TKT-008', subject: 'Avionics unit not working', category: 'Technical', status: 'open', priority: 'high', orderNumber: 'ORD-2025-1241', industry: 'aviation', createdAt: '2025-12-23', messages: [{}, {}, {}] },
      { id: 'TKT-009', subject: 'Crane component missing parts', category: 'Shipping', status: 'resolved', priority: 'medium', orderNumber: 'ORD-2025-1242', industry: 'machinery', createdAt: '2025-12-22', messages: [{}, {}] },
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
    
    // Mock orders data
    const allOrders = [
      { id: 'ORD-2025-1247', customer: 'Aerotech Industries', email: 'orders@aerotech.com', amount: 45200, status: 'processing', industry: 'aviation', date: '2025-12-26', items: 3 },
      { id: 'ORD-2025-1246', customer: 'AutoMax Germany', email: 'procurement@automax.de', amount: 12800, status: 'shipped', industry: 'automotive', date: '2025-12-26', items: 5 },
      { id: 'ORD-2025-1245', customer: 'Heavy Duty Corp', email: 'supply@heavyduty.com', amount: 89500, status: 'delivered', industry: 'machinery', date: '2025-12-25', items: 2 },
      { id: 'ORD-2025-1244', customer: 'SkyLine Aviation', email: 'parts@skyline.aero', amount: 156000, status: 'processing', industry: 'aviation', date: '2025-12-25', items: 8 },
      { id: 'ORD-2025-1243', customer: 'Premium Auto Parts', email: 'orders@premiumauto.com', amount: 8750, status: 'pending', industry: 'automotive', date: '2025-12-24', items: 12 },
      { id: 'ORD-2025-1242', customer: 'Construction Plus', email: 'purchasing@constplus.com', amount: 67300, status: 'shipped', industry: 'machinery', date: '2025-12-24', items: 4 },
      { id: 'ORD-2025-1241', customer: 'AirCraft Solutions', email: 'supply@aircraft.com', amount: 234000, status: 'pending', industry: 'aviation', date: '2025-12-23', items: 6 },
      { id: 'ORD-2025-1240', customer: 'Euro Auto Systems', email: 'parts@euroauto.eu', amount: 19500, status: 'delivered', industry: 'automotive', date: '2025-12-23', items: 8 },
    ];

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
 * Get Tickets Management page
 */
const getTicketsManagement = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    const ticketsDatabase = req.app.locals.ticketsDatabase || [];
    
    // Add mock industry to tickets if not present
    const ticketsWithIndustry = ticketsDatabase.map((ticket, index) => ({
      ...ticket,
      industry: ['automotive', 'aviation', 'machinery'][index % 3]
    }));

    const tickets = filterByModule(ticketsWithIndustry, currentModule);
    
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
 * Get Users Management page
 */
const getUsersManagement = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Mock users data
    const allUsers = [
      { id: 1, name: 'John Smith', email: 'john.smith@company.com', company: 'Aerotech Industries', orders: 23, totalSpent: 245000, status: 'active', joined: '2024-03-15', industry: 'aviation' },
      { id: 2, name: 'Maria Garcia', email: 'maria@automax.de', company: 'AutoMax Germany', orders: 45, totalSpent: 89000, status: 'active', joined: '2024-01-22', industry: 'automotive' },
      { id: 3, name: 'Robert Chen', email: 'r.chen@heavyduty.com', company: 'Heavy Duty Corp', orders: 12, totalSpent: 456000, status: 'active', joined: '2024-06-10', industry: 'machinery' },
      { id: 4, name: 'Sarah Johnson', email: 'sarah@skyline.aero', company: 'SkyLine Aviation', orders: 67, totalSpent: 1250000, status: 'active', joined: '2023-11-05', industry: 'aviation' },
      { id: 5, name: 'Michael Brown', email: 'mbrown@premiumauto.com', company: 'Premium Auto Parts', orders: 34, totalSpent: 67500, status: 'inactive', joined: '2024-02-28', industry: 'automotive' },
      { id: 6, name: 'Emma Wilson', email: 'emma@constplus.com', company: 'Construction Plus', orders: 18, totalSpent: 234000, status: 'active', joined: '2024-04-19', industry: 'machinery' },
    ];

    const users = filterByModule(allUsers, currentModule);

    res.render('admin/users', {
      title: currentModule ? `${moduleConfig.name} Users | PARTSFORM Admin` : 'Users Management | PARTSFORM',
      activePage: 'users',
      currentModule,
      moduleConfig,
      users
    });
  } catch (error) {
    console.error('Error in getUsersManagement:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load users' });
  }
};

/**
 * Get Payments Management page
 */
const getPaymentsManagement = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Mock payments data
    const allPayments = [
      { id: 'PAY-2025-001', orderId: 'ORD-2025-1247', customer: 'Aerotech Industries', amount: 45200, method: 'wire', status: 'completed', date: '2025-12-26', industry: 'aviation' },
      { id: 'PAY-2025-002', orderId: 'ORD-2025-1246', customer: 'AutoMax Germany', amount: 12800, method: 'credit_card', status: 'completed', date: '2025-12-26', industry: 'automotive' },
      { id: 'PAY-2025-003', orderId: 'ORD-2025-1245', customer: 'Heavy Duty Corp', amount: 89500, method: 'wire', status: 'pending', date: '2025-12-25', industry: 'machinery' },
      { id: 'PAY-2025-004', orderId: 'ORD-2025-1244', customer: 'SkyLine Aviation', amount: 156000, method: 'letter_of_credit', status: 'processing', date: '2025-12-25', industry: 'aviation' },
      { id: 'PAY-2025-005', orderId: 'ORD-2025-1243', customer: 'Premium Auto Parts', amount: 8750, method: 'credit_card', status: 'completed', date: '2025-12-24', industry: 'automotive' },
      { id: 'PAY-2025-006', orderId: 'ORD-2025-1242', customer: 'Construction Plus', amount: 67300, method: 'wire', status: 'completed', date: '2025-12-24', industry: 'machinery' },
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

// Export controller functions
module.exports = {
  getAdminDashboard,
  getOrdersManagement,
  getTicketsManagement,
  getUsersManagement,
  getPaymentsManagement,
  getAOGManagement,
  getAdminSettings
};
