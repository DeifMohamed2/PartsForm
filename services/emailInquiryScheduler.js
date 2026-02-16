/**
 * Email Inquiry Scheduler Service
 * Background service that periodically checks for new emails
 * and processes them through the AI pipeline
 * 
 * OOM Prevention:
 * - Log throttling to prevent spam during MongoDB outages
 * - Circuit breaker for MongoDB operations
 */
const cron = require('node-cron');
const emailService = require('./emailService');
const emailInquiryProcessor = require('./emailInquiryProcessor');
const EmailInquiry = require('../models/EmailInquiry');

// OOM Prevention utilities
const { circuitBreakers, logThrottle, isConnectionError } = require('../utils/oomPrevention');

class EmailInquiryScheduler {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
    this.lastCheckTime = null;
    this.useIdleMode = true; // Use IMAP IDLE for real-time detection
    this.stats = {
      totalChecks: 0,
      totalEmailsProcessed: 0,
      totalQuotationsSent: 0,
      errors: 0,
      lastError: null,
    };
    
    // Configuration
    this.config = {
      // Check interval in minutes (default: every 2 minutes) - used as fallback
      checkIntervalMinutes: parseInt(process.env.EMAIL_CHECK_INTERVAL, 10) || 2,
      // Enable/disable email processing
      enabled: process.env.EMAIL_PROCESSING_ENABLED !== 'false',
      // Max emails to process per batch
      maxBatchSize: parseInt(process.env.EMAIL_BATCH_SIZE, 10) || 10,
      // Retry failed inquiries
      retryFailedEnabled: process.env.EMAIL_RETRY_FAILED !== 'false',
      retryIntervalHours: parseInt(process.env.EMAIL_RETRY_INTERVAL_HOURS, 10) || 1,
      // Use IDLE mode (real-time) vs polling
      useIdleMode: process.env.EMAIL_USE_IDLE !== 'false',
    };
  }

  /**
   * Initialize and start the scheduler
   */
  async initialize() {
    if (!this.config.enabled) {
      console.log('📧 Email inquiry processing is DISABLED');
      return false;
    }

    // Check if email service is configured
    if (!emailService.isConfigured()) {
      console.warn('⚠️  Email service not configured - scheduler will not start');
      console.log('   Please set EMAIL_IMAP_* and EMAIL_SMTP_* environment variables');
      return false;
    }

    try {
      // Initialize email connections
      await emailService.connectImap();
      emailService.initializeSmtp();
      await emailService.verifySmtp();

      console.log('✅ Email inquiry scheduler initialized');
      return true;
    } catch (error) {
      console.error('❌ Email scheduler initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Start the scheduled email checking
   */
  start() {
    if (!this.config.enabled) {
      console.log('📧 Email processing disabled, not starting scheduler');
      return;
    }

    if (this.isRunning) {
      console.log('⚠️  Email scheduler already running');
      return;
    }

    // Try IDLE mode first (real-time), fall back to polling
    if (this.config.useIdleMode) {
      this.startIdleMode();
    } else {
      this.startPollingMode();
    }

    // Schedule retry of failed inquiries
    if (this.config.retryFailedEnabled) {
      const retryInterval = this.config.retryIntervalHours;
      const retryCron = `0 */${retryInterval} * * *`; // Every X hours
      
      cron.schedule(retryCron, async () => {
        await this.retryFailedInquiries();
      });
      
      console.log(`🔄 Failed inquiry retry scheduled - every ${retryInterval} hour(s)`);
    }
  }

  /**
   * Start IDLE mode for real-time email detection
   */
  async startIdleMode() {
    try {
      // Start IMAP IDLE - get notified instantly when new email arrives
      await emailService.startIdle(async (numNewMsgs) => {
        console.log(`📩 Real-time: ${numNewMsgs} new email(s) detected!`);
        await this.processNewlyArrivedEmails(numNewMsgs);
      });

      this.isRunning = true;
      this.useIdleMode = true;
      console.log('📧 Email inquiry scheduler started - REAL-TIME MODE (IMAP IDLE)');
      console.log('   ✨ Only new emails will be processed when they arrive!');
      console.log('   📭 Waiting for new emails...');

      // NO initial check - only process truly new emails when they arrive

    } catch (error) {
      console.error('❌ IDLE mode failed, falling back to polling:', error.message);
      this.useIdleMode = false;
      this.startPollingMode();
    }
  }

  /**
   * Start polling mode (fallback)
   */
  startPollingMode() {
    const interval = this.config.checkIntervalMinutes;
    const cronExpression = `*/${interval} * * * *`; // Every X minutes

    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.checkAndProcessEmails();
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC',
    });

    this.isRunning = true;
    this.useIdleMode = false;
    console.log(`📧 Email inquiry scheduler started - POLLING MODE (every ${interval} minutes)`);

    // Run initial check immediately
    this.checkAndProcessEmails();
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    if (this.useIdleMode) {
      emailService.stopIdle();
    }
    this.isRunning = false;
    emailService.disconnect();
    console.log('📧 Email inquiry scheduler stopped');
  }

  /**
   * Check for new emails and process them
   */
  async checkAndProcessEmails() {
    if (emailInquiryProcessor.isProcessing) {
      console.log('⏳ Email processing in progress, skipping this cycle');
      return;
    }

    this.stats.totalChecks++;
    this.lastCheckTime = new Date();

    try {
      console.log('📬 Checking for new emails...');
      
      const result = await emailInquiryProcessor.processNewEmails();
      
      if (result.processed > 0) {
        this.stats.totalEmailsProcessed += result.processed;
        console.log(`✅ Processed ${result.processed} new email(s)`);
      }

      if (result.errors && result.errors.length > 0) {
        this.stats.errors += result.errors.length;
        this.stats.lastError = result.errors[result.errors.length - 1];
      }

      // Emit event for real-time updates (if socket.io is available)
      this.emitStatusUpdate();

    } catch (error) {
      console.error('❌ Email check error:', error.message);
      this.stats.errors++;
      this.stats.lastError = error.message;
    }
  }

  /**
   * Process ONLY newly arrived emails (called from IDLE mode)
   * @param {number} numNewMsgs - Number of new messages detected by IDLE
   */
  async processNewlyArrivedEmails(numNewMsgs) {
    if (emailInquiryProcessor.isProcessing) {
      console.log('⏳ Email processing in progress, will retry...');
      // Retry after a short delay
      setTimeout(() => this.processNewlyArrivedEmails(numNewMsgs), 2000);
      return;
    }

    this.stats.totalChecks++;
    this.lastCheckTime = new Date();

    try {
      // Use the new method that only fetches the latest N emails
      const result = await emailInquiryProcessor.processLatestEmails(numNewMsgs);
      
      if (result.processed > 0) {
        this.stats.totalEmailsProcessed += result.processed;
        console.log(`✅ Processed ${result.processed} new email(s)`);
      }

      if (result.errors && result.errors.length > 0) {
        this.stats.errors += result.errors.length;
        this.stats.lastError = result.errors[result.errors.length - 1];
      }

      // Emit event for real-time updates
      this.emitStatusUpdate();

    } catch (error) {
      console.error('❌ New email processing error:', error.message);
      this.stats.errors++;
      this.stats.lastError = error.message;
    }
  }

  /**
   * Retry failed inquiries
   */
  async retryFailedInquiries() {
    try {
      // Check circuit breaker before hitting MongoDB
      if (!circuitBreakers.mongodb.isAvailable()) {
        logThrottle.log('email-retry-circuit', '⏸️  Skipping failed inquiry retry - MongoDB circuit open');
        return;
      }
      
      const failedInquiries = await EmailInquiry.find({
        status: 'failed',
        'error.retryCount': { $lt: 3 }, // Max 3 retries
        'error.occurredAt': {
          $lt: new Date(Date.now() - 30 * 60 * 1000), // At least 30 min old
        },
      }).limit(5);

      // Record success for MongoDB circuit
      circuitBreakers.mongodb.recordSuccess();

      if (failedInquiries.length === 0) {
        return;
      }

      console.log(`🔄 Retrying ${failedInquiries.length} failed inquiry(ies)...`);

      for (const inquiry of failedInquiries) {
        try {
          await emailInquiryProcessor.retryInquiry(inquiry._id);
        } catch (error) {
          console.error(`Retry failed for ${inquiry._id}:`, error.message);
        }
      }
    } catch (error) {
      if (isConnectionError(error)) {
        circuitBreakers.mongodb.recordFailure(error);
        logThrottle.error('email-retry-conn', `Failed inquiry retry (MongoDB unavailable): ${error.message}`);
      } else {
        logThrottle.error('email-retry-error', `Failed inquiry retry error: ${error.message}`);
      }
    }
  }

  /**
   * Emit status update for real-time monitoring
   */
  emitStatusUpdate() {
    // This can be connected to Socket.IO for real-time admin dashboard updates
    const status = this.getStatus();
    
    // If socket service is available, emit update
    try {
      const socketService = require('./socketService');
      if (socketService && socketService.io) {
        socketService.io.to('admin').emit('emailInquiryStatus', status);
      }
    } catch {
      // Socket service not available, ignore
    }
  }

  /**
   * Get current scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      enabled: this.config.enabled,
      mode: this.useIdleMode ? 'realtime' : 'polling',
      lastCheckTime: this.lastCheckTime,
      checkIntervalMinutes: this.config.checkIntervalMinutes,
      stats: this.stats,
      emailServiceConnected: emailService.isConnected,
      isIdling: emailService.isIdling,
    };
  }

  /**
   * Get statistics summary
   */
  async getStatistics() {
    const inquiryStats = await EmailInquiry.getStats();
    const unreadCount = await EmailInquiry.getUnreadCount();

    return {
      scheduler: this.getStatus(),
      inquiries: inquiryStats,
      unreadCount,
    };
  }

  /**
   * Manually trigger email check
   */
  async triggerManualCheck() {
    console.log('📧 Manual email check triggered');
    return this.checkAndProcessEmails();
  }

  /**
   * Test email configuration
   */
  async testConfiguration() {
    const results = {
      imap: { success: false, error: null },
      smtp: { success: false, error: null },
    };

    // Test IMAP
    try {
      await emailService.connectImap();
      results.imap.success = true;
    } catch (error) {
      results.imap.error = error.message;
    }

    // Test SMTP
    try {
      await emailService.verifySmtp();
      results.smtp.success = true;
    } catch (error) {
      results.smtp.error = error.message;
    }

    return results;
  }
}

// Singleton instance
const emailInquiryScheduler = new EmailInquiryScheduler();

module.exports = emailInquiryScheduler;
