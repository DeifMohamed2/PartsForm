/**
 * Supplier Parts Service
 * Handles all supplier parts operations:
 * - Import from Excel/CSV
 * - CRUD operations
 * - Elasticsearch indexing
 * - Audit logging
 */
const mongoose = require('mongoose');
const Part = require('../models/Part');
const Supplier = require('../models/Supplier');
const AuditLog = require('../models/AuditLog');
const elasticsearchService = require('./elasticsearchService');
const ExcelJS = require('exceljs');
const csv = require('csv-parse');
const logger = require('../utils/logger');
const { Readable } = require('stream');

class SupplierPartsService {
  
  /**
   * Parse uploaded file (Excel or CSV)
   */
  async parseFile(buffer, filename) {
    const ext = filename.toLowerCase().split('.').pop();
    
    if (ext === 'csv') {
      return this.parseCSV(buffer);
    } else if (ext === 'xlsx' || ext === 'xls') {
      return this.parseExcel(buffer);
    }
    
    throw new Error('Unsupported file format. Use CSV or Excel files.');
  }

  /**
   * Parse CSV file
   */
  async parseCSV(buffer) {
    return new Promise((resolve, reject) => {
      const records = [];
      const parser = csv.parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      });

      parser.on('data', (row) => records.push(row));
      parser.on('error', reject);
      parser.on('end', () => {
        const headers = records.length > 0 ? Object.keys(records[0]) : [];
        resolve({ headers, rows: records });
      });

      const stream = Readable.from(buffer);
      stream.pipe(parser);
    });
  }

  /**
   * Parse Excel file
   */
  async parseExcel(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('No worksheet found in Excel file');

    const rows = [];
    let headers = [];

    worksheet.eachRow((row, rowNumber) => {
      const values = row.values.slice(1); // Remove first empty element
      
      if (rowNumber === 1) {
        headers = values.map(v => String(v || '').trim());
      } else {
        const rowData = {};
        headers.forEach((header, idx) => {
          let value = values[idx];
          // Handle cell objects
          if (value && typeof value === 'object') {
            value = value.text || value.result || value.toString();
          }
          rowData[header] = value !== undefined && value !== null ? String(value).trim() : '';
        });
        rows.push(rowData);
      }
    });

    return { headers, rows };
  }

  /**
   * Map raw data to Part schema
   */
  mapToPart(rawRow, columnMapping = {}) {
    // Default column mapping (common variations)
    const defaultMapping = {
      partNumber: ['part_number', 'partnumber', 'part', 'pn', 'part_no', 'part no', 'part#', 'sku', 'item_number', 'item number', 'item', 'code'],
      description: ['description', 'desc', 'name', 'title', 'product_name', 'product name', 'item_description', 'item description'],
      brand: ['brand', 'manufacturer', 'mfr', 'make', 'vendor', 'oem'],
      supplier: ['supplier', 'seller', 'source'],
      price: ['price', 'unit_price', 'unit price', 'cost', 'rate', 'amount', 'selling_price', 'selling price'],
      quantity: ['quantity', 'qty', 'stock', 'available', 'inventory', 'on_hand', 'on hand', 'stock_qty'],
      currency: ['currency', 'curr', 'ccy'],
      weight: ['weight', 'wt', 'mass', 'kg', 'lbs'],
      deliveryDays: ['delivery_days', 'delivery days', 'lead_time', 'lead time', 'days', 'eta'],
      category: ['category', 'cat', 'type', 'group', 'classification'],
      minOrderQty: ['min_order_qty', 'min order qty', 'moq', 'minimum_qty', 'min_qty']
    };

    const part = {};
    const lowerKeys = {};
    
    // Create lowercase key map
    Object.keys(rawRow).forEach(key => {
      lowerKeys[key.toLowerCase().replace(/[^a-z0-9]/g, '_')] = key;
    });

    // Map each field
    Object.keys(defaultMapping).forEach(field => {
      const possibleKeys = defaultMapping[field];
      const customKey = columnMapping[field];
      
      let value = null;
      
      // First check custom mapping
      if (customKey && rawRow[customKey] !== undefined) {
        value = rawRow[customKey];
      } else {
        // Then check default mappings
        for (const key of possibleKeys) {
          const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const actualKey = lowerKeys[normalizedKey];
          if (actualKey && rawRow[actualKey] !== undefined && rawRow[actualKey] !== '') {
            value = rawRow[actualKey];
            break;
          }
        }
      }

      if (value !== null && value !== undefined && value !== '') {
        // Type conversion
        if (['price', 'quantity', 'weight', 'deliveryDays', 'minOrderQty'].includes(field)) {
          const numValue = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
          if (!isNaN(numValue)) part[field] = numValue;
        } else {
          part[field] = String(value).trim();
        }
      }
    });

    return part;
  }

  /**
   * Import parts from file
   */
  async importFromFile(supplier, fileBuffer, filename, options = {}) {
    const { columnMapping = {}, replaceExisting = false } = options;
    const startTime = Date.now();

    try {
      // Parse file
      const { headers, rows } = await this.parseFile(fileBuffer, filename);
      
      if (rows.length === 0) {
        throw new Error('No data found in file');
      }

      // If replacing, delete existing parts from this file
      if (replaceExisting) {
        await Part.deleteSupplierParts(supplier._id, { fileName: filename });
      }

      // Map and validate rows
      const validParts = [];
      const errors = [];

      rows.forEach((row, index) => {
        try {
          const part = this.mapToPart(row, columnMapping);
          
          if (!part.partNumber) {
            errors.push({ row: index + 2, error: 'Missing part number' });
            return;
          }

          // Set defaults
          part.currency = part.currency || 'AED';
          part.quantity = part.quantity || 0;
          part.price = part.price || 0;

          validParts.push(part);
        } catch (err) {
          errors.push({ row: index + 2, error: err.message });
        }
      });

      if (validParts.length === 0) {
        throw new Error('No valid parts found in file. Check column mapping.');
      }

      // Import parts
      const result = await Part.bulkImportSupplierParts(validParts, {
        supplierId: supplier._id,
        supplierName: supplier.companyName,
        supplierCode: supplier.companyCode,
        fileName: filename
      });

      // Index to Elasticsearch
      try {
        await this.indexSupplierParts(supplier._id, filename);
      } catch (esErr) {
        logger.error('Elasticsearch indexing failed:', esErr.message);
      }

      // Audit log
      await AuditLog.log({
        actor: { 
          type: 'supplier', 
          id: supplier._id, 
          name: supplier.contactName,
          email: supplier.email 
        },
        action: 'parts.import',
        resource: { 
          type: 'parts', 
          name: filename 
        },
        supplier: supplier._id,
        status: 'success',
        details: {
          filename,
          totalRows: rows.length,
          imported: result.inserted,
          errors: errors.length,
          duration: Date.now() - startTime
        }
      });

      return {
        success: true,
        filename,
        totalRows: rows.length,
        imported: result.inserted,
        errors,
        headers,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Import error:', error);
      
      await AuditLog.log({
        actor: { 
          type: 'supplier', 
          id: supplier._id, 
          name: supplier.contactName 
        },
        action: 'parts.import',
        resource: { type: 'parts', name: filename },
        supplier: supplier._id,
        status: 'failure',
        details: { error: error.message }
      });

      throw error;
    }
  }

  /**
   * Get supplier parts with pagination
   */
  async getParts(supplierId, options = {}) {
    return Part.getSupplierParts(supplierId, options);
  }

  /**
   * Get supplier stats
   */
  async getStats(supplierId) {
    return Part.getSupplierStats(supplierId);
  }

  /**
   * Get single part
   */
  async getPart(supplierId, partId) {
    const part = await Part.findOne({
      _id: partId,
      'source.type': 'supplier_upload',
      'source.supplierId': supplierId
    }).lean();

    if (!part) throw new Error('Part not found');
    return part;
  }

  /**
   * Update a part
   */
  async updatePart(supplier, partId, updates) {
    const part = await Part.updateSupplierPart(partId, supplier._id, updates, supplier._id);

    // Update in Elasticsearch
    try {
      await elasticsearchService.queueDocument({
        _id: part._id,
        partNumber: part.partNumber,
        description: part.description,
        brand: part.brand,
        supplier: part.supplier || supplier.companyName,
        price: part.price,
        currency: part.currency,
        quantity: part.quantity,
        stock: part.stock,
        weight: part.weight,
        deliveryDays: part.deliveryDays,
        category: part.category,
        sourceType: 'supplier_upload',
        sourceSupplierId: supplier._id.toString(),
        sourceSupplierName: supplier.companyName,
        fileName: part.fileName,
        importedAt: part.importedAt,
        updatedAt: new Date()
      });
    } catch (err) {
      logger.error('ES update error:', err.message);
    }

    // Audit log
    await AuditLog.log({
      actor: { 
        type: 'supplier', 
        id: supplier._id, 
        name: supplier.contactName 
      },
      action: 'parts.update',
      resource: { type: 'part', id: partId, name: part.partNumber },
      supplier: supplier._id,
      status: 'success',
      changes: updates
    });

    return part;
  }

  /**
   * Bulk update parts
   */
  async bulkUpdateParts(supplier, partIds, updates) {
    const updateResult = await Part.updateMany(
      {
        _id: { $in: partIds },
        'source.type': 'supplier_upload',
        'source.supplierId': supplier._id
      },
      {
        $set: {
          ...updates,
          lastUpdated: new Date(),
          lastModifiedBy: supplier._id
        }
      }
    );

    // Re-index affected parts
    try {
      const parts = await Part.find({ _id: { $in: partIds } }).lean();
      for (const part of parts) {
        await elasticsearchService.queueDocument({
          _id: part._id,
          partNumber: part.partNumber,
          description: part.description,
          brand: part.brand,
          supplier: part.supplier || supplier.companyName,
          price: part.price,
          currency: part.currency,
          quantity: part.quantity,
          stock: part.stock,
          sourceType: 'supplier_upload',
          sourceSupplierId: supplier._id.toString(),
          updatedAt: new Date()
        });
      }
    } catch (err) {
      logger.error('ES bulk update error:', err.message);
    }

    await AuditLog.log({
      actor: { type: 'supplier', id: supplier._id, name: supplier.contactName },
      action: 'parts.bulk_update',
      resource: { type: 'parts', name: `${partIds.length} parts` },
      supplier: supplier._id,
      status: 'success',
      details: { count: updateResult.modifiedCount, updates }
    });

    return { updated: updateResult.modifiedCount };
  }

  /**
   * Delete parts
   */
  async deleteParts(supplier, options = {}) {
    const { partIds, fileName } = options;
    
    const deletedCount = await Part.deleteSupplierParts(supplier._id, { partIds, fileName });

    // Remove from Elasticsearch
    try {
      if (partIds && partIds.length) {
        for (const id of partIds) {
          await elasticsearchService.deletePart(id);
        }
      }
    } catch (err) {
      logger.error('ES delete error:', err.message);
    }

    await AuditLog.log({
      actor: { type: 'supplier', id: supplier._id, name: supplier.contactName },
      action: 'parts.delete',
      resource: { type: 'parts', name: fileName || `${partIds?.length || 0} parts` },
      supplier: supplier._id,
      status: 'success',
      details: { deletedCount }
    });

    return { deleted: deletedCount };
  }

  /**
   * Index supplier parts to Elasticsearch
   */
  async indexSupplierParts(supplierId, fileName = null) {
    const query = {
      'source.type': 'supplier_upload',
      'source.supplierId': supplierId
    };
    if (fileName) query.fileName = fileName;

    const parts = await Part.find(query).lean();
    
    if (parts.length === 0) return { indexed: 0 };

    const batchSize = 1000;
    let indexed = 0;

    for (let i = 0; i < parts.length; i += batchSize) {
      const batch = parts.slice(i, i + batchSize);
      
      for (const part of batch) {
        try {
          await elasticsearchService.queueDocument({
            _id: part._id,
            partNumber: part.partNumber,
            description: part.description,
            brand: part.brand,
            supplier: part.supplier || part.source?.supplierName,
            price: part.price,
            currency: part.currency,
            quantity: part.quantity,
            stock: part.stock,
            weight: part.weight,
            deliveryDays: part.deliveryDays,
            category: part.category,
            sourceType: 'supplier_upload',
            sourceSupplierId: supplierId.toString(),
            sourceSupplierName: part.source?.supplierName,
            fileName: part.fileName,
            importedAt: part.importedAt,
            createdAt: part.createdAt
          });
          indexed++;
        } catch (err) {
          logger.error(`ES index error for ${part._id}:`, err.message);
        }
      }
    }

    return { indexed };
  }

  /**
   * Export parts to Excel
   */
  async exportToExcel(supplierId, options = {}) {
    const { fileName } = options;
    
    const query = {
      'source.type': 'supplier_upload',
      'source.supplierId': supplierId
    };
    if (fileName) query.fileName = fileName;

    const parts = await Part.find(query).lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Parts');

    // Define columns
    worksheet.columns = [
      { header: 'Part Number', key: 'partNumber', width: 20 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Brand', key: 'brand', width: 15 },
      { header: 'Price', key: 'price', width: 12 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Stock Status', key: 'stock', width: 12 },
      { header: 'Weight', key: 'weight', width: 10 },
      { header: 'Delivery Days', key: 'deliveryDays', width: 12 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Import File', key: 'fileName', width: 25 },
      { header: 'Last Updated', key: 'lastUpdated', width: 20 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0EA5E9' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data
    parts.forEach(part => {
      worksheet.addRow({
        partNumber: part.partNumber,
        description: part.description,
        brand: part.brand,
        price: part.price,
        currency: part.currency,
        quantity: part.quantity,
        stock: part.stock,
        weight: part.weight,
        deliveryDays: part.deliveryDays,
        category: part.category,
        fileName: part.fileName,
        lastUpdated: part.lastUpdated ? new Date(part.lastUpdated).toISOString() : ''
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer, count: parts.length };
  }

  /**
   * Get preview of file data (first N rows)
   */
  async previewFile(fileBuffer, filename, limit = 10) {
    const { headers, rows } = await this.parseFile(fileBuffer, filename);
    
    return {
      headers,
      preview: rows.slice(0, limit),
      totalRows: rows.length
    };
  }

  /**
   * Get import files (distinct fileNames)
   */
  async getImportFiles(supplierId) {
    // Convert supplierId to ObjectId for aggregation
    const supplierObjectId = new mongoose.Types.ObjectId(supplierId);
    
    const files = await Part.aggregate([
      { 
        $match: { 
          'source.type': 'supplier_upload',
          'source.supplierId': supplierObjectId 
        } 
      },
      {
        $group: {
          _id: '$fileName',
          count: { $sum: 1 },
          importedAt: { $min: '$importedAt' },
          lastUpdated: { $max: '$lastUpdated' }
        }
      },
      { $sort: { importedAt: -1 } }
    ]);

    return files.map(f => ({
      fileName: f._id,
      partsCount: f.count,
      importedAt: f.importedAt,
      lastUpdated: f.lastUpdated
    }));
  }
}

module.exports = new SupplierPartsService();
