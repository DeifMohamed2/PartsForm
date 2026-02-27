const mongoose = require('mongoose');

/**
 * DataExport Model
 * Tracks export jobs - both manual and scheduled
 * Maintains history of all exports for audit and debugging
 */
const dataExportSchema = new mongoose.Schema(
  {
    // Owner
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    
    // Source table(s)
    tables: [{
      table: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DataTable',
        required: true,
      },
      tableName: { type: String },
      recordCount: { type: Number, default: 0 },
    }],
    
    // Export configuration
    config: {
      format: {
        type: String,
        enum: ['csv', 'xlsx', 'json'],
        default: 'csv',
      },
      delimiter: { type: String, default: ',' },
      encoding: { type: String, default: 'utf-8' },
      includeHeaders: { type: Boolean, default: true },
      columns: [{ type: String }], // Specific columns to export (empty = all)
      filters: { type: mongoose.Schema.Types.Mixed }, // Query filters applied
      dateFormat: { type: String, default: 'YYYY-MM-DD' },
      numberFormat: { type: String },
      compression: { type: Boolean, default: false },
    },
    
    // Export type
    type: {
      type: String,
      enum: ['manual', 'scheduled', 'api', 'sftp_sync'],
      default: 'manual',
    },
    
    // Status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    
    // Progress tracking
    progress: {
      total: { type: Number, default: 0 },
      processed: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
      currentTable: { type: String },
    },
    
    // Output file info
    file: {
      filename: { type: String },
      originalName: { type: String },
      path: { type: String },
      size: { type: Number },
      mimeType: { type: String },
      checksum: { type: String }, // MD5/SHA256 for integrity
      downloadUrl: { type: String },
      expiresAt: { type: Date },
    },
    
    // SFTP upload info (if applicable)
    sftp: {
      enabled: { type: Boolean, default: false },
      host: { type: String },
      remotePath: { type: String },
      uploaded: { type: Boolean, default: false },
      uploadedAt: { type: Date },
      uploadError: { type: String },
    },
    
    // Timing
    startedAt: { type: Date },
    completedAt: { type: Date },
    duration: { type: Number }, // milliseconds
    
    // Triggered by
    triggeredBy: {
      type: {
        type: String,
        enum: ['user', 'schedule', 'api', 'system'],
      },
      id: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String },
    },
    
    // Error tracking
    error: {
      code: { type: String },
      message: { type: String },
      details: { type: mongoose.Schema.Types.Mixed },
      retryable: { type: Boolean, default: false },
    },
    
    // Retry info
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    
    // Notification
    notification: {
      email: { type: Boolean, default: false },
      emailSent: { type: Boolean, default: false },
      emailSentAt: { type: Date },
    },
    
    // Metadata
    metadata: {
      version: { type: Number, default: 1 },
      exportedRecordCount: { type: Number, default: 0 },
      executionTime: { type: Number }, // seconds
      memoryUsed: { type: Number }, // bytes
    },
    
    // Correlation ID for tracking
    correlationId: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes
dataExportSchema.index({ status: 1, createdAt: -1 });
dataExportSchema.index({ 'tables.table': 1 });
dataExportSchema.index({ type: 1, status: 1 });
dataExportSchema.index({ 'file.expiresAt': 1 }, { expireAfterSeconds: 0 }); // Auto-cleanup expired exports
dataExportSchema.index({ correlationId: 1 });

// Virtual for duration in human readable format
dataExportSchema.virtual('durationFormatted').get(function () {
  if (!this.duration) return null;
  
  const seconds = Math.floor(this.duration / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
});

// Method to update progress
dataExportSchema.methods.updateProgress = async function (processed, currentTable = null) {
  this.progress.processed = processed;
  this.progress.percentage = this.progress.total > 0 
    ? Math.round((processed / this.progress.total) * 100) 
    : 0;
  if (currentTable) this.progress.currentTable = currentTable;
  
  return this.save();
};

// Method to mark as completed
dataExportSchema.methods.markCompleted = async function (fileInfo) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  this.progress.percentage = 100;
  
  if (fileInfo) {
    this.file = { ...this.file, ...fileInfo };
  }
  
  return this.save();
};

// Method to mark as failed
dataExportSchema.methods.markFailed = async function (error) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  this.error = {
    code: error.code || 'EXPORT_FAILED',
    message: error.message,
    details: error.details,
    retryable: error.retryable || false,
  };
  
  return this.save();
};

// Method to check if can retry
dataExportSchema.methods.canRetry = function () {
  return this.status === 'failed' && 
         this.error?.retryable && 
         this.retryCount < this.maxRetries;
};

// Method to prepare for retry
dataExportSchema.methods.retry = async function () {
  if (!this.canRetry()) {
    throw new Error('Export cannot be retried');
  }
  
  this.status = 'pending';
  this.retryCount += 1;
  this.error = null;
  this.progress = { total: this.progress.total, processed: 0, percentage: 0 };
  
  return this.save();
};

// Static: Create export job
dataExportSchema.statics.createJob = async function ({
  supplier,
  tables,
  config,
  type = 'manual',
  triggeredBy,
  sftpConfig,
  correlationId,
}) {
  const totalRecords = tables.reduce((sum, t) => sum + (t.recordCount || 0), 0);
  
  const job = new this({
    supplier,
    tables: tables.map(t => ({
      table: t.table._id || t.table,
      tableName: t.tableName || t.table.name,
      recordCount: t.recordCount || 0,
    })),
    config,
    type,
    triggeredBy,
    sftp: sftpConfig ? {
      enabled: true,
      host: sftpConfig.host,
      remotePath: sftpConfig.remotePath,
    } : { enabled: false },
    progress: { total: totalRecords, processed: 0, percentage: 0 },
    correlationId,
  });
  
  await job.save();
  return job;
};

// Static: Get pending jobs
dataExportSchema.statics.getPendingJobs = async function (limit = 10) {
  return this.find({ status: 'pending' })
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('supplier', 'companyName companyCode')
    .populate('tables.table', 'name slug');
};

// Static: Get exports for supplier
dataExportSchema.statics.getExportsForSupplier = async function ({
  supplier,
  status,
  type,
  limit = 20,
  skip = 0,
}) {
  const query = { supplier };
  if (status) query.status = status;
  if (type) query.type = type;
  
  const [exports, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('tables.table', 'name slug')
      .lean(),
    this.countDocuments(query),
  ]);
  
  return {
    exports,
    pagination: { total, limit, skip, hasMore: skip + exports.length < total },
  };
};

// Static: Cleanup old exports
dataExportSchema.statics.cleanupOldExports = async function (daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.deleteMany({
    status: { $in: ['completed', 'failed', 'cancelled'] },
    createdAt: { $lt: cutoffDate },
  });
  
  return result.deletedCount;
};

const DataExport = mongoose.model('DataExport', dataExportSchema);

module.exports = DataExport;
