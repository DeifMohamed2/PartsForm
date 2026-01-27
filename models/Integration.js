const mongoose = require('mongoose');

/**
 * Integration Model
 * Stores FTP, API, and Google Sheets connection configurations
 */
const integrationSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Integration name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  type: {
    type: String,
    required: [true, 'Integration type is required'],
    enum: ['ftp', 'api', 'google-sheets'],
    default: 'ftp'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'error', 'syncing'],
    default: 'inactive'
  },
  
  // FTP Configuration
  ftp: {
    host: { type: String, trim: true },
    port: { type: Number, default: 21 },
    username: { type: String, trim: true },
    password: { type: String }, // Should be encrypted in production
    secure: { type: Boolean, default: false },
    remotePath: { type: String, default: '/', trim: true },
    filePattern: { type: String, default: '*.csv', trim: true }
  },
  
  // API Configuration (Enhanced)
  api: {
    // Basic Configuration
    name: { type: String, trim: true },
    apiType: { type: String, enum: ['rest', 'graphql'], default: 'rest' },
    baseUrl: { type: String, trim: true },
    
    // Authentication
    authType: { type: String, enum: ['none', 'api-key', 'apikey', 'bearer', 'oauth2', 'basic'], default: 'api-key' },
    authHeader: { type: String, trim: true, default: 'X-API-Key' },
    apiKey: { type: String }, // Should be encrypted in production
    token: { type: String }, // Bearer token
    username: { type: String, trim: true },
    password: { type: String }, // Should be encrypted in production
    
    // OAuth2 Configuration
    oauth2: {
      clientId: { type: String, trim: true },
      clientSecret: { type: String },
      tokenUrl: { type: String, trim: true },
      scope: { type: String, trim: true },
      accessToken: { type: String },
      refreshToken: { type: String },
      tokenExpiry: { type: Date }
    },
    
    // Endpoints Configuration
    endpoints: [{
      name: { type: String, trim: true },
      path: { type: String, trim: true, default: '/' },
      method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
      description: { type: String, trim: true },
      queryParams: { type: mongoose.Schema.Types.Mixed },
      body: { type: mongoose.Schema.Types.Mixed },
      dataPath: { type: String, trim: true }, // Path to data array in response
      fieldMapping: { type: mongoose.Schema.Types.Mixed },
      isEnabled: { type: Boolean, default: true }
    }],
    
    // Pagination Configuration
    pagination: {
      paginationType: { type: String, enum: ['none', 'page', 'offset', 'cursor'], default: 'none' },
      pageParam: { type: String, default: 'page' },
      offsetParam: { type: String, default: 'offset' },
      limitParam: { type: String, default: 'limit' },
      cursorParam: { type: String, default: 'cursor' },
      pageSize: { type: Number, default: 100 },
      maxPages: { type: Number, default: 100 },
      totalPath: { type: String, trim: true }, // Path to total count in response
      cursorPath: { type: String, trim: true } // Path to next cursor in response
    },
    
    // Data Configuration
    dataPath: { type: String, trim: true }, // Global path to data array
    fieldMapping: { type: mongoose.Schema.Types.Mixed }, // Global field mapping
    
    // Request Configuration
    headers: { type: mongoose.Schema.Types.Mixed }, // Custom headers
    rateLimit: { type: Number, default: 60 }, // Requests per minute
    timeout: { type: Number, default: 30000 }, // Request timeout in ms
    
    // Response Handling
    successCodes: [{ type: Number }], // HTTP codes considered success (default 200-299)
    errorHandling: {
      retryOnError: { type: Boolean, default: true },
      maxRetries: { type: Number, default: 3 },
      retryDelay: { type: Number, default: 1000 } // Base delay in ms
    },
    
    // GraphQL specific
    graphqlEndpoint: { type: String, trim: true },
    graphqlQuery: { type: String }, // GraphQL query string
    graphqlVariables: { type: mongoose.Schema.Types.Mixed }
  },
  
  // Google Sheets Configuration
  googleSheets: {
    spreadsheetId: { type: String, trim: true },
    sheetName: { type: String, default: 'Sheet1', trim: true },
    range: { type: String, default: 'A:Z', trim: true },
    credentials: { type: mongoose.Schema.Types.Mixed } // Service account credentials
  },
  
  // Sync Schedule
  syncSchedule: {
    enabled: { type: Boolean, default: true },
    frequency: { 
      type: String, 
      enum: ['manual', 'hourly', '6hours', '12hours', 'daily', 'weekly', 'monthly', 'custom'],
      default: 'daily'
    },
    time: { type: String, default: '08:00' }, // HH:MM format
    daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0 = Sunday
    dayOfMonth: { type: Number, min: 1, max: 31 },
    interval: { type: Number, default: 1 }, // For custom intervals
    timezone: { type: String, default: 'UTC' }
  },
  
  // Advanced Options
  options: {
    autoSync: { type: Boolean, default: true },
    notifyOnComplete: { type: Boolean, default: true },
    deltaSync: { type: Boolean, default: false }, // Only sync changes
    retryOnFail: { type: Boolean, default: true },
    maxRetries: { type: Number, default: 3 },
    timeout: { type: Number, default: 300000 } // 5 minutes in ms
  },
  
  // Sync Statistics
  stats: {
    totalRecords: { type: Number, default: 0 },
    lastSyncRecords: { type: Number, default: 0 },
    totalSyncs: { type: Number, default: 0 },
    successfulSyncs: { type: Number, default: 0 },
    failedSyncs: { type: Number, default: 0 }
  },
  
  // Last Sync Information
  lastSync: {
    date: { type: Date },
    status: { type: String, enum: ['success', 'failed', 'partial'] },
    duration: { type: Number }, // in milliseconds
    recordsProcessed: { type: Number },
    recordsInserted: { type: Number },
    recordsUpdated: { type: Number },
    recordsSkipped: { type: Number },
    error: { type: String },
    files: [{
      name: { type: String },
      size: { type: Number },
      records: { type: Number },
      status: { type: String }
    }]
  },
  
  // Column Mapping for CSV/Sheets import
  columnMapping: {
    partNumber: { type: String, default: 'Part Number' },
    description: { type: String, default: 'Description' },
    supplier: { type: String, default: 'Supplier' },
    price: { type: String, default: 'Price' },
    quantity: { type: String, default: 'Quantity' },
    brand: { type: String, default: 'Brand' },
    origin: { type: String, default: 'Origin' },
    custom: [{ 
      sourceColumn: String, 
      targetField: String 
    }]
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
integrationSchema.index({ type: 1, status: 1 });
integrationSchema.index({ 'syncSchedule.enabled': 1 });
integrationSchema.index({ 'lastSync.date': -1 });
integrationSchema.index({ name: 'text' });

// Virtual for connection display name
integrationSchema.virtual('displayName').get(function() {
  if (this.type === 'ftp') {
    return this.name || `${this.ftp?.host}`;
  } else if (this.type === 'api') {
    return this.name || this.api?.name;
  } else if (this.type === 'google-sheets') {
    return this.name || `Sheet: ${this.googleSheets?.sheetName}`;
  }
  return this.name;
});

// Method to check if sync is due
integrationSchema.methods.isSyncDue = function() {
  if (!this.syncSchedule.enabled) return false;
  if (!this.lastSync?.date) return true;
  
  const now = new Date();
  const lastSync = new Date(this.lastSync.date);
  const hoursSinceLastSync = (now - lastSync) / (1000 * 60 * 60);
  
  switch (this.syncSchedule.frequency) {
    case 'hourly':
      return hoursSinceLastSync >= 1;
    case 'daily':
      return hoursSinceLastSync >= 24;
    case 'weekly':
      return hoursSinceLastSync >= 168;
    case 'monthly':
      return hoursSinceLastSync >= 720;
    default:
      return hoursSinceLastSync >= 24;
  }
};

// Method to get sanitized config (without passwords)
integrationSchema.methods.toSafeJSON = function() {
  const obj = this.toObject();
  
  // Remove sensitive data
  if (obj.ftp) {
    obj.ftp.password = obj.ftp.password ? '********' : undefined;
  }
  if (obj.api) {
    obj.api.apiKey = obj.api.apiKey ? '********' : undefined;
    obj.api.password = obj.api.password ? '********' : undefined;
  }
  if (obj.googleSheets) {
    obj.googleSheets.credentials = obj.googleSheets.credentials ? '[CREDENTIALS]' : undefined;
  }
  
  return obj;
};

// Static method to get enabled integrations for scheduling
integrationSchema.statics.getEnabledForSync = function() {
  return this.find({
    status: { $in: ['active', 'inactive'] },
    'syncSchedule.enabled': true
  });
};

// Pre-save middleware to update stats (Mongoose v9+ uses async/await pattern)
integrationSchema.pre('save', async function() {
  if (this.isModified('lastSync.status')) {
    this.stats.totalSyncs += 1;
    if (this.lastSync.status === 'success') {
      this.stats.successfulSyncs += 1;
    } else if (this.lastSync.status === 'failed') {
      this.stats.failedSyncs += 1;
    }
  }
  // No need to call next() in Mongoose v9+ - just return or let the function complete
});

const Integration = mongoose.model('Integration', integrationSchema);

module.exports = Integration;
