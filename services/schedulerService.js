/**
 * Scheduler Service
 * Manages cron-based scheduled syncing for integrations
 * Supports both main process sync and worker process sync
 */
const cron = require('node-cron');
const mongoose = require('mongoose');
const Integration = require('../models/Integration');
const syncService = require('./syncService');

class SchedulerService {
  constructor() {
    this.tasks = new Map();
    this.isInitialized = false;
    this.useWorker = process.env.SYNC_USE_WORKER === 'true';
  }

  /**
   * Trigger sync - either via worker or main process
   */
  async triggerSync(integrationId) {
    if (this.useWorker) {
      // Create sync request for worker to pick up
      const db = mongoose.connection.db;

      // Check if already syncing
      const existing = await db.collection('sync_requests').findOne({
        integrationId,
        status: { $in: ['pending', 'processing'] },
      });

      if (existing) {
        console.log(`⏭️  Sync already in progress for ${integrationId}`);
        return;
      }

      await db.collection('sync_requests').insertOne({
        integrationId,
        status: 'pending',
        createdAt: new Date(),
        source: 'scheduler',
        progress: { status: 'pending', phase: 'queued' },
      });

      console.log(`📤 Scheduled sync request sent to worker: ${integrationId}`);
    } else {
      // Direct sync in main process
      await syncService.syncIntegration(integrationId);
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
      // First, cleanup any stuck "syncing" status from previous server instance
      const stuckSyncing = await Integration.updateMany(
        { status: 'syncing' },
        {
          $set: {
            status: 'error',
            'lastSync.status': 'failed',
            'lastSync.error': 'Sync interrupted by server restart',
          },
        },
      );
      if (stuckSyncing.modifiedCount > 0) {
        console.log(
          `🔧 Cleaned up ${stuckSyncing.modifiedCount} stuck syncing integrations`,
        );
      }

      const integrations = await Integration.find({
        'syncSchedule.enabled': true,
        status: { $in: ['active', 'inactive'] },
      });

      console.log(
        `📅 Initializing scheduler for ${integrations.length} integrations...`,
      );

      for (const integration of integrations) {
        await this.scheduleIntegration(integration);
      }

      this.isInitialized = true;
      console.log(`✅ Scheduler initialized with ${this.tasks.size} tasks`);
    } catch (error) {
      console.error('❌ Scheduler initialization failed:', error.message);
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
    for (const [id, task] of this.tasks) {
      task.stop();
    }
    this.tasks.clear();
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
    };
  }
}

// Export singleton
const schedulerService = new SchedulerService();
module.exports = schedulerService;
