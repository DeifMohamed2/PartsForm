/**
 * Supplier Export Scheduler Service
 * Manages scheduled SFTP exports for suppliers
 * Runs background jobs to automatically export and upload data
 */
const cron = require('node-cron');
const Supplier = require('../models/Supplier');
const DataTable = require('../models/DataTable');
const DataExport = require('../models/DataExport');
const AuditLog = require('../models/AuditLog');
const sftpExportService = require('./sftpExportService');
const logger = require('../utils/logger');

class SupplierExportScheduler {
  constructor() {
    this.scheduledJobs = new Map();
    this.isRunning = false;
    this.mainScheduler = null;
    this.processingQueue = false;
  }

  /**
   * Initialize the scheduler
   */
  async initialize() {
    if (this.isRunning) {
      logger.warn('Supplier export scheduler already running');
      return;
    }

    logger.info('Initializing supplier export scheduler');

    // Main scheduler - runs every 5 minutes to check for due exports
    this.mainScheduler = cron.schedule('*/5 * * * *', () => {
      this.processDueExports();
    });

    // Export queue processor - runs every minute
    this.queueProcessor = cron.schedule('* * * * *', () => {
      this.processExportQueue();
    });

    // Cleanup old exports - runs daily at 3 AM
    this.cleanupScheduler = cron.schedule('0 3 * * *', () => {
      this.cleanupOldExports();
    });

    this.isRunning = true;
    logger.info('Supplier export scheduler started');

    // Process any pending exports from server restart
    await this.processDueExports();
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.mainScheduler) {
      this.mainScheduler.stop();
    }
    if (this.queueProcessor) {
      this.queueProcessor.stop();
    }
    if (this.cleanupScheduler) {
      this.cleanupScheduler.stop();
    }
    
    this.isRunning = false;
    logger.info('Supplier export scheduler stopped');
  }

  /**
   * Process due scheduled exports
   */
  async processDueExports() {
    if (this.processingQueue) {
      logger.debug('Export queue already being processed');
      return;
    }

    try {
      const now = new Date();
      
      // Find suppliers with due exports
      const suppliers = await Supplier.find({
        isActive: true,
        isApproved: true,
        'sftpConfig.enabled': true,
        'sftpConfig.exportSchedule.enabled': true,
        'sftpConfig.exportSchedule.nextExport': { $lte: now },
      }).select('+sftpConfig.password +sftpConfig.privateKey');

      if (suppliers.length === 0) {
        return;
      }

      logger.info(`Found ${suppliers.length} suppliers with due exports`);

      for (const supplier of suppliers) {
        try {
          await this.runScheduledExport(supplier);
        } catch (error) {
          logger.error(`Scheduled export failed for ${supplier.companyCode}:`, error.message);
        }
      }
    } catch (error) {
      logger.error('Error processing due exports:', error.message);
    }
  }

  /**
   * Run scheduled export for a supplier
   */
  async runScheduledExport(supplier) {
    logger.info(`Running scheduled export for ${supplier.companyCode}`);

    const sftpConfig = {
      host: supplier.sftpConfig.host,
      port: supplier.sftpConfig.port,
      username: supplier.sftpConfig.username,
      password: supplier.sftpConfig.password,
      privateKey: supplier.sftpConfig.privateKey,
      remotePath: supplier.sftpConfig.remotePath,
    };

    // Test connection first
    const testResult = await sftpExportService.testConnection(sftpConfig);
    if (!testResult.success) {
      logger.error(`SFTP connection test failed for ${supplier.companyCode}: ${testResult.message}`);
      
      await AuditLog.log({
        actor: { type: 'system', name: 'Export Scheduler' },
        action: 'sftp.scheduled_export',
        resource: { type: 'supplier', id: supplier._id, name: supplier.companyName },
        supplier: supplier._id,
        status: 'failure',
        error: { code: 'SFTP_CONNECTION_FAILED', message: testResult.message },
        severity: 'error',
      });
      
      // Update next export time even on failure to prevent infinite retries
      await this.updateNextExportTime(supplier);
      return;
    }

    // Get tables configured for SFTP export
    const tables = await DataTable.find({
      supplier: supplier._id,
      status: 'active',
      'settings.sftpExport.enabled': true,
    });

    if (tables.length === 0) {
      logger.info(`No tables configured for SFTP export for ${supplier.companyCode}`);
      await this.updateNextExportTime(supplier);
      return;
    }

    // Export each table
    const results = await sftpExportService.batchExportAndUpload({
      tables,
      supplier,
      sftpConfig,
      format: 'csv', // Default format
      triggeredBy: { type: 'schedule', name: 'Export Scheduler' },
    });

    // Log results
    await AuditLog.log({
      actor: { type: 'system', name: 'Export Scheduler' },
      action: 'sftp.scheduled_export',
      resource: { type: 'supplier', id: supplier._id, name: supplier.companyName },
      supplier: supplier._id,
      details: {
        bulkInfo: results.summary,
        metadata: { tables: results.results.map(r => r.table) },
      },
      status: results.summary.failed > 0 ? 'partial' : 'success',
      correlationId: results.correlationId,
      severity: results.summary.failed > 0 ? 'warning' : 'info',
    });

    // Update last and next export times
    supplier.sftpConfig.exportSchedule.lastExport = new Date();
    await this.updateNextExportTime(supplier);

    logger.info(`Scheduled export completed for ${supplier.companyCode}: ${results.summary.success}/${results.summary.total} tables`);
  }

  /**
   * Update next export time based on cron expression
   */
  async updateNextExportTime(supplier) {
    try {
      const cronExpression = supplier.sftpConfig.exportSchedule.cronExpression || '0 2 * * *';
      const nextDate = this.getNextCronDate(cronExpression);
      
      supplier.sftpConfig.exportSchedule.nextExport = nextDate;
      await supplier.save();
    } catch (error) {
      logger.error(`Failed to update next export time for ${supplier.companyCode}:`, error.message);
    }
  }

  /**
   * Calculate next cron execution date
   */
  getNextCronDate(cronExpression) {
    // Parse cron expression and calculate next run
    // Format: minute hour day month weekday
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression');
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    let next = new Date(now);

    // Simple implementation for common patterns
    // For production, consider using a library like cron-parser
    
    // Set time components
    if (minute !== '*') {
      next.setMinutes(parseInt(minute, 10));
      next.setSeconds(0);
      next.setMilliseconds(0);
    }
    
    if (hour !== '*') {
      next.setHours(parseInt(hour, 10));
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    }
    
    // Ensure next is in the future
    while (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * Process pending export queue
   */
  async processExportQueue() {
    if (this.processingQueue) return;
    
    this.processingQueue = true;
    
    try {
      const pendingJobs = await DataExport.getPendingJobs(5);
      
      for (const job of pendingJobs) {
        await this.processExportJob(job);
      }
    } catch (error) {
      logger.error('Error processing export queue:', error.message);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Process a single export job
   */
  async processExportJob(job) {
    try {
      job.startedAt = new Date();
      job.status = 'processing';
      await job.save();

      const supplier = await Supplier.findById(job.supplier).select('+sftpConfig.password');
      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const tables = await DataTable.find({ 
        _id: { $in: job.tables.map(t => t.table) } 
      });

      if (job.sftp.enabled) {
        // SFTP export
        const sftpConfig = {
          host: job.sftp.host || supplier.sftpConfig.host,
          port: supplier.sftpConfig.port,
          username: supplier.sftpConfig.username,
          password: supplier.sftpConfig.password,
          remotePath: job.sftp.remotePath || supplier.sftpConfig.remotePath,
        };

        for (const table of tables) {
          await sftpExportService.exportAndUpload({
            table,
            supplier,
            sftpConfig,
            format: job.config.format,
            options: job.config,
            triggeredBy: job.triggeredBy,
            correlationId: job.correlationId,
          });
        }
      }

      await job.markCompleted({});
    } catch (error) {
      await job.markFailed({
        message: error.message,
        retryable: error.code !== 'VALIDATION_ERROR',
      });
    }
  }

  /**
   * Cleanup old exports
   */
  async cleanupOldExports() {
    try {
      const deletedCount = await DataExport.cleanupOldExports(30);
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old export records`);
      }
    } catch (error) {
      logger.error('Error cleaning up old exports:', error.message);
    }
  }

  /**
   * Manually trigger export for a supplier
   */
  async triggerExport(supplierId, tableIds = null) {
    const supplier = await Supplier.findById(supplierId).select('+sftpConfig.password +sftpConfig.privateKey');
    
    if (!supplier) {
      throw new Error('Supplier not found');
    }
    
    if (!supplier.sftpConfig?.enabled) {
      throw new Error('SFTP not configured for this supplier');
    }

    const query = { supplier: supplierId, status: 'active' };
    if (tableIds && tableIds.length > 0) {
      query._id = { $in: tableIds };
    } else {
      query['settings.sftpExport.enabled'] = true;
    }

    const tables = await DataTable.find(query);
    
    if (tables.length === 0) {
      throw new Error('No tables found for export');
    }

    const sftpConfig = {
      host: supplier.sftpConfig.host,
      port: supplier.sftpConfig.port,
      username: supplier.sftpConfig.username,
      password: supplier.sftpConfig.password,
      privateKey: supplier.sftpConfig.privateKey,
      remotePath: supplier.sftpConfig.remotePath,
    };

    return sftpExportService.batchExportAndUpload({
      tables,
      supplier,
      sftpConfig,
      format: 'csv',
      triggeredBy: { type: 'user', name: 'Manual Trigger' },
    });
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      processingQueue: this.processingQueue,
      scheduledJobsCount: this.scheduledJobs.size,
    };
  }
}

module.exports = new SupplierExportScheduler();
