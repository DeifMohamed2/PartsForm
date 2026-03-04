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
   * Parse CSV file with auto-detection of delimiter
   */
  async parseCSV(buffer) {
    return new Promise((resolve, reject) => {
      const content = buffer.toString('utf8');
      
      // Auto-detect delimiter by checking first line
      const firstLine = content.split('\n')[0] || '';
      let delimiter = ',';
      
      // Count potential delimiters in first line
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;
      
      if (semicolonCount > commaCount && semicolonCount > tabCount) {
        delimiter = ';';
      } else if (tabCount > commaCount && tabCount > semicolonCount) {
        delimiter = '\t';
      }
      
      logger.info(`CSV delimiter auto-detected: "${delimiter === '\t' ? 'TAB' : delimiter}"`);
      
      const records = [];
      const parser = csv.parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        relax_quotes: true,
        delimiter: delimiter,
        quote: '"',
        escape: '"',
        skip_records_with_error: true,
        on_record: (record) => {
          // Clean up any special Excel formatting like ="value"
          const cleaned = {};
          for (const [key, value] of Object.entries(record)) {
            let cleanValue = value;
            if (typeof cleanValue === 'string') {
              // Remove Excel formula wrapper ="..."
              cleanValue = cleanValue.replace(/^="?(.*)"?$/g, '$1');
              // Remove leading apostrophes (Excel text prefix)
              cleanValue = cleanValue.replace(/^'/, '');
            }
            cleaned[key] = cleanValue;
          }
          return cleaned;
        }
      });

      parser.on('data', (row) => records.push(row));
      parser.on('error', (err) => {
        logger.warn('CSV parse warning:', err.message);
        // Don't reject on parse errors, try to continue
      });
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
   * Clean Excel formula wrapper from values like ="3/6" or =""3/6""
   */
  cleanExcelValue(value) {
    if (!value || typeof value !== 'string') return value;
    
    let cleaned = value.trim();
    
    // Remove Excel formula wrapper: ="value" or =""value"" or =value
    // Pattern handles: ="3/6" or =""3/6"" or ="AB4" etc
    cleaned = cleaned
      .replace(/^="*(.+?)"*$/g, '$1')  // Remove ="..." wrapper
      .replace(/^""(.+?)""$/g, '$1')    // Remove double quotes
      .replace(/^"(.+?)"$/g, '$1')      // Remove single quotes
      .replace(/^'/g, '');              // Remove leading apostrophe (Excel text prefix)
    
    return cleaned.trim();
  }

  /**
   * Parse delivery time - preserves original format like "3/6" while extracting min days
   */
  parseDeliveryTime(value) {
    const cleaned = this.cleanExcelValue(value);
    if (!cleaned) return { deliveryTime: '', deliveryDays: '' };
    return { deliveryTime: cleaned, deliveryDays: cleaned };
  }

  /**
   * Map raw data to Part schema
   */
  mapToPart(rawRow, columnMapping = {}) {
    // Default column mapping (common variations)
    const defaultMapping = {
      partNumber: ['part_number', 'partnumber', 'part', 'pn', 'part_no', 'part no', 'part#', 'sku', 'item_number', 'item number', 'item', 'code', 'vendor_code', 'vendor code', 'article', 'article_number'],
      description: ['description', 'desc', 'name', 'title', 'product_name', 'product name', 'item_description', 'item description'],
      brand: ['brand', 'manufacturer', 'mfr', 'make', 'oem'],
      supplier: ['supplier', 'seller', 'source', 'vendor'],
      price: ['price', 'unit_price', 'unit price', 'cost', 'rate', 'amount', 'selling_price', 'selling price', 'price_aed', 'price aed'],
      quantity: ['quantity', 'qty', 'available', 'inventory', 'on_hand', 'on hand', 'stock_qty'],
      currency: ['currency', 'curr', 'ccy'],
      weight: ['weight', 'wt', 'mass', 'kg', 'lbs'],
      volume: ['volume', 'vol', 'cbm', 'cubic'],
      deliveryTime: ['delivery', 'delivery_days', 'delivery days', 'lead_time', 'lead time', 'days', 'eta'],
      category: ['category', 'cat', 'type', 'group', 'classification'],
      minOrderQty: ['min_order_qty', 'min order qty', 'moq', 'minimum_qty', 'min_qty', 'min_lot', 'min lot', 'minlot'],
      stockCode: ['stock', 'stock_code', 'stock code', 'warehouse', 'location', 'wh']
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
        // Special handling for delivery time - preserves "3/6" format
        if (field === 'deliveryTime') {
          const { deliveryTime, deliveryDays } = this.parseDeliveryTime(value);
          if (deliveryTime) part.deliveryTime = deliveryTime;
          if (deliveryDays) part.deliveryDays = deliveryDays;
        }
        // Special handling for stockCode - clean Excel wrapper
        else if (field === 'stockCode') {
          const cleaned = this.cleanExcelValue(value);
          if (cleaned) part.stockCode = cleaned;
        }
        // Numeric fields
        else if (['price', 'quantity', 'weight', 'volume', 'minOrderQty'].includes(field)) {
          let strValue = this.cleanExcelValue(String(value));
          // Handle European decimal format (comma as decimal separator)
          // If there's a comma but no period, replace comma with period
          if (strValue.includes(',') && !strValue.includes('.')) {
            strValue = strValue.replace(',', '.');
          }
          const numValue = parseFloat(strValue.replace(/[^0-9.-]/g, ''));
          if (!isNaN(numValue)) part[field] = numValue;
        }
        // String fields
        else {
          part[field] = this.cleanExcelValue(String(value));
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
        // IMPORTANT: Get document IDs and partNumbers BEFORE deleting from MongoDB
        const partsToDelete = await Part.find({
          'source.type': 'supplier_upload',
          'source.supplierId': supplier._id,
          fileName: filename
        }, '_id partNumber').lean();
        const docIdsToDelete = partsToDelete.map((p) => p._id);
        const partNumbersToDelete = partsToDelete.map((p) => p.partNumber);
        
        // Delete from MongoDB
        await Part.deleteSupplierParts(supplier._id, { fileName: filename });
        // Delete from Elasticsearch (partNumbers catches orphan duplicates)
        await elasticsearchService.deleteBySupplierFile(supplier._id, filename, docIdsToDelete, supplier.companyName || supplier.name, partNumbersToDelete);
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
        stockCode: part.stockCode,
        weight: part.weight,
        volume: part.volume,
        deliveryDays: part.deliveryDays,
        deliveryTime: part.deliveryTime,
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
          stockCode: part.stockCode,
          deliveryDays: part.deliveryDays,
          deliveryTime: part.deliveryTime,
          weight: part.weight,
          volume: part.volume,
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
    
    // IMPORTANT: Get document IDs and partNumbers BEFORE deleting from MongoDB
    // partNumbers used to delete ALL orphan duplicates from ES (fixes duplicate search results)
    let docIdsToDelete = [];
    let partNumbersToDelete = [];
    if (partIds && partIds.length) {
      docIdsToDelete = partIds;
      const parts = await Part.find({ _id: { $in: partIds } }, 'partNumber').lean();
      partNumbersToDelete = parts.map((p) => p.partNumber);
    } else if (fileName) {
      const partsToDelete = await Part.find({
        'source.type': 'supplier_upload',
        'source.supplierId': supplier._id,
        fileName: fileName
      }, '_id partNumber').lean();
      docIdsToDelete = partsToDelete.map((p) => p._id);
      partNumbersToDelete = partsToDelete.map((p) => p.partNumber);
    }

    // Delete from MongoDB
    const deletedCount = await Part.deleteSupplierParts(supplier._id, { partIds, fileName });

    // Remove from Elasticsearch (pass doc IDs, partNumbers for full cleanup including orphans)
    try {
      if (fileName) {
        await elasticsearchService.deleteBySupplierFile(supplier._id, fileName, docIdsToDelete, supplier.companyName || supplier.name, partNumbersToDelete);
      } else if (partIds && partIds.length) {
        // Delete by IDs and partNumbers (catches orphan duplicates)
        await elasticsearchService.deleteBySupplierFile(supplier._id, null, docIdsToDelete, supplier.companyName || supplier.name, partNumbersToDelete);
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
   * Index supplier parts to Elasticsearch - uses bulkIndex directly for immediate indexing
   * (like sync process) so parts appear in search right away
   */
  async indexSupplierParts(supplierId, fileName = null) {
    const query = {
      'source.type': 'supplier_upload',
      'source.supplierId': supplierId
    };
    if (fileName) query.fileName = fileName;

    const parts = await Part.find(query).lean();
    if (parts.length === 0) return { indexed: 0 };

    const supplierName = parts[0]?.source?.supplierName || '';
    const BATCH_SIZE = 5000;
    let totalIndexed = 0;

    for (let i = 0; i < parts.length; i += BATCH_SIZE) {
      const batch = parts.slice(i, i + BATCH_SIZE);
      const docs = batch.map((part) => ({
        _id: part._id,
        partNumber: part.partNumber,
        description: part.description,
        brand: part.brand,
        supplier: part.supplier || part.source?.supplierName || supplierName,
        price: part.price,
        currency: part.currency,
        quantity: part.quantity,
        minOrderQty: part.minOrderQty ?? 1,
        stock: part.stock,
        stockCode: part.stockCode,
        weight: part.weight,
        volume: part.volume,
        deliveryDays: part.deliveryDays,
        deliveryTime: part.deliveryTime,
        category: part.category,
        sourceType: 'supplier_upload',
        sourceSupplierId: supplierId.toString(),
        sourceSupplierName: part.source?.supplierName || supplierName,
        fileName: part.fileName,
        importedAt: part.importedAt,
        createdAt: part.createdAt,
      }));

      const result = await elasticsearchService.bulkIndex(docs);
      totalIndexed += result.indexed || 0;
    }

    elasticsearchService.invalidateDocCountCache();
    await elasticsearchService.refreshIndex();
    return { indexed: totalIndexed };
  }

  /**
   * Export parts to Excel
   */
  async exportToExcel(supplierId, options = {}) {
    const { fileNames, fileName } = options;
    
    const query = {
      'source.type': 'supplier_upload',
      'source.supplierId': supplierId
    };
    
    // Support both multiple fileNames and single fileName
    if (fileNames && Array.isArray(fileNames) && fileNames.length > 0) {
      query.fileName = { $in: fileNames };
    } else if (fileName) {
      query.fileName = fileName;
    }

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

  /**
   * Get distinct brands for supplier
   */
  async getSupplierBrands(supplierId) {
    const supplierObjectId = new mongoose.Types.ObjectId(supplierId);
    
    const brands = await Part.aggregate([
      { 
        $match: { 
          'source.type': 'supplier_upload',
          'source.supplierId': supplierObjectId,
          brand: { $exists: true, $ne: '' }
        } 
      },
      {
        $group: {
          _id: '$brand',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return brands.map(b => ({
      brand: b._id,
      partsCount: b.count
    }));
  }

  /**
   * Delete parts by criteria
   */
  async deletePartsByCriteria(supplierId, criteria = {}) {
    const supplierObjectId = new mongoose.Types.ObjectId(supplierId);
    
    const filter = {
      'source.type': 'supplier_upload',
      'source.supplierId': supplierObjectId
    };

    if (criteria.brand) {
      filter.brand = criteria.brand;
    }
    if (criteria.fileName) {
      filter.fileName = criteria.fileName;
    }
    if (criteria.partIds && criteria.partIds.length > 0) {
      filter._id = { $in: criteria.partIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    // Get parts to delete for ES cleanup (need partNumber for orphan duplicate removal)
    const partsToDelete = await Part.find(filter).select('_id partNumber').lean();
    const docIdsToDelete = partsToDelete.map(p => p._id);
    const partNumbersToDelete = partsToDelete.map(p => p.partNumber);

    // Delete from MongoDB
    const result = await Part.deleteMany(filter);

    // Delete from Elasticsearch (use deleteBySupplierFile for full cleanup including orphans)
    if (docIdsToDelete.length > 0) {
      try {
        const supplier = await Supplier.findById(supplierId).select('companyName name').lean();
        const supplierName = supplier?.companyName || supplier?.name || '';
        await elasticsearchService.deleteBySupplierFile(supplierId, criteria.fileName || null, docIdsToDelete, supplierName, partNumbersToDelete);
      } catch (err) {
        logger.error('Error deleting from ES:', err);
      }
    }

    return { deleted: result.deletedCount };
  }

  /**
   * Get import summary for data management UI
   */
  async getImportSummary(supplierId) {
    const supplierObjectId = new mongoose.Types.ObjectId(supplierId);
    
    const summary = await Part.aggregate([
      { 
        $match: { 
          'source.type': 'supplier_upload',
          'source.supplierId': supplierObjectId 
        } 
      },
      {
        $facet: {
          byBrand: [
            { $group: { _id: '$brand', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
          ],
          byFile: [
            { $group: { 
              _id: '$fileName', 
              count: { $sum: 1 },
              lastImport: { $max: '$importedAt' }
            }},
            { $sort: { lastImport: -1 } }
          ],
          totals: [
            { $group: { 
              _id: null, 
              totalParts: { $sum: 1 },
              uniqueBrands: { $addToSet: '$brand' },
              uniqueFiles: { $addToSet: '$fileName' }
            }}
          ]
        }
      }
    ]);

    const result = summary[0];
    return {
      byBrand: result.byBrand.map(b => ({ brand: b._id || 'Unknown', count: b.count })),
      byFile: result.byFile.map(f => ({ fileName: f._id, count: f.count, lastImport: f.lastImport })),
      totalParts: result.totals[0]?.totalParts || 0,
      uniqueBrands: result.totals[0]?.uniqueBrands?.length || 0,
      uniqueFiles: result.totals[0]?.uniqueFiles?.length || 0
    };
  }
}
module.exports = new SupplierPartsService();
