/**
 * Scheduler Service
 * Manages cron-based scheduled syncing for integrations
 * Supports both main process sync and worker process sync
 * 
 * ENHANCED FEATURES:
 * - Due sync detection: Automatically triggers overdue syncs
 * - Server restart recovery: Resumes syncs after server restart
 * - Health monitoring: Periodic checks for stuck syncs
 * - SyncHistory integration: Full sync history tracking
 */
const cron = require('node-cron');
const mongoose = require('mongoose');
const Integration = require('../models/Integration');
const SyncHistory = require('../models/SyncHistory');
const syncService = require('./syncService');

class SchedulerService {
  constructor() {
    this.tasks = new Map();
    this.isInitialized = false;
    this.useWorker = process.env.SYNC_USE_WORKER === 'true';
    this.healthCheckInterval = null;
    this.dueSyncCheckInterval = null;
    
    // Configuration
    this.config = {
      // How long a sync can be "running" before considered stuck (1 hour)
      stuckSyncThreshold: 60 * 60 * 1000,
      // Grace period after scheduled time to still trigger sync (2 hours)
      dueSyncGracePeriod: 2 * 60 * 60 * 1000,
      // How often to check for due/stuck syncs (every 5 minutes)
      healthCheckIntervalMs: 5 * 60 * 1000,
      // Delay before triggering due syncs after startup (30 seconds)
      startupDelay: 30 * 1000,
    };
  }

  /**
   * Trigger sync - either via worker or main process
   * @param {string} integrationId - Integration ID
   * @param {string} triggeredBy - What triggered the sync ('scheduler', 'manual', 'startup-recovery', etc)
   */
  async triggerSync(integrationId, triggeredBy = 'scheduler') {
    try {
      // Get integration for creating history record
      const integration = await Integration.findById(integrationId);
      if (!integration) {
        console.error(`❌ Integration not found: ${integrationId}`);
        return { success: false, error: 'Integration not found' };
      }
      
      // Create sync history record
      let syncHistoryRecord;
      try {
        syncHistoryRecord = await SyncHistory.createSyncRecord(integration, triggeredBy);
        console.log(`📝 Created sync history record: ${syncHistoryRecord._id}`);
      } catch (historyError) {
        console.error('Failed to create sync history record:', historyError.message);
        // Continue without history - don't block sync
      }
      
      if (this.useWorker) {
        // Create sync request for worker to pick up
        const db = mongoose.connection.db;

        // Clean up stale requests first
        await this._cleanupStaleRequests(integrationId);

        // Check if already syncing
        const existing = await db.collection('sync_requests').findOne({
          integrationId,
          status: { $in: ['pending', 'processing'] },
        });

        if (existing) {
          console.log(`⏭️  Sync already in progress for ${integrationId}`);
          if (syncHistoryRecord) {
            syncHistoryRecord.status = 'cancelled';
            syncHistoryRecord.errorSummary = 'Sync already in progress';
            await syncHistoryRecord.save();
          }
          return { success: false, error: 'Sync already in progress' };
        }

        await db.collection('sync_requests').insertOne({
          integrationId,
          status: 'pending',
          createdAt: new Date(),
          source: triggeredBy,
          syncHistoryId: syncHistoryRecord?._id,
          progress: { status: 'pending', phase: 'queued' },
        });

        console.log(`📤 Sync request sent to worker: ${integration.name} (${triggeredBy})`);
        return { success: true, message: 'Sync queued for worker' };
      } else {
        // Direct sync in main process
        // Mark history as running
        if (syncHistoryRecord) {
          await syncHistoryRecord.markRunning();
        }
        
        const result = await syncService.syncIntegration(integrationId, { syncHistoryId: syncHistoryRecord?._id });
        
        // Update history record with results
        if (syncHistoryRecord) {
          if (result.success) {
            await syncHistoryRecord.markCompleted({
              filesProcessed: result.filesProcessed || 0,
              recordsProcessed: result.recordsProcessed || 0,
              recordsInserted: result.inserted || 0,
              recordsUpdated: result.updated || 0,
              recordsSkipped: result.skipped || 0,
            });
          } else {
            await syncHistoryRecord.markFailed(result.error);
          }
        }
        
        return result;
      }
    } catch (error) {
      console.error(`❌ Error triggering sync for ${integrationId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up stale sync requests
   */
  async _cleanupStaleRequests(integrationId) {
    try {
      const db = mongoose.connection.db;
      const result = await db.collection('sync_requests').updateMany(
        {
          integrationId,
          status: { $in: ['pending', 'processing'] },
          createdAt: { $lt: new Date(Date.now() - this.config.stuckSyncThreshold) },
        },
        { $set: { status: 'stale', error: 'Cleaned up stale request' } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`🧹 Cleaned up ${result.modifiedCount} stale requests for ${integrationId}`);
      }
    } catch (error) {
      console.error('Error cleaning up stale requests:', error.message);
    }
  }

  /**
   * Convert sync schedule to cron expression
   */
  scheduleToCronExpression(schedule) {
    const { frequency, time, daysOfWeek, dayOfMonth } = schedule;
    const [hour, minute] = (time || '08:00').split(':').map(Number);

    switch (frequency) {
      case 'hourly':
        return `${minute} * * * *`;

      case 'every2hours':
        return `${minute} */2 * * *`;

      case 'every3hours':
        return `${minute} */3 * * *`;

      case 'every4hours':
        return `${minute} */4 * * *`;

      case '6hours':
      case 'every6hours':
        return `${minute} */6 * * *`;

      case 'every8hours':
        return `${minute} */8 * * *`;

      case '12hours':
      case 'every12hours':
        return `${minute} */12 * * *`;

      case 'daily':
        return `${minute} ${hour} * * *`;

      case 'weekly':
        if (daysOfWeek && daysOfWeek.length > 0) {
          return `${minute} ${hour} * * ${daysOfWeek.join(',')}`;
        }
        return `${minute} ${hour} * * 1`; // Default: Monday

      case 'monthly':
        return `${minute} ${hour} ${dayOfMonth || 1} * *`;

      default:
        return `${minute} ${hour} * * *`; // Default: daily
    }
  }

  /**
   * Schedule an integration for syncing
   */
  async scheduleIntegration(integration) {
    const integrationId = integration._id.toString();

    // Remove existing task
    if (this.tasks.has(integrationId)) {
      this.tasks.get(integrationId).stop();
      this.tasks.delete(integrationId);
    }

    // Don't schedule if sync is disabled
    if (!integration.syncSchedule?.enabled) {
      console.log(`⏸️  Sync disabled for: ${integration.name}`);
      return;
    }

    const cronExpression = this.scheduleToCronExpression(
      integration.syncSchedule,
    );

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      console.error(
        `❌ Invalid cron expression for ${integration.name}: ${cronExpression}`,
      );
      return;
    }

    const task = cron.schedule(
      cronExpression,
      async () => {
        console.log(`⏰ Scheduled sync triggered: ${integration.name}`);
        try {
          await this.triggerSync(integrationId);
        } catch (error) {
          console.error(
            `❌ Scheduled sync failed for ${integration.name}:`,
            error.message,
          );
        }
      },
      {
        scheduled: true,
        timezone: integration.syncSchedule.timezone || 'UTC',
      },
    );

    this.tasks.set(integrationId, task);
    console.log(
      `📅 Scheduled: ${integration.name} (${cronExpression})${this.useWorker ? ' [worker mode]' : ''}`,
    );
  }

  /**
   * Initialize scheduler with all enabled integrations
   */
  async initialize() {
    try {
      console.log('📅 Starting scheduler initialization...');
      
      // Step 1: Mark stale SyncHistory records as interrupted
      try {
        const staleCount = await SyncHistory.markStaleAsInterrupted();
        if (staleCount > 0) {
          console.log(`🧹 Marked ${staleCount} stale sync history records as interrupted`);
        }
      } catch (err) {
        console.error('Error marking stale history:', err.message);
      }
      
      // Step 2: Cleanup any stuck "syncing" status from previous server instance
      const stuckSyncing = await Integration.find({ status: 'syncing' });
      if (stuckSyncing.length > 0) {
        console.log(`🔧 Found ${stuckSyncing.length} integrations stuck in syncing state`);
        
        for (const integration of stuckSyncing) {
          // Create interrupted history record
          try {
            const historyRecord = await SyncHistory.createSyncRecord(integration, 'system');
            historyRecord.status = 'interrupted';
            historyRecord.errorSummary = 'Sync interrupted by server restart';
            historyRecord.completedAt = new Date();
            await historyRecord.save();
          } catch (err) {
            console.error('Error creating interrupted history:', err.message);
          }
          
          // Reset integration status
          integration.status = 'active';
          if (integration.lastSync) {
            integration.lastSync.status = 'interrupted';
            integration.lastSync.error = 'Sync interrupted by server restart';
          }
          await integration.save();
          console.log(`  ✓ Reset ${integration.name} status`);
        }
      }
      
      // Step 3: Clean up stale worker requests
      if (this.useWorker) {
        try {
          const db = mongoose.connection.db;
          const staleResult = await db.collection('sync_requests').updateMany(
            { status: { $in: ['pending', 'processing'] } },
            { $set: { status: 'stale', error: 'Server restarted' } }
          );
          if (staleResult.modifiedCount > 0) {
            console.log(`🧹 Cleaned up ${staleResult.modifiedCount} stale worker sync requests`);
          }
        } catch (err) {
          console.error('Error cleaning worker requests:', err.message);
        }
      }

      // Step 4: Schedule all enabled integrations
      const integrations = await Integration.find({
        'syncSchedule.enabled': true,
        status: { $in: ['active', 'inactive', 'error'] }, // Include error status for recovery
      });

      console.log(`📅 Scheduling ${integrations.length} integrations...`);

      for (const integration of integrations) {
        await this.scheduleIntegration(integration);
      }

      this.isInitialized = true;
      console.log(`✅ Scheduler initialized with ${this.tasks.size} tasks`);
      
      // Step 5: Start health check interval
      this._startHealthCheck();
      
      // Step 6: Check for due syncs after a short delay (let system stabilize)
      setTimeout(async () => {
        console.log('🔍 Checking for overdue syncs...');
        await this.checkAndTriggerDueSyncs();
      }, this.config.startupDelay);
      
    } catch (error) {
      console.error('❌ Scheduler initialization failed:', error.message);
    }
  }

  /**
   * Start periodic health check for stuck syncs and due syncs
   */
  _startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this._performHealthCheck();
      } catch (error) {
        console.error('Health check error:', error.message);
      }
    }, this.config.healthCheckIntervalMs);
    
    console.log(`🏥 Health check started (every ${this.config.healthCheckIntervalMs / 60000} minutes)`);
  }

  /**
   * Perform health check - detect stuck syncs and check for due syncs
   */
  async _performHealthCheck() {
    const now = Date.now();
    
    // Check for stuck integrations (syncing for too long)
    const stuckIntegrations = await Integration.find({
      status: 'syncing',
      'lastSync.date': { $lt: new Date(now - this.config.stuckSyncThreshold) },
    });
    
    for (const integration of stuckIntegrations) {
      console.log(`⚠️  Detected stuck sync: ${integration.name} - resetting...`);
      
      // Create interrupted history
      try {
        const historyRecord = await SyncHistory.createSyncRecord(integration, 'system');
        historyRecord.status = 'interrupted';
        historyRecord.errorSummary = 'Sync detected as stuck and reset by health check';
        historyRecord.completedAt = new Date();
        await historyRecord.save();
      } catch (err) {
        console.error('Error creating history for stuck sync:', err.message);
      }
      
      // Reset integration
      integration.status = 'error';
      if (integration.lastSync) {
        integration.lastSync.status = 'failed';
        integration.lastSync.error = 'Sync stuck and reset by system';
      }
      await integration.save();
    }
    
    // Check and trigger due syncs periodically
    await this.checkAndTriggerDueSyncs();
  }

  /**
   * Check if any syncs are overdue and trigger them
   */
  async checkAndTriggerDueSyncs() {
    try {
      const integrations = await Integration.find({
        'syncSchedule.enabled': true,
        status: { $in: ['active', 'inactive', 'error'] },
      });
      
      const now = new Date();
      let triggeredCount = 0;
      
      for (const integration of integrations) {
        // Skip if currently syncing
        if (integration.status === 'syncing') continue;
        
        // Check if sync is due
        const isDue = this._isSyncDue(integration, now);
        
        if (isDue) {
          const lastSyncTime = integration.lastSync?.date 
            ? new Date(integration.lastSync.date).toLocaleString() 
            : 'never';
          console.log(`⏰ Sync overdue for ${integration.name} (last sync: ${lastSyncTime})`);
          
          // Trigger the sync
          await this.triggerSync(integration._id.toString(), 'startup-recovery');
          triggeredCount++;
          
          // Add small delay between triggers to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (triggeredCount > 0) {
        console.log(`🚀 Triggered ${triggeredCount} overdue sync(s)`);
      }
      
      return triggeredCount;
    } catch (error) {
      console.error('Error checking due syncs:', error.message);
      return 0;
    }
  }

  /**
   * Check if a sync is due based on schedule
   * @param {Object} integration - Integration document
   * @param {Date} now - Current time
   * @returns {boolean} - True if sync is due
   */
  _isSyncDue(integration, now) {
    if (!integration.syncSchedule?.enabled) return false;
    
    const lastSync = integration.lastSync?.date ? new Date(integration.lastSync.date) : null;
    
    // If never synced, it's due
    if (!lastSync) return true;
    
    // Calculate expected interval in milliseconds
    const intervalMs = this._getIntervalMs(integration.syncSchedule.frequency);
    if (!intervalMs) return false; // Manual frequency
    
    // Add grace period to allow for some delay
    const dueTime = new Date(lastSync.getTime() + intervalMs + this.config.dueSyncGracePeriod);
    
    // It's due if current time is past the due time
    return now > dueTime;
  }

  /**
   * Get interval in milliseconds for a frequency
   */
  _getIntervalMs(frequency) {
    const hourMs = 60 * 60 * 1000;
    
    switch (frequency) {
      case 'hourly': return 1 * hourMs;
      case 'every2hours': return 2 * hourMs;
      case 'every3hours': return 3 * hourMs;
      case 'every4hours': return 4 * hourMs;
      case '6hours':
      case 'every6hours': return 6 * hourMs;
      case 'every8hours': return 8 * hourMs;
      case '12hours':
      case 'every12hours': return 12 * hourMs;
      case 'daily': return 24 * hourMs;
      case 'weekly': return 7 * 24 * hourMs;
      case 'monthly': return 30 * 24 * hourMs;
      case 'manual': return null;
      default: return 24 * hourMs;
    }
  }

  /**
   * Reschedule an integration (after update)
   */
  async rescheduleIntegration(integrationId) {
    try {
      const integration = await Integration.findById(integrationId);
      if (integration) {
        await this.scheduleIntegration(integration);
      }
    } catch (error) {
      console.error(`❌ Error rescheduling ${integrationId}:`, error.message);
    }
  }

  /**
   * Stop schedule for an integration
   */
  stopIntegration(integrationId) {
    const id = integrationId.toString();
    if (this.tasks.has(id)) {
      this.tasks.get(id).stop();
      this.tasks.delete(id);
      console.log(`⏹️  Stopped schedule for ${id}`);
    }
  }

  /**
   * Stop all scheduled tasks
   */
  stopAll() {
    // Stop health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Stop all cron tasks
    for (const [id, task] of this.tasks) {
      task.stop();
    }
    this.tasks.clear();
    this.isInitialized = false;
    console.log('⏹️  All scheduled tasks stopped');
  }

  /**
   * Get status of all scheduled tasks
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      taskCount: this.tasks.size,
      tasks: Array.from(this.tasks.keys()),
      useWorker: this.useWorker,
      healthCheckActive: !!this.healthCheckInterval,
      config: this.config,
    };
  }

  /**
   * Force trigger sync for an integration (manual trigger)
   */
  async forceTriggerSync(integrationId) {
    return this.triggerSync(integrationId, 'manual');
  }

  /**
   * Get sync history for an integration
   */
  async getSyncHistory(integrationId, limit = 20) {
    return SyncHistory.getRecentByIntegration(integrationId, limit);
  }

  /**
   * Get all sync history (for dashboard)
   */
  async getAllSyncHistory(options = {}) {
    const { limit = 50, status, integrationId, startDate, endDate } = options;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (integrationId) {
      query.integration = integrationId;
    }
    
    if (startDate || endDate) {
      query.startedAt = {};
      if (startDate) query.startedAt.$gte = new Date(startDate);
      if (endDate) query.startedAt.$lte = new Date(endDate);
    }
    
    return SyncHistory.find(query)
      .sort({ startedAt: -1 })
      .limit(limit)
      .populate('integration', 'name type')
      .lean();
  }
}

// Export singleton
const schedulerService = new SchedulerService();
module.exports = schedulerService;
