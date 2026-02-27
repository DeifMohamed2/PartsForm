const mongoose = require('mongoose');

/**
 * DataTable Model
 * Defines the schema/structure of data tables that suppliers create
 * Each supplier can have multiple tables with custom column definitions
 */
const dataTableSchema = new mongoose.Schema(
  {
    // Owner
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    
    // Table Identity
    name: {
      type: String,
      required: [true, 'Table name is required'],
      trim: true,
      maxlength: [100, 'Table name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_-]+$/, 'Slug can only contain lowercase letters, numbers, underscores, and hyphens'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    
    // Column Definitions
    columns: [{
      name: {
        type: String,
        required: true,
        trim: true,
      },
      key: {
        type: String,
        required: true,
        trim: true,
        match: [/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Column key must start with a letter and contain only letters, numbers, and underscores'],
      },
      type: {
        type: String,
        enum: ['string', 'number', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'email', 'url', 'select', 'multiselect', 'text', 'json'],
        default: 'string',
      },
      required: { type: Boolean, default: false },
      unique: { type: Boolean, default: false },
      indexed: { type: Boolean, default: false },
      
      // Validation rules
      validation: {
        minLength: { type: Number },
        maxLength: { type: Number },
        min: { type: Number },
        max: { type: Number },
        pattern: { type: String },
        patternMessage: { type: String },
        options: [{ type: String }], // For select/multiselect
        defaultValue: { type: mongoose.Schema.Types.Mixed },
      },
      
      // Display settings
      display: {
        width: { type: Number, default: 150 },
        visible: { type: Boolean, default: true },
        sortable: { type: Boolean, default: true },
        filterable: { type: Boolean, default: true },
        editable: { type: Boolean, default: true },
        format: { type: String }, // e.g., 'currency', 'percentage', 'date:YYYY-MM-DD'
        tooltip: { type: String },
      },
      
      // Order in table
      order: { type: Number, default: 0 },
      
      // Metadata
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    }],
    
    // Primary Key column(s)
    primaryKey: [{ type: String }], // Array of column keys
    
    // Table Settings
    settings: {
      // Import/Export settings
      allowImport: { type: Boolean, default: true },
      allowExport: { type: Boolean, default: true },
      exportFormat: {
        type: String,
        enum: ['csv', 'xlsx', 'json', 'all'],
        default: 'all',
      },
      
      // Versioning settings
      enableVersioning: { type: Boolean, default: true },
      maxVersions: { type: Number, default: 50 },
      
      // Pagination defaults
      defaultPageSize: { type: Number, default: 50 },
      maxPageSize: { type: Number, default: 1000 },
      
      // Display settings
      frozenColumns: { type: Number, default: 0 }, // Number of columns to freeze from left
      rowHeight: { type: Number, default: 32 },
      
      // SFTP Export settings (per table)
      sftpExport: {
        enabled: { type: Boolean, default: false },
        filename: { type: String, default: '' }, // Empty = use table slug
        includeHeaders: { type: Boolean, default: true },
        delimiter: { type: String, default: ',' },
        encoding: { type: String, default: 'utf-8' },
      },
      
      // Search integration
      searchable: { type: Boolean, default: true },
      searchableColumns: [{ type: String }], // Column keys to include in search index
    },
    
    // Stats (updated periodically)
    stats: {
      recordCount: { type: Number, default: 0 },
      storageBytes: { type: Number, default: 0 },
      lastRecordAt: { type: Date },
      lastImportAt: { type: Date },
      lastExportAt: { type: Date },
    },
    
    // Status
    status: {
      type: String,
      enum: ['active', 'archived', 'locked', 'importing', 'exporting'],
      default: 'active',
    },
    
    // Audit info
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    
    // Version for optimistic locking
    __v: { type: Number, select: true },
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // Enable version-based concurrency control
  }
);

// Compound unique index for supplier + slug
dataTableSchema.index({ supplier: 1, slug: 1 }, { unique: true });
dataTableSchema.index({ supplier: 1, status: 1 });
dataTableSchema.index({ 'settings.sftpExport.enabled': 1 });

// Pre-save: Generate slug from name if not provided
dataTableSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);
  }
  
  // Update column order if not set
  if (this.isModified('columns')) {
    this.columns.forEach((col, idx) => {
      if (col.order === undefined || col.order === 0) {
        col.order = idx;
      }
      col.updatedAt = new Date();
    });
  }
  
  next();
});

// Method to get column by key
dataTableSchema.methods.getColumn = function (key) {
  return this.columns.find(col => col.key === key);
};

// Method to get sorted columns
dataTableSchema.methods.getSortedColumns = function () {
  return [...this.columns].sort((a, b) => a.order - b.order);
};

// Method to validate a record against column definitions
dataTableSchema.methods.validateRecord = function (record) {
  const errors = [];
  
  for (const column of this.columns) {
    const value = record[column.key];
    const validation = column.validation || {};
    
    // Required check
    if (column.required && (value === undefined || value === null || value === '')) {
      errors.push({ column: column.key, message: `${column.name} is required` });
      continue;
    }
    
    if (value === undefined || value === null || value === '') continue;
    
    // Type validation
    switch (column.type) {
      case 'number':
      case 'integer':
      case 'decimal':
        if (isNaN(Number(value))) {
          errors.push({ column: column.key, message: `${column.name} must be a valid number` });
        } else {
          const num = Number(value);
          if (validation.min !== undefined && num < validation.min) {
            errors.push({ column: column.key, message: `${column.name} must be at least ${validation.min}` });
          }
          if (validation.max !== undefined && num > validation.max) {
            errors.push({ column: column.key, message: `${column.name} must be at most ${validation.max}` });
          }
        }
        break;
        
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push({ column: column.key, message: `${column.name} must be a valid email address` });
        }
        break;
        
      case 'url':
        try {
          new URL(value);
        } catch {
          errors.push({ column: column.key, message: `${column.name} must be a valid URL` });
        }
        break;
        
      case 'date':
      case 'datetime':
        if (isNaN(Date.parse(value))) {
          errors.push({ column: column.key, message: `${column.name} must be a valid date` });
        }
        break;
        
      case 'select':
        if (validation.options && !validation.options.includes(value)) {
          errors.push({ column: column.key, message: `${column.name} must be one of: ${validation.options.join(', ')}` });
        }
        break;
        
      case 'multiselect':
        if (validation.options && Array.isArray(value)) {
          const invalid = value.filter(v => !validation.options.includes(v));
          if (invalid.length > 0) {
            errors.push({ column: column.key, message: `${column.name} contains invalid options: ${invalid.join(', ')}` });
          }
        }
        break;
        
      case 'string':
      case 'text':
      default:
        const strValue = String(value);
        if (validation.minLength && strValue.length < validation.minLength) {
          errors.push({ column: column.key, message: `${column.name} must be at least ${validation.minLength} characters` });
        }
        if (validation.maxLength && strValue.length > validation.maxLength) {
          errors.push({ column: column.key, message: `${column.name} must be at most ${validation.maxLength} characters` });
        }
        if (validation.pattern) {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(strValue)) {
            errors.push({ column: column.key, message: validation.patternMessage || `${column.name} has invalid format` });
          }
        }
        break;
    }
  }
  
  return { valid: errors.length === 0, errors };
};

// Method to cast record values to proper types
dataTableSchema.methods.castRecord = function (record) {
  const casted = {};
  
  for (const column of this.columns) {
    const value = record[column.key];
    if (value === undefined || value === null || value === '') {
      casted[column.key] = column.validation?.defaultValue ?? null;
      continue;
    }
    
    switch (column.type) {
      case 'number':
      case 'decimal':
        casted[column.key] = parseFloat(value);
        break;
      case 'integer':
        casted[column.key] = parseInt(value, 10);
        break;
      case 'boolean':
        casted[column.key] = ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
        break;
      case 'date':
      case 'datetime':
        casted[column.key] = new Date(value);
        break;
      case 'multiselect':
        casted[column.key] = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
        break;
      case 'json':
        casted[column.key] = typeof value === 'string' ? JSON.parse(value) : value;
        break;
      default:
        casted[column.key] = String(value);
        break;
    }
  }
  
  return casted;
};

// Static method to get collection name for data records
dataTableSchema.statics.getDataCollectionName = function (tableId) {
  return `supplier_data_${tableId}`;
};

const DataTable = mongoose.model('DataTable', dataTableSchema);

module.exports = DataTable;
