#!/usr/bin/env node
/**
 * TURBO SYNC WORKER v2.0
 * ======================
 * Professional-grade high-performance sync engine
 * Target: 75M records in 30 minutes (~42k records/sec)
 * 
 * Uses TURBO ENGINE with:
 * - Parallel FTP downloads
 * - NDJSON transformation (10x faster than streaming)
 * - mongoimport (native Go, 16 workers) when available
 * - Bulk MongoDB inserts with w:0 as fallback
 * - Parallel ES bulk indexing with refresh disabled
 * 
 * Architecture:
 * ┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
 * │  FTP Server │ ──▶ │ Transform    │ ──▶ │ mongoimport │ ──▶ │  ES Bulk    │
 * │  (parallel) │     │ (NDJSON)     │     │ (16 workers)│     │  (parallel) │
 * └─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
 * 
 * OOM Prevention:
 * - Circuit breakers for MongoDB/ES (fail fast when unavailable)
 * - Log throttling (prevent log spam during outages)
 * - Memory watchdog (stop before OOM)
 * - Exponential backoff on failures
 */

require('dotenv').config();
const mongoose = require('mongoose');
const EventEmitter = require('events');
const Integration = require('../models/Integration');
const SyncHistory = require('../models/SyncHistory');
const { runTurboSync, CONFIG: TURBO_CONFIG } = require('./turboSyncEngine');

// OOM Prevention utilities
const { 
  circuitBreakers, 
  logThrottle, 
  memoryWatchdog, 
  ExponentialBackoff,
  isConnectionError 
} = require('../utils/oomPrevention');

// Increase event listener limit
EventEmitter.defaultMaxListeners = 100;

// Use TURBO mode by default for maximum speed
const USE_TURBO_ENGINE = process.env.SYNC_ENGINE !== 'legacy';

// Backoff for connection retries
const connectionBackoff = new ExponentialBackoff({
  baseDelayMs: 5000,
  maxDelayMs: 60000,
  maxRetries: 10,
});

// Legacy config (only used if turbo disabled)
const CONFIG = {
  POLL_INTERVAL: 1000,          // Check for requests every 1s
  POLL_INTERVAL_BACKOFF: 30000, // Backoff interval when services unavailable
};

class SyncWorker {
  constructor() {
    this.isProcessing = false;
    this.currentSync = null;
    this.shouldStop = false;
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'ERROR' ? '❌' : type === 'SUCCESS' ? '✅' : type === 'PROGRESS' ? '⏳' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  /**
   * Connect to MongoDB with retry
   */
  async connect() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';
    
    // Retry connection with exponential backoff
    await connectionBackoff.execute(
      async (attempt) => {
        if (attempt > 0) {
          this.log(`Retrying MongoDB connection (attempt ${attempt + 1})...`);
        }
        await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        });
      },
      {
        onRetry: (error, attempt, delay) => {
          this.log(`MongoDB connection failed: ${error.message}. Retry in ${delay/1000}s...`, 'ERROR');
          circuitBreakers.mongodb.recordFailure(error);
        },
        shouldRetry: (error) => isConnectionError(error),
      }
    );
    
    this.log('Connected to MongoDB');
    circuitBreakers.mongodb.recordSuccess();
    
    // Ensure sync_requests collection exists
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'sync_requests' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('sync_requests');
      this.log('Created sync_requests collection');
    }
    
    // Set up disconnect handler
    mongoose.connection.on('disconnected', () => {
      logThrottle.log('mongo-disconnect', '⚠️ MongoDB disconnected');
      circuitBreakers.mongodb.recordFailure(new Error('disconnected'));
    });
    
    mongoose.connection.on('reconnected', () => {
      this.log('MongoDB reconnected');
      circuitBreakers.mongodb.recordSuccess();
    });
  }

  /**
   * Update sync progress in MongoDB (main app reads this)
   */
  async updateProgress(requestId, progress) {
    const db = mongoose.connection.db;
    
    // Use elapsedMs from caller if provided, otherwise calculate from startTime
    let elapsedMs = progress.elapsedMs || 0;
    if (!elapsedMs && progress.startTime) {
      elapsedMs = Date.now() - progress.startTime;
    }
    
    const updatedProgress = {
      ...progress,
      elapsedMs,
      updatedAt: new Date()
    };
    
    await db.collection('sync_requests').updateOne(
      { _id: new mongoose.Types.ObjectId(requestId) },
      { 
        $set: { 
          progress: updatedProgress,
          updatedAt: new Date()
        } 
      }
    );
  }

  /**
   * Process a single sync request - TURBO MODE
   */
  async processSync(request) {
    const startTime = Date.now();
    const integrationId = request.integrationId;
    
    this.log(`Starting sync for integration: ${integrationId}`);
    
    try {
      // Get integration
      const integration = await Integration.findById(integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      // Update status
      integration.status = 'syncing';
      await integration.save();

      await this.updateProgress(request._id, {
        status: 'syncing',
        phase: 'starting',
        integrationName: integration.name,
        startTime,
        filesTotal: 0,
        filesProcessed: 0,
        recordsProcessed: 0,
        recordsInserted: 0,
      });

      let result;

      // USE TURBO ENGINE for maximum speed
      if (USE_TURBO_ENGINE) {
        this.log('🚀 Using TURBO ENGINE for maximum speed');
        
        await this.updateProgress(request._id, {
          phase: 'turbo',
          message: 'Starting Turbo Sync Engine...',
        });

        // Progress callback — turbo engine calls this with live stats
        const requestId = request._id;
        const progressCallback = async (data) => {
          try {
            await this.updateProgress(requestId, data);
          } catch (e) {
            // Swallow progress update errors
          }
        };
        
        const turboResult = await runTurboSync(integrationId, { onProgress: progressCallback });
        
        result = {
          success: turboResult.success,
          inserted: turboResult.records || 0,
          recordsProcessed: turboResult.records || 0,
          duration: turboResult.duration || Date.now() - startTime,
        };
        
      } else {
        // Legacy mode (fallback)
        this.log('Using legacy sync mode');
        result = await this.syncFTPLegacy(integration, request._id);
      }

      const duration = Date.now() - startTime;

      // Update integration status (turbo engine updates it too, but this is a safety net)
      await Integration.findByIdAndUpdate(integrationId, {
        status: 'active',
        lastSync: {
          date: new Date(),
          status: 'success',
          duration,
          recordsProcessed: result.recordsProcessed || 0,
          recordsInserted: result.inserted || 0,
          error: null,
        },
      });

      // Mark request as completed
      const db = mongoose.connection.db;
      await db.collection('sync_requests').updateOne(
        { _id: request._id },
        {
          $set: {
            status: 'completed',
            result: {
              success: true,
              duration,
              recordsProcessed: result.recordsProcessed,
              recordsInserted: result.inserted,
            },
            completedAt: new Date(),
          }
        }
      );

      // Update SyncHistory record if it exists
      if (request.syncHistoryId) {
        try {
          const syncHistory = await SyncHistory.findById(request.syncHistoryId);
          if (syncHistory) {
            await syncHistory.markCompleted({
              filesProcessed: request.progress?.filesProcessed || 0,
              recordsProcessed: result.recordsProcessed || 0,
              recordsInserted: result.inserted || 0,
            });
            this.log(`Updated sync history record: ${syncHistory._id}`);
          }
        } catch (historyError) {
          this.log(`Warning: Could not update sync history: ${historyError.message}`, 'ERROR');
        }
      }

      this.log(`Sync completed: ${(result.inserted || 0).toLocaleString()} records in ${(duration/1000/60).toFixed(1)} minutes`, 'SUCCESS');
      
      // Log memory usage after sync
      const memUsage = process.memoryUsage();
      this.log(`Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.log('Garbage collection triggered');
      }

    } catch (error) {
      this.log(`Sync failed: ${error.message}`, 'ERROR');
      
      // Mark request as failed
      const db = mongoose.connection.db;
      await db.collection('sync_requests').updateOne(
        { _id: request._id },
        {
          $set: {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          }
        }
      );

      // Update SyncHistory record if it exists
      if (request.syncHistoryId) {
        try {
          const syncHistory = await SyncHistory.findById(request.syncHistoryId);
          if (syncHistory) {
            await syncHistory.markFailed(error.message);
            this.log(`Updated sync history record as failed: ${syncHistory._id}`);
          }
        } catch (historyError) {
          this.log(`Warning: Could not update sync history: ${historyError.message}`, 'ERROR');
        }
      }

      // Update integration status
      try {
        await Integration.findByIdAndUpdate(integrationId, {
          status: 'error',
          'lastSync.status': 'failed',
          'lastSync.error': error.message,
        });
      } catch (e) {}
    }
  }

  /**
   * Legacy FTP Sync (fallback if turbo engine disabled)
   */
  async syncFTPLegacy(integration, requestId) {
    // Load services only when needed
    const ftpService = require('./ftpService');
    const csvParserService = require('./csvParserService');
    const Part = require('../models/Part');
    const elasticsearchService = require('./elasticsearchService');
    
    const ftpConfig = integration.ftp;
    
    // Step 1: Get file list
    await this.updateProgress(requestId, { phase: 'listing', message: 'Getting file list...' });
    
    const fileList = await ftpService.listFiles(ftpConfig);
    const pattern = ftpConfig.filePattern ? new RegExp(ftpConfig.filePattern.replace(/\*/g, '.*')) : null;
    const files = pattern ? fileList.filter(f => pattern.test(f.name)) : fileList;
    
    this.log(`Found ${files.length} files to process`);

    // Step 2: Delete old data FAST
    await this.updateProgress(requestId, { phase: 'deleting', message: 'Deleting old data...' });
    
    const deleteStart = Date.now();
    await Part.deleteByIntegration(integration._id.toString());
    this.log(`Deleted old data in ${((Date.now() - deleteStart)/1000).toFixed(1)}s`);

    // Prepare ES
    await elasticsearchService.prepareForBulkIndexing();

    // Step 3: Process files
    let totalRecords = 0;
    let totalInserted = 0;
    let filesProcessed = 0;
    const PARALLEL = 8;
    const FTP_RETRY_ATTEMPTS = 2;
    const FTP_RETRY_DELAY = 1000;

    // Download and process files in parallel batches
    for (let i = 0; i < files.length; i += PARALLEL) {
      const batch = files.slice(i, i + PARALLEL);
      const batchNum = Math.floor(i / PARALLEL) + 1;
      const totalBatches = Math.ceil(files.length / PARALLEL);
      
      await this.updateProgress(requestId, {
        status: 'syncing',
        phase: 'processing',
        message: `Processing files ${i + 1}-${Math.min(i + PARALLEL, files.length)} of ${files.length}...`,
        filesTotal: files.length,
        filesProcessed,
        recordsProcessed: totalRecords,
        recordsInserted: totalInserted,
      });

      // Process batch in parallel with retry logic
      const results = await Promise.all(
        batch.map(async (file) => {
          let lastError = null;
          
          // Retry loop for FTP failures
          for (let attempt = 1; attempt <= FTP_RETRY_ATTEMPTS; attempt++) {
            try {
              // Download file
              const tempPath = await ftpService.downloadToTempFileParallel(file.name, ftpConfig);
              
              // Parse and import
              const result = await csvParserService.parseAndImport(
                tempPath,
                {
                  integration: integration._id.toString(),
                  integrationName: integration.name,
                  fileName: file.name,
                  columnMapping: integration.mapping || {},
                  skipES: true,
                },
                null
              );

              // Cleanup temp file
              try { require('fs').unlinkSync(tempPath); } catch (e) {}

              return result;
            } catch (error) {
              lastError = error;
              if (attempt < FTP_RETRY_ATTEMPTS) {
                await new Promise(r => setTimeout(r, FTP_RETRY_DELAY * attempt));
              }
            }
          }
          
          this.log(`Error processing ${file.name}: ${lastError.message}`, 'ERROR');
          return { recordsProcessed: 0, inserted: 0, error: lastError.message };
        })
      );

      // Aggregate results
      for (const result of results) {
        totalRecords += result.recordsProcessed || 0;
        totalInserted += result.inserted || 0;
        filesProcessed++;
      }

      this.log(`Batch ${batchNum}/${totalBatches}: ${totalInserted.toLocaleString()} total records`);
    }

    // Reindex to ES
    if (totalInserted > 0) {
      await this.updateProgress(requestId, {
        phase: 'indexing',
        message: `Indexing ${totalInserted.toLocaleString()} records...`,
      });
      
      await elasticsearchService.reindexIntegration(integration._id.toString());
      await elasticsearchService.finalizeIndexing();
    }

    return {
      success: true,
      recordsProcessed: totalRecords,
      inserted: totalInserted,
      files: files.map(f => f.name),
    };
  }

  /**
   * Watch for new sync requests
   */
  async watchForRequests() {
    this.log('Watching for sync requests...');
    
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 10;
    
    while (!this.shouldStop) {
      try {
        // Check if MongoDB is available (circuit breaker)
        if (!circuitBreakers.mongodb.isAvailable()) {
          logThrottle.log('sync-worker-mongo-unavail', '⏸️  MongoDB circuit open - skipping sync check');
          await new Promise(resolve => setTimeout(resolve, CONFIG.POLL_INTERVAL_BACKOFF));
          continue;
        }
        
        // Memory guard - don't start sync if memory is too high
        const memStatus = memoryWatchdog.checkMemory();
        if (!memStatus.safe) {
          logThrottle.log('sync-worker-memory', `⏸️  Memory too high (${memStatus.usage.rss}MB) - skipping sync`);
          // Try to force GC if available
          memoryWatchdog.forceGC();
          await new Promise(resolve => setTimeout(resolve, CONFIG.POLL_INTERVAL_BACKOFF));
          continue;
        }
        
        if (!this.isProcessing) {
          const db = mongoose.connection.db;
          
          // Find pending request
          const request = await db.collection('sync_requests').findOne(
            { status: 'pending' },
            { sort: { createdAt: 1 } }
          );

          if (request) {
            this.isProcessing = true;
            this.currentSync = request;

            // Mark as processing
            await db.collection('sync_requests').updateOne(
              { _id: request._id },
              { $set: { status: 'processing', startedAt: new Date() } }
            );

            // Process the sync
            await this.processSync(request);

            this.isProcessing = false;
            this.currentSync = null;
          }
          
          // Reset error counter on success
          consecutiveErrors = 0;
          circuitBreakers.mongodb.recordSuccess();
        }
      } catch (error) {
        consecutiveErrors++;
        
        if (isConnectionError(error)) {
          circuitBreakers.mongodb.recordFailure(error);
          logThrottle.error('sync-worker-conn-error', `Watch error (connection): ${error.message}`);
        } else {
          logThrottle.error('sync-worker-error', `Watch error: ${error.message}`);
        }
        
        // Exponential backoff on consecutive errors
        if (consecutiveErrors >= maxConsecutiveErrors) {
          const backoffDelay = CONFIG.POLL_INTERVAL_BACKOFF * Math.min(consecutiveErrors / maxConsecutiveErrors, 3);
          this.log(`Too many errors (${consecutiveErrors}), backing off for ${backoffDelay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }

      // Wait before checking again (use normal interval if no errors)
      const pollInterval = consecutiveErrors > 0 ? CONFIG.POLL_INTERVAL_BACKOFF : CONFIG.POLL_INTERVAL;
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Start the worker
   */
  async start() {
    console.log('\n' + '='.repeat(60));
    console.log('� TURBO SYNC WORKER v2.0');
    console.log('='.repeat(60));
    console.log(`   Memory: ${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(0)} MB allocated`);
    console.log(`   Engine: ${USE_TURBO_ENGINE ? 'TURBO (mongoimport)' : 'Legacy (Node.js)'}`);
    console.log(`   Target: 75M records in ~30 minutes`);
    console.log('='.repeat(60) + '\n');

    await this.connect();
    await this.watchForRequests();
  }

  /**
   * Graceful shutdown
   */
  async stop() {
    this.log('Shutting down...');
    this.shouldStop = true;
    
    // Wait for current sync to complete
    while (this.isProcessing) {
      this.log('Waiting for current sync to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    await mongoose.disconnect();
    this.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Create and start worker
const worker = new SyncWorker();

// Handle shutdown signals
process.on('SIGTERM', () => worker.stop());
process.on('SIGINT', () => worker.stop());

// Start worker
worker.start().catch(error => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
