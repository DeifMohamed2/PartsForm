/**
 * Admin Supplier Controller
 * Handles all admin operations for managing suppliers and their data
 * NOTE: Suppliers are created ONLY by admins - no self-registration
 */

const Supplier = require('../models/Supplier');
const DataTable = require('../models/DataTable');
const DataRecord = require('../models/DataRecord');
const AuditLog = require('../models/AuditLog');
const DataExport = require('../models/DataExport');
const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Generate a secure random password
 */
const generateSecurePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  let password = '';
  const randomBytes = crypto.randomBytes(16);
  for (let i = 0; i < 12; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
};

/**
 * Generate unique company code
 */
const generateCompanyCode = (companyName) => {
  const prefix = companyName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${random}`;
};

/**
 * Helper to get sidebar counts for admin layout
 */
const getSidebarCounts = async () => {
  try {
    const [pendingSuppliers, activeSuppliers] = await Promise.all([
      Supplier.countDocuments({ status: 'pending' }),
      Supplier.countDocuments({ status: 'active' })
    ]);
    return { pendingSuppliers, activeSuppliers };
  } catch (error) {
    console.error('Error getting supplier sidebar counts:', error);
    return { pendingSuppliers: 0, activeSuppliers: 0 };
  }
};

/**
 * Suppliers Management Page
 * GET /admin/suppliers
 */
const getSuppliersManagement = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build filter query
    const filter = {};
    
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { companyName: searchRegex },
        { email: searchRegex },
        { contactPerson: searchRegex }
      ];
    }
    
    const [suppliers, totalCount, statusCounts] = await Promise.all([
      Supplier.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Supplier.countDocuments(filter),
      Supplier.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);
    
    // Get table counts for each supplier
    const supplierIds = suppliers.map(s => s._id);
    const tableCounts = await DataTable.aggregate([
      { $match: { supplier: { $in: supplierIds } } },
      { $group: { _id: '$supplier', count: { $sum: 1 } } }
    ]);
    
    const tableCountMap = tableCounts.reduce((acc, tc) => {
      acc[tc._id.toString()] = tc.count;
      return acc;
    }, {});
    
    // Add table counts to suppliers
    const suppliersWithCounts = suppliers.map(s => ({
      ...s,
      tableCount: tableCountMap[s._id.toString()] || 0
    }));
    
    // Format status counts
    const stats = {
      total: await Supplier.countDocuments(),
      active: 0,
      pending: 0,
      suspended: 0,
      rejected: 0
    };
    
    statusCounts.forEach(sc => {
      if (stats.hasOwnProperty(sc._id)) {
        stats[sc._id] = sc.count;
      }
    });
    
    const totalPages = Math.ceil(totalCount / limit);
    
    res.render('admin/suppliers', {
      activePage: 'suppliers',
      title: 'Suppliers Management',
      suppliers: suppliersWithCounts,
      stats,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        status: req.query.status || 'all',
        search: req.query.search || ''
      },
      currentAdmin: req.user,
      userPermissions: req.adminPermissions
    });
  } catch (error) {
    console.error('Error loading suppliers management:', error);
    res.status(500).render('error', {
      message: 'Failed to load suppliers',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

/**
 * Supplier Details Page
 * GET /admin/suppliers/:id
 */
const getSupplierDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).render('error', { message: 'Supplier not found' });
    }
    
    const supplier = await Supplier.findById(id).lean();
    
    if (!supplier) {
      return res.status(404).render('error', { message: 'Supplier not found' });
    }
    
    // Get supplier data tables with record counts
    const tables = await DataTable.aggregate([
      { $match: { supplier: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'datarecords',
          localField: '_id',
          foreignField: 'table',
          as: 'records'
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          columns: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          recordCount: { $size: '$records' }
        }
      },
      { $sort: { updatedAt: -1 } }
    ]);
    
    // Get recent exports
    const exports = await DataExport.find({ supplier: id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Get recent audit logs
    const auditLogs = await AuditLog.find({ supplier: id })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();
    
    // Get team members count
    const teamCount = supplier.team ? supplier.team.length : 0;
    
    // Calculate storage usage (approximate)
    const recordCount = await DataRecord.countDocuments({ 
      table: { $in: tables.map(t => t._id) } 
    });
    
    res.render('admin/supplier-details', {
      activePage: 'suppliers',
      title: `Supplier: ${supplier.companyName}`,
      supplier,
      tables,
      exports,
      auditLogs,
      teamCount,
      recordCount,
      currentAdmin: req.user,
      userPermissions: req.adminPermissions
    });
  } catch (error) {
    console.error('Error loading supplier details:', error);
    res.status(500).render('error', {
      message: 'Failed to load supplier details',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

/**
 * Get Suppliers API
 * GET /admin/api/suppliers
 */
const getSuppliersApi = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = {};
    
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { companyName: searchRegex },
        { email: searchRegex },
        { contactPerson: searchRegex }
      ];
    }
    
    const [suppliers, totalCount] = await Promise.all([
      Supplier.find(filter)
        .select('-password -apiKeys.key')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Supplier.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      data: suppliers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers API:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch suppliers' });
  }
};

/**
 * Get Supplier Stats API
 * GET /admin/api/suppliers/stats
 */
const getSupplierStats = async (req, res) => {
  try {
    const [statusCounts, recentActivity, topSuppliers] = await Promise.all([
      // Status breakdown
      Supplier.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      // Recent registrations (last 30 days)
      Supplier.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),
      // Top suppliers by data volume
      DataTable.aggregate([
        {
          $lookup: {
            from: 'datarecords',
            localField: '_id',
            foreignField: 'table',
            as: 'records'
          }
        },
        {
          $group: {
            _id: '$supplier',
            tableCount: { $sum: 1 },
            recordCount: { $sum: { $size: '$records' } }
          }
        },
        { $sort: { recordCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'suppliers',
            localField: '_id',
            foreignField: '_id',
            as: 'supplierInfo'
          }
        },
        { $unwind: '$supplierInfo' },
        {
          $project: {
            companyName: '$supplierInfo.companyName',
            tableCount: 1,
            recordCount: 1
          }
        }
      ])
    ]);
    
    const stats = {
      total: 0,
      active: 0,
      pending: 0,
      suspended: 0,
      rejected: 0,
      recentRegistrations: recentActivity,
      topSuppliers
    };
    
    statusCounts.forEach(sc => {
      stats.total += sc.count;
      if (stats.hasOwnProperty(sc._id)) {
        stats[sc._id] = sc.count;
      }
    });
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching supplier stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
};

/**
 * Approve Supplier
 * PUT /admin/api/suppliers/:id/approve
 */
const approveSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    
    if (supplier.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot approve supplier with status: ${supplier.status}` 
      });
    }
    
    supplier.status = 'active';
    supplier.approvedAt = new Date();
    supplier.approvedBy = req.user._id;
    await supplier.save();
    
    // Log the action
    await AuditLog.create({
      supplier: supplier._id,
      user: null,
      action: 'supplier_approved',
      resource: 'supplier',
      resourceId: supplier._id,
      details: {
        approvedBy: req.user.email,
        adminId: req.user._id
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ 
      success: true, 
      message: 'Supplier approved successfully',
      data: { status: supplier.status }
    });
  } catch (error) {
    console.error('Error approving supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to approve supplier' });
  }
};

/**
 * Reject Supplier
 * PUT /admin/api/suppliers/:id/reject
 */
const rejectSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    
    if (supplier.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot reject supplier with status: ${supplier.status}` 
      });
    }
    
    supplier.status = 'rejected';
    supplier.rejectionReason = reason || 'No reason provided';
    supplier.rejectedAt = new Date();
    supplier.rejectedBy = req.user._id;
    await supplier.save();
    
    // Log the action
    await AuditLog.create({
      supplier: supplier._id,
      user: null,
      action: 'supplier_rejected',
      resource: 'supplier',
      resourceId: supplier._id,
      details: {
        rejectedBy: req.user.email,
        adminId: req.user._id,
        reason: supplier.rejectionReason
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ 
      success: true, 
      message: 'Supplier rejected',
      data: { status: supplier.status }
    });
  } catch (error) {
    console.error('Error rejecting supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to reject supplier' });
  }
};

/**
 * Suspend Supplier
 * PUT /admin/api/suppliers/:id/suspend
 */
const suspendSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    
    if (supplier.status === 'suspended') {
      return res.status(400).json({ success: false, error: 'Supplier is already suspended' });
    }
    
    supplier.status = 'suspended';
    supplier.suspensionReason = reason || 'No reason provided';
    supplier.suspendedAt = new Date();
    supplier.suspendedBy = req.user._id;
    await supplier.save();
    
    // Log the action
    await AuditLog.create({
      supplier: supplier._id,
      user: null,
      action: 'supplier_suspended',
      resource: 'supplier',
      resourceId: supplier._id,
      details: {
        suspendedBy: req.user.email,
        adminId: req.user._id,
        reason: supplier.suspensionReason
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ 
      success: true, 
      message: 'Supplier suspended',
      data: { status: supplier.status }
    });
  } catch (error) {
    console.error('Error suspending supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to suspend supplier' });
  }
};

/**
 * Reactivate Supplier
 * PUT /admin/api/suppliers/:id/reactivate
 */
const reactivateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    
    if (supplier.status === 'active') {
      return res.status(400).json({ success: false, error: 'Supplier is already active' });
    }
    
    supplier.status = 'active';
    supplier.reactivatedAt = new Date();
    supplier.reactivatedBy = req.user._id;
    await supplier.save();
    
    // Log the action
    await AuditLog.create({
      supplier: supplier._id,
      user: null,
      action: 'supplier_reactivated',
      resource: 'supplier',
      resourceId: supplier._id,
      details: {
        reactivatedBy: req.user.email,
        adminId: req.user._id,
        previousStatus: supplier.status
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ 
      success: true, 
      message: 'Supplier reactivated',
      data: { status: supplier.status }
    });
  } catch (error) {
    console.error('Error reactivating supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to reactivate supplier' });
  }
};

/**
 * Delete Supplier
 * DELETE /admin/api/suppliers/:id
 */
const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    
    if (permanent === 'true') {
      // Permanent deletion - remove all data
      const tables = await DataTable.find({ supplier: id });
      const tableIds = tables.map(t => t._id);
      
      await Promise.all([
        DataRecord.deleteMany({ table: { $in: tableIds } }),
        DataTable.deleteMany({ supplier: id }),
        DataExport.deleteMany({ supplier: id }),
        AuditLog.deleteMany({ supplier: id }),
        Supplier.findByIdAndDelete(id)
      ]);
      
      res.json({ 
        success: true, 
        message: 'Supplier and all associated data permanently deleted' 
      });
    } else {
      // Soft delete - just mark as deleted
      supplier.status = 'deleted';
      supplier.deletedAt = new Date();
      supplier.deletedBy = req.user._id;
      await supplier.save();
      
      // Log the action
      await AuditLog.create({
        supplier: supplier._id,
        user: null,
        action: 'supplier_deleted',
        resource: 'supplier',
        resourceId: supplier._id,
        details: {
          deletedBy: req.user.email,
          adminId: req.user._id,
          permanent: false
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.json({ 
        success: true, 
        message: 'Supplier deleted (can be restored)' 
      });
    }
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to delete supplier' });
  }
};

/**
 * Get Supplier Data Tables
 * GET /admin/api/suppliers/:id/tables
 */
const getSupplierTables = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tables = await DataTable.aggregate([
      { $match: { supplier: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'datarecords',
          localField: '_id',
          foreignField: 'table',
          as: 'records'
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          columns: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          recordCount: { $size: '$records' }
        }
      },
      { $sort: { updatedAt: -1 } }
    ]);
    
    res.json({ success: true, data: tables });
  } catch (error) {
    console.error('Error fetching supplier tables:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tables' });
  }
};

/**
 * Get Supplier Exports
 * GET /admin/api/suppliers/:id/exports
 */
const getSupplierExports = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const [exports, totalCount] = await Promise.all([
      DataExport.find({ supplier: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DataExport.countDocuments({ supplier: id })
    ]);
    
    res.json({
      success: true,
      data: exports,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching supplier exports:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch exports' });
  }
};

/**
 * Get Supplier Audit Logs
 * GET /admin/api/suppliers/:id/audit-logs
 */
const getSupplierAuditLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const filter = { supplier: id };
    
    if (req.query.action) {
      filter.action = req.query.action;
    }
    
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) {
        filter.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.timestamp.$lte = new Date(req.query.endDate);
      }
    }
    
    const [logs, totalCount] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
};

/**
 * Bulk Update Suppliers Status
 * PUT /admin/api/suppliers/bulk-status
 */
const bulkUpdateStatus = async (req, res) => {
  try {
    const { supplierIds, status, reason } = req.body;
    
    if (!supplierIds || !Array.isArray(supplierIds) || supplierIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No suppliers selected' });
    }
    
    if (!['active', 'suspended', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    
    const updateData = { status };
    if (status === 'suspended') {
      updateData.suspensionReason = reason || 'Bulk suspension';
      updateData.suspendedAt = new Date();
      updateData.suspendedBy = req.user._id;
    } else if (status === 'rejected') {
      updateData.rejectionReason = reason || 'Bulk rejection';
      updateData.rejectedAt = new Date();
      updateData.rejectedBy = req.user._id;
    } else if (status === 'active') {
      updateData.reactivatedAt = new Date();
      updateData.reactivatedBy = req.user._id;
    }
    
    const result = await Supplier.updateMany(
      { _id: { $in: supplierIds } },
      { $set: updateData }
    );
    
    // Log bulk action
    await AuditLog.create({
      supplier: null,
      user: null,
      action: 'bulk_status_update',
      resource: 'supplier',
      resourceId: null,
      details: {
        updatedBy: req.user.email,
        adminId: req.user._id,
        supplierCount: supplierIds.length,
        newStatus: status,
        reason
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: `${result.modifiedCount} suppliers updated to ${status}`,
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Error bulk updating suppliers:', error);
    res.status(500).json({ success: false, error: 'Failed to update suppliers' });
  }
};

/**
 * Get Pending Suppliers Count (for sidebar badge)
 * GET /admin/api/suppliers/pending-count
 */
const getPendingCount = async (req, res) => {
  try {
    const count = await Supplier.countDocuments({ status: 'pending' });
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Error fetching pending count:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch count' });
  }
};

/**
 * Export Suppliers List
 * GET /admin/api/suppliers/export
 */
const exportSuppliers = async (req, res) => {
  try {
    const filter = {};
    
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    
    const suppliers = await Supplier.find(filter)
      .select('companyName email contactPerson phone status createdAt lastLogin')
      .sort({ createdAt: -1 })
      .lean();
    
    // Convert to CSV
    const headers = ['Company Name', 'Email', 'Contact Person', 'Phone', 'Status', 'Registered', 'Last Login'];
    const csvRows = [headers.join(',')];
    
    suppliers.forEach(s => {
      const row = [
        `"${s.companyName || ''}"`,
        `"${s.email || ''}"`,
        `"${s.contactPerson || ''}"`,
        `"${s.phone || ''}"`,
        s.status,
        s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '',
        s.lastLogin ? new Date(s.lastLogin).toISOString().split('T')[0] : 'Never'
      ];
      csvRows.push(row.join(','));
    });
    
    const csv = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="suppliers-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting suppliers:', error);
    res.status(500).json({ success: false, error: 'Failed to export suppliers' });
  }
};

/**
 * Update Supplier Limits/Quota
 * PUT /admin/api/suppliers/:id/limits
 */
const updateSupplierLimits = async (req, res) => {
  try {
    const { id } = req.params;
    const { maxTables, maxRecordsPerTable, maxExportsPerMonth, maxApiCallsPerDay } = req.body;
    
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    
    // Update limits
    if (!supplier.limits) supplier.limits = {};
    if (maxTables !== undefined) supplier.limits.maxTables = maxTables;
    if (maxRecordsPerTable !== undefined) supplier.limits.maxRecordsPerTable = maxRecordsPerTable;
    if (maxExportsPerMonth !== undefined) supplier.limits.maxExportsPerMonth = maxExportsPerMonth;
    if (maxApiCallsPerDay !== undefined) supplier.limits.maxApiCallsPerDay = maxApiCallsPerDay;
    
    await supplier.save();
    
    // Log the action
    await AuditLog.create({
      supplier: supplier._id,
      user: null,
      action: 'limits_updated',
      resource: 'supplier',
      resourceId: supplier._id,
      details: {
        updatedBy: req.user.email,
        adminId: req.user._id,
        newLimits: supplier.limits
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: 'Supplier limits updated',
      data: { limits: supplier.limits }
    });
  } catch (error) {
    console.error('Error updating supplier limits:', error);
    res.status(500).json({ success: false, error: 'Failed to update limits' });
  }
};

/**
 * Create Supplier Account (Admin Only)
 * POST /admin/api/suppliers
 */
const createSupplier = async (req, res) => {
  try {
    const {
      companyName,
      companyCode,
      contactName,
      email,
      phone,
      country,
      quotas,
      ftpEnabled,
      ftpDirectory,
      sendCredentials
    } = req.body;

    // Validate required fields
    if (!companyName || !contactName || !email) {
      return res.status(400).json({
        success: false,
        error: 'Company name, contact name, and email are required'
      });
    }

    // Check for existing supplier
    const existingSupplier = await Supplier.findOne({
      $or: [
        { email: email.toLowerCase() },
        { companyCode: companyCode ? companyCode.toUpperCase() : null }
      ].filter(c => c.companyCode !== null)
    });

    if (existingSupplier) {
      return res.status(409).json({
        success: false,
        error: existingSupplier.email === email.toLowerCase()
          ? 'Email is already in use'
          : 'Company code is already in use'
      });
    }

    // Generate temporary password
    const tempPassword = generateSecurePassword();
    
    // Generate company code if not provided
    const finalCompanyCode = companyCode || generateCompanyCode(companyName);
    
    // Generate FTP credentials if enabled
    let ftpCredentials = null;
    if (ftpEnabled) {
      ftpCredentials = {
        username: `supplier_${finalCompanyCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        password: generateSecurePassword(),
        directory: ftpDirectory || `/suppliers/${finalCompanyCode}`
      };
    }

    // Create supplier
    const supplier = new Supplier({
      companyName,
      companyCode: finalCompanyCode.toUpperCase(),
      contactName,
      email: email.toLowerCase(),
      phone,
      password: tempPassword, // Will be hashed by pre-save hook
      address: country ? { country } : undefined,
      isActive: true,
      isApproved: true, // Admin-created accounts are pre-approved
      isEmailVerified: true, // No email verification needed
      approvedBy: req.user._id,
      approvedAt: new Date(),
      mustChangePassword: true, // Force password change on first login
      quotas: quotas || {
        maxTables: 10,
        maxRecordsPerTable: 100000,
        maxStorageBytes: 1073741824
      },
      ftpAccess: ftpEnabled ? {
        enabled: true,
        username: ftpCredentials.username,
        password: ftpCredentials.password, // Will be hashed
        directory: ftpCredentials.directory,
        createdAt: new Date()
      } : { enabled: false }
    });

    await supplier.save();

    // Log the action
    await AuditLog.create({
      supplier: supplier._id,
      user: null,
      action: 'supplier_created',
      resource: 'supplier',
      resourceId: supplier._id,
      details: {
        createdBy: req.user.email,
        adminId: req.user._id,
        companyName,
        email: email.toLowerCase(),
        ftpEnabled: !!ftpEnabled
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Prepare credentials to return (and optionally send via email)
    const credentials = {
      email: supplier.email,
      tempPassword,
      companyCode: supplier.companyCode,
      loginUrl: `${process.env.BASE_URL || ''}/supplier/login`,
      ftp: ftpEnabled ? {
        host: process.env.FTP_SERVER_HOST || 'ftp.yourserver.com',
        port: parseInt(process.env.FTP_SERVER_PORT) || 21,
        username: ftpCredentials.username,
        password: ftpCredentials.password,
        directory: ftpCredentials.directory
      } : null
    };

    // TODO: Send welcome email with credentials if sendCredentials is true
    // if (sendCredentials) {
    //   await emailService.sendSupplierWelcomeEmail(supplier, credentials);
    // }

    res.status(201).json({
      success: true,
      message: 'Supplier account created successfully',
      data: {
        supplier: {
          id: supplier._id,
          companyName: supplier.companyName,
          companyCode: supplier.companyCode,
          email: supplier.email,
          contactName: supplier.contactName
        },
        credentials: sendCredentials === false ? undefined : credentials
      }
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to create supplier' });
  }
};

/**
 * Get Supplier Create Page
 * GET /admin/suppliers/create
 */
const getSupplierCreate = async (req, res) => {
  try {
    res.render('admin/supplier-create', {
      activePage: 'suppliers',
      title: 'Create Supplier',
      currentAdmin: req.user,
      userPermissions: req.adminPermissions,
      ftpServerConfig: {
        host: process.env.FTP_SERVER_HOST || 'ftp.yourserver.com',
        port: parseInt(process.env.FTP_SERVER_PORT) || 21
      }
    });
  } catch (error) {
    console.error('Error loading supplier create page:', error);
    res.status(500).render('error', {
      message: 'Failed to load page',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

/**
 * Update Supplier FTP Access
 * PUT /admin/api/suppliers/:id/ftp
 */
const updateSupplierFtp = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, enabled, directory, regeneratePassword } = req.body;
    
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    if (!supplier.ftpAccess) {
      supplier.ftpAccess = {};
    }

    // Handle action-based requests from FTP settings page
    if (action === 'enable' || action === 'regenerate') {
      const ftpUsername = `supplier_${supplier.companyCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const ftpPassword = generateSecurePassword();
      
      supplier.ftpAccess.enabled = true;
      supplier.ftpAccess.username = ftpUsername;
      supplier.ftpAccess.password = ftpPassword; // Will be hashed by pre-save hook
      supplier.ftpAccess.directory = supplier.ftpAccess.directory || `/suppliers/${supplier.companyCode}`;
      if (action === 'enable') {
        supplier.ftpAccess.createdAt = new Date();
      }

      // Save with unmodified tracking to capture password change
      supplier.markModified('ftpAccess.password');
      await supplier.save();

      // Log the action
      await AuditLog.create({
        supplier: supplier._id,
        user: null,
        action: action === 'enable' ? 'ftp_enabled' : 'ftp_password_regenerated',
        resource: 'supplier',
        resourceId: supplier._id,
        details: {
          updatedBy: req.user.email,
          adminId: req.user._id,
          ftpUsername
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: action === 'enable' ? 'FTP access enabled' : 'FTP credentials regenerated',
        data: {
          ftpEnabled: true,
          ftpCredentials: {
            host: process.env.FTP_SERVER_HOST || 'ftp.yourserver.com',
            port: parseInt(process.env.FTP_SERVER_PORT) || 21,
            username: ftpUsername,
            password: ftpPassword, // Plain text - only shown once
            directory: supplier.ftpAccess.directory
          }
        }
      });
    }

    if (action === 'disable') {
      supplier.ftpAccess.enabled = false;
      await supplier.save();

      await AuditLog.create({
        supplier: supplier._id,
        user: null,
        action: 'ftp_disabled',
        resource: 'supplier',
        resourceId: supplier._id,
        details: {
          updatedBy: req.user.email,
          adminId: req.user._id
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: 'FTP access disabled',
        data: { ftpEnabled: false }
      });
    }

    // Handle traditional enabled/directory/regeneratePassword params
    if (enabled !== undefined) {
      supplier.ftpAccess.enabled = enabled;
    }

    if (directory) {
      supplier.ftpAccess.directory = directory;
    }

    // Generate new credentials if enabling for first time or regenerating
    if (enabled && (!supplier.ftpAccess.username || regeneratePassword)) {
      const ftpUsername = `supplier_${supplier.companyCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const ftpPassword = generateSecurePassword();
      
      supplier.ftpAccess.username = ftpUsername;
      supplier.ftpAccess.password = ftpPassword;
      supplier.ftpAccess.directory = directory || `/suppliers/${supplier.companyCode}`;
      supplier.ftpAccess.createdAt = new Date();

      supplier.markModified('ftpAccess.password');
      await supplier.save();

      // Log the action
      await AuditLog.create({
        supplier: supplier._id,
        user: null,
        action: 'ftp_credentials_generated',
        resource: 'supplier',
        resourceId: supplier._id,
        details: {
          updatedBy: req.user.email,
          adminId: req.user._id,
          ftpUsername
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: 'FTP credentials generated',
        data: {
          ftpEnabled: true,
          credentials: {
            host: process.env.FTP_SERVER_HOST || 'ftp.yourserver.com',
            port: parseInt(process.env.FTP_SERVER_PORT) || 21,
            username: ftpUsername,
            password: ftpPassword,
            directory: supplier.ftpAccess.directory
          }
        }
      });
    }

    await supplier.save();

    res.json({
      success: true,
      message: 'FTP settings updated',
      data: {
        ftpEnabled: supplier.ftpAccess.enabled,
        ftpDirectory: supplier.ftpAccess.directory,
        ftpUsername: supplier.ftpAccess.username
      }
    });
  } catch (error) {
    console.error('Error updating supplier FTP:', error);
    res.status(500).json({ success: false, error: 'Failed to update FTP settings' });
  }
};

/**
 * Reset Supplier Password
 * POST /admin/api/suppliers/:id/reset-password
 */
const resetSupplierPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { sendEmail } = req.body;
    
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    // Generate new temporary password
    const tempPassword = generateSecurePassword();
    
    supplier.password = tempPassword;
    supplier.mustChangePassword = true;
    supplier.loginAttempts = 0;
    supplier.lockUntil = undefined;
    await supplier.save();

    // Log the action
    await AuditLog.create({
      supplier: supplier._id,
      user: null,
      action: 'password_reset',
      resource: 'supplier',
      resourceId: supplier._id,
      details: {
        resetBy: req.user.email,
        adminId: req.user._id
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // TODO: Send password reset email if requested
    // if (sendEmail) {
    //   await emailService.sendSupplierPasswordReset(supplier, tempPassword);
    // }

    res.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        email: supplier.email,
        tempPassword: sendEmail ? undefined : tempPassword
      }
    });
  } catch (error) {
    console.error('Error resetting supplier password:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
};

/**
 * Get FTP Server System Settings Page
 * GET /admin/suppliers/ftp-settings
 */
const getFtpSettings = async (req, res) => {
  try {
    // Get all suppliers with FTP enabled
    const ftpSuppliers = await Supplier.find({ 'ftpAccess.enabled': true })
      .select('companyName companyCode ftpAccess.username ftpAccess.directory ftpAccess.createdAt lastLogin')
      .sort({ 'ftpAccess.createdAt': -1 })
      .lean();

    res.render('admin/supplier-ftp-settings', {
      activePage: 'suppliers',
      title: 'FTP Server Settings',
      currentAdmin: req.user,
      userPermissions: req.adminPermissions,
      ftpSuppliers,
      ftpServerConfig: {
        host: process.env.FTP_SERVER_HOST || 'ftp.yourserver.com',
        port: parseInt(process.env.FTP_SERVER_PORT) || 21,
        passiveMode: process.env.FTP_SERVER_PASSIVE === 'true',
        baseDirectory: process.env.FTP_BASE_DIRECTORY || '/var/ftp/suppliers'
      }
    });
  } catch (error) {
    console.error('Error loading FTP settings page:', error);
    res.status(500).render('error', {
      message: 'Failed to load FTP settings',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

module.exports = {
  // Page routes
  getSuppliersManagement,
  getSupplierDetails,
  getSupplierCreate,
  getFtpSettings,
  
  // API routes
  getSuppliersApi,
  getSupplierStats,
  createSupplier,
  approveSupplier,
  rejectSupplier,
  suspendSupplier,
  reactivateSupplier,
  deleteSupplier,
  getSupplierTables,
  getSupplierExports,
  getSupplierAuditLogs,
  bulkUpdateStatus,
  getPendingCount,
  exportSuppliers,
  updateSupplierLimits,
  updateSupplierFtp,
  resetSupplierPassword
};
