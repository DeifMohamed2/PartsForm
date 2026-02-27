const mongoose = require('mongoose');

/**
 * AuditLog Model
 * Comprehensive audit trail for all data management operations
 * Tracks who did what, when, and from where
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    actor: {
      type: {
        type: String,
        enum: ['supplier', 'admin', 'system', 'api'],
        required: true,
      },
      id: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String },
      email: { type: String },
      role: { type: String },
    },
    
    // What was the action
    action: {
      type: String,
      enum: [
        // Table operations
        'table.create',
        'table.update',
        'table.delete',
        'table.archive',
        'table.restore',
        
        // Record operations
        'record.create',
        'record.update',
        'record.delete',
        'record.restore',
        'record.bulk_create',
        'record.bulk_update',
        'record.bulk_delete',
        
        // Parts operations (supplier uploads)
        'parts.import',
        'parts.update',
        'parts.delete',
        'parts.bulk_update',
        'parts.bulk_delete',
        'parts.export',
        
        // Import/Export operations
        'import.start',
        'import.complete',
        'import.failed',
        'export.start',
        'export.complete',
        'export.failed',
        
        // SFTP operations
        'sftp.upload',
        'sftp.download',
        'sftp.config_update',
        'sftp.scheduled_export',
        
        // Supplier operations
        'supplier.login',
        'supplier.logout',
        'supplier.password_change',
        'supplier.settings_update',
        'supplier.api_key_generate',
        'supplier.team_member_add',
        'supplier.team_member_remove',
        
        // Admin operations
        'admin.supplier_approve',
        'admin.supplier_reject',
        'admin.supplier_suspend',
        'admin.quota_update',
        'admin.supplier_create',
        'admin.supplier_delete',
        'admin.supplier_reactivate',
        'admin.ftp_update',
        'admin.password_reset',
        
        // Legacy admin actions (for backwards compatibility)
        'supplier_created',
        'supplier_approved',
        'supplier_rejected',
        'supplier_suspended',
        'supplier_reactivated',
        'supplier_deleted',
        
        // FTP operations
        'ftp.login',
        'ftp.upload',
        'ftp.delete',
        'ftp.download',
        'ftp.auto_import',
        
        // Version operations
        'version.restore',
        
        // Access operations
        'access.denied',
        'access.rate_limited',
      ],
      required: true,
    },
    
    // Target resource
    resource: {
      type: {
        type: String,
        enum: ['table', 'record', 'supplier', 'export', 'import', 'sftp', 'system', 'parts', 'part'],
      },
      id: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String },
    },
    
    // Associated supplier (for multi-tenant isolation)
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      index: true,
    },
    
    // Associated table (if applicable)
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DataTable',
      index: true,
    },
    
    // Details of the change
    details: {
      // For updates: what changed
      changes: {
        before: { type: mongoose.Schema.Types.Mixed },
        after: { type: mongoose.Schema.Types.Mixed },
        fields: [{ type: String }],
      },
      
      // For bulk operations
      bulkInfo: {
        totalRecords: { type: Number },
        successCount: { type: Number },
        failedCount: { type: Number },
        errors: [{ type: mongoose.Schema.Types.Mixed }],
      },
      
      // For import/export
      fileInfo: {
        filename: { type: String },
        size: { type: Number },
        format: { type: String },
        rows: { type: Number },
        path: { type: String },
      },
      
      // Additional context
      message: { type: String },
      metadata: { type: mongoose.Schema.Types.Mixed },
    },
    
    // Request context
    request: {
      ipAddress: { type: String },
      userAgent: { type: String },
      endpoint: { type: String },
      method: { type: String },
      requestId: { type: String },
    },
    
    // Status of the action
    status: {
      type: String,
      enum: ['success', 'failure', 'partial', 'pending'],
      default: 'success',
    },
    
    // Error details if failed
    error: {
      code: { type: String },
      message: { type: String },
      stack: { type: String },
    },
    
    // Duration of operation (ms)
    duration: { type: Number },
    
    // Session/correlation ID for tracking related operations
    sessionId: { type: String },
    correlationId: { type: String },
    
    // Tags for easy filtering
    tags: [{ type: String }],
    
    // Severity level for alerting
    severity: {
      type: String,
      enum: ['info', 'warning', 'error', 'critical'],
      default: 'info',
    },
  },
  {
    timestamps: true,
    // TTL index - automatically delete old logs after 365 days
    // You can adjust this based on compliance requirements
  }
);

// Indexes for efficient querying
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ 'actor.id': 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ 'resource.type': 1, 'resource.id': 1 });
auditLogSchema.index({ status: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });
auditLogSchema.index({ correlationId: 1 });
// TTL index - auto-delete after 365 days (adjust as needed)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Static: Create log entry
auditLogSchema.statics.log = async function (data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    // Don't let logging errors break the application
    console.error('Audit logging failed:', error.message);
    return null;
  }
};

// Static: Create log for table operation
auditLogSchema.statics.logTableAction = async function ({
  action,
  table,
  supplier,
  actor,
  changes,
  request,
  status = 'success',
}) {
  return this.log({
    actor,
    action,
    resource: {
      type: 'table',
      id: table._id,
      name: table.name,
    },
    supplier: supplier?._id || supplier,
    table: table._id,
    details: { changes },
    request,
    status,
    severity: action.includes('delete') ? 'warning' : 'info',
  });
};

// Static: Create log for record operation
auditLogSchema.statics.logRecordAction = async function ({
  action,
  record,
  table,
  supplier,
  actor,
  changes,
  request,
  status = 'success',
}) {
  return this.log({
    actor,
    action,
    resource: {
      type: 'record',
      id: record?._id,
      name: record?.rowKey,
    },
    supplier: supplier?._id || supplier,
    table: table?._id || table,
    details: { changes },
    request,
    status,
    severity: action.includes('delete') ? 'warning' : 'info',
  });
};

// Static: Create log for bulk operation
auditLogSchema.statics.logBulkAction = async function ({
  action,
  table,
  supplier,
  actor,
  bulkInfo,
  request,
  correlationId,
}) {
  const status = bulkInfo.failedCount === 0 ? 'success' : 
                 bulkInfo.successCount === 0 ? 'failure' : 'partial';
  
  return this.log({
    actor,
    action,
    resource: {
      type: 'table',
      id: table._id,
      name: table.name,
    },
    supplier: supplier?._id || supplier,
    table: table._id,
    details: { bulkInfo },
    request,
    status,
    correlationId,
    severity: status === 'failure' ? 'error' : status === 'partial' ? 'warning' : 'info',
  });
};

// Static: Create log for import/export
auditLogSchema.statics.logDataTransfer = async function ({
  action,
  table,
  supplier,
  actor,
  fileInfo,
  request,
  status = 'success',
  error,
  duration,
  correlationId,
}) {
  return this.log({
    actor,
    action,
    resource: {
      type: action.startsWith('import') ? 'import' : 'export',
      id: table?._id,
      name: fileInfo?.filename,
    },
    supplier: supplier?._id || supplier,
    table: table?._id,
    details: { fileInfo },
    request,
    status,
    error,
    duration,
    correlationId,
    severity: status === 'failure' ? 'error' : 'info',
  });
};

// Static: Get audit trail for a resource
auditLogSchema.statics.getAuditTrail = async function ({
  resourceType,
  resourceId,
  supplier,
  limit = 100,
  skip = 0,
  actions,
  startDate,
  endDate,
}) {
  const query = {};
  
  if (resourceType) query['resource.type'] = resourceType;
  if (resourceId) query['resource.id'] = resourceId;
  if (supplier) query.supplier = supplier;
  if (actions && actions.length > 0) query.action = { $in: actions };
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  const [logs, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query),
  ]);
  
  return {
    logs,
    pagination: {
      total,
      limit,
      skip,
      hasMore: skip + logs.length < total,
    },
  };
};

// Static: Get summary statistics
auditLogSchema.statics.getSummary = async function ({
  supplier,
  startDate,
  endDate,
}) {
  const matchStage = { supplier };
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          action: '$action',
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.action',
        total: { $sum: '$count' },
        success: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'success'] }, '$count', 0],
          },
        },
        failure: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'failure'] }, '$count', 0],
          },
        },
      },
    },
  ]);
  
  return stats;
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
