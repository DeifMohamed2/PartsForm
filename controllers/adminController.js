// Admin Controller
// This file contains all admin-related controller functions

const Integration = require('../models/Integration');
const Part = require('../models/Part');
const Buyer = require('../models/Buyer');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const ftpService = require('../services/ftpService');
const syncService = require('../services/syncService');
const schedulerService = require('../services/schedulerService');
const elasticsearchService = require('../services/elasticsearchService');
const socketService = require('../services/socketService');

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
 * Helper function to format order date
 */
const formatOrderDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Helper function to format order time
 */
const formatOrderTime = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Get Orders Management page - Uses real database
 */
const getOrdersManagement = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Get real orders from database with buyer info
    const dbOrders = await Order.find({})
      .populate('buyer', 'firstName lastName email companyName phone')
      .sort({ createdAt: -1 })
      .lean();
    
    // Transform database orders to view format
    const orders = dbOrders.map(order => ({
      id: order.orderNumber,
      _id: order._id,
      customer: order.buyer ? 
        (order.buyer.companyName || `${order.buyer.firstName || ''} ${order.buyer.lastName || ''}`.trim() || 'Unknown') : 
        'Unknown Customer',
      email: order.buyer?.email || 'N/A',
      phone: order.buyer?.phone || 'N/A',
      amount: order.pricing?.total || 0,
      currency: order.pricing?.currency || 'AED',
      status: order.status || 'pending',
      industry: 'automotive',
      date: formatOrderDate(order.createdAt),
      time: formatOrderTime(order.createdAt),
      items: order.totalItems || order.items?.length || 0,
      priority: order.priority || 'normal',
      paymentStatus: order.payment?.status || 'pending',
      paymentMethod: order.payment?.method || 'N/A',
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

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
 * Get Order Details page - Uses real database
 */
const getOrderDetails = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    const orderId = req.params.id;
    
    // Try to find by order number first, then by _id
    let order = await Order.findOne({ orderNumber: orderId })
      .populate('buyer', 'firstName lastName email companyName phone country city shippingAddress')
      .lean();
    
    if (!order) {
      // Try finding by MongoDB _id
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        order = await Order.findById(orderId)
          .populate('buyer', 'firstName lastName email companyName phone country city shippingAddress')
          .lean();
      }
    }
    
    if (!order) {
      return res.status(404).render('error', { title: 'Error', error: 'Order not found' });
    }

    // Transform for view - full order details
    const orderData = {
      id: order.orderNumber,
      _id: order._id,
      customer: order.buyer ? 
        (order.buyer.companyName || `${order.buyer.firstName || ''} ${order.buyer.lastName || ''}`.trim() || 'Unknown') : 
        'Unknown Customer',
      email: order.buyer?.email || 'N/A',
      phone: order.buyer?.phone || 'N/A',
      amount: order.pricing?.total || 0,
      subtotal: order.pricing?.subtotal || 0,
      tax: order.pricing?.tax || 0,
      shipping: order.pricing?.shipping || 0,
      processingFee: order.pricing?.processingFee || 0,
      discount: order.pricing?.discount || 0,
      currency: order.pricing?.currency || 'AED',
      status: order.status || 'pending',
      date: formatOrderDate(order.createdAt),
      time: formatOrderTime(order.createdAt),
      priority: order.priority || 'normal',
      totalItems: order.totalItems || order.items?.length || 0,
      totalWeight: order.totalWeight || 0,
      notes: order.notes || '',
      
      // Items with full details
      items: order.items?.map(item => ({
        partNumber: item.partNumber,
        description: item.description || item.partNumber,
        brand: item.brand || 'N/A',
        supplier: item.supplier || 'N/A',
        price: item.price || 0,
        currency: item.currency || 'AED',
        weight: item.weight || 0,
        stock: item.stock || 'N/A',
        addedAt: item.addedAt
      })) || [],
      
      // Payment info
      payment: {
        type: order.payment?.type || 'full',
        method: order.payment?.method || 'N/A',
        status: order.payment?.status || 'pending',
        amountPaid: order.payment?.amountPaid || 0,
        amountDue: order.payment?.amountDue || order.pricing?.total || 0,
        transactions: order.payment?.transactions || []
      },
      
      // Shipping info
      shipping: {
        fullName: order.shipping?.fullName || order.shipping?.firstName || 'N/A',
        phone: order.shipping?.phone || 'N/A',
        street: order.shipping?.street || order.shipping?.address || 'N/A',
        city: order.shipping?.city || 'N/A',
        state: order.shipping?.state || '',
        country: order.shipping?.country || 'N/A',
        postalCode: order.shipping?.postalCode || '',
        trackingNumber: order.shipping?.trackingNumber || '',
        carrier: order.shipping?.carrier || '',
        estimatedDelivery: order.shipping?.estimatedDelivery,
        actualDelivery: order.shipping?.actualDelivery
      },
      
      // Timeline
      timeline: order.timeline?.map(event => ({
        status: event.status,
        message: event.message,
        timestamp: event.timestamp,
        updatedBy: event.updatedBy || 'System',
        formattedDate: formatOrderDate(event.timestamp),
        formattedTime: formatOrderTime(event.timestamp)
      })) || [],
      
      // Buyer info
      buyer: order.buyer ? {
        id: order.buyer._id,
        name: order.buyer.companyName || `${order.buyer.firstName || ''} ${order.buyer.lastName || ''}`.trim(),
        email: order.buyer.email,
        phone: order.buyer.phone,
        country: order.buyer.country,
        city: order.buyer.city
      } : null,
      
      // Cancellation info
      cancellation: order.cancellation || null,
      
      // Timestamps
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };

    res.render('admin/order-details', {
      title: `Order ${order.orderNumber} | PARTSFORM Admin`,
      activePage: 'orders',
      currentModule,
      moduleConfig,
      order: orderData
    });
  } catch (error) {
    console.error('Error in getOrderDetails:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load order details' });
  }
};

/**
 * Get Order Create page - with buyers list
 */
const getOrderCreate = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Get all buyers for the dropdown (include all statuses for admin)
    const buyers = await Buyer.find({})
      .select('firstName lastName email companyName phone country city accountStatus')
      .sort({ companyName: 1, lastName: 1 })
      .lean();
    
    console.log('Found buyers for order create:', buyers.length);

    res.render('admin/order-create', {
      title: 'Create Order | PARTSFORM Admin',
      activePage: 'orders',
      currentModule,
      moduleConfig,
      buyers
    });
  } catch (error) {
    console.error('Error in getOrderCreate:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load create order page' });
  }
};

/**
 * Get Order Edit page - Uses real database
 */
const getOrderEdit = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    const orderId = req.params.id;
    
    // Try to find by order number first, then by _id
    let order = await Order.findOne({ orderNumber: orderId })
      .populate('buyer', 'firstName lastName email companyName phone')
      .lean();
    
    if (!order) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        order = await Order.findById(orderId)
          .populate('buyer', 'firstName lastName email companyName phone')
          .lean();
      }
    }
    
    if (!order) {
      return res.status(404).render('error', { title: 'Error', error: 'Order not found' });
    }
    
    // Get all buyers for the dropdown
    const buyers = await Buyer.find({ accountStatus: 'active' })
      .select('firstName lastName email companyName phone')
      .sort({ companyName: 1, lastName: 1 })
      .lean();

    // Transform for edit view
    const orderData = {
      id: order.orderNumber,
      _id: order._id,
      buyerId: order.buyer?._id,
      customer: order.buyer ? 
        (order.buyer.companyName || `${order.buyer.firstName || ''} ${order.buyer.lastName || ''}`.trim()) : 
        'Unknown',
      email: order.buyer?.email || 'N/A',
      status: order.status || 'pending',
      priority: order.priority || 'normal',
      date: formatOrderDate(order.createdAt),
      time: formatOrderTime(order.createdAt),
      amount: order.pricing?.total || 0,
      subtotal: order.pricing?.subtotal || 0,
      currency: order.pricing?.currency || 'AED',
      notes: order.notes || '',
      
      // Pricing object for edit view
      pricing: {
        subtotal: order.pricing?.subtotal || 0,
        tax: order.pricing?.tax || 0,
        shipping: order.pricing?.shipping || 0,
        processingFee: order.pricing?.processingFee || 0,
        discount: order.pricing?.discount || 0,
        total: order.pricing?.total || 0,
        currency: order.pricing?.currency || 'AED'
      },
      
      // Items
      items: order.items?.map(item => ({
        partNumber: item.partNumber,
        description: item.description || item.partNumber,
        brand: item.brand || 'N/A',
        supplier: item.supplier || 'N/A',
        price: item.price || 0,
        currency: item.currency || 'AED'
      })) || [],
      
      // Payment
      payment: {
        type: order.payment?.type || 'full',
        method: order.payment?.method || 'bank-dubai',
        status: order.payment?.status || 'pending'
      },
      
      // Shipping
      shipping: {
        fullName: order.shipping?.fullName || '',
        phone: order.shipping?.phone || '',
        street: order.shipping?.street || order.shipping?.address || '',
        city: order.shipping?.city || '',
        state: order.shipping?.state || '',
        country: order.shipping?.country || '',
        postalCode: order.shipping?.postalCode || ''
      }
    };

    res.render('admin/order-edit', {
      title: `Edit Order ${order.orderNumber} | PARTSFORM Admin`,
      activePage: 'orders',
      currentModule,
      moduleConfig,
      order: orderData,
      buyers
    });
  } catch (error) {
    console.error('Error in getOrderEdit:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load edit order page' });
  }
};

/**
 * Delete Order (API) - Uses real database
 */
const deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Try to find and delete by order number first
    let deletedOrder = await Order.findOneAndDelete({ orderNumber: orderId });
    
    if (!deletedOrder) {
      // Try by MongoDB _id
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        deletedOrder = await Order.findByIdAndDelete(orderId);
      }
    }
    
    if (!deletedOrder) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    res.json({ 
      success: true, 
      message: `Order ${deletedOrder.orderNumber} deleted successfully` 
    });
  } catch (error) {
    console.error('Error in deleteOrder:', error);
    res.status(500).json({ success: false, error: 'Failed to delete order' });
  }
};

/**
 * Create Order (API) - Uses real database
 */
const createOrder = async (req, res) => {
  try {
    const { buyerId, items, priority, notes, payment, shipping } = req.body;
    
    // Validate buyer
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) {
      return res.status(400).json({ success: false, error: 'Invalid buyer selected' });
    }
    
    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one item is required' });
    }
    
    // Generate order number
    const orderNumber = await Order.generateOrderNumber();
    
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const processingFee = parseFloat(payment?.processingFee) || 0;
    const tax = parseFloat(payment?.tax) || 0;
    const shippingCost = parseFloat(payment?.shippingCost) || 0;
    const total = subtotal + processingFee + tax + shippingCost;
    
    // Create order items
    const orderItems = items.map(item => ({
      partNumber: item.partNumber,
      description: item.description || item.partNumber,
      brand: item.brand || 'N/A',
      supplier: item.supplier || 'N/A',
      price: parseFloat(item.price) || 0,
      currency: item.currency || 'AED',
      weight: parseFloat(item.weight) || 0,
      stock: item.stock || 'N/A',
      addedAt: new Date()
    }));
    
    // Create order
    const order = await Order.create({
      orderNumber,
      buyer: buyerId,
      items: orderItems,
      pricing: {
        subtotal,
        tax,
        shipping: shippingCost,
        processingFee,
        discount: 0,
        total,
        currency: payment?.currency || 'AED'
      },
      payment: {
        type: payment?.type || 'full',
        method: payment?.method || 'bank-dubai',
        status: 'pending',
        amountPaid: 0,
        amountDue: total,
        transactions: []
      },
      shipping: {
        fullName: shipping?.fullName || `${buyer.firstName} ${buyer.lastName}`,
        phone: shipping?.phone || buyer.phone,
        street: shipping?.street || buyer.shippingAddress,
        city: shipping?.city || buyer.city,
        state: shipping?.state || '',
        country: shipping?.country || buyer.country,
        postalCode: shipping?.postalCode || ''
      },
      status: 'pending',
      priority: priority || 'normal',
      notes: notes || '',
      totalItems: orderItems.length,
      totalWeight: orderItems.reduce((sum, item) => sum + (item.weight || 0), 0),
      timeline: [{
        status: 'pending',
        message: 'Order created by admin',
        timestamp: new Date(),
        updatedBy: req.admin?.username || 'Admin'
      }]
    });
    
    res.json({
      success: true,
      message: 'Order created successfully',
      order: {
        id: order.orderNumber,
        _id: order._id,
        total: order.pricing.total
      }
    });
  } catch (error) {
    console.error('Error in createOrder:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create order' });
  }
};

/**
 * Update Order (API) - Uses real database
 */
const updateOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, priority, notes, shipping, items, payment } = req.body;
    
    // Find order
    let order = await Order.findOne({ orderNumber: orderId });
    if (!order) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        order = await Order.findById(orderId);
      }
    }
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    // Track status change
    const statusChanged = status && status !== order.status;
    
    // Update fields
    if (status) order.status = status;
    if (priority) order.priority = priority;
    if (notes !== undefined) order.notes = notes;
    
    // Update shipping
    if (shipping) {
      order.shipping = {
        ...order.shipping,
        ...shipping
      };
    }
    
    // Update items if provided
    if (items && Array.isArray(items)) {
      order.items = items.map(item => ({
        partNumber: item.partNumber,
        description: item.description || item.partNumber,
        brand: item.brand || 'N/A',
        supplier: item.supplier || 'N/A',
        price: parseFloat(item.price) || 0,
        currency: item.currency || 'AED',
        weight: parseFloat(item.weight) || 0,
        stock: item.stock || 'N/A'
      }));
      
      // Recalculate pricing
      const subtotal = order.items.reduce((sum, item) => sum + item.price, 0);
      order.pricing.subtotal = subtotal;
      order.pricing.total = subtotal + (order.pricing.tax || 0) + 
                           (order.pricing.shipping || 0) + 
                           (order.pricing.processingFee || 0) - 
                           (order.pricing.discount || 0);
      order.totalItems = order.items.length;
    }
    
    // Update payment if provided
    if (payment) {
      if (payment.status) order.payment.status = payment.status;
      if (payment.method) order.payment.method = payment.method;
    }
    
    // Add timeline event if status changed
    if (statusChanged) {
      const statusMessages = {
        pending: 'Order marked as pending',
        processing: 'Order is now being processed',
        shipped: 'Order has been shipped',
        delivered: 'Order has been delivered',
        completed: 'Order completed',
        cancelled: 'Order has been cancelled'
      };
      
      order.timeline.push({
        status,
        message: statusMessages[status] || `Status changed to ${status}`,
        timestamp: new Date(),
        updatedBy: req.admin?.username || 'Admin'
      });
    }
    
    await order.save();
    
    res.json({
      success: true,
      message: 'Order updated successfully',
      order: {
        id: order.orderNumber,
        status: order.status,
        total: order.pricing.total
      }
    });
  } catch (error) {
    console.error('Error in updateOrder:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update order' });
  }
};

/**
 * Update Order Status (API)
 */
const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, message } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    
    // Find order
    let order = await Order.findOne({ orderNumber: orderId });
    if (!order) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        order = await Order.findById(orderId);
      }
    }
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const statusMessages = {
      pending: 'Order marked as pending',
      processing: 'Order is now being processed',
      shipped: 'Order has been shipped',
      delivered: 'Order has been delivered',
      completed: 'Order completed',
      cancelled: 'Order has been cancelled'
    };
    
    await order.updateStatus(
      status, 
      message || statusMessages[status] || `Status changed to ${status}`,
      req.admin?.username || 'Admin'
    );
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      newStatus: status
    });
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
};

/**
 * Get Order Stats (API) - For dashboard
 */
const getOrderStats = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$pricing.total' }
        }
      }
    ]);
    
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        byStatus: stats.reduce((acc, s) => {
          acc[s._id] = { count: s.count, amount: s.totalAmount };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error in getOrderStats:', error);
    res.status(500).json({ success: false, error: 'Failed to get order stats' });
  }
};

/**
 * Get Tickets Management page - Uses real database
 */
const getTicketsManagement = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Get real tickets from database
    const dbTickets = await Ticket.find({})
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    // Format tickets for the view
    const tickets = dbTickets.map(ticket => ({
      id: ticket.ticketNumber,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority || 'medium',
      orderNumber: ticket.orderNumber || 'N/A',
      customerName: ticket.buyerName,
      customerEmail: ticket.buyerEmail,
      customer: ticket.buyerName,
      email: ticket.buyerEmail,
      industry: ticket.industry || 'automotive',
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      unreadCount: ticket.unreadByAdmin || 0,
      lastMessage: ticket.messages && ticket.messages.length > 0 
        ? { 
            content: ticket.messages[ticket.messages.length - 1].content,
            time: ticket.messages[ticket.messages.length - 1].createdAt
          }
        : null,
      messages: ticket.messages || []
    }));
    
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
 * Get Ticket Details/Chat page - Uses real database
 */
const getTicketDetails = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    const ticketId = req.params.id;
    
    // Find ticket in database
    const dbTicket = await Ticket.findOne({ ticketNumber: ticketId })
      .populate('buyer', 'firstName lastName email companyName phone industry')
      .lean();
    
    if (!dbTicket) {
      return res.status(404).render('error', { title: 'Error', error: 'Ticket not found' });
    }

    // Mark messages as read by admin
    await Ticket.updateOne(
      { _id: dbTicket._id },
      { 
        $set: { 
          unreadByAdmin: 0,
          'messages.$[elem].readByAdmin': true 
        } 
      },
      { 
        arrayFilters: [{ 'elem.sender': 'buyer' }] 
      }
    );

    // Format ticket for the view
    const ticket = {
      id: dbTicket.ticketNumber,
      _id: dbTicket._id,
      subject: dbTicket.subject,
      description: dbTicket.description,
      category: dbTicket.category,
      status: dbTicket.status,
      priority: dbTicket.priority || 'medium',
      orderNumber: dbTicket.orderNumber || 'N/A',
      customerName: dbTicket.buyerName,
      customerEmail: dbTicket.buyerEmail,
      customer: dbTicket.buyerName,
      email: dbTicket.buyerEmail,
      buyerId: dbTicket.buyer?._id || dbTicket.buyer,
      industry: dbTicket.buyer?.industry || dbTicket.industry || 'N/A',
      createdAt: dbTicket.createdAt,
      updatedAt: dbTicket.updatedAt,
      attachments: dbTicket.attachments || [],
      messages: dbTicket.messages.map(msg => ({
        _id: msg._id,
        sender: msg.sender,
        senderName: msg.senderName,
        content: msg.content,
        text: msg.content,
        attachments: msg.attachments || [],
        time: msg.createdAt,
        createdAt: msg.createdAt,
        read: msg.readByAdmin
      }))
    };

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
 * Post reply to ticket - Uses real database
 */
const postTicketReply = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { message } = req.body;
    const admin = req.user;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Find the ticket
    const ticket = await Ticket.findOne({ ticketNumber: ticketId });
    
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
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
          path: `/uploads/tickets/${file.filename}`
        });
      }
    }

    // Add the message
    const adminName = admin ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Support Team' : 'Support Team';
    
    const newMessage = await ticket.addMessage({
      sender: 'admin',
      senderName: adminName,
      senderId: admin?._id,
      content: message.trim(),
      attachments
    });

    // Emit socket event for real-time update
    socketService.emitToTicket(ticketId, 'message-received', {
      ticketId,
      message: {
        id: newMessage._id,
        sender: 'admin',
        senderName: adminName,
        content: message.trim(),
        attachments,
        timestamp: newMessage.createdAt
      }
    });

    // Notify the buyer
    socketService.emitToBuyer(ticket.buyer.toString(), 'ticket-new-message', {
      ticketId: ticket.ticketNumber,
      subject: ticket.subject,
      message: {
        sender: 'admin',
        senderName: adminName,
        content: message.trim().substring(0, 100),
        timestamp: newMessage.createdAt
      }
    });
    
    res.json({ 
      success: true, 
      message: {
        id: newMessage._id,
        sender: 'admin',
        senderName: adminName,
        content: message.trim(),
        attachments,
        timestamp: newMessage.createdAt
      }
    });
  } catch (error) {
    console.error('Error in postTicketReply:', error);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
};

/**
 * Update ticket status - Uses real database
 */
const updateTicketStatus = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status } = req.body;
    
    const ticket = await Ticket.findOne({ ticketNumber: ticketId });
    
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    
    await ticket.updateStatus(status, 'admin');

    // Emit socket event for real-time update
    socketService.emitToTicket(ticketId, 'ticket-status-changed', {
      ticketId,
      status,
      updatedBy: 'admin'
    });

    // Notify the buyer
    socketService.emitToBuyer(ticket.buyer.toString(), 'ticket-status-changed', {
      ticketId: ticket.ticketNumber,
      subject: ticket.subject,
      status
    });
    
    res.json({ success: true, message: `Ticket status updated to ${status}` });
  } catch (error) {
    console.error('Error in updateTicketStatus:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
};

/**
 * Get tickets API for admin
 * GET /admin/api/tickets
 */
const getTicketsApi = async (req, res) => {
  try {
    const { status, priority, category, search, page = 1, limit = 20 } = req.query;

    // Build query
    const query = {};
    
    if (status && status !== '') {
      query.status = status;
    }
    
    if (priority && priority !== '') {
      query.priority = priority;
    }
    
    if (category && category !== '') {
      query.category = category;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { ticketNumber: searchRegex },
        { subject: searchRegex },
        { orderNumber: searchRegex },
        { buyerName: searchRegex },
        { buyerEmail: searchRegex }
      ];
    }

    // Get tickets with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Ticket.countDocuments(query)
    ]);

    // Get status counts
    const [openCount, inProgressCount, resolvedCount, closedCount] = await Promise.all([
      Ticket.countDocuments({ status: 'open' }),
      Ticket.countDocuments({ status: 'in-progress' }),
      Ticket.countDocuments({ status: 'resolved' }),
      Ticket.countDocuments({ status: 'closed' })
    ]);

    res.json({
      success: true,
      tickets: tickets.map(t => ({
        id: t.ticketNumber,
        subject: t.subject,
        category: t.category,
        status: t.status,
        priority: t.priority,
        orderNumber: t.orderNumber || 'N/A',
        customerName: t.buyerName,
        customerEmail: t.buyerEmail,
        createdAt: t.createdAt,
        unreadCount: t.unreadByAdmin || 0,
        messageCount: t.messages?.length || 0,
        lastMessageAt: t.lastMessageAt
      })),
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
        closed: closedCount,
        total: openCount + inProgressCount + resolvedCount + closedCount
      }
    });
  } catch (error) {
    console.error('Error in getTicketsApi:', error);
    res.status(500).json({ success: false, error: 'Failed to load tickets' });
  }
};

/**
 * Mark ticket as read by admin
 * PUT /admin/api/tickets/:id/read
 */
const markTicketAsReadAdmin = async (req, res) => {
  try {
    const ticketId = req.params.id;

    const ticket = await Ticket.findOne({ ticketNumber: ticketId });

    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    await ticket.markAsRead('admin');

    // Notify via socket
    socketService.emitToTicket(ticketId, 'messages-marked-read', {
      ticketId,
      readBy: 'admin'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error in markTicketAsReadAdmin:', error);
    res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
};

/**
 * Get Users Management page (users are global, not filtered by module)
 * Uses real database data from Buyer model
 */
const getUsersManagement = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    
    // Get all buyers from database
    const buyers = await Buyer.find({}).sort({ createdAt: -1 }).lean();
    
    // Get order counts and total spent for each buyer
    const usersWithStats = await Promise.all(buyers.map(async (buyer) => {
      // Get orders for this buyer
      const orders = await Order.find({ buyer: buyer._id }).lean();
      const orderCount = orders.length;
      const totalSpent = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      
      // Map isActive to status for view compatibility
      const status = buyer.isActive ? 'active' : 'inactive';
      
      return {
        id: buyer._id,
        name: `${buyer.firstName} ${buyer.lastName}`,
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        email: buyer.email,
        company: buyer.companyName,
        companyName: buyer.companyName,
        phone: buyer.phone,
        country: buyer.country,
        city: buyer.city,
        shippingAddress: buyer.shippingAddress,
        orders: orderCount,
        totalSpent: totalSpent,
        status: status,
        isActive: buyer.isActive,
        joined: buyer.createdAt,
        createdAt: buyer.createdAt,
        lastLogin: buyer.lastLogin,
        avatar: buyer.avatar,
      };
    }));

    res.render('admin/users', {
      title: 'Users Management | PARTSFORM',
      activePage: 'users',
      currentModule,
      moduleConfig,
      users: usersWithStats
    });
  } catch (error) {
    console.error('Error in getUsersManagement:', error);
    res.status(500).render('error', { title: 'Error', error: 'Failed to load users' });
  }
};

/**
 * Get User Details page - uses real database
 */
const getUserDetails = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    const userId = req.params.id;
    
    // Find buyer in database
    const buyer = await Buyer.findById(userId).lean();
    
    if (!buyer) {
      return res.status(404).render('error', { title: 'Error', error: 'User not found' });
    }

    // Get orders for this buyer
    const orders = await Order.find({ buyer: userId }).sort({ createdAt: -1 }).lean();
    const orderCount = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    
    // Map isActive to status for view compatibility
    const status = buyer.isActive ? 'active' : 'inactive';
    
    // Build user object for view
    const user = {
      id: buyer._id,
      name: `${buyer.firstName} ${buyer.lastName}`,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      email: buyer.email,
      company: buyer.companyName,
      companyName: buyer.companyName,
      phone: buyer.phone,
      country: buyer.country,
      city: buyer.city,
      shippingAddress: buyer.shippingAddress,
      addresses: buyer.addresses || [],
      orders: orderCount,
      totalSpent: totalSpent,
      status: status,
      isActive: buyer.isActive,
      joined: buyer.createdAt,
      createdAt: buyer.createdAt,
      updatedAt: buyer.updatedAt,
      lastLogin: buyer.lastLogin,
      avatar: buyer.avatar,
      newsletter: buyer.newsletter,
      preferredCurrency: buyer.preferredCurrency,
      // Include recent orders for display
      recentOrders: orders.slice(0, 5).map(order => ({
        id: order.orderNumber || order._id,
        date: order.createdAt,
        items: order.items ? order.items.length : 0,
        amount: order.totalAmount || 0,
        status: order.status || 'pending'
      }))
    };

    res.render('admin/user-details', {
      title: `${user.name} | PARTSFORM Admin`,
      activePage: 'users',
      currentModule,
      moduleConfig,
      user,
      orders: orders
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
 * Get User Edit page - uses real database
 */
const getUserEdit = async (req, res) => {
  try {
    const { currentModule, moduleConfig } = getModuleData(req);
    const userId = req.params.id;
    
    // Find buyer in database
    const buyer = await Buyer.findById(userId).lean();
    
    if (!buyer) {
      return res.status(404).render('error', { title: 'Error', error: 'User not found' });
    }

    // Map isActive to status for view compatibility
    const status = buyer.isActive ? 'active' : 'inactive';

    const user = {
      id: buyer._id,
      name: `${buyer.firstName} ${buyer.lastName}`,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      email: buyer.email,
      company: buyer.companyName,
      companyName: buyer.companyName,
      phone: buyer.phone,
      country: buyer.country,
      city: buyer.city,
      shippingAddress: buyer.shippingAddress,
      status: status,
      isActive: buyer.isActive,
      joined: buyer.createdAt,
      newsletter: buyer.newsletter,
      preferredCurrency: buyer.preferredCurrency,
    };

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
 * Update user status - uses real database
 */
const updateUserStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;
    
    // Find and update buyer in database
    const buyer = await Buyer.findById(userId);
    
    if (!buyer) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Update isActive based on status
    buyer.isActive = (status === 'active');
    
    await buyer.save();
    
    res.json({ success: true, message: `User status updated to ${status}` });
  } catch (error) {
    console.error('Error in updateUserStatus:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
};

/**
 * Bulk update users - uses real database
 */
const bulkUpdateUsers = async (req, res) => {
  try {
    const { userIds, status } = req.body;
    
    // Map status to isActive
    const isActive = (status === 'active');
    
    // Update all users in database
    await Buyer.updateMany(
      { _id: { $in: userIds } },
      { isActive: isActive }
    );
    
    res.json({ success: true, message: `${userIds.length} users updated to ${status}` });
  } catch (error) {
    console.error('Error in bulkUpdateUsers:', error);
    res.status(500).json({ success: false, error: 'Failed to update users' });
  }
};

/**
 * Delete user - uses real database
 */
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Find and delete buyer from database
    const buyer = await Buyer.findByIdAndDelete(userId);
    
    if (!buyer) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Optionally: Delete related orders (or keep them for records)
    // await Order.deleteMany({ buyer: userId });
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
};

/**
 * Create user from admin panel - uses real database
 */
const createUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      country,
      city,
      shippingAddress,
      status,
      industry,
      position
    } = req.body;

    // Check if email already exists
    const existingBuyer = await Buyer.findOne({ email: email.toLowerCase() });
    if (existingBuyer) {
      return res.status(409).json({
        success: false,
        error: 'A user with this email already exists'
      });
    }

    // Generate a temporary password (user will need to reset)
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

    // Create new buyer
    const buyer = new Buyer({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : '',
      companyName: companyName ? companyName.trim() : 'N/A',
      country: country ? country.trim() : 'US',
      city: city ? city.trim() : 'N/A',
      shippingAddress: shippingAddress ? shippingAddress.trim() : 'N/A',
      password: tempPassword,
      isActive: status === 'active',
      termsAcceptedAt: new Date(),
    });

    await buyer.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: buyer._id,
        email: buyer.email,
        name: `${buyer.firstName} ${buyer.lastName}`
      }
    });
  } catch (error) {
    console.error('Error in createUser:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
};

/**
 * Update user from admin panel - uses real database
 */
const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      country,
      city,
      shippingAddress,
      status,
      industry,
      position
    } = req.body;

    const buyer = await Buyer.findById(userId);
    
    if (!buyer) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Update fields if provided
    if (firstName) buyer.firstName = firstName.trim();
    if (lastName) buyer.lastName = lastName.trim();
    if (email && email !== buyer.email) {
      // Check if new email exists
      const existingBuyer = await Buyer.findOne({ email: email.toLowerCase(), _id: { $ne: userId } });
      if (existingBuyer) {
        return res.status(409).json({ success: false, error: 'Email already in use' });
      }
      buyer.email = email.toLowerCase().trim();
    }
    if (phone) buyer.phone = phone.trim();
    if (companyName) buyer.companyName = companyName.trim();
    if (country) buyer.country = country.trim();
    if (city) buyer.city = city.trim();
    if (shippingAddress) buyer.shippingAddress = shippingAddress.trim();
    
    // Update status - simple active/inactive
    if (status) {
      buyer.isActive = (status === 'active');
    }

    await buyer.save();

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: buyer._id,
        email: buyer.email,
        name: `${buyer.firstName} ${buyer.lastName}`
      }
    });
  } catch (error) {
    console.error('Error in updateUser:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
};

/**
 * Activate user account
 */
const approveUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const buyer = await Buyer.findById(userId);
    
    if (!buyer) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    buyer.isActive = true;
    
    await buyer.save();
    
    res.json({
      success: true,
      message: 'User account activated successfully'
    });
  } catch (error) {
    console.error('Error in approveUser:', error);
    res.status(500).json({ success: false, error: 'Failed to activate user' });
  }
};

/**
 * Deactivate user account
 */
const rejectUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const buyer = await Buyer.findById(userId);
    
    if (!buyer) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    buyer.isActive = false;
    
    await buyer.save();
    
    res.json({
      success: true,
      message: 'User account deactivated'
    });
  } catch (error) {
    console.error('Error in rejectUser:', error);
    res.status(500).json({ success: false, error: 'Failed to deactivate user' });
  }
};

/**
 * Suspend user account (same as deactivate)
 */
const suspendUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const buyer = await Buyer.findById(userId);
    
    if (!buyer) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    buyer.isActive = false;
    
    await buyer.save();
    
    res.json({
      success: true,
      message: 'User account suspended'
    });
  } catch (error) {
    console.error('Error in suspendUser:', error);
    res.status(500).json({ success: false, error: 'Failed to suspend user' });
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
 * Upload parts from Excel/CSV file
 * POST /admin/api/orders/upload-parts
 */
const uploadPartsFromFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname.toLowerCase();
    
    let parts = [];
    
    // Check file type and parse accordingly
    if (fileName.endsWith('.csv')) {
      // Parse CSV file
      const csvParserService = require('../services/csvParserService');
      const parser = new csvParserService();
      parts = await parser.parseCSV(fileBuffer, {});
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // For Excel files, use exceljs library
      try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet || worksheet.rowCount < 2) {
          return res.status(400).json({ success: false, error: 'Excel file is empty or has no data rows' });
        }
        
        // Get headers from first row
        const headerRow = worksheet.getRow(1);
        const headers = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          headers[colNumber] = String(cell.value || '').toLowerCase().trim();
        });
        
        // Find column indices
        const partNumberIdx = headers.findIndex(h => 
          h && (h.includes('part') || h.includes('number') || h.includes('sku') || h.includes('code'))
        );
        const quantityIdx = headers.findIndex(h => 
          h && (h.includes('qty') || h.includes('quantity'))
        );
        
        // Parse data rows
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
          const row = worksheet.getRow(rowNumber);
          const partNumber = row.getCell(partNumberIdx !== -1 ? partNumberIdx : 1).value;
          const quantity = row.getCell(quantityIdx !== -1 ? quantityIdx : 2).value;
          
          if (partNumber) {
            // Search for part in database to get full details
            const Part = require('../models/Part');
            const existingPart = await Part.findOne({ 
              partNumber: { $regex: new RegExp('^' + String(partNumber).toString().trim() + '$', 'i') }
            });
            
            if (existingPart) {
              parts.push({
                partNumber: existingPart.partNumber,
                description: existingPart.description || existingPart.partNumber,
                brand: existingPart.brand || 'N/A',
                supplier: existingPart.supplier || 'N/A',
                price: parseFloat(existingPart.price) || 0,
                currency: existingPart.currency || 'AED',
                weight: parseFloat(existingPart.weight) || 0,
                quantity: parseInt(quantity) || 1,
                stock: existingPart.quantity || existingPart.stock || 'N/A'
              });
            } else {
              // Add as unknown part
              parts.push({
                partNumber: String(partNumber).toString().trim(),
                description: String(partNumber).toString().trim(),
                brand: 'Unknown',
                supplier: 'Unknown',
                price: 0,
                currency: 'AED',
                weight: 0,
                quantity: parseInt(quantity) || 1,
                stock: 'N/A'
              });
            }
          }
        }
      } catch (xlsxError) {
        console.error('Excel parsing error:', xlsxError);
        return res.status(400).json({ 
          success: false, 
          error: 'Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.'
        });
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Unsupported file format. Please upload a .csv, .xlsx, or .xls file.'
      });
    }
    
    res.json({
      success: true,
      parts: parts,
      count: parts.length
    });
  } catch (error) {
    console.error('Error uploading parts file:', error);
    res.status(500).json({ success: false, error: 'Failed to process file' });
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
  createOrder,
  updateOrder,
  updateOrderStatus,
  getOrderStats,
  getTicketsManagement,
  getTicketDetails,
  postTicketReply,
  updateTicketStatus,
  getTicketsApi,
  markTicketAsReadAdmin,
  getUsersManagement,
  getUserDetails,
  getUserCreate,
  getUserEdit,
  updateUserStatus,
  bulkUpdateUsers,
  deleteUser,
  createUser,
  updateUser,
  approveUser,
  rejectUser,
  suspendUser,
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
  // File upload
  uploadPartsFromFile,
};

