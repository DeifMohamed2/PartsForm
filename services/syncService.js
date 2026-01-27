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
    const updated = { ...current, ...progress, updatedAt: new Date() };
    this.syncProgress.set(integrationId, updated);
    this.emit('progress', { integrationId, ...updated });
    return updated;
  }

  /**
   * Sync a single integration with real-time progress
   */
  async syncIntegration(integrationId) {
    // Prevent concurrent syncs
    if (this.syncingIntegrations.get(integrationId)) {
      console.log(`⏭️  Sync already in progress for ${integrationId}`);
      return { success: false, error: 'Sync already in progress' };
    }

    this.syncingIntegrations.set(integrationId, true);
    const startTime = Date.now();

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

      console.log(`✅ Sync completed for ${integration.name} in ${duration}ms`);

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
    console.log(`[SYNC DEBUG] Starting FTP sync for: ${integration.name}`);

    const credentials = {
      host: integration.ftp.host,
      port: integration.ftp.port,
      username: integration.ftp.username,
      password: integration.ftp.password,
      secure: integration.ftp.secure,
      filePattern: integration.ftp.filePattern,
    };

    console.log(`[SYNC DEBUG] FTP credentials:`, {
      host: credentials.host,
      port: credentials.port,
      username: credentials.username,
      secure: credentials.secure,
      filePattern: credentials.filePattern,
      remotePath: integration.ftp.remotePath
    });

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
      console.log(`[SYNC DEBUG] Listed ${files.length} files from FTP`);
    } catch (listError) {
      console.error(`[SYNC DEBUG] Error listing files:`, listError);
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

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalProcessed = 0;
    const fileResults = [];
    const errors = [];

    // Process each file - ftpService creates fresh connection for each download and closes after
    // Process in batches with delays to avoid overwhelming the FTP server
    const batchSize = 5; // Process 5 files per batch (reduced to avoid rate limiting)
    const batchDelay = 5000; // 5 second delay between batches (increased to avoid rate limiting)

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[SYNC DEBUG] Processing file ${i + 1}/${files.length}: ${file.name}`);

      // Wait between batches to avoid rate limiting
      // Note: Connection is already closed after each download by ftpService
      if (i > 0 && i % batchSize === 0) {
        console.log(`[SYNC DEBUG] Batch complete, waiting ${batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }

      try {
        console.log(`📥 Processing: ${file.name}`);

        this._updateProgress(integrationId, {
          phase: 'downloading',
          currentFile: file.name,
          filesProcessed: i,
          message: `Downloading ${file.name}...`,
        });

        // Build remote path - use just the filename (working implementation pattern)
        const remotePath = file.name;
        const remoteDir = integration.ftp.remotePath || '/';

        console.log(`[SYNC DEBUG] Remote directory: ${remoteDir}, File: ${remotePath}`);

        // Pass remotePath in credentials so downloadFile can change directory if needed
        const downloadCredentials = {
          ...credentials,
          remotePath: remoteDir
        };

        // Download file - ftpService handles connection/disconnection internally
        // Close connection after each download (like working implementation)
        const buffer = await ftpService.downloadFile(remotePath, downloadCredentials);
        await ftpService.close();

        console.log(`[SYNC DEBUG] Downloaded ${file.name}, size: ${buffer.length} bytes`);

        this._updateProgress(integrationId, {
          phase: 'parsing',
          message: `Parsing ${file.name}...`,
        });

        // Parse and import
        const result = await csvParserService.parseAndImport(buffer, {
          integration: integration._id,
          integrationName: integration.name,
          fileName: file.name,
          columnMapping: integration.columnMapping,
          onProgress: (parseProgress) => {
            this._updateProgress(integrationId, {
              recordsProcessed: totalProcessed + parseProgress.processed,
              recordsInserted: totalInserted + parseProgress.inserted,
              recordsUpdated: totalUpdated + parseProgress.updated,
              message: `Processing ${file.name}: ${parseProgress.processed} records...`,
            });
          }
        });

        totalInserted += result.inserted;
        totalUpdated += result.updated;
        totalProcessed += result.validRecords;

        fileResults.push({
          name: file.name,
          size: buffer.length,
          records: result.validRecords,
          inserted: result.inserted,
          updated: result.updated,
          status: 'success',
        });

        this._updateProgress(integrationId, {
          filesProcessed: i + 1,
          recordsTotal: totalProcessed,
          recordsProcessed: totalProcessed,
          recordsInserted: totalInserted,
          recordsUpdated: totalUpdated,
          message: `Completed ${file.name}: ${result.validRecords} records`,
        });

        console.log(`✅ Processed ${file.name}: ${result.inserted} inserted, ${result.updated} updated`);
      } catch (error) {
        console.error(`❌ Error processing ${file.name}:`, error.message);
        console.error(`[SYNC DEBUG] Full error:`, error);

        errors.push({ file: file.name, error: error.message });

        fileResults.push({
          name: file.name,
          status: 'failed',
          error: error.message,
        });

        this._updateProgress(integrationId, {
          filesProcessed: i + 1,
          errors: errors,
          message: `Error processing ${file.name}: ${error.message}`,
        });

        // Force reset connection on error and wait longer
        await ftpService.forceReset();

        // Add a longer delay before next file if we hit an error
        if (i < files.length - 1) {
          const errorDelay = 5000; // Increased to 5 seconds to avoid rate limiting
          console.log(`[SYNC DEBUG] Waiting ${errorDelay}ms before next file after error...`);
          await new Promise(resolve => setTimeout(resolve, errorDelay));
        }
      }
    }

    // Final cleanup - ensure connection is closed
    await ftpService.close();
    console.log(`[SYNC DEBUG] Sync completed. Files: ${fileResults.length}, Errors: ${errors.length}`);

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
              origin: record.origin,
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
