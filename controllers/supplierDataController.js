/**
 * Supplier Data Controller
 * Handles all API endpoints for supplier data management
 * Supports table CRUD, record CRUD, import/export operations
 */
const supplierDataService = require('../services/supplierDataService');
const supplierDataImportService = require('../services/supplierDataImportService');
const sftpExportService = require('../services/sftpExportService');
const elasticsearchService = require('../services/elasticsearchService');
const DataTable = require('../models/DataTable');
const DataRecord = require('../models/DataRecord');
const DataExport = require('../models/DataExport');
const AuditLog = require('../models/AuditLog');
const Supplier = require('../models/Supplier');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

// FTP upload directory configuration
const FTP_BASE_DIR = process.env.FTP_BASE_DIR || path.join(process.cwd(), 'ftp-uploads');

/**
 * Save uploaded file to supplier's FTP directory
 */
async function saveToFtpDirectory(supplierId, fileBuffer, originalFilename) {
  try {
    // Get supplier info
    const supplier = await Supplier.findById(supplierId).lean();
    if (!supplier) {
      logger.warn('Could not find supplier for FTP save:', supplierId);
      return null;
    }

    // Use companyCode or create a folder name from supplier ID
    const folderName = supplier.companyCode || supplier.code || `supplier_${supplierId}`;
    const supplierDir = path.join(FTP_BASE_DIR, folderName);

    // Ensure directory exists
    await fsPromises.mkdir(supplierDir, { recursive: true });

    // Create timestamped filename to avoid overwrites
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext);
    const savedFilename = `${baseName}_${timestamp}${ext}`;
    const filePath = path.join(supplierDir, savedFilename);

    // Save the file
    await fsPromises.writeFile(filePath, fileBuffer);

    logger.info(`Saved upload to FTP: ${filePath}`);

    return {
      path: filePath,
      filename: savedFilename,
      directory: supplierDir,
    };
  } catch (error) {
    logger.error('Error saving to FTP directory:', error.message);
    return null;
  }
}

// ==================== TABLE OPERATIONS ====================

/**
 * Get all tables for the authenticated supplier
 */
const getTables = async (req, res) => {
  try {
    const supplier = req.supplier;
    const { status = 'active', includeStats = 'true' } = req.query;
    
    const tables = await supplierDataService.getTables({
      supplier: supplier.getEffectiveSupplierId(),
      status,
      includeStats: includeStats === 'true',
    });
    
    res.json({
      success: true,
      tables,
      count: tables.length,
    });
  } catch (error) {
    logger.error('Get tables error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get tables',
      error: error.message,
    });
  }
};

/**
 * Get a single table
 */
const getTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    
    const table = await supplierDataService.getTable({
      tableId,
      includeStats: true,
    });
    
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found',
      });
    }
    
    // Verify ownership
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    
    res.json({
      success: true,
      table,
    });
  } catch (error) {
    logger.error('Get table error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get table',
      error: error.message,
    });
  }
};

/**
 * Create a new table
 */
const createTable = async (req, res) => {
  try {
    const supplier = req.supplier;
    const { name, description, columns, settings } = req.body;
    
    if (!name || !columns || columns.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Table name and at least one column are required',
      });
    }
    
    const table = await supplierDataService.createTable({
      supplier: supplier.getEffectiveSupplierId(),
      name,
      description,
      columns,
      settings,
      createdBy: supplier,
      req,
    });
    
    res.status(201).json({
      success: true,
      message: 'Table created successfully',
      table,
    });
  } catch (error) {
    const errorMessage = error?.message || (typeof error === 'string' ? error : String(error));
    logger.error('Create table error:', errorMessage);
    res.status(errorMessage?.includes?.('limit') ? 403 : 500).json({
      success: false,
      message: errorMessage || 'Unknown error creating table',
    });
  }
};

/**
 * Update table metadata
 */
const updateTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { name, description, settings } = req.body;
    
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const updatedTable = await supplierDataService.updateTable({
      tableId,
      updates: { name, description, settings },
      updatedBy: req.supplier,
      req,
    });
    
    res.json({
      success: true,
      message: 'Table updated successfully',
      table: updatedTable,
    });
  } catch (error) {
    logger.error('Update table error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update table columns
 */
const updateTableColumns = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { columns } = req.body;
    
    if (!columns || columns.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one column is required',
      });
    }
    
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const updatedTable = await supplierDataService.updateTableColumns({
      tableId,
      columns,
      updatedBy: req.supplier,
      req,
    });
    
    res.json({
      success: true,
      message: 'Columns updated successfully',
      table: updatedTable,
    });
  } catch (error) {
    logger.error('Update columns error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Archive a table
 */
const archiveTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    await supplierDataService.archiveTable({
      tableId,
      archivedBy: req.supplier,
      req,
    });
    
    res.json({
      success: true,
      message: 'Table archived successfully',
    });
  } catch (error) {
    logger.error('Archive table error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete a table permanently
 */
const deleteTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Delete from Elasticsearch first
    const esDeleteResult = await elasticsearchService.deleteByTable(tableId);
    logger.info(`ES delete for table ${tableId}: ${esDeleteResult.deleted} docs removed`);
    
    const result = await supplierDataService.deleteTable({
      tableId,
      deletedBy: req.supplier,
      req,
    });
    
    res.json({
      success: true,
      message: 'Table deleted successfully',
      recordsDeleted: result.recordsDeleted,
      esRecordsDeleted: esDeleteResult.deleted,
    });
  } catch (error) {
    logger.error('Delete table error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== RECORD OPERATIONS ====================

/**
 * Get records for a table with pagination and filtering
 */
const getRecords = async (req, res) => {
  try {
    const { tableId } = req.params;
    const {
      page = 1,
      limit = 50,
      sortField = 'updatedAt',
      sortOrder = 'desc',
      status = 'active',
      search = '',
      ...filters
    } = req.query;
    
    // Verify table ownership
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Clean up filters
    const cleanFilters = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value && key !== 'sortField' && key !== 'sortOrder') {
        cleanFilters[key] = value;
      }
    }
    
    const result = await supplierDataService.getRecords({
      tableId,
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 1000),
      sort: { [sortField]: sortOrder === 'asc' ? 1 : -1 },
      filters: cleanFilters,
      search,
      status,
    });
    
    res.json({
      success: true,
      records: result.records,
      pagination: result.pagination,
      table: {
        id: table._id,
        name: table.name,
        columns: table.getSortedColumns(),
      },
    });
  } catch (error) {
    logger.error('Get records error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get a single record
 */
const getRecord = async (req, res) => {
  try {
    const { tableId, recordId } = req.params;
    
    const record = await supplierDataService.getRecord({ recordId });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    
    if (record.table.toString() !== tableId) {
      return res.status(400).json({ success: false, message: 'Record does not belong to this table' });
    }
    
    if (record.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    res.json({
      success: true,
      record,
    });
  } catch (error) {
    logger.error('Get record error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create a new record
 */
const createRecord = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { data } = req.body;
    
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Record data is required',
      });
    }
    
    // Verify table ownership
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const record = await supplierDataService.createRecord({
      tableId,
      data,
      createdBy: req.supplier,
      req,
    });
    
    res.status(201).json({
      success: true,
      message: 'Record created successfully',
      record,
    });
  } catch (error) {
    logger.error('Create record error:', error.message);
    
    if (error.validationErrors) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.validationErrors,
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update a record
 */
const updateRecord = async (req, res) => {
  try {
    const { tableId, recordId } = req.params;
    const { data, lockVersion } = req.body;
    
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Record data is required',
      });
    }
    
    if (lockVersion === undefined) {
      return res.status(400).json({
        success: false,
        message: 'lockVersion is required for concurrency control',
      });
    }
    
    // Verify record belongs to table and supplier
    const existingRecord = await DataRecord.findById(recordId);
    if (!existingRecord || existingRecord.table.toString() !== tableId) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    
    if (existingRecord.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const record = await supplierDataService.updateRecord({
      recordId,
      data,
      lockVersion,
      updatedBy: req.supplier,
      req,
    });
    
    res.json({
      success: true,
      message: 'Record updated successfully',
      record,
      newLockVersion: record.lockVersion,
    });
  } catch (error) {
    logger.error('Update record error:', error.message);
    
    if (error.code === 'CONCURRENT_MODIFICATION') {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: error.code,
        currentVersion: error.currentVersion,
      });
    }
    
    if (error.validationErrors) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.validationErrors,
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete a record
 */
const deleteRecord = async (req, res) => {
  try {
    const { tableId, recordId } = req.params;
    
    // Verify record belongs to table and supplier
    const existingRecord = await DataRecord.findById(recordId);
    if (!existingRecord || existingRecord.table.toString() !== tableId) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    
    if (existingRecord.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    await supplierDataService.deleteRecord({
      recordId,
      deletedBy: req.supplier,
      req,
    });
    
    res.json({
      success: true,
      message: 'Record deleted successfully',
    });
  } catch (error) {
    logger.error('Delete record error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Bulk create records
 */
const bulkCreateRecords = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { records, skipDuplicates = true } = req.body;
    
    if (!records || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Records array is required',
      });
    }
    
    // Verify table ownership
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const result = await supplierDataService.bulkCreateRecords({
      tableId,
      records,
      createdBy: req.supplier,
      req,
      skipDuplicates,
    });
    
    res.status(201).json({
      success: true,
      message: `Created ${result.success.length} records`,
      created: result.success.length,
      failed: result.failed.length,
      skipped: result.skipped.length,
      errors: result.failed.slice(0, 20), // Limit errors in response
    });
  } catch (error) {
    logger.error('Bulk create error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Bulk update records
 */
const bulkUpdateRecords = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { updates } = req.body;
    
    if (!updates || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required',
      });
    }
    
    // Verify table ownership
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const result = await supplierDataService.bulkUpdateRecords({
      updates,
      updatedBy: req.supplier,
      req,
    });
    
    res.json({
      success: true,
      message: `Updated ${result.success.length} records`,
      updated: result.success.length,
      failed: result.failed.length,
      errors: result.failed.slice(0, 20),
    });
  } catch (error) {
    logger.error('Bulk update error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Bulk delete records
 */
const bulkDeleteRecords = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { recordIds } = req.body;
    
    if (!recordIds || recordIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'recordIds array is required',
      });
    }
    
    // Verify table ownership
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const result = await supplierDataService.bulkDeleteRecords({
      tableId,
      recordIds,
      deletedBy: req.supplier,
      req,
    });
    
    res.json({
      success: true,
      message: `Deleted ${result.deleted} records`,
      deleted: result.deleted,
    });
  } catch (error) {
    logger.error('Bulk delete error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Restore a deleted record
 */
const restoreRecord = async (req, res) => {
  try {
    const { tableId, recordId } = req.params;
    
    const existingRecord = await DataRecord.findById(recordId);
    if (!existingRecord || existingRecord.table.toString() !== tableId) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    
    if (existingRecord.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const record = await supplierDataService.restoreRecord({
      recordId,
      restoredBy: req.supplier,
      req,
    });
    
    res.json({
      success: true,
      message: 'Record restored successfully',
      record,
    });
  } catch (error) {
    logger.error('Restore record error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Restore record to a previous version
 */
const restoreRecordVersion = async (req, res) => {
  try {
    const { tableId, recordId } = req.params;
    const { version } = req.body;
    
    if (!version) {
      return res.status(400).json({
        success: false,
        message: 'Version number is required',
      });
    }
    
    const existingRecord = await DataRecord.findById(recordId);
    if (!existingRecord || existingRecord.table.toString() !== tableId) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    
    if (existingRecord.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const record = await supplierDataService.restoreRecordVersion({
      recordId,
      version,
      restoredBy: req.supplier,
      req,
    });
    
    res.json({
      success: true,
      message: `Record restored to version ${version}`,
      record,
    });
  } catch (error) {
    logger.error('Restore version error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get record version history
 */
const getRecordHistory = async (req, res) => {
  try {
    const { tableId, recordId } = req.params;
    
    const record = await DataRecord.findById(recordId).select('table supplier versionHistory version lockVersion');
    if (!record || record.table.toString() !== tableId) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    
    if (record.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    res.json({
      success: true,
      currentVersion: record.version,
      lockVersion: record.lockVersion,
      history: record.versionHistory || [],
    });
  } catch (error) {
    logger.error('Get history error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== IMPORT/EXPORT OPERATIONS ====================

/**
 * Preview import from file
 */
const previewImport = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { columnMapping } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
      });
    }
    
    // Verify table ownership
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const preview = await supplierDataImportService.previewImport({
      tableId,
      buffer: req.file.buffer,
      filename: req.file.originalname,
      columnMapping,
    });
    
    res.json({
      success: true,
      preview,
    });
  } catch (error) {
    logger.error('Preview import error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Import data from file
 */
const importData = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { columnMapping, mode = 'append', updateKeyColumn, skipDuplicates = true } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
      });
    }
    
    // Verify table ownership
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const result = await supplierDataImportService.importData({
      tableId,
      buffer: req.file.buffer,
      filename: req.file.originalname,
      columnMapping: columnMapping ? JSON.parse(columnMapping) : null,
      importedBy: req.supplier,
      req,
      mode,
      updateKeyColumn,
      skipDuplicates: skipDuplicates === 'true' || skipDuplicates === true,
    });
    
    res.json({
      success: true,
      message: 'Import completed',
      ...result,
    });
  } catch (error) {
    logger.error('Import error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Smart AI-powered column type detection
 * Analyzes sample data to determine the best data type
 */
function detectColumnType(values) {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return 'text';
  
  const sampleSize = Math.min(nonEmpty.length, 100);
  const samples = nonEmpty.slice(0, sampleSize);
  
  let numberCount = 0;
  let integerCount = 0;
  let decimalCount = 0;
  let dateCount = 0;
  let booleanCount = 0;
  let emailCount = 0;
  let urlCount = 0;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const urlRegex = /^(https?:\/\/|www\.)/i;
  // Only match explicit date formats, NOT just numbers that Date.parse accepts
  const dateRegex = /^(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/;
  // Strict number regex - must be ONLY numbers, optional decimal, optional negative/leading sign
  // Supports European format with comma as decimal separator
  const strictNumberRegex = /^[+-]?\d+([.,]\d+)?$/;
  // Also support numbers with thousand separators
  const numberWithSeparatorsRegex = /^[+-]?[\d.,]+$/;
  const booleanValues = ['true', 'false', 'yes', 'no', 'y', 'n'];
  
  for (const val of samples) {
    const str = String(val).trim();
    const strLower = str.toLowerCase();
    
    // Check email first (most specific)
    if (emailRegex.test(str)) {
      emailCount++;
      continue;
    }
    
    // Check URL
    if (urlRegex.test(str)) {
      urlCount++;
      continue;
    }
    
    // Check boolean (only specific boolean words, NOT 0/1 which could be quantities)
    if (booleanValues.includes(strLower)) {
      booleanCount++;
      continue;
    }
    
    // Check date patterns - ONLY explicit date formats
    if (dateRegex.test(str)) {
      dateCount++;
      continue;
    }
    
    // Check number - STRICT validation: entire string must be numeric
    // Handle European format (comma as decimal) and thousand separators
    if (numberWithSeparatorsRegex.test(str)) {
      // Normalize: remove thousand separators, convert comma decimal to dot
      let numStr = str;
      
      // Detect format: if there's both comma and dot, figure out which is decimal
      const hasComma = str.includes(',');
      const hasDot = str.includes('.');
      
      if (hasComma && hasDot) {
        // If comma comes after dot, comma is decimal (unlikely but handle it)
        // If dot comes after comma, dot is decimal (e.g., "1,000.50")
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');
        if (lastDot > lastComma) {
          // Standard format: 1,000.50 - remove commas, keep dot
          numStr = str.replace(/,/g, '');
        } else {
          // European format: 1.000,50 - remove dots, convert comma
          numStr = str.replace(/\./g, '').replace(',', '.');
        }
      } else if (hasComma) {
        // Could be European decimal (1,5) or thousand separator (1,000)
        // If exactly 3 digits after comma, likely thousand separator
        const parts = str.split(',');
        if (parts.length === 2 && parts[1].length === 3 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
          // Likely thousand separator: 1,000
          numStr = str.replace(/,/g, '');
        } else {
          // Likely European decimal: 1,5 or 0,396
          numStr = str.replace(',', '.');
        }
      }
      // If only dot, it's either decimal or thousand separator - parseFloat handles it
      
      const num = parseFloat(numStr);
      if (!isNaN(num) && isFinite(num)) {
        numberCount++;
        // Check if integer (no decimal part after normalization)
        if (Number.isInteger(num)) {
          integerCount++;
        } else {
          decimalCount++;
        }
      }
    }
  }
  
  const threshold = sampleSize * 0.8; // 80% threshold
  
  // Determine type based on detection - order matters!
  if (emailCount >= threshold) return 'email';
  if (urlCount >= threshold) return 'url';
  // Only detect boolean if it's clearly boolean text (not 0/1 numbers)
  if (booleanCount >= threshold && numberCount < threshold * 0.5) return 'boolean';
  if (dateCount >= threshold) return 'date';
  // For numbers, check if mostly decimals or integers
  if (numberCount >= threshold) {
    if (decimalCount > integerCount) return 'decimal';
    return 'number'; // Use 'number' for integers too - more flexible
  }
  
  return 'text';
}

/**
 * Smart column key generator - handles any characters
 */
function generateSmartKey(name, index, existingKeys) {
  if (!name || typeof name !== 'string') {
    return `column_${index + 1}`;
  }
  
  // Common header name mappings for smart detection
  const smartMappings = {
    // Product/Part identifiers
    'sku': 'sku', 'part number': 'part_number', 'part_number': 'part_number',
    'partnumber': 'part_number', 'part no': 'part_number', 'partno': 'part_number',
    'item number': 'item_number', 'item_number': 'item_number', 'itemno': 'item_number',
    'product id': 'product_id', 'productid': 'product_id', 'prod_id': 'product_id',
    'article': 'article', 'article number': 'article_number', 'art_no': 'article_number',
    'oem': 'oem_number', 'oem number': 'oem_number', 'oem_number': 'oem_number',
    'vendor code': 'vendor_code', 'vendor_code': 'vendor_code', 'vendorcode': 'vendor_code',
    
    // Descriptions
    'description': 'description', 'desc': 'description', 'title': 'title',
    'name': 'name', 'product name': 'product_name', 'productname': 'product_name',
    'item name': 'item_name', 'itemname': 'item_name',
    
    // Brand/Manufacturer
    'brand': 'brand', 'make': 'brand', 'manufacturer': 'manufacturer',
    'mfr': 'manufacturer', 'mfg': 'manufacturer', 'vendor': 'vendor',
    
    // Pricing
    'price': 'price', 'unit price': 'unit_price', 'unitprice': 'unit_price',
    'cost': 'cost', 'msrp': 'msrp', 'retail': 'retail_price',
    'wholesale': 'wholesale_price', 'net': 'net_price', 'gross': 'gross_price',
    
    // Quantity/Stock
    'quantity': 'quantity', 'qty': 'quantity', 'stock': 'stock',
    'inventory': 'inventory', 'available': 'available', 'on hand': 'on_hand',
    'min order': 'min_order', 'minorder': 'min_order', 'min_lot': 'min_lot',
    'min lot': 'min_lot', 'moq': 'min_order_qty',
    
    // Dimensions/Weight
    'weight': 'weight', 'length': 'length', 'width': 'width', 'height': 'height',
    'volume': 'volume', 'size': 'size', 'dimension': 'dimension',
    
    // Delivery/Shipping
    'delivery': 'delivery', 'lead time': 'lead_time', 'leadtime': 'lead_time',
    'shipping': 'shipping', 'eta': 'eta',
    
    // Location/Warehouse
    'location': 'location', 'warehouse': 'warehouse', 'bin': 'bin_location',
    'shelf': 'shelf', 'storage': 'storage',
    
    // Categories
    'category': 'category', 'type': 'type', 'group': 'group',
    'class': 'class', 'family': 'family', 'segment': 'segment',
    
    // Status
    'status': 'status', 'active': 'is_active', 'enabled': 'is_enabled',
    'available': 'is_available',
    
    // Notes
    'notes': 'notes', 'remarks': 'remarks', 'comment': 'comment',
    'comments': 'comments', 'memo': 'memo',
  };
  
  const cleanName = name.trim().toLowerCase();
  
  // Check smart mappings first
  if (smartMappings[cleanName]) {
    let key = smartMappings[cleanName];
    // Ensure uniqueness
    let uniqueKey = key;
    let counter = 1;
    while (existingKeys.has(uniqueKey)) {
      uniqueKey = `${key}_${counter}`;
      counter++;
    }
    return uniqueKey;
  }
  
  // Generate key from name
  let key = name
    .normalize('NFD') // Normalize unicode
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, '_') // Spaces to underscores
    .replace(/_+/g, '_') // Multiple underscores to single
    .replace(/^_|_$/g, '') // Trim underscores
    .trim();
  
  // Handle empty or invalid key
  if (!key || !/^[a-z]/.test(key)) {
    // Try to extract any alphanumeric characters
    const extracted = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (extracted && /^[a-z]/.test(extracted)) {
      key = extracted.slice(0, 30);
    } else {
      key = `col_${index + 1}`;
    }
  }
  
  // Limit length
  key = key.slice(0, 50);
  
  // Ensure uniqueness
  let uniqueKey = key;
  let counter = 1;
  while (existingKeys.has(uniqueKey)) {
    uniqueKey = `${key}_${counter}`;
    counter++;
  }
  
  return uniqueKey;
}

/**
 * Smart table name generator from filename
 */
function generateSmartTableName(filename) {
  let name = filename
    .replace(/\.(xlsx|xls|csv)$/i, '') // Remove extension
    .replace(/[_-]+/g, ' ') // Replace underscores/hyphens with spaces
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .trim();
  
  // Capitalize first letter of each word
  name = name.replace(/\b\w/g, c => c.toUpperCase());
  
  // Clean up common patterns
  name = name
    .replace(/\s*part\s*\d+\s*$/i, '') // Remove "part 1", "part 2" etc
    .replace(/\s*\(\d+\)\s*$/i, '') // Remove "(1)", "(2)" etc
    .replace(/\s*v\d+(\.\d+)?\s*$/i, '') // Remove version numbers
    .replace(/\s*copy\s*$/i, '') // Remove "copy"
    .replace(/\s*\d{4}[-_]\d{2}[-_]\d{2}\s*$/i, '') // Remove dates
    .trim();
  
  return name || 'Imported Data';
}

/**
 * Auto import - AI-powered smart import that creates table automatically
 */
const autoImportData = async (req, res) => {
  try {
    const { newTableName, newTableDescription, tableId, mode = 'create' } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'File is required',
      });
    }
    
    logger.info(`Smart import started: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB), mode: ${mode}`);
    
    // Save uploaded file to supplier's FTP directory for backup/access
    const supplierId = req.supplier.getEffectiveSupplierId();
    const ftpSaveResult = await saveToFtpDirectory(supplierId, req.file.buffer, req.file.originalname);
    if (ftpSaveResult) {
      logger.info(`File saved to FTP: ${ftpSaveResult.filename}`);
    }
    
    // Parse the file to get columns and data
    const parsedData = await supplierDataImportService.parseFile(req.file.buffer, { filename: req.file.originalname });
    
    // Data is in records array, each with a .data property
    const records = parsedData.records || [];
    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'File is empty or could not be parsed',
      });
    }
    
    // Extract column names from headers or first record
    const headers = parsedData.headers || Object.keys(records[0].data || records[0]);
    
    logger.info(`Parsed ${records.length} records with ${headers.length} columns: ${headers.join(', ')}`);
    
    // UPDATE EXISTING TABLE MODE
    if (mode === 'update' && tableId) {
      const existingTable = await DataTable.findById(tableId);
      if (!existingTable) {
        return res.status(404).json({
          success: false,
          error: 'Table not found',
        });
      }
      
      // Verify ownership
      if (existingTable.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }
      
      // Create column mapping from file headers to existing table column keys
      const columnMapping = {};
      for (const header of headers) {
        const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Try to match by key or name
        const matchedCol = existingTable.columns.find(col => {
          const normalizedKey = col.key.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedName = col.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return col.key === header || 
                 col.name.toLowerCase() === header.toLowerCase() ||
                 normalizedKey === normalizedHeader ||
                 normalizedName === normalizedHeader;
        });
        
        if (matchedCol) {
          columnMapping[header] = matchedCol.key;
        }
      }
      
      logger.info(`Column mapping for update: ${JSON.stringify(columnMapping)}`);
      
      // Map records to table column keys
      const mappedRecords = records.map(record => {
        const mappedData = {};
        for (const [sourceKey, targetKey] of Object.entries(columnMapping)) {
          if (record.data && record.data[sourceKey] !== undefined) {
            mappedData[targetKey] = record.data[sourceKey];
          }
        }
        return mappedData;
      });
      
      // Filter out empty records
      const validRecords = mappedRecords.filter(data => Object.keys(data).length > 0);
      
      logger.info(`Mapped ${validRecords.length} valid records for update`);
      
      if (validRecords.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No records could be mapped to table columns. Check that file headers match table columns.',
        });
      }
      
      // Delete existing records and insert new ones (replace mode)
      await DataRecord.deleteMany({ table: tableId });
      
      // Create records directly
      const result = await supplierDataService.bulkCreateRecords({
        tableId: existingTable._id,
        records: validRecords,
        createdBy: req.supplier,
        req,
        skipDuplicates: false,
      });
      
      // Index to Elasticsearch (update mode - replace existing)
      const supplierInfo = await Supplier.findById(req.supplier.getEffectiveSupplierId()).select('name code').lean();
      
      const esRecords = validRecords.map((data, index) => ({
        _id: result.success?.[index]?.id?.toString() || `${existingTable._id}_${index}`,
        data,
      }));
      
      elasticsearchService.indexSupplierData({
        tableId: existingTable._id.toString(),
        tableName: existingTable.name,
        supplierId: req.supplier.getEffectiveSupplierId().toString(),
        supplierName: supplierInfo?.name || req.supplier.username,
        supplierCode: supplierInfo?.code || req.supplier.username,
        records: esRecords,
        columnMapping,
        fileName: req.file.originalname,
        replaceExisting: true, // Delete old ES docs and re-index
      }).then(esResult => {
        logger.info(`ES indexing (update) complete: ${esResult.indexed} indexed`);
      }).catch(err => {
        logger.error(`ES indexing (update) failed: ${err.message}`);
      });
      
      return res.json({
        success: true,
        message: 'Table updated successfully',
        tableId: existingTable._id,
        tableName: existingTable.name,
        recordsImported: result.success?.length || 0,
        recordsFailed: result.failed?.length || 0,
        columns: existingTable.columns.length,
        columnCount: existingTable.columns.length,
        totalRows: records.length,
        mode: 'update',
        summary: {
          created: result.success?.length || 0,
          failed: result.failed?.length || 0,
          skipped: result.skipped?.length || 0,
        },
        elasticsearch: 'indexing',
      });
    }
    
    // CREATE NEW TABLE MODE
    // Generate smart table name from filename
    const tableName = newTableName || generateSmartTableName(req.file.originalname);
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        error: 'Table name is required',
      });
    }
    
    // Smart column generation with AI-like detection
    const usedKeys = new Set();
    const columns = headers.map((header, index) => {
      // Generate smart key
      const key = generateSmartKey(header, index, usedKeys);
      usedKeys.add(key);
      
      // Collect sample values for type detection
      const sampleValues = records.slice(0, 100).map(r => {
        const data = r.data || r;
        return data[header];
      });
      
      // Detect column type based on actual data
      const detectedType = detectColumnType(sampleValues);
      
      // Map to supported types
      const typeMapping = {
        'text': 'text',
        'string': 'string',
        'number': 'number',
        'integer': 'integer',
        'decimal': 'decimal',
        'boolean': 'boolean',
        'date': 'date',
        'email': 'email',
        'url': 'url',
      };
      
      const columnType = typeMapping[detectedType] || 'text';
      
      return {
        name: header.trim() || `Column ${index + 1}`,
        key: key,
        type: columnType,
        required: false,
        display: {
          visible: true,
          sortable: true,
          filterable: true,
          editable: true,
        },
      };
    });
    
    logger.info(`Smart column detection complete: ${columns.map(c => `${c.name}(${c.type})`).join(', ')}`);
    
    // Create slug from table name
    const slug = tableName.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50) || 'import';
    
    // Create the table
    const table = new DataTable({
      supplier: req.supplier.getEffectiveSupplierId(),
      name: tableName,
      slug: slug + '_' + Date.now().toString(36),
      description: newTableDescription || `Smart imported from ${req.file.originalname} on ${new Date().toLocaleDateString()}`,
      columns,
      status: 'active',
      settings: {
        allowBulkEdit: true,
        trackHistory: true,
        exportFormats: ['csv', 'xlsx', 'json'],
      },
    });
    
    await table.save();
    
    // Create column mapping from original header names to generated keys
    const columnMapping = {};
    headers.forEach((header, index) => {
      columnMapping[header] = columns[index].key;
    });
    
    logger.info(`Column mapping: ${JSON.stringify(columnMapping)}`);
    
    // Map records directly (no need to re-parse the file!)
    const mappedRecords = records.map(record => {
      const mappedData = {};
      for (const [sourceKey, targetKey] of Object.entries(columnMapping)) {
        if (record.data && record.data[sourceKey] !== undefined) {
          mappedData[targetKey] = record.data[sourceKey];
        }
      }
      return mappedData;
    });
    
    // Filter out completely empty records
    const validRecords = mappedRecords.filter(data => Object.keys(data).length > 0);
    
    logger.info(`Mapped ${validRecords.length} records for import`);
    
    if (validRecords.length === 0) {
      // Delete the table since no records could be imported
      await DataTable.deleteOne({ _id: table._id });
      return res.status(400).json({
        success: false,
        error: 'No valid records found in file. Please check the file format.',
      });
    }
    
    // Insert records directly using bulk create
    const result = await supplierDataService.bulkCreateRecords({
      tableId: table._id,
      records: validRecords,
      createdBy: req.supplier,
      req,
      skipDuplicates: false,
    });
    
    const recordsImported = result.success?.length || 0;
    const recordsFailed = result.failed?.length || 0;
    
    logger.info(`Import complete: ${recordsImported} success, ${recordsFailed} failed`);
    
    // Log failed records for debugging
    if (recordsFailed > 0) {
      logger.warn(`Failed records sample: ${JSON.stringify(result.failed?.slice(0, 5))}`);
    }
    
    // Index to Elasticsearch for search
    // Get supplier info for tagging
    const supplierInfo = await Supplier.findById(req.supplier.getEffectiveSupplierId()).select('name code').lean();
    
    // Index records to ES asynchronously (don't block response)
    const esRecords = validRecords.map((data, index) => ({
      _id: result.success?.[index]?.id?.toString() || `${table._id}_${index}`,
      data,
    }));
    
    elasticsearchService.indexSupplierData({
      tableId: table._id.toString(),
      tableName: table.name,
      supplierId: req.supplier.getEffectiveSupplierId().toString(),
      supplierName: supplierInfo?.name || req.supplier.username,
      supplierCode: supplierInfo?.code || req.supplier.username,
      records: esRecords,
      columnMapping,
      fileName: req.file.originalname,
      replaceExisting: true,
    }).then(esResult => {
      logger.info(`ES indexing complete: ${esResult.indexed} indexed, ${esResult.errors} errors`);
    }).catch(err => {
      logger.error(`ES indexing failed: ${err.message}`);
    });
    
    res.json({
      success: true,
      message: 'Import completed',
      tableId: table._id,
      tableName: table.name,
      recordsImported: recordsImported,
      recordsFailed: recordsFailed,
      columns: columns.length,
      columnCount: columns.length,
      totalRows: records.length,
      mode: 'create',
      summary: {
        created: recordsImported,
        failed: recordsFailed,
        skipped: result.skipped?.length || 0,
      },
      elasticsearch: 'indexing',
    });
  } catch (error) {
    logger.error('Auto import error:', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Export table to file
 */
const exportData = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { format = 'csv', columns } = req.query;
    
    // Verify table ownership
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Get all records
    const records = await DataRecord.find({
      table: tableId,
      status: 'active',
    }).lean();
    
    let buffer;
    let contentType;
    let extension;
    
    switch (format) {
      case 'xlsx':
        buffer = await sftpExportService.exportToXLSX(table, records, { columns: columns ? columns.split(',') : null });
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;
      case 'json':
        buffer = await sftpExportService.exportToJSON(table, records, { pretty: true });
        contentType = 'application/json';
        extension = 'json';
        break;
      case 'csv':
      default:
        buffer = await sftpExportService.exportToCSV(table, records);
        contentType = 'text/csv';
        extension = 'csv';
        break;
    }
    
    const filename = `${table.slug}_${new Date().toISOString().slice(0, 10)}.${extension}`;
    
    // Update table stats
    await DataTable.updateOne(
      { _id: tableId },
      { $set: { 'stats.lastExportAt': new Date() } }
    );
    
    // Audit log
    await AuditLog.logDataTransfer({
      action: 'export.complete',
      table,
      supplier: table.supplier,
      actor: supplierDataService.buildActorInfo(req.supplier),
      fileInfo: { filename, format, rows: records.length, size: buffer.length },
      request: supplierDataService.buildRequestInfo(req),
      status: 'success',
    });
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    logger.error('Export error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== AUDIT & HISTORY ====================

/**
 * Get audit logs for supplier
 */
const getAuditLogs = async (req, res) => {
  try {
    const { tableId, action, startDate, endDate, limit = 50, skip = 0 } = req.query;
    
    const query = {
      supplier: req.supplier.getEffectiveSupplierId(),
    };
    
    if (tableId) query.table = tableId;
    if (action) query.action = { $in: action.split(',') };
    
    const result = await AuditLog.getAuditTrail({
      ...query,
      startDate,
      endDate,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Get audit logs error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get export history
 */
const getExportHistory = async (req, res) => {
  try {
    const { status, type, limit = 20, skip = 0 } = req.query;
    
    const result = await DataExport.getExportsForSupplier({
      supplier: req.supplier.getEffectiveSupplierId(),
      status,
      type,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Get export history error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Download export file
 */
const downloadExport = async (req, res) => {
  try {
    const { exportId } = req.params;
    
    const exportRecord = await DataExport.findOne({
      _id: exportId,
      supplier: req.supplier.getEffectiveSupplierId(),
    });
    
    if (!exportRecord) {
      return res.status(404).json({
        success: false,
        message: 'Export not found',
      });
    }
    
    if (exportRecord.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Export is ${exportRecord.status}`,
      });
    }
    
    if (!exportRecord.fileUrl) {
      return res.status(404).json({
        success: false,
        message: 'Export file not available',
      });
    }
    
    // Check if file exists
    const fs = require('fs');
    const filePath = path.join(__dirname, '..', exportRecord.fileUrl);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Export file no longer exists',
      });
    }
    
    // Set appropriate content type based on format
    const contentTypes = {
      csv: 'text/csv',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      json: 'application/json',
    };
    
    const contentType = contentTypes[exportRecord.format] || 'application/octet-stream';
    const filename = exportRecord.fileName || `export-${exportId}.${exportRecord.format === 'excel' ? 'xlsx' : exportRecord.format}`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // Log download in audit
    await AuditLog.create({
      supplier: req.supplier.getEffectiveSupplierId(),
      user: req.supplier._id,
      action: 'export.downloaded',
      resourceType: 'export',
      resourceId: exportId,
      metadata: {
        fileName: filename,
        format: exportRecord.format,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
  } catch (error) {
    logger.error('Download export error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== FTP FILE OPERATIONS ====================

/**
 * Get list of uploaded files in supplier's FTP directory
 */
const getUploadedFiles = async (req, res) => {
  try {
    const supplier = req.supplier;
    const supplierId = supplier.getEffectiveSupplierId();

    // Get supplier info
    const supplierDoc = await Supplier.findById(supplierId).lean();
    if (!supplierDoc) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    // Get folder name
    const folderName = supplierDoc.companyCode || supplierDoc.code || `supplier_${supplierId}`;
    const supplierDir = path.join(FTP_BASE_DIR, folderName);

    // Check if directory exists
    try {
      await fsPromises.access(supplierDir);
    } catch {
      // Directory doesn't exist yet - return empty array
      return res.json({
        success: true,
        files: [],
        directory: folderName,
      });
    }

    // Read directory contents
    const files = await fsPromises.readdir(supplierDir);
    const fileDetails = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(supplierDir, filename);
        try {
          const stats = await fsPromises.stat(filePath);
          return {
            filename,
            size: stats.size,
            sizeFormatted: formatFileSize(stats.size),
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          };
        } catch {
          return null;
        }
      })
    );

    // Filter out nulls and sort by date (newest first)
    const validFiles = fileDetails
      .filter(Boolean)
      .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    res.json({
      success: true,
      files: validFiles,
      directory: folderName,
      count: validFiles.length,
    });
  } catch (error) {
    logger.error('Get uploaded files error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete an uploaded file from supplier's FTP directory
 */
const deleteUploadedFile = async (req, res) => {
  try {
    const supplier = req.supplier;
    const supplierId = supplier.getEffectiveSupplierId();
    const { filename } = req.params;

    // Validate filename (prevent path traversal)
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename',
      });
    }

    // Get supplier info
    const supplierDoc = await Supplier.findById(supplierId).lean();
    if (!supplierDoc) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    // Build file path
    const folderName = supplierDoc.companyCode || supplierDoc.code || `supplier_${supplierId}`;
    const supplierDir = path.join(FTP_BASE_DIR, folderName);
    const filePath = path.join(supplierDir, filename);

    // Check access and delete
    try {
      await fsPromises.access(filePath);
      await fsPromises.unlink(filePath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }
      throw err;
    }

    // Log in audit
    await AuditLog.create({
      supplier: supplierId,
      user: supplier._id,
      action: 'file.deleted',
      resourceType: 'upload',
      metadata: {
        filename,
        directory: folderName,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    logger.info(`Deleted FTP file: ${filePath}`);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    logger.error('Delete uploaded file error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Format file size to human readable string
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
  // Table operations
  getTables,
  getTable,
  createTable,
  updateTable,
  updateTableColumns,
  archiveTable,
  deleteTable,
  // Record operations
  getRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  bulkCreateRecords,
  bulkUpdateRecords,
  bulkDeleteRecords,
  restoreRecord,
  restoreRecordVersion,
  getRecordHistory,
  // Import/Export
  previewImport,
  importData,
  autoImportData,
  exportData,
  downloadExport,
  // Audit & History
  getAuditLogs,
  getExportHistory,
  // FTP File operations
  getUploadedFiles,
  deleteUploadedFile,
};
