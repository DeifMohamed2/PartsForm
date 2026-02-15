/**
 * Sync Service
 * Handles synchronization of FTP and API integrations with real-time progress tracking
 * Based on the working implementation - closes FTP after each file
 */
const EventEmitter = require('events');
const ftpService = require('./ftpService');
const apiService = require('./apiService');
const csvParserService = require('./csvParserService');
const elasticsearchService = require('./elasticsearchService');
const Integration = require('../models/Integration');
const Part = require('../models/Part');

class SyncService extends EventEmitter {
  constructor() {
    super();
    this.syncingIntegrations = new Map();
    this.syncProgress = new Map();
    // Production mode - less logging, faster processing
    this.productionMode = process.env.NODE_ENV === 'production' || process.env.SYNC_PRODUCTION_MODE === 'true';
    this.debug = !this.productionMode;
    
    // Website-friendly mode: slower sync but keeps website responsive
    // Set SYNC_PRIORITY=low for balanced mode, or SYNC_PRIORITY=high for max speed (website may lag)
    this.syncPriority = process.env.SYNC_PRIORITY || 'low'; // 'low' = website first, 'high' = sync first
  }
  
  /**
   * Yield to event loop - allows web requests to be processed
   * Critical for keeping website responsive during heavy sync
   */
  async yieldToEventLoop(ms = 1) {
    return new Promise(resolve => setImmediate(() => setTimeout(resolve, ms)));
  }

  log(...args) {
    if (this.debug) console.log(...args);
  }

  /**
   * Get current sync progress for an integration
   */
  getSyncProgress(integrationId) {
    return this.syncProgress.get(integrationId) || null;
  }

  /**
   * Check if an integration is currently syncing
   */
  isSyncing(integrationId) {
    return this.syncingIntegrations.get(integrationId) || false;
  }

  /**
   * Update and emit sync progress
   */
  _updateProgress(integrationId, progress) {
    const current = this.syncProgress.get(integrationId) || {};
    
    // Calculate elapsed time if startTime exists
    let elapsedMs = progress.duration;
    if (!elapsedMs && current.startTime) {
      elapsedMs = Date.now() - current.startTime;
    }
    
    const updated = { 
      ...current, 
      ...progress, 
      elapsedMs,
      updatedAt: new Date() 
    };
    this.syncProgress.set(integrationId, updated);
    this.emit('progress', { integrationId, ...updated });
    return updated;
  }

  /**
   * Sync a single integration with real-time progress
   * @param {string} integrationId - Integration ID
   * @param {Object} options - Options including syncHistoryId
   */
  async syncIntegration(integrationId, options = {}) {
    const { syncHistoryId } = options;
    let syncHistoryRecord = null;
    
    // Load sync history record if provided
    if (syncHistoryId) {
      const SyncHistory = require('../models/SyncHistory');
      syncHistoryRecord = await SyncHistory.findById(syncHistoryId);
    }
    
    // Prevent concurrent syncs
    if (this.syncingIntegrations.get(integrationId)) {
      console.log(`⏭️  Sync already in progress for ${integrationId}`);
      if (syncHistoryRecord) {
        syncHistoryRecord.status = 'cancelled';
        syncHistoryRecord.errorSummary = 'Sync already in progress';
        syncHistoryRecord.completedAt = new Date();
        await syncHistoryRecord.save();
      }
      return { success: false, error: 'Sync already in progress' };
    }

    this.syncingIntegrations.set(integrationId, true);
    const startTime = Date.now();

    // Mark sync history as running
    if (syncHistoryRecord) {
      syncHistoryRecord.status = 'running';
      syncHistoryRecord.phase = 'connecting';
      syncHistoryRecord.startedAt = new Date(startTime);
      await syncHistoryRecord.save();
    }

    // Initialize progress
    this._updateProgress(integrationId, {
      status: 'starting',
      phase: 'connecting',
      filesTotal: 0,
      filesProcessed: 0,
      recordsTotal: 0,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      currentFile: null,
      errors: [],
      startTime,
    });

    try {
      const integration = await Integration.findById(integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      console.log(`🔄 Starting sync for: ${integration.name}`);

      // Prepare Elasticsearch for bulk indexing (faster)
      await elasticsearchService.prepareForBulkIndexing();

      // Update status to syncing
      integration.status = 'syncing';
      await integration.save();

      this._updateProgress(integrationId, {
        status: 'syncing',
        integrationName: integration.name,
        integrationType: integration.type,
      });

      let result;
      switch (integration.type) {
        case 'ftp':
          result = await this.syncFTP(integration, integrationId);
          break;
        case 'api':
          result = await this.syncAPI(integration, integrationId);
          break;
        case 'google-sheets':
          result = await this.syncGoogleSheets(integration, integrationId);
          break;
        default:
          throw new Error(`Unsupported integration type: ${integration.type}`);
      }

      // PHASE 2: Reindex to Elasticsearch AFTER MongoDB import is complete
      // This is MUCH faster than indexing during file processing
      const deferES = process.env.SYNC_DEFER_ES !== 'false'; // Default: true
      if (deferES && elasticsearchService.isAvailable && result.success && result.inserted > 0) {
        this._updateProgress(integrationId, {
          phase: 'indexing',
          message: `Indexing ${result.inserted.toLocaleString()} records to search engine...`,
        });
        
        console.log(`🔍 Starting deferred ES indexing for ${result.inserted.toLocaleString()} records...`);
        
        const esResult = await elasticsearchService.reindexIntegration(
          integration._id.toString(),
          (progress) => {
            this._updateProgress(integrationId, {
              phase: 'indexing',
              message: `ES indexing: ${progress.indexed.toLocaleString()} docs (${progress.rate.toLocaleString()}/s)`,
            });
          }
        );
        
        console.log(`✅ ES indexing complete: ${esResult.indexed.toLocaleString()} docs`);
      }

      const duration = Date.now() - startTime;

      // Update integration with sync results
      integration.status = result.success ? 'active' : 'error';
      integration.lastSync = {
        date: new Date(),
        status: result.success ? 'success' : 'failed',
        duration,
        recordsProcessed: result.recordsProcessed || 0,
        recordsInserted: result.inserted || 0,
        recordsUpdated: result.updated || 0,
        recordsSkipped: result.skipped || 0,
        error: result.error || null,
        files: result.files || [],
      };

      integration.stats.totalRecords += result.inserted || 0;
      integration.stats.lastSyncRecords = result.recordsProcessed || 0;
      integration.stats.totalSyncs = (integration.stats.totalSyncs || 0) + 1;
      if (result.success) {
        integration.stats.successfulSyncs = (integration.stats.successfulSyncs || 0) + 1;
      } else {
        integration.stats.failedSyncs = (integration.stats.failedSyncs || 0) + 1;
      }

      await integration.save();

      // Finalize Elasticsearch indexing (re-enable refresh and replicas)
      await elasticsearchService.finalizeIndexing();

      this.log(`✅ Sync completed for ${integration.name} in ${duration}ms`);

      // Update sync history record with results
      if (syncHistoryRecord) {
        syncHistoryRecord.status = 'completed';
        syncHistoryRecord.phase = 'done';
        syncHistoryRecord.completedAt = new Date();
        syncHistoryRecord.duration = duration;
        syncHistoryRecord.filesTotal = result.filesTotal || 0;
        syncHistoryRecord.filesProcessed = result.filesProcessed || 0;
        syncHistoryRecord.recordsTotal = result.recordsTotal || result.recordsProcessed || 0;
        syncHistoryRecord.recordsProcessed = result.recordsProcessed || 0;
        syncHistoryRecord.recordsInserted = result.inserted || 0;
        syncHistoryRecord.recordsUpdated = result.updated || 0;
        syncHistoryRecord.recordsSkipped = result.skipped || 0;
        syncHistoryRecord.recordsFailed = result.failed || 0;
        syncHistoryRecord.files = result.files || [];
        if (duration > 0 && (result.recordsProcessed || 0) > 0) {
          syncHistoryRecord.metrics = {
            avgRecordsPerSecond: Math.round(((result.recordsProcessed || 0) / duration) * 1000),
          };
        }
        await syncHistoryRecord.save();
      }

      // Final progress update
      this._updateProgress(integrationId, {
        status: 'completed',
        phase: 'done',
        duration,
        success: true,
        recordsInserted: result.inserted || 0,
        recordsUpdated: result.updated || 0,
      });

      return {
        success: true,
        integrationId,
        integrationName: integration.name,
        duration,
        ...result,
      };
    } catch (error) {
      console.error(`❌ Sync failed for ${integrationId}:`, error.message);

      const duration = Date.now() - startTime;

      // Update sync history with failure
      if (syncHistoryRecord) {
        syncHistoryRecord.status = 'failed';
        syncHistoryRecord.phase = 'failed';
        syncHistoryRecord.completedAt = new Date();
        syncHistoryRecord.duration = duration;
        syncHistoryRecord.errorSummary = error.message;
        syncHistoryRecord.errors.push({
          message: error.message,
          code: error.code,
          timestamp: new Date(),
        });
        await syncHistoryRecord.save();
      }

      // Update progress with error
      this._updateProgress(integrationId, {
        status: 'error',
        phase: 'failed',
        error: error.message,
        duration,
        success: false,
      });

      // Update integration status
      try {
        await Integration.findByIdAndUpdate(integrationId, {
          status: 'error',
          'lastSync.date': new Date(),
          'lastSync.status': 'failed',
          'lastSync.error': error.message,
          'lastSync.duration': duration,
          $inc: { 'stats.totalSyncs': 1, 'stats.failedSyncs': 1 }
        });
      } catch (updateError) {
        console.error('Failed to update integration status:', updateError.message);
      }

      return {
        success: false,
        integrationId,
        error: error.message,
        duration,
      };
    } finally {
      this.syncingIntegrations.set(integrationId, false);
      // Always close FTP connection
      await ftpService.close();

      // Clear progress after a delay (keep for polling)
      setTimeout(() => {
        this.syncProgress.delete(integrationId);
      }, 60000);
    }
  }

  /**
   * Sync FTP integration with real-time progress
   * KEY: Close FTP connection after EACH operation to prevent ECONNRESET
   * Based on working implementation from THings of FTP Connection
   */
  async syncFTP(integration, integrationId) {
    this.log(`[SYNC] Starting FTP sync for: ${integration.name}`);

    const credentials = {
      host: integration.ftp.host,
      port: integration.ftp.port,
      username: integration.ftp.username,
      password: integration.ftp.password,
      secure: integration.ftp.secure,
      filePattern: integration.ftp.filePattern,
    };

    this.log(`[SYNC] FTP host: ${credentials.host}, pattern: ${credentials.filePattern}`);

    this._updateProgress(integrationId, {
      phase: 'listing',
      status: 'syncing',
      message: 'Listing files on FTP server...',
    });

    let files;
    try {
      // List files - ftpService now handles connection internally
      files = await ftpService.listFiles(credentials, integration.ftp.remotePath);
      // Connection is already closed by listFiles
      console.log(`📂 Found ${files.length} files to sync`);
    } catch (listError) {
      console.error(`❌ Error listing files:`, listError.message);
      throw listError;
    }

    if (files.length === 0) {
      this._updateProgress(integrationId, {
        phase: 'done',
        message: 'No files found to sync',
      });
      return {
        success: true,
        message: 'No files found to sync',
        recordsProcessed: 0,
        inserted: 0,
        updated: 0,
        files: [],
      };
    }

    this._updateProgress(integrationId, {
      filesTotal: files.length,
      message: `Found ${files.length} files to process`,
    });

    // Delete old data for this integration before importing fresh data
    // This ensures clean sync - no orphaned records from removed files
    this._updateProgress(integrationId, {
      phase: 'cleaning',
      message: 'Removing old data before fresh sync...',
    });

    try {
      const deletedCount = await Part.deleteByIntegration(integration._id);
      console.log(`🗑️  Cleaned up ${deletedCount} old parts before sync`);

      // Also delete from Elasticsearch
      if (elasticsearchService.isAvailable) {
        await elasticsearchService.deleteByIntegration(integration._id.toString());
      }
    } catch (cleanupError) {
      console.error('Warning: Failed to cleanup old data:', cleanupError.message);
      // Continue with sync even if cleanup fails
    }

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalProcessed = 0;
    const fileResults = [];
    const errors = [];

    // MAXIMUM SPEED PARALLEL PROCESSING
    // Each file uses its own isolated FTP connection for true parallelism
    // 
    // ULTRA-FAST MODE (SYNC_DEFER_ES=true, default):
    //   - MongoDB-only import with w:0 write concern (fire-and-forget)
    //   - 25 parallel downloads for maximum throughput
    //   - Target: 75M records in 10-15 minutes
    //
    // SYNC_PRIORITY=low (default): 20 parallel - fast but yields for website
    // SYNC_PRIORITY=high: 30 parallel - maximum speed, website may lag
    //
    const deferES = process.env.SYNC_DEFER_ES !== 'false';
    const PARALLEL_DOWNLOADS = this.syncPriority === 'high' 
      ? (this.productionMode ? (deferES ? 30 : 10) : 2)
      : (this.productionMode ? (deferES ? 20 : 6) : 2);
    
    const YIELD_BETWEEN_BATCHES = this.syncPriority !== 'high';
    const YIELD_DELAY_MS = 5; // Minimal pause

    console.log(`🚀 ULTRA-FAST sync: ${PARALLEL_DOWNLOADS} parallel downloads (priority: ${this.syncPriority}, deferES: ${deferES})`);

    // Helper function to process a single file with isolated FTP connection
    const processFile = async (file, index) => {
      const startTime = Date.now();
      try {
        // Build remote path
        const remotePath = file.name;
        const remoteDir = integration.ftp.remotePath || '/';

        // Download file using ISOLATED parallel-safe connection
        const downloadCredentials = { ...credentials, remotePath: remoteDir };
        const tempFilePath = await ftpService.downloadToTempFileParallel(remotePath, downloadCredentials);
        // No need to close - isolated client closes itself

        // Parse and import from temp file
        const result = await csvParserService.parseAndImport(tempFilePath, {
          integration: integration._id,
          integrationName: integration.name,
          fileName: file.name,
          columnMapping: integration.columnMapping,
        });

        // Clean up temp file after processing
        try {
          const fs = require('fs');
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } catch (e) { /* ignore cleanup errors */ }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        if (index % 10 === 0 || !this.productionMode) {
          console.log(`✅ [${index + 1}/${files.length}] ${file.name}: ${result.inserted.toLocaleString()} records (${duration}s)`);
        }

        return {
          name: file.name,
          records: result.validRecords,
          inserted: result.inserted,
          updated: result.updated,
          status: 'success',
        };
      } catch (error) {
        console.error(`❌ [${index + 1}/${files.length}] ${file.name}: ${error.message}`);
        return {
          name: file.name,
          status: 'failed',
          error: error.message,
        };
      }
    };

    // Process files in parallel batches with isolated connections
    const processBatch = async (batch, startIndex) => {
      const promises = batch.map((file, i) => processFile(file, startIndex + i));
      return Promise.all(promises);
    };

    // Split files into batches and process in parallel
    for (let i = 0; i < files.length; i += PARALLEL_DOWNLOADS) {
      const batch = files.slice(i, i + PARALLEL_DOWNLOADS);
      
      this._updateProgress(integrationId, {
        phase: 'processing',
        filesProcessed: i,
        message: `Processing files ${i + 1}-${Math.min(i + PARALLEL_DOWNLOADS, files.length)} of ${files.length} (${PARALLEL_DOWNLOADS} parallel)...`,
      });

      // Yield to event loop before each batch to keep website responsive
      if (YIELD_BETWEEN_BATCHES) {
        await this.yieldToEventLoop(YIELD_DELAY_MS);
      }

      const batchResults = await processBatch(batch, i);
      
      // Aggregate results
      for (const result of batchResults) {
        fileResults.push(result);
        if (result.status === 'success') {
          totalInserted += result.inserted;
          totalUpdated += result.updated;
          totalProcessed += result.records;
        } else {
          errors.push({ file: result.name, error: result.error });
        }
      }

      // Update progress after each batch
      this._updateProgress(integrationId, {
        filesProcessed: Math.min(i + PARALLEL_DOWNLOADS, files.length),
        recordsTotal: totalProcessed,
        recordsProcessed: totalProcessed,
        recordsInserted: totalInserted,
        recordsUpdated: totalUpdated,
        errors: errors,
      });
    }

    // Final cleanup of main client
    await ftpService.close();
    console.log(`✅ PARALLEL sync completed: ${fileResults.length} files, ${totalInserted.toLocaleString()} records, ${errors.length} errors`);

    return {
      success: errors.length === 0 || fileResults.some(f => f.status === 'success'),
      recordsProcessed: totalProcessed,
      inserted: totalInserted,
      updated: totalUpdated,
      files: fileResults,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Sync API integration with full support
   * Supports REST APIs with pagination, authentication, rate limiting, and data transformation
   */
  async syncAPI(integration, integrationId) {
    const config = integration.api || {};

    console.log(`🌐 Starting API sync for: ${integration.name}`);

    this._updateProgress(integrationId, {
      phase: 'connecting',
      status: 'syncing',
      message: 'Connecting to API...',
    });

    // Validate configuration
    if (!config.baseUrl) {
      throw new Error('API base URL is required');
    }

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalProcessed = 0;
    let totalSkipped = 0;
    const errors = [];
    const endpointResults = [];

    try {
      // Fetch data from API with progress tracking
      this._updateProgress(integrationId, {
        phase: 'fetching',
        message: 'Fetching data from API...',
      });

      const fetchResult = await apiService.fetchData(integration, {
        onProgress: (progress) => {
          this._updateProgress(integrationId, {
            phase: progress.phase || 'fetching',
            message: progress.message,
            recordsProcessed: progress.recordsFetched || 0,
            currentEndpoint: progress.currentEndpoint,
          });
        },
        onError: (error) => {
          errors.push(error);
          this._updateProgress(integrationId, {
            message: `Error: ${error.error}`,
            errors: errors,
          });
        },
      });

      if (!fetchResult.success && fetchResult.records.length === 0) {
        throw new Error(fetchResult.error || 'Failed to fetch data from API');
      }

      console.log(`📊 Fetched ${fetchResult.totalRecords} records from API`);

      this._updateProgress(integrationId, {
        phase: 'parsing',
        message: `Parsing ${fetchResult.totalRecords} records...`,
        recordsTotal: fetchResult.totalRecords,
      });

      // Parse and validate the data
      const fieldMapping = config.fieldMapping || integration.columnMapping || {};
      const parseResult = apiService.parsePartsData(fetchResult.records, fieldMapping);

      console.log(`✅ Parsed: ${parseResult.stats.valid} valid, ${parseResult.stats.invalid} invalid`);

      if (parseResult.stats.valid === 0) {
        console.log('⚠️ No valid records found in API response');
        return {
          success: true,
          message: 'No valid records found in API response',
          recordsProcessed: 0,
          inserted: 0,
          updated: 0,
          skipped: parseResult.stats.invalid,
          errors: parseResult.errors.length > 0 ? parseResult.errors : undefined,
        };
      }

      // Import records in batches
      this._updateProgress(integrationId, {
        phase: 'importing',
        message: `Importing ${parseResult.stats.valid} records to database...`,
      });

      const batchSize = 100;
      const validRecords = parseResult.validRecords;

      for (let i = 0; i < validRecords.length; i += batchSize) {
        const batch = validRecords.slice(i, i + batchSize);

        // Process each record in the batch
        for (const record of batch) {
          try {
            // Check if part exists by part number
            const existingPart = await Part.findOne({ partNumber: record.partNumber });

            const partData = {
              partNumber: record.partNumber,
              description: record.description,
              supplier: record.supplier,
              price: record.price,
              quantity: record.quantity,
              condition: record.condition,
              brand: record.brand,
              leadTime: record.leadTime,
              uom: record.uom,
              category: record.category,
              subcategory: record.subcategory,
              integration: integration._id,
              integrationName: integration.name,
              lastUpdated: new Date(),
            };

            if (existingPart) {
              // Update existing record
              await Part.findByIdAndUpdate(existingPart._id, partData);
              totalUpdated++;
            } else {
              // Insert new record
              await Part.create(partData);
              totalInserted++;
            }
            totalProcessed++;
          } catch (recordError) {
            console.error(`Error processing record ${record.partNumber}:`, recordError.message);
            errors.push({ partNumber: record.partNumber, error: recordError.message });
            totalSkipped++;
          }
        }

        // Update progress
        const progress = Math.round(((i + batch.length) / validRecords.length) * 100);
        this._updateProgress(integrationId, {
          phase: 'importing',
          recordsProcessed: totalProcessed,
          recordsInserted: totalInserted,
          recordsUpdated: totalUpdated,
          message: `Importing records... ${progress}% (${totalProcessed}/${validRecords.length})`,
        });
      }

      // Index to Elasticsearch if available
      if (elasticsearchService.isAvailable && totalProcessed > 0) {
        this._updateProgress(integrationId, {
          phase: 'indexing',
          message: 'Indexing to search engine...',
        });

        try {
          const partsToIndex = await Part.find({ integration: integration._id }).lean();
          await elasticsearchService.bulkIndex(partsToIndex);
          // Invalidate cache so new documents are picked up
          elasticsearchService.invalidateDocCountCache();
          console.log(`🔍 Indexed ${partsToIndex.length} parts to Elasticsearch`);
        } catch (esError) {
          console.error('Elasticsearch indexing error:', esError.message);
          errors.push({ phase: 'indexing', error: esError.message });
        }
      }

      // Prepare endpoint results for logging
      if (fetchResult.endpoints) {
        endpointResults.push(...fetchResult.endpoints.map(ep => ({
          name: ep.path,
          records: ep.recordCount,
          status: ep.status,
        })));
      }

      console.log(`✅ API sync completed: ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped`);

      return {
        success: errors.length === 0 || totalProcessed > 0,
        recordsProcessed: totalProcessed,
        inserted: totalInserted,
        updated: totalUpdated,
        skipped: totalSkipped,
        endpoints: endpointResults,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error(`❌ API sync error:`, error.message);
      throw error;
    } finally {
      // Clear rate limiter for this integration
      apiService.clearRateLimiter(integrationId);
    }
  }

  /**
   * Sync Google Sheets integration (placeholder)
   */
  async syncGoogleSheets(integration) {
    console.log('Google Sheets sync not yet implemented');
    return {
      success: false,
      error: 'Google Sheets sync not yet implemented',
      recordsProcessed: 0,
      inserted: 0,
      updated: 0,
    };
  }

  /**
   * Sync all enabled integrations
   */
  async syncAllEnabled() {
    try {
      const integrations = await Integration.getEnabledForSync();
      console.log(`🔄 Syncing ${integrations.length} enabled integrations...`);

      const results = [];
      for (const integration of integrations) {
        const result = await this.syncIntegration(integration._id.toString());
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error('Error syncing all integrations:', error.message);
      throw error;
    }
  }

  /**
   * Clear all data for an integration
   */
  async clearIntegrationData(integrationId) {
    try {
      // Delete from MongoDB
      const mongoResult = await Part.deleteMany({ integration: integrationId });

      // Delete from Elasticsearch
      let esResult = { deleted: 0 };
      if (elasticsearchService.isAvailable) {
        esResult = await elasticsearchService.deleteByIntegration(integrationId);
      }

      console.log(`🗑️  Cleared ${mongoResult.deletedCount} MongoDB records, ${esResult.deleted} ES records`);

      return {
        success: true,
        mongoDeleted: mongoResult.deletedCount,
        esDeleted: esResult.deleted,
      };
    } catch (error) {
      console.error('Error clearing integration data:', error.message);
      throw error;
    }
  }
}

// Export singleton
module.exports = new SyncService();
