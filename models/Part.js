const mongoose = require('mongoose');

/**
 * Part Model
 * Stores automotive parts imported from FTP/API/Sheets integrations
 */
const partSchema = new mongoose.Schema({
  // Core Part Information
  partNumber: {
    type: String,
    required: [true, 'Part number is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  brand: {
    type: String,
    trim: true,
    default: ''
  },
  supplier: {
    type: String,
    trim: true,
    default: ''
  },

  // Pricing & Availability
  price: {
    type: Number,
    min: 0,
    default: null
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
    trim: true
  },
  quantity: {
    type: Number,
    min: 0,
    default: 0
  },
  stock: {
    type: String,
    enum: ['in-stock', 'low-stock', 'out-of-stock', 'on-order', 'unknown'],
    default: 'unknown'
  },

  // Additional Details
  origin: {
    type: String,
    trim: true,
    default: ''
  },
  weight: {
    type: Number,
    min: 0,
    default: null
  },
  weightUnit: {
    type: String,
    enum: ['kg', 'lbs', 'g', 'oz'],
    default: 'kg'
  },
  deliveryDays: {
    type: Number,
    min: 0,
    default: null
  },

  // Categorization
  category: {
    type: String,
    trim: true,
    default: ''
  },
  subcategory: {
    type: String,
    trim: true,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],

  // Source Information
  integration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Integration'
  },
  integrationName: {
    type: String,
    trim: true,
    index: true
  },
  fileName: {
    type: String,
    trim: true
  },

  // Raw Data (for reference)
  rawData: {
    type: mongoose.Schema.Types.Mixed
  },

  // Import Information
  importedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },

  // Search & Indexing
  searchText: {
    type: String,
    index: 'text'
  },
  isIndexed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound indexes for efficient searching
partSchema.index({ partNumber: 1, supplier: 1 });
partSchema.index({ partNumber: 1, fileName: 1 });
partSchema.index({ partNumber: 1, integration: 1 });
partSchema.index({ brand: 1, supplier: 1 });
partSchema.index({ price: 1, quantity: 1 });

// Text index for full-text search (fallback when Elasticsearch is unavailable)
partSchema.index({
  partNumber: 'text',
  description: 'text',
  brand: 'text',
  supplier: 'text'
}, {
  weights: {
    partNumber: 10,
    brand: 5,
    description: 3,
    supplier: 2
  },
  name: 'parts_text_index'
});

// Pre-save middleware to generate search text
partSchema.pre('save', function (next) {
  // Create searchable text field
  this.searchText = [
    this.partNumber,
    this.description,
    this.brand,
    this.supplier,
    this.origin
  ].filter(Boolean).join(' ').toLowerCase();

  // Update stock status based on quantity (preserve explicit 'on-order' when qty is 0)
  if (this.quantity !== undefined) {
    if (this.quantity > 10) {
      this.stock = 'in-stock';
    } else if (this.quantity > 0) {
      this.stock = 'low-stock';
    } else if (this.stock !== 'on-order') {
      this.stock = 'out-of-stock';
    }
  }

  this.lastUpdated = new Date();
  next();
});

// Post-save middleware for automatic Elasticsearch indexing
partSchema.post('save', async function (doc) {
  try {
    // Lazy load to avoid circular dependency issues
    const elasticsearchService = require('../services/elasticsearchService');

    if (elasticsearchService.isAvailable) {
      // Queue document for bulk indexing (batched for efficiency)
      await elasticsearchService.queueDocument({
        _id: doc._id,
        partNumber: doc.partNumber,
        description: doc.description,
        brand: doc.brand,
        supplier: doc.supplier,
        price: doc.price,
        currency: doc.currency,
        quantity: doc.quantity,
        stock: doc.stock,
        origin: doc.origin,
        weight: doc.weight,
        deliveryDays: doc.deliveryDays,
        category: doc.category,
        integration: doc.integration?.toString(),
        integrationName: doc.integrationName,
        fileName: doc.fileName,
        importedAt: doc.importedAt,
        createdAt: doc.createdAt,
      });
    }
  } catch (error) {
    // Log but don't fail the save operation
    console.error('Error queuing document for Elasticsearch:', error.message);
  }
});

// Static method for searching parts
partSchema.statics.searchParts = async function (query, options = {}) {
  const {
    page = 1,
    limit = 50,
    sortBy = 'importedAt',
    sortOrder = 'desc',
    filters = {}
  } = options;

  const skip = (page - 1) * limit;
  const searchQuery = {};

  // Text search
  if (query && query.trim()) {
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    searchQuery.$or = [
      { partNumber: { $regex: escapedQuery, $options: 'i' } },
      { description: { $regex: escapedQuery, $options: 'i' } },
      { brand: { $regex: escapedQuery, $options: 'i' } },
      { supplier: { $regex: escapedQuery, $options: 'i' } }
    ];
  }

  // Apply filters
  if (filters.brand) {
    searchQuery.brand = { $regex: filters.brand, $options: 'i' };
  }
  if (filters.supplier) {
    searchQuery.supplier = { $regex: filters.supplier, $options: 'i' };
  }
  if (filters.minPrice !== undefined) {
    searchQuery.price = { ...searchQuery.price, $gte: parseFloat(filters.minPrice) };
  }
  if (filters.maxPrice !== undefined) {
    searchQuery.price = { ...searchQuery.price, $lte: parseFloat(filters.maxPrice) };
  }
  if (filters.integration) {
    searchQuery.integration = filters.integration;
  }
  if (filters.inStock) {
    searchQuery.quantity = { $gt: 0 };
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const [results, total] = await Promise.all([
    this.find(searchQuery)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(searchQuery)
  ]);

  return {
    results,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: skip + results.length < total
  };
};

// Static method to get filter options
partSchema.statics.getFilterOptions = async function (query = {}) {
  const matchStage = {};

  if (query && query.trim()) {
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    matchStage.$or = [
      { partNumber: { $regex: escapedQuery, $options: 'i' } },
      { description: { $regex: escapedQuery, $options: 'i' } },
      { brand: { $regex: escapedQuery, $options: 'i' } },
      { supplier: { $regex: escapedQuery, $options: 'i' } }
    ];
  }

  const [brands, suppliers, priceRange] = await Promise.all([
    this.distinct('brand', matchStage),
    this.distinct('supplier', matchStage),
    this.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      }
    ])
  ]);

  return {
    brands: brands.filter(b => b && b.trim()).sort(),
    suppliers: suppliers.filter(s => s && s.trim()).sort(),
    priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 }
  };
};

// Static method for bulk upsert
partSchema.statics.bulkUpsert = async function (records, options = {}) {
  const { integration, fileName } = options;

  const operations = records.map(record => ({
    updateOne: {
      filter: {
        partNumber: record.partNumber,
        integration: integration,
        fileName: fileName
      },
      update: {
        $set: {
          ...record,
          integration,
          fileName,
          importedAt: new Date(),
          lastUpdated: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      upsert: true
    }
  }));

  const batchSize = 1000;
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const result = await this.bulkWrite(batch, { ordered: false });
    inserted += result.upsertedCount || 0;
    updated += result.modifiedCount || 0;
  }

  return { inserted, updated, total: records.length };
};

const Part = mongoose.model('Part', partSchema);

module.exports = Part;
