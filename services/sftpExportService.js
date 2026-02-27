/**
 * SFTP Export Service
 * Handles secure file transfers to SFTP servers
 * Used for automated data exports and distribution
 */
const Client = require('basic-ftp').Client; // Using basic-ftp for both FTP and SFTP
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const DataTable = require('../models/DataTable');
const DataRecord = require('../models/DataRecord');
const DataExport = require('../models/DataExport');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

class SFTPExportService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'partsform-exports');
    this.ensureTempDir();
  }

  /**
   * Ensure temp directory exists
   */
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Create SFTP client connection
   */
  async connect(config) {
    const client = new Client();
    
    try {
      await client.access({
        host: config.host,
        port: config.port || 22,
        user: config.username,
        password: config.password,
        secure: config.secure !== false, // Default to secure
        secureOptions: {
          rejectUnauthorized: config.rejectUnauthorized !== false,
        },
      });
      
      logger.info(`SFTP connected to ${config.host}`);
      return client;
    } catch (error) {
      logger.error(`SFTP connection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test SFTP connection
   */
  async testConnection(config) {
    let client = null;
    try {
      client = await this.connect(config);
      
      // Test directory access
      const remotePath = config.remotePath || '/';
      await client.cd(remotePath);
      const list = await client.list();
      
      return {
        success: true,
        message: `Connected successfully. Found ${list.length} items in ${remotePath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        code: error.code,
      };
    } finally {
      if (client) {
        try {
          client.close();
        } catch (e) {}
      }
    }
  }

  /**
   * Generate export filename
   */
  generateFilename(table, format, timestamp = new Date()) {
    const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${table.slug}_${dateStr}.${format}`;
  }

  /**
   * Export table data to CSV format
   */
  async exportToCSV(table, records, options = {}) {
    const {
      delimiter = ',',
      includeHeaders = true,
      encoding = 'utf-8',
      columns = null,
      dateFormat = 'YYYY-MM-DD',
    } = options;

    const sortedColumns = columns || table.getSortedColumns().filter(c => c.display?.visible !== false);
    const lines = [];

    // Header row
    if (includeHeaders) {
      const headerRow = sortedColumns.map(col => this.escapeCSV(col.name, delimiter));
      lines.push(headerRow.join(delimiter));
    }

    // Data rows
    for (const record of records) {
      const row = sortedColumns.map(col => {
        let value = record.data[col.key];
        
        // Format value based on type
        if (value === null || value === undefined) {
          return '';
        }
        
        if (col.type === 'date' || col.type === 'datetime') {
          if (value instanceof Date) {
            value = this.formatDate(value, dateFormat);
          }
        } else if (col.type === 'multiselect' && Array.isArray(value)) {
          value = value.join(';');
        } else if (col.type === 'boolean') {
          value = value ? 'true' : 'false';
        } else if (col.type === 'json') {
          value = JSON.stringify(value);
        }
        
        return this.escapeCSV(String(value), delimiter);
      });
      lines.push(row.join(delimiter));
    }

    return Buffer.from(lines.join('\n'), encoding);
  }

  /**
   * Escape CSV value
   */
  escapeCSV(value, delimiter = ',') {
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Format date according to format string
   */
  formatDate(date, format) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * Export table data to XLSX format
   */
  async exportToXLSX(table, records, options = {}) {
    const {
      includeHeaders = true,
      columns = null,
      sheetName = null,
    } = options;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PARTSFORM';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName || table.name);
    const sortedColumns = columns || table.getSortedColumns().filter(c => c.display?.visible !== false);

    // Define columns
    worksheet.columns = sortedColumns.map(col => ({
      header: col.name,
      key: col.key,
      width: Math.max(col.display?.width || 15, col.name.length + 2) / 7, // Approximate character width
      style: this.getColumnStyle(col),
    }));

    // Style header row
    if (includeHeaders) {
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    }

    // Add data rows
    for (const record of records) {
      const rowData = {};
      for (const col of sortedColumns) {
        let value = record.data[col.key];
        
        // Handle special types
        if (col.type === 'multiselect' && Array.isArray(value)) {
          value = value.join(', ');
        } else if (col.type === 'json') {
          value = JSON.stringify(value);
        }
        
        rowData[col.key] = value;
      }
      worksheet.addRow(rowData);
    }

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `${String.fromCharCode(64 + sortedColumns.length)}1`,
    };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Get Excel column style based on column type
   */
  getColumnStyle(column) {
    switch (column.type) {
      case 'number':
      case 'decimal':
        return { numFmt: '#,##0.00' };
      case 'integer':
        return { numFmt: '#,##0' };
      case 'date':
        return { numFmt: 'yyyy-mm-dd' };
      case 'datetime':
        return { numFmt: 'yyyy-mm-dd hh:mm:ss' };
      case 'boolean':
        return {};
      default:
        return {};
    }
  }

  /**
   * Export table data to JSON format
   */
  async exportToJSON(table, records, options = {}) {
    const { columns = null, pretty = false } = options;
    
    const sortedColumns = columns || table.getSortedColumns();
    const columnKeys = sortedColumns.map(c => c.key);
    
    const data = records.map(record => {
      const row = {};
      for (const key of columnKeys) {
        row[key] = record.data[key];
      }
      return row;
    });
    
    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    return Buffer.from(json, 'utf-8');
  }

  /**
   * Calculate checksum for a buffer
   */
  calculateChecksum(buffer, algorithm = 'md5') {
    return crypto.createHash(algorithm).update(buffer).digest('hex');
  }

  /**
   * Export table and upload to SFTP
   */
  async exportAndUpload({
    table,
    supplier,
    sftpConfig,
    format = 'csv',
    options = {},
    triggeredBy = { type: 'system' },
    correlationId = null,
  }) {
    const startTime = Date.now();
    let client = null;
    let tempFilePath = null;
    let exportJob = null;

    try {
      // Create export job
      const records = await DataRecord.find({ 
        table: table._id, 
        status: 'active' 
      }).lean();

      exportJob = await DataExport.createJob({
        supplier: supplier._id || supplier,
        tables: [{ table, tableName: table.name, recordCount: records.length }],
        config: { format, ...options },
        type: 'sftp_sync',
        triggeredBy,
        sftpConfig,
        correlationId: correlationId || `sftp_export_${Date.now()}`,
      });

      exportJob.startedAt = new Date();
      exportJob.status = 'processing';
      await exportJob.save();

      // Generate export file
      let buffer;
      const filename = this.generateFilename(table, format);
      
      switch (format) {
        case 'xlsx':
          buffer = await this.exportToXLSX(table, records, options);
          break;
        case 'json':
          buffer = await this.exportToJSON(table, records, options);
          break;
        case 'csv':
        default:
          buffer = await this.exportToCSV(table, records, options);
          break;
      }

      const checksum = this.calculateChecksum(buffer);

      // Save to temp file
      tempFilePath = path.join(this.tempDir, filename);
      fs.writeFileSync(tempFilePath, buffer);

      // Update progress
      await exportJob.updateProgress(records.length * 0.5, 'Uploading to SFTP');

      // Connect and upload
      client = await this.connect(sftpConfig);

      // Navigate to remote path
      const remotePath = sftpConfig.remotePath || '/';
      try {
        await client.cd(remotePath);
      } catch (error) {
        // Try to create directory
        await client.ensureDir(remotePath);
        await client.cd(remotePath);
      }

      // Upload file
      const remoteFilePath = path.join(remotePath, filename);
      await client.uploadFrom(tempFilePath, filename);

      logger.info(`SFTP upload completed: ${filename} to ${sftpConfig.host}${remoteFilePath}`);

      // Mark completed
      const duration = Date.now() - startTime;
      await exportJob.markCompleted({
        filename,
        originalName: filename,
        path: tempFilePath,
        size: buffer.length,
        mimeType: this.getMimeType(format),
        checksum,
      });

      exportJob.sftp.uploaded = true;
      exportJob.sftp.uploadedAt = new Date();
      exportJob.sftp.remotePath = remoteFilePath;
      exportJob.duration = duration;
      exportJob.metadata.exportedRecordCount = records.length;
      await exportJob.save();

      // Audit log
      await AuditLog.logDataTransfer({
        action: 'sftp.upload',
        table,
        supplier: supplier._id || supplier,
        actor: triggeredBy,
        fileInfo: {
          filename,
          size: buffer.length,
          format,
          rows: records.length,
          path: remoteFilePath,
        },
        status: 'success',
        duration,
        correlationId: exportJob.correlationId,
      });

      // Update table stats
      await DataTable.updateOne(
        { _id: table._id },
        { $set: { 'stats.lastExportAt': new Date() } }
      );

      return {
        success: true,
        exportId: exportJob._id,
        filename,
        remotePath: remoteFilePath,
        recordCount: records.length,
        size: buffer.length,
        checksum,
        duration,
      };
    } catch (error) {
      logger.error(`SFTP export failed: ${error.message}`);

      if (exportJob) {
        await exportJob.markFailed({
          code: error.code || 'SFTP_EXPORT_FAILED',
          message: error.message,
          retryable: true,
        });
      }

      await AuditLog.logDataTransfer({
        action: 'sftp.upload',
        table,
        supplier: supplier._id || supplier,
        actor: triggeredBy,
        fileInfo: { format },
        status: 'failure',
        error: {
          code: error.code,
          message: error.message,
        },
        duration: Date.now() - startTime,
        correlationId: correlationId || exportJob?.correlationId,
      });

      throw error;
    } finally {
      // Cleanup
      if (client) {
        try {
          client.close();
        } catch (e) {}
      }
      
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {}
      }
    }
  }

  /**
   * Get MIME type for format
   */
  getMimeType(format) {
    const mimeTypes = {
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      json: 'application/json',
    };
    return mimeTypes[format] || 'application/octet-stream';
  }

  /**
   * Export multiple tables to SFTP
   */
  async batchExportAndUpload({
    tables,
    supplier,
    sftpConfig,
    format = 'csv',
    options = {},
    triggeredBy = { type: 'system' },
  }) {
    const results = [];
    const correlationId = `batch_sftp_${Date.now()}`;

    for (const table of tables) {
      try {
        const result = await this.exportAndUpload({
          table,
          supplier,
          sftpConfig,
          format,
          options,
          triggeredBy,
          correlationId,
        });
        results.push({ table: table.name, success: true, ...result });
      } catch (error) {
        results.push({
          table: table.name,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      correlationId,
      results,
      summary: {
        total: tables.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    };
  }

  /**
   * List files on SFTP server
   */
  async listRemoteFiles(sftpConfig, remotePath = '/') {
    let client = null;
    try {
      client = await this.connect(sftpConfig);
      await client.cd(remotePath);
      const list = await client.list();
      
      return list.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        modifiedAt: file.modifiedAt,
        isDirectory: file.type === 2,
      }));
    } finally {
      if (client) {
        client.close();
      }
    }
  }

  /**
   * Download file from SFTP
   */
  async downloadFromSFTP(sftpConfig, remoteFilePath) {
    let client = null;
    const tempFilePath = path.join(this.tempDir, `download_${Date.now()}_${path.basename(remoteFilePath)}`);
    
    try {
      client = await this.connect(sftpConfig);
      await client.downloadTo(tempFilePath, remoteFilePath);
      
      const buffer = fs.readFileSync(tempFilePath);
      fs.unlinkSync(tempFilePath);
      
      return buffer;
    } finally {
      if (client) {
        client.close();
      }
    }
  }
}

module.exports = new SFTPExportService();
