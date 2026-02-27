/**
 * Supplier Data Import Service
 * Handles importing data from Excel and CSV files
 * Supports validation, mapping, and batch processing
 */
const ExcelJS = require('exceljs');
const csv = require('csv-parser');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
const DataTable = require('../models/DataTable');
const DataRecord = require('../models/DataRecord');
const AuditLog = require('../models/AuditLog');
const supplierDataService = require('./supplierDataService');
const logger = require('../utils/logger');

class SupplierDataImportService {
  constructor() {
    this.batchSize = 500;
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.supportedFormats = ['csv', 'xlsx', 'xls'];
  }

  /**
   * Detect file format from buffer or filename
   */
  detectFormat(buffer, filename = '') {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    
    if (this.supportedFormats.includes(ext)) {
      return ext === 'xls' ? 'xlsx' : ext;
    }
    
    // Try to detect from magic bytes
    if (buffer && buffer.length >= 4) {
      // XLSX (ZIP format)
      if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
        return 'xlsx';
      }
      // Check for CSV (text with commas or semicolons)
      const sample = buffer.slice(0, 1000).toString('utf-8');
      if (/^[^,;\n\r]+[,;]/.test(sample)) {
        return 'csv';
      }
    }
    
    throw new Error('Unable to detect file format. Supported formats: CSV, XLSX');
  }

  /**
   * Parse CSV buffer to records
   */
  async parseCSV(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const { delimiter, encoding = 'utf-8', skipRows = 0 } = options;
      
      const results = [];
      let headers = null;
      let rowIndex = 0;
      
      // Detect delimiter if not specified
      const bufferStr = buffer.toString(encoding);
      const firstLine = bufferStr.split('\n')[0] || '';
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;
      const separator = delimiter || (semicolonCount > commaCount ? ';' : ',');

      const stream = Readable.from(buffer);
      
      stream
        .pipe(csv({
          separator,
          skipLines: skipRows,
          mapHeaders: ({ header }) => header.trim().replace(/^["']|["']$/g, ''),
        }))
        .on('data', (data) => {
          if (!headers) {
            headers = Object.keys(data);
          }
          
          // Clean up values
          const cleanedData = {};
          for (const [key, value] of Object.entries(data)) {
            cleanedData[key] = value !== undefined && value !== null 
              ? String(value).replace(/^["']|["']$/g, '').trim()
              : '';
          }
          
          results.push({
            rowIndex: rowIndex++,
            data: cleanedData,
          });
        })
        .on('end', () => {
          resolve({ headers, records: results, totalRows: results.length });
        })
        .on('error', reject);
    });
  }

  /**
   * Parse XLSX buffer to records
   */
  async parseXLSX(buffer, options = {}) {
    const { sheetName, sheetIndex = 0, skipRows = 0 } = options;
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    // Get the target worksheet
    let worksheet;
    if (sheetName) {
      worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        throw new Error(`Worksheet "${sheetName}" not found`);
      }
    } else {
      worksheet = workbook.worksheets[sheetIndex];
      if (!worksheet) {
        throw new Error('No worksheets found in file');
      }
    }

    const results = [];
    let headers = [];
    let headerRowIndex = 1 + skipRows;

    // Get headers from first row (after skip)
    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.value 
        ? String(cell.value).trim() 
        : `Column${colNumber}`;
    });

    // Parse data rows
    let rowIndex = 0;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIndex) return; // Skip header and skipRows
      
      const data = {};
      let hasData = false;
      
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (!header) return;
        
        let value = cell.value;
        
        // Handle different cell types
        if (value && typeof value === 'object') {
          if (value.result !== undefined) {
            // Formula cell
            value = value.result;
          } else if (value.richText) {
            // Rich text
            value = value.richText.map(rt => rt.text).join('');
          } else if (value instanceof Date) {
            value = value.toISOString();
          }
        }
        
        if (value !== null && value !== undefined && value !== '') {
          hasData = true;
        }
        
        data[header] = value !== null && value !== undefined ? String(value).trim() : '';
      });
      
      if (hasData) {
        results.push({
          rowIndex: rowIndex++,
          data,
        });
      }
    });

    return {
      headers: headers.filter(Boolean),
      records: results,
      totalRows: results.length,
      sheetName: worksheet.name,
    };
  }

  /**
   * Parse file buffer based on format
   */
  async parseFile(buffer, options = {}) {
    const format = options.format || this.detectFormat(buffer, options.filename);
    
    switch (format) {
      case 'csv':
        return this.parseCSV(buffer, options);
      case 'xlsx':
      case 'xls':
        return this.parseXLSX(buffer, options);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Auto-map source columns to table columns
   */
  autoMapColumns(sourceHeaders, tableColumns) {
    const mapping = {};
    const unmapped = [];
    
    for (const header of sourceHeaders) {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Try exact match on key
      let match = tableColumns.find(col => col.key === header);
      
      // Try exact match on name
      if (!match) {
        match = tableColumns.find(col => col.name.toLowerCase() === header.toLowerCase());
      }
      
      // Try normalized match
      if (!match) {
        match = tableColumns.find(col => {
          const normalizedColName = col.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedColKey = col.key.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedColName === normalizedHeader || normalizedColKey === normalizedHeader;
        });
      }
      
      // Try fuzzy match (contains)
      if (!match) {
        match = tableColumns.find(col => {
          const normalizedColName = col.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedColName.includes(normalizedHeader) || normalizedHeader.includes(normalizedColName);
        });
      }
      
      if (match) {
        mapping[header] = match.key;
      } else {
        unmapped.push(header);
      }
    }
    
    return { mapping, unmapped };
  }

  /**
   * Apply column mapping to records
   */
  applyMapping(records, mapping) {
    return records.map(record => {
      const mappedData = {};
      for (const [sourceKey, targetKey] of Object.entries(mapping)) {
        if (record.data[sourceKey] !== undefined) {
          mappedData[targetKey] = record.data[sourceKey];
        }
      }
      return {
        ...record,
        data: mappedData,
      };
    });
  }

  /**
   * Preview import without saving
   */
  async previewImport({
    tableId,
    buffer,
    filename,
    options = {},
    columnMapping = null,
    limit = 10,
  }) {
    const table = await DataTable.findById(tableId);
    if (!table) throw new Error('Table not found');

    // Parse file
    const parsed = await this.parseFile(buffer, { ...options, filename });
    
    // Auto-map if no mapping provided
    const mapping = columnMapping || this.autoMapColumns(parsed.headers, table.columns).mapping;
    
    // Apply mapping to preview records
    const previewRecords = this.applyMapping(parsed.records.slice(0, limit), mapping);
    
    // Validate preview records
    const validationResults = previewRecords.map(record => {
      const validation = table.validateRecord(record.data);
      return {
        rowIndex: record.rowIndex,
        data: record.data,
        valid: validation.valid,
        errors: validation.errors,
      };
    });

    return {
      headers: parsed.headers,
      totalRows: parsed.totalRows,
      sheetName: parsed.sheetName,
      columnMapping: mapping,
      unmappedColumns: this.autoMapColumns(parsed.headers, table.columns).unmapped,
      tableColumns: table.columns.map(c => ({ key: c.key, name: c.name, type: c.type, required: c.required })),
      preview: validationResults,
      validCount: validationResults.filter(r => r.valid).length,
      invalidCount: validationResults.filter(r => !r.valid).length,
    };
  }

  /**
   * Import data into table
   */
  async importData({
    tableId,
    buffer,
    filename,
    options = {},
    columnMapping,
    importedBy,
    req,
    mode = 'append', // 'append', 'replace', 'update'
    updateKeyColumn = null,
    skipDuplicates = true,
    validateAll = false,
  }) {
    const startTime = Date.now();
    const correlationId = `import_${Date.now()}`;
    
    const table = await DataTable.findById(tableId);
    if (!table) throw new Error('Table not found');
    if (table.status !== 'active') throw new Error('Table is not active');

    // Update table status
    table.status = 'importing';
    await table.save();

    const results = {
      success: [],
      failed: [],
      skipped: [],
      updated: [],
    };

    try {
      // Parse file
      const parsed = await this.parseFile(buffer, { ...options, filename });
      
      // Use provided mapping or auto-map
      const mapping = columnMapping || this.autoMapColumns(parsed.headers, table.columns).mapping;
      
      // Apply mapping
      const mappedRecords = this.applyMapping(parsed.records, mapping);

      // Pre-validation if requested
      if (validateAll) {
        for (const record of mappedRecords) {
          const validation = table.validateRecord(record.data);
          if (!validation.valid) {
            results.failed.push({
              rowIndex: record.rowIndex,
              errors: validation.errors,
            });
          }
        }
        
        if (results.failed.length > 0 && results.failed.length === mappedRecords.length) {
          throw new Error(`All ${mappedRecords.length} records failed validation`);
        }
      }

      // Handle replace mode - delete existing records first
      if (mode === 'replace') {
        await DataRecord.deleteMany({ table: tableId });
        await DataTable.updateOne({ _id: tableId }, { $set: { 'stats.recordCount': 0 } });
      }

      // Process records in batches
      const recordsToProcess = validateAll 
        ? mappedRecords.filter(r => !results.failed.find(f => f.rowIndex === r.rowIndex))
        : mappedRecords;

      if (mode === 'update' && updateKeyColumn) {
        // Update mode - find and update existing records
        for (const record of recordsToProcess) {
          try {
            const keyValue = record.data[updateKeyColumn];
            if (!keyValue) {
              results.skipped.push({ rowIndex: record.rowIndex, reason: 'missing_key' });
              continue;
            }

            const existing = await DataRecord.findOne({
              table: tableId,
              [`data.${updateKeyColumn}`]: keyValue,
              status: 'active',
            });

            if (existing) {
              // Update existing record
              const validation = table.validateRecord({ ...existing.data, ...record.data });
              if (!validation.valid) {
                results.failed.push({ rowIndex: record.rowIndex, errors: validation.errors });
                continue;
              }

              existing._previousData = { ...existing.data };
              existing.data = table.castRecord({ ...existing.data, ...record.data });
              existing.updatedBy = importedBy?._id || importedBy;
              await existing.save();
              results.updated.push({ rowIndex: record.rowIndex, id: existing._id });
            } else {
              // Create new record
              const createResult = await this.createRecordFromImport(table, record, importedBy, skipDuplicates);
              if (createResult.success) {
                results.success.push({ rowIndex: record.rowIndex, id: createResult.id });
              } else if (createResult.skipped) {
                results.skipped.push({ rowIndex: record.rowIndex, reason: createResult.reason });
              } else {
                results.failed.push({ rowIndex: record.rowIndex, errors: createResult.errors });
              }
            }
          } catch (error) {
            results.failed.push({ rowIndex: record.rowIndex, errors: [{ message: error.message }] });
          }
        }
      } else {
        // Append mode - bulk create
        const createResults = await supplierDataService.bulkCreateRecords({
          tableId,
          records: recordsToProcess.map(r => r.data),
          createdBy: importedBy,
          req,
          skipDuplicates,
        });

        results.success = createResults.success;
        results.failed.push(...createResults.failed);
        results.skipped.push(...createResults.skipped);
      }

      // Update table stats
      await DataTable.updateOne(
        { _id: tableId },
        { 
          $set: { 
            status: 'active',
            'stats.lastImportAt': new Date(),
          }
        }
      );

      // Audit log
      await AuditLog.logDataTransfer({
        action: 'import.complete',
        table,
        supplier: table.supplier,
        actor: supplierDataService.buildActorInfo(importedBy),
        fileInfo: {
          filename,
          format: options.format || this.detectFormat(buffer, filename),
          rows: parsed.totalRows,
          size: buffer.length,
        },
        request: supplierDataService.buildRequestInfo(req),
        status: results.failed.length > 0 ? 'partial' : 'success',
        duration: Date.now() - startTime,
        correlationId,
      });

      return {
        success: true,
        correlationId,
        totalRows: parsed.totalRows,
        summary: {
          created: results.success.length,
          updated: results.updated.length,
          skipped: results.skipped.length,
          failed: results.failed.length,
        },
        failed: results.failed.slice(0, 100), // Limit error details
        duration: Date.now() - startTime,
      };
    } catch (error) {
      // Reset table status
      await DataTable.updateOne({ _id: tableId }, { $set: { status: 'active' } });

      // Audit log failure
      await AuditLog.logDataTransfer({
        action: 'import.failed',
        table,
        supplier: table.supplier,
        actor: supplierDataService.buildActorInfo(importedBy),
        fileInfo: { filename },
        request: supplierDataService.buildRequestInfo(req),
        status: 'failure',
        error: { code: error.code, message: error.message },
        duration: Date.now() - startTime,
        correlationId,
      });

      throw error;
    }
  }

  /**
   * Helper to create a single record from import
   */
  async createRecordFromImport(table, record, createdBy, skipDuplicates) {
    try {
      const validation = table.validateRecord(record.data);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      const castedData = table.castRecord(record.data);
      const rowKey = DataRecord.generateRowKey(castedData, table.primaryKey);

      const existing = await DataRecord.findOne({
        table: table._id,
        rowKey,
        status: 'active',
      });

      if (existing) {
        if (skipDuplicates) {
          return { success: false, skipped: true, reason: 'duplicate' };
        }
        return { success: false, errors: [{ message: 'Duplicate key' }] };
      }

      const newRecord = new DataRecord({
        table: table._id,
        supplier: table.supplier,
        data: castedData,
        rowKey,
        createdBy: createdBy?._id || createdBy,
        updatedBy: createdBy?._id || createdBy,
        version: 1,
        versionHistory: [{
          version: 1,
          data: castedData,
          changedBy: createdBy?._id || createdBy,
          changedAt: new Date(),
          changeType: 'import',
          changedFields: Object.keys(castedData),
        }],
      });

      await newRecord.save();
      return { success: true, id: newRecord._id };
    } catch (error) {
      return { success: false, errors: [{ message: error.message }] };
    }
  }

  /**
   * Get list of worksheets in an Excel file
   */
  async getWorksheets(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    return workbook.worksheets.map((ws, index) => ({
      index,
      name: ws.name,
      rowCount: ws.rowCount,
      columnCount: ws.columnCount,
    }));
  }
}

module.exports = new SupplierDataImportService();
