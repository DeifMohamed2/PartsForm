#!/usr/bin/env node
/**
 * DEDICATED SYNC WORKER
 * ======================
 * Runs as a COMPLETELY SEPARATE PM2 process
 * Has its own memory space - NEVER affects website performance
 * 
 * Communication with main app via MongoDB (sync requests collection)
 * 
 * This worker:
 * 1. Watches for sync requests in MongoDB
 * 2. Processes syncs with maximum speed (no throttling)
 * 3. Updates progress in MongoDB (main app reads it)
 * 4. Stays running and waits for next request
 */

require('dotenv').config();
const mongoose = require('mongoose');
const EventEmitter = require('events');
const ftpService = require('./ftpService');
const csvParserService = require('./csvParserService');
const elasticsearchService = require('./elasticsearchService');
const Integration = require('../models/Integration');
const Part = require('../models/Part');

// Increase event listener limit for high-performance sync
EventEmitter.defaultMaxListeners = 50;

// Configuration for MAXIMUM SPEED (no website to worry about)
const CONFIG = {
  PARALLEL_DOWNLOADS: 30,       // Max parallel FTP downloads
  BATCH_SIZE: 100000,           // 100k records per batch
  ES_BULK_SIZE: 25000,          // ES bulk size
  ES_PARALLEL_BULKS: 10,        // Concurrent ES operations
  POLL_INTERVAL: 2000,          // Check for new requests every 2s
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
   * Connect to MongoDB
   */
  async connect() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';
    await mongoose.connect(mongoUri);
    this.log('Connected to MongoDB');
    
    // Ensure sync_requests collection exists
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'sync_requests' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('sync_requests');
      this.log('Created sync_requests collection');
    }
  }

  /**
   * Update sync progress in MongoDB (main app reads this)
   */
  async updateProgress(requestId, progress) {
    const db = mongoose.connection.db;
    await db.collection('sync_requests').updateOne(
      { _id: new mongoose.Types.ObjectId(requestId) },
      { 
        $set: { 
          progress,
          updatedAt: new Date()
        } 
      }
    );
  }

  /**
   * Process a single sync request
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
        phase: 'connecting',
        integrationName: integration.name,
        startTime,
      });

      // Prepare ES for bulk indexing
      await elasticsearchService.prepareForBulkIndexing();

      let result;
      if (integration.type === 'ftp') {
        result = await this.syncFTP(integration, request._id);
      } else {
        throw new Error(`Unsupported integration type: ${integration.type}`);
      }

      // Reindex to ES after MongoDB import
      if (result.success && result.inserted > 0) {
        await this.updateProgress(request._id, {
          status: 'syncing',
          phase: 'indexing',
          message: `Indexing ${result.inserted.toLocaleString()} records to Elasticsearch...`,
        });

        this.log(`Starting ES reindex for ${result.inserted.toLocaleString()} records...`);
        
        await elasticsearchService.reindexIntegration(
          integration._id.toString(),
          (prog) => {
            this.updateProgress(request._id, {
              phase: 'indexing',
              message: `ES: ${prog.indexed.toLocaleString()} docs (${prog.rate.toLocaleString()}/s)`,
            });
          }
        );
      }

      const duration = Date.now() - startTime;

      // Update integration status
      integration.status = 'active';
      integration.lastSync = {
        date: new Date(),
        status: 'success',
        duration,
        recordsProcessed: result.recordsProcessed || 0,
        recordsInserted: result.inserted || 0,
        error: null,
      };
      integration.stats.totalRecords += result.inserted || 0;
      integration.stats.lastSyncRecords = result.recordsProcessed || 0;
      integration.stats.totalSyncs = (integration.stats.totalSyncs || 0) + 1;
      integration.stats.successfulSyncs = (integration.stats.successfulSyncs || 0) + 1;
      await integration.save();

      await elasticsearchService.finalizeIndexing();

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

      this.log(`Sync completed: ${result.inserted.toLocaleString()} records in ${(duration/1000/60).toFixed(1)} minutes`, 'SUCCESS');

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
   * Sync FTP integration with MAXIMUM SPEED
   */
  async syncFTP(integration, requestId) {
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

    // Step 3: Process files in PARALLEL
    let totalRecords = 0;
    let totalInserted = 0;
    let filesProcessed = 0;

    // Download and process files in parallel batches
    for (let i = 0; i < files.length; i += CONFIG.PARALLEL_DOWNLOADS) {
      const batch = files.slice(i, i + CONFIG.PARALLEL_DOWNLOADS);
      const batchNum = Math.floor(i / CONFIG.PARALLEL_DOWNLOADS) + 1;
      const totalBatches = Math.ceil(files.length / CONFIG.PARALLEL_DOWNLOADS);
      
      await this.updateProgress(requestId, {
        phase: 'processing',
        message: `Processing files ${i + 1}-${Math.min(i + CONFIG.PARALLEL_DOWNLOADS, files.length)} of ${files.length} (${CONFIG.PARALLEL_DOWNLOADS} parallel)...`,
        filesTotal: files.length,
        filesProcessed,
        recordsTotal: totalRecords,
        recordsInserted: totalInserted,
      });

      // Process batch in parallel
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            // Download file - pass filename first, then FTP credentials
            const tempPath = await ftpService.downloadToTempFileParallel(file.name, ftpConfig);
            
            // Parse and import with MAXIMUM speed settings
            const result = await csvParserService.parseAndImport(
              tempPath,
              {
                integrationId: integration._id.toString(),
                integrationName: integration.name,
                fileName: file.name,
                mapping: integration.mapping || {},
                batchSize: CONFIG.BATCH_SIZE,
                skipES: true, // Defer ES indexing
              },
              null // No progress callback needed
            );

            // Cleanup temp file
            try { require('fs').unlinkSync(tempPath); } catch (e) {}

            return result;
          } catch (error) {
            this.log(`Error processing ${file.name}: ${error.message}`, 'ERROR');
            return { recordsProcessed: 0, inserted: 0, error: error.message };
          }
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
    
    while (!this.shouldStop) {
      try {
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
        }
      } catch (error) {
        this.log(`Watch error: ${error.message}`, 'ERROR');
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, CONFIG.POLL_INTERVAL));
    }
  }

  /**
   * Start the worker
   */
  async start() {
    console.log('\n' + '='.repeat(60));
    console.log('🔧 SYNC WORKER - Dedicated Process');
    console.log('='.repeat(60));
    console.log(`   Memory: ${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(0)} MB allocated`);
    console.log(`   Parallel Downloads: ${CONFIG.PARALLEL_DOWNLOADS}`);
    console.log(`   Batch Size: ${CONFIG.BATCH_SIZE.toLocaleString()}`);
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
