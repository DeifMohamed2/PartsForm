const mongoose = require('mongoose');

/**
 * SyncHistory Model
 * Stores complete history of all sync operations for professional tracking
 */
const syncHistorySchema = new mongoose.Schema(
  {
    // Reference to the integration
    integration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Integration',
      required: true,
      index: true,
    },
    
    // Integration snapshot (in case integration is deleted)
    integrationName: {
      type: String,
      required: true,
    },
    integrationType: {
      type: String,
      enum: ['ftp', 'api', 'google-sheets'],
      required: true,
    },
    
    // Sync timing
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    duration: {
      type: Number, // milliseconds
      default: 0,
    },
    
    // Sync status
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'interrupted', 'cancelled'],
      default: 'pending',
      index: true,
    },
    
    // Trigger source
    triggeredBy: {
      type: String,
      enum: ['scheduler', 'manual', 'api', 'startup-recovery', 'system'],
      default: 'manual',
    },
    
    // Progress tracking
    phase: {
      type: String,
      enum: ['queued', 'connecting', 'downloading', 'parsing', 'importing', 'indexing', 'finalizing', 'done'],
      default: 'queued',
    },
    
    // File statistics
    filesTotal: {
      type: Number,
      default: 0,
    },
    filesProcessed: {
      type: Number,
      default: 0,
    },
    files: [{
      name: String,
      size: Number,
      records: Number,
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'skipped'],
      },
      error: String,
      startedAt: Date,
      completedAt: Date,
    }],
    
    // Record statistics
    recordsTotal: {
      type: Number,
      default: 0,
    },
    recordsProcessed: {
      type: Number,
      default: 0,
    },
    recordsInserted: {
      type: Number,
      default: 0,
    },
    recordsUpdated: {
      type: Number,
      default: 0,
    },
    recordsSkipped: {
      type: Number,
      default: 0,
    },
    recordsFailed: {
      type: Number,
      default: 0,
    },
    
    // Elasticsearch indexing stats
    esIndexed: {
      type: Number,
      default: 0,
    },
    esIndexingDuration: {
      type: Number, // milliseconds
      default: 0,
    },
    
    // Error tracking
    errors: [{
      message: String,
      code: String,
      file: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    }],
    errorSummary: {
      type: String,
    },
    
    // Performance metrics
    metrics: {
      avgRecordsPerSecond: Number,
      avgFileSize: Number,
      peakMemoryUsage: Number,
      mongoWriteOps: Number,
      esWriteOps: Number,
    },
    
    // Additional metadata
    serverVersion: String,
    nodeVersion: String,
    hostname: String,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
syncHistorySchema.index({ integration: 1, startedAt: -1 });
syncHistorySchema.index({ status: 1, startedAt: -1 });
syncHistorySchema.index({ startedAt: -1 });
syncHistorySchema.index({ triggeredBy: 1 });
syncHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // Auto-delete after 90 days

// Virtual for formatted duration
syncHistorySchema.virtual('durationFormatted').get(function() {
  if (!this.duration) return '-';
  
  const seconds = Math.floor(this.duration / 1000);
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
});

// Methods
syncHistorySchema.methods.markRunning = function() {
  this.status = 'running';
  this.phase = 'connecting';
  this.startedAt = new Date();
  return this.save();
};

syncHistorySchema.methods.markCompleted = function(stats = {}) {
  this.status = 'completed';
  this.phase = 'done';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  
  Object.assign(this, stats);
  
  // Calculate metrics
  if (this.duration > 0 && this.recordsProcessed > 0) {
    this.metrics = this.metrics || {};
    this.metrics.avgRecordsPerSecond = Math.round((this.recordsProcessed / this.duration) * 1000);
  }
  
  return this.save();
};

syncHistorySchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  this.errorSummary = error?.message || error || 'Unknown error';
  
  if (error) {
    this.errors.push({
      message: error.message || error,
      code: error.code,
      timestamp: new Date(),
    });
  }
  
  return this.save();
};

syncHistorySchema.methods.markInterrupted = function(reason = 'Server restart') {
  this.status = 'interrupted';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  this.errorSummary = reason;
  
  return this.save();
};

syncHistorySchema.methods.updateProgress = function(progress) {
  Object.assign(this, progress);
  return this.save();
};

// Static methods
syncHistorySchema.statics.createSyncRecord = async function(integration, triggeredBy = 'manual') {
  const record = new this({
    integration: integration._id,
    integrationName: integration.name,
    integrationType: integration.type,
    triggeredBy,
    status: 'pending',
    phase: 'queued',
    serverVersion: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    hostname: require('os').hostname(),
  });
  
  return record.save();
};

syncHistorySchema.statics.getRecentByIntegration = function(integrationId, limit = 20) {
  return this.find({ integration: integrationId })
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();
};

syncHistorySchema.statics.getRunningSync = function(integrationId) {
  return this.findOne({
    integration: integrationId,
    status: { $in: ['pending', 'running'] },
  });
};

syncHistorySchema.statics.markStaleAsInterrupted = async function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const result = await this.updateMany(
    {
      status: { $in: ['pending', 'running'] },
      startedAt: { $lt: oneHourAgo },
    },
    {
      $set: {
        status: 'interrupted',
        completedAt: new Date(),
        errorSummary: 'Sync stale - marked as interrupted',
      },
    }
  );
  
  return result.modifiedCount;
};

syncHistorySchema.statics.getStats = async function(integrationId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        integration: new mongoose.Types.ObjectId(integrationId),
        startedAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        totalRecords: { $sum: '$recordsProcessed' },
      },
    },
  ]);
  
  return stats;
};

const SyncHistory = mongoose.model('SyncHistory', syncHistorySchema);

module.exports = SyncHistory;
