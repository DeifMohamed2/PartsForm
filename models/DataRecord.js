const mongoose = require('mongoose');

/**
 * DataRecord Model
 * Stores actual data records for supplier data tables
 * Uses dynamic fields to accommodate any table schema
 */
const dataRecordSchema = new mongoose.Schema(
  {
    // References
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DataTable',
      required: true,
      index: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    
    // Dynamic data fields - stores actual record data
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    
    // Row identifier (combines primary key values)
    rowKey: {
      type: String,
      required: true,
    },
    
    // Version History
    version: {
      type: Number,
      default: 1,
    },
    versionHistory: [{
      version: { type: Number },
      data: { type: mongoose.Schema.Types.Mixed },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
      changedAt: { type: Date, default: Date.now },
      changeType: {
        type: String,
        enum: ['create', 'update', 'restore', 'import'],
      },
      changedFields: [{ type: String }], // Which fields were changed
    }],
    
    // Status
    status: {
      type: String,
      enum: ['active', 'deleted', 'archived'],
      default: 'active',
    },
    
    // Soft delete info
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    
    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    
    // Optimistic locking
    lockVersion: { type: Number, default: 0 },
    
    // Optional: Link to search index
    searchIndexed: { type: Boolean, default: false },
    searchIndexedAt: { type: Date },
  },
  {
    timestamps: true,
    minimize: false, // Keep empty objects in data field
  }
);

// Compound indexes for efficient querying
dataRecordSchema.index({ table: 1, rowKey: 1 }, { unique: true });
dataRecordSchema.index({ table: 1, status: 1 });
dataRecordSchema.index({ supplier: 1, table: 1, status: 1 });
dataRecordSchema.index({ table: 1, updatedAt: -1 });

// Text index for basic search within data (limited to string values)
// Note: For complex search, use Elasticsearch integration
dataRecordSchema.index({ 'data.$**': 'text' });

// Pre-save: Update version and create history entry
dataRecordSchema.pre('save', function (next) {
  if (this.isNew) {
    this.versionHistory = [{
      version: 1,
      data: { ...this.data },
      changedBy: this.createdBy,
      changedAt: new Date(),
      changeType: 'create',
      changedFields: Object.keys(this.data),
    }];
  } else if (this.isModified('data')) {
    const previousData = this._previousData || {};
    const changedFields = [];
    
    // Detect changed fields
    const allKeys = new Set([...Object.keys(this.data), ...Object.keys(previousData)]);
    for (const key of allKeys) {
      if (JSON.stringify(this.data[key]) !== JSON.stringify(previousData[key])) {
        changedFields.push(key);
      }
    }
    
    if (changedFields.length > 0) {
      this.version += 1;
      
      // Keep limited history
      if (this.versionHistory && this.versionHistory.length >= 50) {
        this.versionHistory = this.versionHistory.slice(-49);
      }
      
      this.versionHistory.push({
        version: this.version,
        data: { ...this.data },
        changedBy: this.updatedBy,
        changedAt: new Date(),
        changeType: 'update',
        changedFields,
      });
    }
  }
  
  next();
});

// Virtual for display-friendly version info
dataRecordSchema.virtual('versionInfo').get(function () {
  return {
    current: this.version,
    total: this.versionHistory?.length || 0,
    lastModified: this.updatedAt,
  };
});

// Method to restore to a previous version
dataRecordSchema.methods.restoreToVersion = function (targetVersion, restoredBy) {
  const historyEntry = this.versionHistory?.find(h => h.version === targetVersion);
  if (!historyEntry) {
    throw new Error(`Version ${targetVersion} not found in history`);
  }
  
  // Store current data before restore
  this._previousData = { ...this.data };
  
  // Restore data
  this.data = { ...historyEntry.data };
  this.version += 1;
  this.updatedBy = restoredBy;
  
  // Add restore entry to history
  this.versionHistory.push({
    version: this.version,
    data: { ...this.data },
    changedBy: restoredBy,
    changedAt: new Date(),
    changeType: 'restore',
    changedFields: Object.keys(this.data),
  });
  
  return this;
};

// Method for optimistic locking
dataRecordSchema.methods.updateWithLock = async function (newData, expectedLockVersion, updatedBy) {
  if (this.lockVersion !== expectedLockVersion) {
    const error = new Error('Record has been modified by another user');
    error.code = 'CONCURRENT_MODIFICATION';
    error.currentVersion = this.lockVersion;
    error.expectedVersion = expectedLockVersion;
    throw error;
  }
  
  this._previousData = { ...this.data };
  this.data = { ...this.data, ...newData };
  this.lockVersion += 1;
  this.updatedBy = updatedBy;
  
  return this.save();
};

// Method to soft delete
dataRecordSchema.methods.softDelete = function (deletedBy) {
  this.status = 'deleted';
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Method to restore from soft delete
dataRecordSchema.methods.restore = function (restoredBy) {
  this.status = 'active';
  this.deletedAt = null;
  this.deletedBy = null;
  this.updatedBy = restoredBy;
  return this.save();
};

// Static: Bulk update with concurrency check
dataRecordSchema.statics.bulkUpdateWithLock = async function (updates, updatedBy) {
  const results = { success: [], failed: [] };
  
  for (const update of updates) {
    try {
      const record = await this.findById(update.id);
      if (!record) {
        results.failed.push({ id: update.id, error: 'Record not found' });
        continue;
      }
      
      await record.updateWithLock(update.data, update.lockVersion, updatedBy);
      results.success.push({ id: update.id, newLockVersion: record.lockVersion });
    } catch (error) {
      results.failed.push({
        id: update.id,
        error: error.message,
        code: error.code,
      });
    }
  }
  
  return results;
};

// Static: Get records with pagination
dataRecordSchema.statics.findWithPagination = async function (query, options = {}) {
  const {
    page = 1,
    limit = 50,
    sort = { updatedAt: -1 },
    select,
    populate,
  } = options;
  
  const skip = (page - 1) * limit;
  
  let q = this.find(query);
  
  if (select) q = q.select(select);
  if (populate) q = q.populate(populate);
  
  const [records, total] = await Promise.all([
    q.sort(sort).skip(skip).limit(limit).lean(),
    this.countDocuments(query),
  ]);
  
  return {
    records,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

// Static: Generate row key from primary key values
dataRecordSchema.statics.generateRowKey = function (data, primaryKeyColumns) {
  if (!primaryKeyColumns || primaryKeyColumns.length === 0) {
    // Use all values if no primary key defined
    return Object.values(data).filter(v => v).join('_').substring(0, 255);
  }
  
  const keyParts = primaryKeyColumns.map(col => {
    const value = data[col];
    return value !== undefined && value !== null ? String(value) : '';
  });
  
  return keyParts.join('_').substring(0, 255);
};

const DataRecord = mongoose.model('DataRecord', dataRecordSchema);

module.exports = DataRecord;
