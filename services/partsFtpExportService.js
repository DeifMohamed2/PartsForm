/**
 * Parts FTP Export Service
 * 
 * Exports ALL parts data to Excel and makes it available via FTP
 * - Daily scheduled export at 9PM
 * - Handles millions of records without OOM using streaming
 * - Professional Excel formatting
 * - Source tracking for each part
 */
const Part = require('../models/Part');
const Integration = require('../models/Integration');
const Supplier = require('../models/Supplier');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cron = require('node-cron');
const logger = require('../utils/logger');

// Export directory configuration
const FTP_EXPORT_DIR = process.env.FTP_EXPORT_DIR || path.join(process.cwd(), 'ftp-exports');
const EXPORT_FILENAME = 'partsform_catalog.xlsx';
const EXPORT_FILENAME_CSV = 'partsform_catalog.csv';

class PartsFtpExportService {
  constructor() {
    this.isExporting = false;
    this.lastExport = null;
    this.scheduledTask = null;
  }

  /**
   * Initialize the service and create export directory
   */
  async initialize() {
    try {
      await fs.mkdir(FTP_EXPORT_DIR, { recursive: true });
      logger.info(`📁 FTP Export directory: ${FTP_EXPORT_DIR}`);
    } catch (err) {
      logger.error('Failed to create FTP export directory:', err.message);
    }
  }

  /**
   * Start daily scheduled export at 9PM
   */
  startScheduler() {
    // Run at 21:00 (9PM) every day
    this.scheduledTask = cron.schedule('0 21 * * *', async () => {
      logger.info('🕘 Starting scheduled FTP export at 9PM...');
      await this.exportAllParts();
    }, {
      timezone: process.env.TIMEZONE || 'Asia/Dubai'
    });

    logger.info('✅ FTP Export scheduler started - Daily at 9PM');
  }

  /**
   * Stop the scheduler
   */
  stopScheduler() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
      logger.info('🛑 FTP Export scheduler stopped');
    }
  }

  /**
   * Export all parts to Excel and CSV
   * Uses streaming to handle large datasets without OOM
   */
  async exportAllParts() {
    if (this.isExporting) {
      logger.warn('Export already in progress, skipping...');
      return { success: false, message: 'Export already in progress' };
    }

    this.isExporting = true;
    const startTime = Date.now();

    try {
      await this.initialize();

      // Get total count for progress tracking
      const totalCount = await Part.countDocuments({});
      logger.info(`📊 Starting export of ${totalCount.toLocaleString()} parts...`);

      if (totalCount === 0) {
        logger.warn('No parts to export');
        this.isExporting = false;
        return { success: true, exported: 0 };
      }

      // Get integration names map for source display
      const integrations = await Integration.find({}).select('_id name').lean();
      const integrationMap = {};
      integrations.forEach(i => { integrationMap[i._id.toString()] = i.name; });

      // Get supplier names map for source display
      const suppliers = await Supplier.find({}).select('_id companyName companyCode').lean();
      const supplierMap = {};
      suppliers.forEach(s => { 
        supplierMap[s._id.toString()] = { name: s.companyName, code: s.companyCode };
      });

      // Create Excel workbook with streaming writer
      const excelPath = path.join(FTP_EXPORT_DIR, EXPORT_FILENAME);
      const csvPath = path.join(FTP_EXPORT_DIR, EXPORT_FILENAME_CSV);

      // Use streaming workbook for memory efficiency
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: excelPath,
        useStyles: true
      });

      const worksheet = workbook.addWorksheet('Parts Catalog', {
        views: [{ state: 'frozen', ySplit: 1 }] // Freeze header row
      });

      // Define columns
      worksheet.columns = [
        { header: 'Part Number', key: 'partNumber', width: 22 },
        { header: 'Description', key: 'description', width: 45 },
        { header: 'Brand', key: 'brand', width: 18 },
        { header: 'Supplier', key: 'supplier', width: 20 },
        { header: 'Price', key: 'price', width: 12 },
        { header: 'Currency', key: 'currency', width: 10 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Stock Status', key: 'stock', width: 14 },
        { header: 'Weight (kg)', key: 'weight', width: 12 },
        { header: 'Delivery Days', key: 'deliveryDays', width: 14 },
        { header: 'Category', key: 'category', width: 18 },
        { header: 'Source', key: 'source', width: 25 },
        { header: 'Last Updated', key: 'lastUpdated', width: 22 }
      ];

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0C4A6E' } // Dark blue
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 24;
      await headerRow.commit();

      // Also create CSV file
      const csvStream = fsSync.createWriteStream(csvPath);
      csvStream.write('Part Number,Description,Brand,Supplier,Price,Currency,Quantity,Stock Status,Weight,Delivery Days,Category,Source,Last Updated\n');

      // Stream parts in batches
      const BATCH_SIZE = 5000;
      let processed = 0;
      let skip = 0;

      while (true) {
        const parts = await Part.find({})
          .skip(skip)
          .limit(BATCH_SIZE)
          .select('partNumber description brand supplier price currency quantity stock weight deliveryDays category source integration integrationName fileName lastUpdated')
          .lean();

        if (parts.length === 0) break;

        for (const part of parts) {
          // Determine source display name
          let sourceDisplay = 'Unknown';
          
          if (part.source?.type === 'supplier_upload' && part.source?.supplierId) {
            const suppInfo = supplierMap[part.source.supplierId.toString()];
            sourceDisplay = suppInfo ? `Supplier: ${suppInfo.name}` : 'Supplier Upload';
          } else if (part.integration || part.integrationName) {
            const intId = part.integration?.toString();
            sourceDisplay = part.integrationName || integrationMap[intId] || 'Integration Sync';
          } else if (part.source?.type) {
            sourceDisplay = part.source.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          }

          const rowData = {
            partNumber: part.partNumber || '',
            description: part.description || '',
            brand: part.brand || '',
            supplier: part.supplier || '',
            price: part.price || 0,
            currency: part.currency || 'AED',
            quantity: part.quantity || 0,
            stock: part.stock || 'unknown',
            weight: part.weight || '',
            deliveryDays: part.deliveryDays || '',
            category: part.category || '',
            source: sourceDisplay,
            lastUpdated: part.lastUpdated ? new Date(part.lastUpdated).toISOString().slice(0, 19).replace('T', ' ') : ''
          };

          // Add to Excel (streamed)
          const row = worksheet.addRow(rowData);
          
          // Style alternating rows
          if (processed % 2 === 1) {
            row.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' }
            };
          }
          await row.commit();

          // Add to CSV
          const csvLine = [
            this.escapeCSV(rowData.partNumber),
            this.escapeCSV(rowData.description),
            this.escapeCSV(rowData.brand),
            this.escapeCSV(rowData.supplier),
            rowData.price,
            rowData.currency,
            rowData.quantity,
            rowData.stock,
            rowData.weight,
            rowData.deliveryDays,
            this.escapeCSV(rowData.category),
            this.escapeCSV(rowData.source),
            rowData.lastUpdated
          ].join(',');
          csvStream.write(csvLine + '\n');

          processed++;
        }

        skip += BATCH_SIZE;

        // Progress logging
        const progress = Math.round((processed / totalCount) * 100);
        if (processed % 50000 === 0 || processed === totalCount) {
          logger.info(`📦 Export progress: ${processed.toLocaleString()} / ${totalCount.toLocaleString()} (${progress}%)`);
        }

        // Allow event loop to breathe
        await new Promise(resolve => setImmediate(resolve));
      }

      // Commit worksheet and close workbook
      await worksheet.commit();
      await workbook.commit();
      csvStream.end();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      // Get file sizes
      const excelStat = await fs.stat(excelPath);
      const csvStat = await fs.stat(csvPath);

      const result = {
        success: true,
        exported: processed,
        duration: `${duration}s`,
        files: {
          excel: {
            path: excelPath,
            filename: EXPORT_FILENAME,
            size: this.formatFileSize(excelStat.size)
          },
          csv: {
            path: csvPath,
            filename: EXPORT_FILENAME_CSV,
            size: this.formatFileSize(csvStat.size)
          }
        },
        exportedAt: new Date()
      };

      this.lastExport = result;
      logger.info(`✅ FTP Export completed: ${processed.toLocaleString()} parts in ${duration}s`);
      logger.info(`   Excel: ${result.files.excel.size} | CSV: ${result.files.csv.size}`);

      this.isExporting = false;
      return result;

    } catch (error) {
      logger.error('❌ FTP Export failed:', error);
      this.isExporting = false;
      throw error;
    }
  }

  /**
   * Escape CSV field
   */
  escapeCSV(field) {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Get export status
   */
  getStatus() {
    return {
      isExporting: this.isExporting,
      lastExport: this.lastExport,
      schedulerActive: !!this.scheduledTask,
      exportDirectory: FTP_EXPORT_DIR,
      scheduleTime: '21:00 (9PM) daily'
    };
  }

  /**
   * Get list of exported files
   */
  async getExportedFiles() {
    try {
      const files = await fs.readdir(FTP_EXPORT_DIR);
      const fileDetails = [];

      for (const file of files) {
        const filePath = path.join(FTP_EXPORT_DIR, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile()) {
          fileDetails.push({
            filename: file,
            path: filePath,
            size: this.formatFileSize(stat.size),
            sizeBytes: stat.size,
            modified: stat.mtime
          });
        }
      }

      return fileDetails.sort((a, b) => b.modified - a.modified);
    } catch (err) {
      logger.error('Error listing export files:', err.message);
      return [];
    }
  }

  /**
   * Manual trigger export (for admin use)
   */
  async triggerExport() {
    if (this.isExporting) {
      return { success: false, message: 'Export already in progress' };
    }

    // Run in background
    setImmediate(() => {
      this.exportAllParts().catch(err => {
        logger.error('Background export failed:', err.message);
      });
    });

    return { 
      success: true, 
      message: 'Export started in background',
      status: 'processing'
    };
  }
}

// Create singleton instance
const partsFtpExportService = new PartsFtpExportService();

module.exports = partsFtpExportService;
