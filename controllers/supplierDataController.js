/**
 * Supplier Data Controller
 * Handles all API endpoints for supplier data management
 * Supports table CRUD, record CRUD, import/export, SFTP operations
 */
const supplierDataService = require('../services/supplierDataService');
const supplierDataImportService = require('../services/supplierDataImportService');
const sftpExportService = require('../services/sftpExportService');
const supplierExportScheduler = require('../services/supplierExportScheduler');
const DataTable = require('../models/DataTable');
const DataRecord = require('../models/DataRecord');
const DataExport = require('../models/DataExport');
const AuditLog = require('../models/AuditLog');
const Supplier = require('../models/Supplier');
const ExcelJS = require('exceljs');
const logger = require('../utils/logger');

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
    
    const result = await supplierDataService.deleteTable({
      tableId,
      deletedBy: req.supplier,
      req,
    });
    
    res.json({
      success: true,
      message: 'Table deleted successfully',
      recordsDeleted: result.recordsDeleted,
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

// ==================== SFTP OPERATIONS ====================

/**
 * Test SFTP connection
 */
const testSFTPConnection = async (req, res) => {
  try {
    const { host, port, username, password, remotePath } = req.body;
    
    if (!host || !username) {
      return res.status(400).json({
        success: false,
        message: 'SFTP host and username are required',
      });
    }
    
    const result = await sftpExportService.testConnection({
      host,
      port: port || 22,
      username,
      password,
      remotePath: remotePath || '/',
    });
    
    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    logger.error('SFTP test error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update SFTP configuration
 */
const updateSFTPConfig = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.supplier.getEffectiveSupplierId());
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    
    const { enabled, host, port, username, password, remotePath, exportSchedule } = req.body;
    
    supplier.sftpConfig = {
      ...supplier.sftpConfig,
      enabled: enabled !== undefined ? enabled : supplier.sftpConfig.enabled,
      host: host || supplier.sftpConfig.host,
      port: port || supplier.sftpConfig.port,
      username: username || supplier.sftpConfig.username,
      remotePath: remotePath || supplier.sftpConfig.remotePath,
    };
    
    if (password) {
      supplier.sftpConfig.password = password;
    }
    
    if (exportSchedule) {
      supplier.sftpConfig.exportSchedule = {
        ...supplier.sftpConfig.exportSchedule,
        ...exportSchedule,
      };
    }
    
    await supplier.save();
    
    // Audit log
    await AuditLog.log({
      actor: supplierDataService.buildActorInfo(req.supplier),
      action: 'sftp.config_update',
      resource: { type: 'supplier', id: supplier._id, name: supplier.companyName },
      supplier: supplier._id,
      status: 'success',
    });
    
    res.json({
      success: true,
      message: 'SFTP configuration updated',
      sftpConfig: {
        enabled: supplier.sftpConfig.enabled,
        host: supplier.sftpConfig.host,
        port: supplier.sftpConfig.port,
        username: supplier.sftpConfig.username,
        remotePath: supplier.sftpConfig.remotePath,
        exportSchedule: supplier.sftpConfig.exportSchedule,
      },
    });
  } catch (error) {
    logger.error('Update SFTP config error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Export to SFTP
 */
const exportToSFTP = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { format = 'csv' } = req.body;
    
    // Verify table ownership
    const table = await DataTable.findById(tableId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    
    if (table.supplier.toString() !== req.supplier.getEffectiveSupplierId().toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Get supplier with SFTP config
    const supplier = await Supplier.findById(req.supplier.getEffectiveSupplierId())
      .select('+sftpConfig.password');
    
    if (!supplier.sftpConfig?.enabled) {
      return res.status(400).json({
        success: false,
        message: 'SFTP is not configured',
      });
    }
    
    const result = await sftpExportService.exportAndUpload({
      table,
      supplier,
      sftpConfig: supplier.sftpConfig,
      format,
      triggeredBy: supplierDataService.buildActorInfo(req.supplier),
    });
    
    res.json({
      success: true,
      message: 'Export to SFTP completed',
      ...result,
    });
  } catch (error) {
    logger.error('Export to SFTP error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Trigger scheduled export manually
 */
const triggerScheduledExport = async (req, res) => {
  try {
    const { tableIds } = req.body;
    
    const result = await supplierExportScheduler.triggerExport(
      req.supplier.getEffectiveSupplierId(),
      tableIds
    );
    
    res.json({
      success: true,
      message: 'Export triggered',
      ...result,
    });
  } catch (error) {
    logger.error('Trigger export error:', error.message);
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
  exportData,
  downloadExport,
  // SFTP operations
  testSFTPConnection,
  updateSFTPConfig,
  exportToSFTP,
  triggerScheduledExport,
  // Audit & History
  getAuditLogs,
  getExportHistory,
};
