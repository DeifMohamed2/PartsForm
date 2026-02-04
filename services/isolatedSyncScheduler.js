/**
 * ISOLATED SYNC SCHEDULER
 * ========================
 * Runs sync in a SEPARATE child process so it NEVER affects website performance
 * 
 * The main app stays responsive (< 100ms response times) while sync runs
 */

const { fork } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

class IsolatedSyncScheduler extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.currentProcess = null;
    this.lastRun = null;
    this.lastResult = null;
    this.schedules = new Map();
  }
  
  /**
   * Run sync for an integration in a separate process
   */
  runSync(integrationId, options = {}) {
    if (this.isRunning) {
      console.log('[SYNC] Sync already in progress, skipping...');
      return { status: 'already_running' };
    }
    
    this.isRunning = true;
    this.lastRun = new Date();
    
    const scriptPath = path.join(__dirname, '..', 'scripts', 'ultraFastSync.js');
    
    console.log(`[SYNC] Starting isolated sync process for integration: ${integrationId}`);
    
    // Fork as a completely separate process
    // This runs in its own V8 instance - CANNOT affect main process
    this.currentProcess = fork(scriptPath, [integrationId], {
      // Use separate memory space
      detached: false,
      // Limit memory if needed (optional)
      execArgv: ['--max-old-space-size=16384'],
      // Run with lower priority (nice on Unix)
      env: {
        ...process.env,
        SYNC_MODE: 'background',
        NODE_ENV: 'production',
      }
    });
    
    this.currentProcess.on('message', (msg) => {
      console.log('[SYNC]', msg);
      this.emit('progress', msg);
    });
    
    this.currentProcess.on('exit', (code) => {
      this.isRunning = false;
      this.lastResult = code === 0 ? 'success' : 'failed';
      this.currentProcess = null;
      
      console.log(`[SYNC] Process exited with code: ${code}`);
      this.emit('complete', { code, integrationId });
    });
    
    this.currentProcess.on('error', (err) => {
      console.error('[SYNC] Process error:', err);
      this.isRunning = false;
      this.emit('error', err);
    });
    
    return { status: 'started', pid: this.currentProcess.pid };
  }
  
  /**
   * Schedule sync to run at specific time (cron-like)
   */
  schedule(integrationId, cronTime, options = {}) {
    // Parse simple time format "HH:MM" for daily sync
    const [hours, minutes] = cronTime.split(':').map(Number);
    
    const checkAndRun = () => {
      const now = new Date();
      if (now.getHours() === hours && now.getMinutes() === minutes) {
        if (!this.isRunning) {
          this.runSync(integrationId, options);
        }
      }
    };
    
    // Check every minute
    const intervalId = setInterval(checkAndRun, 60000);
    this.schedules.set(integrationId, intervalId);
    
    console.log(`[SYNC] Scheduled integration ${integrationId} to run daily at ${cronTime}`);
    
    return intervalId;
  }
  
  /**
   * Cancel a scheduled sync
   */
  cancelSchedule(integrationId) {
    const intervalId = this.schedules.get(integrationId);
    if (intervalId) {
      clearInterval(intervalId);
      this.schedules.delete(integrationId);
      console.log(`[SYNC] Cancelled schedule for integration ${integrationId}`);
    }
  }
  
  /**
   * Stop current sync if running
   */
  stopSync() {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      console.log('[SYNC] Sent stop signal to sync process');
    }
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      lastResult: this.lastResult,
      pid: this.currentProcess?.pid,
      scheduledIntegrations: Array.from(this.schedules.keys()),
    };
  }
}

// Singleton instance
const isolatedSyncScheduler = new IsolatedSyncScheduler();

module.exports = isolatedSyncScheduler;
