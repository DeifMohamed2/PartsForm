#!/usr/bin/env node
/**
 * TURBO SYNC ENGINE v2.0
 * ======================
 * Professional-grade high-performance sync system
 * Target: 75M records in 30 minutes (~42k records/sec)
 * 
 * Architecture:
 * ┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
 * │  FTP Server │ ──▶ │ Local Files  │ ──▶ │ mongoimport │ ──▶ │  ES Bulk    │
 * │  (parallel) │     │ (NVMe disk)  │     │ (16 workers)│     │  (parallel) │
 * └─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
 * 
 * Key optimizations:
 * 1. Download ALL files first (parallel FTP)
 * 2. Use mongoimport (Go binary, 10-50x faster than Node.js)
 * 3. Drop indexes before import, recreate after
 * 4. ES bulk with refresh disabled
 */

require('dotenv').config();
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const mongoose = require('mongoose');
const { Client: FTPClient } = require('basic-ftp');
const { Client: ESClient } = require('@elastic/elasticsearch');

// ============================================
// CONFIGURATION - Optimized for your server
// 96GB RAM, 18 cores, NVMe SSD
// ============================================
const CONFIG = {
  // Directories
  WORK_DIR: '/tmp/partsform-turbo-sync',
  
  // FTP
  FTP_PARALLEL: 15,              // Parallel FTP downloads
  FTP_TIMEOUT: 30000,            // 30s timeout per file
  
  // MongoDB - mongoimport settings
  MONGO_WORKERS: 16,             // mongoimport parallel workers
  MONGO_BATCH_SIZE: 10000,       // mongoimport batch size
  
  // Elasticsearch
  ES_BULK_SIZE: 50000,           // 50k docs per bulk
  ES_PARALLEL: 8,                // Parallel bulk operations
  ES_REFRESH_INTERVAL: '-1',     // Disable during import
  
  // Processing
  TRANSFORM_WORKERS: 8,          // Parallel file transformation
};

// ============================================
// UTILITIES
// ============================================
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const colors = {
    INFO: '\x1b[36m',    // Cyan
    SUCCESS: '\x1b[32m', // Green
    ERROR: '\x1b[31m',   // Red
    PROGRESS: '\x1b[33m', // Yellow
    RESET: '\x1b[0m'
  };
  const prefix = type === 'ERROR' ? '❌' : type === 'SUCCESS' ? '✅' : type === 'PROGRESS' ? '⏳' : 'ℹ️';
  console.log(`${colors[type] || ''}[${timestamp}] ${prefix} ${message}${colors.RESET}`);
}

function formatNumber(num) {
  return num.toLocaleString();
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function execCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`Command failed: ${cmd}\n${e.stderr || e.message}`);
  }
}

// Check if mongoimport is available
function checkMongoimport() {
  try {
    execCommand('which mongoimport');
    return true;
  } catch {
    return false;
  }
}

// ============================================
// PHASE 1: PARALLEL FTP DOWNLOAD
// ============================================
async function downloadAllFiles(integration) {
  log('PHASE 1: Downloading all files from FTP...', 'PROGRESS');
  const startTime = Date.now();
  
  const ftpConfig = integration.ftp;
  const downloadDir = path.join(CONFIG.WORK_DIR, 'csv');
  
  // Clean and create directories
  if (fs.existsSync(CONFIG.WORK_DIR)) {
    fs.rmSync(CONFIG.WORK_DIR, { recursive: true });
  }
  fs.mkdirSync(downloadDir, { recursive: true });
  
  // Get file list
  const client = new FTPClient();
  client.ftp.verbose = false;
  
  await client.access({
    host: ftpConfig.host,
    port: ftpConfig.port || 21,
    user: ftpConfig.username,
    password: ftpConfig.password,
    secure: ftpConfig.secure || false,
  });
  
  const remotePath = ftpConfig.remotePath || '/';
  const allFiles = await client.list(remotePath);
  client.close();
  
  // Filter CSV files
  const pattern = ftpConfig.filePattern ? new RegExp(ftpConfig.filePattern.replace(/\*/g, '.*')) : /\.csv$/i;
  const csvFiles = allFiles.filter(f => f.isFile && pattern.test(f.name));
  
  log(`Found ${csvFiles.length} CSV files to download`);
  
  // Parallel download function
  const downloadFile = async (file, index) => {
    const localPath = path.join(downloadDir, file.name);
    const client = new FTPClient();
    client.ftp.verbose = false;
    
    try {
      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port || 21,
        user: ftpConfig.username,
        password: ftpConfig.password,
        secure: ftpConfig.secure || false,
      });
      
      const remoteFilePath = path.posix.join(remotePath, file.name);
      await client.downloadTo(localPath, remoteFilePath);
      
      return { success: true, file: file.name, size: file.size };
    } catch (error) {
      return { success: false, file: file.name, error: error.message };
    } finally {
      client.close();
    }
  };
  
  // Download in parallel batches
  let completed = 0;
  let failed = 0;
  const results = [];
  
  for (let i = 0; i < csvFiles.length; i += CONFIG.FTP_PARALLEL) {
    const batch = csvFiles.slice(i, i + CONFIG.FTP_PARALLEL);
    const batchResults = await Promise.all(batch.map((f, idx) => downloadFile(f, i + idx)));
    
    for (const result of batchResults) {
      results.push(result);
      if (result.success) completed++;
      else failed++;
    }
    
    const percent = Math.round(((i + batch.length) / csvFiles.length) * 100);
    log(`Downloaded ${i + batch.length}/${csvFiles.length} files (${percent}%)`, 'PROGRESS');
  }
  
  const duration = Date.now() - startTime;
  log(`Downloaded ${completed} files in ${formatDuration(duration)} (${failed} failed)`, 'SUCCESS');
  
  return {
    downloadDir,
    files: results.filter(r => r.success).map(r => r.file),
    failed: results.filter(r => !r.success),
    duration,
  };
}

// ============================================
// PHASE 2: TRANSFORM CSVs TO NDJSON (STREAMING)
// Uses streaming to avoid loading entire files into memory
// ============================================
async function transformToNDJSON(downloadDir, files, integration) {
  log('PHASE 2: Transforming CSVs to NDJSON format (streaming)...', 'PROGRESS');
  const startTime = Date.now();
  
  const ndjsonDir = path.join(CONFIG.WORK_DIR, 'ndjson');
  fs.mkdirSync(ndjsonDir, { recursive: true });
  
  const integrationId = integration._id.toString();
  const integrationName = integration.name;
  const importedAt = new Date().toISOString();
  
  let totalRecords = 0;
  const ndjsonFiles = [];
  
  // Process files one at a time with streaming
  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const csvPath = path.join(downloadDir, fileName);
    const ndjsonPath = path.join(ndjsonDir, `${path.basename(fileName, '.csv')}.ndjson`);
    
    try {
      // Use streaming to avoid memory issues
      const fileRecords = await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(csvPath, { encoding: 'utf8', highWaterMark: 64 * 1024 });
        const writeStream = fs.createWriteStream(ndjsonPath);
        const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });
        
        let isFirstLine = true;
        let headers = [];
        let colMap = {};
        let separator = ',';
        let recordCount = 0;
        
        rl.on('line', (line) => {
          if (isFirstLine) {
            // Parse header
            isFirstLine = false;
            separator = line.includes(';') ? ';' : ',';
            headers = line.split(separator).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
            
            // Find column indices
            colMap = {
              partNumber: headers.findIndex(h => h.includes('part') || h.includes('vendor') || h.includes('sku') || h === 'code'),
              description: headers.findIndex(h => h.includes('desc') || h.includes('title') || h.includes('name')),
              brand: headers.findIndex(h => h.includes('brand') || h.includes('manufacturer') || h.includes('make')),
              supplier: headers.findIndex(h => h.includes('supplier') || h.includes('vendor')),
              price: headers.findIndex(h => h.includes('price') || h.includes('cost')),
              currency: headers.findIndex(h => h.includes('currency') || h.includes('curr')),
              quantity: headers.findIndex(h => h.includes('quantity') || h.includes('qty') || h.includes('stock')),
              weight: headers.findIndex(h => h.includes('weight')),
              category: headers.findIndex(h => h.includes('category') || h.includes('cat')),
            };
            return;
          }
          
          const trimmedLine = line.trim();
          if (!trimmedLine) return;
          
          const cols = trimmedLine.split(separator);
          const partNumber = (cols[colMap.partNumber] || '').replace(/['"]/g, '').trim();
          if (!partNumber) return;
          
          const doc = {
            partNumber,
            description: (cols[colMap.description] || '').replace(/['"]/g, ''),
            brand: (cols[colMap.brand] || '').replace(/['"]/g, ''),
            supplier: (cols[colMap.supplier] || '').replace(/['"]/g, ''),
            price: parseFloat(cols[colMap.price]) || 0,
            currency: (cols[colMap.currency] || 'USD').replace(/['"]/g, ''),
            quantity: parseInt(cols[colMap.quantity]) || 0,
            weight: parseFloat(cols[colMap.weight]) || 0,
            category: (cols[colMap.category] || '').replace(/['"]/g, ''),
            integration: integrationId,
            integrationName,
            fileName,
            importedAt,
          };
          
          writeStream.write(JSON.stringify(doc) + '\n');
          recordCount++;
        });
        
        rl.on('close', () => {
          writeStream.end(() => resolve(recordCount));
        });
        
        rl.on('error', reject);
        readStream.on('error', reject);
      });
      
      totalRecords += fileRecords;
      ndjsonFiles.push(ndjsonPath);
      
      // Delete CSV immediately to free disk space
      try { fs.unlinkSync(csvPath); } catch (e) {}
      
      // Force GC every 10 files to prevent memory buildup
      if ((i + 1) % 10 === 0 && global.gc) {
        global.gc();
      }
      
    } catch (error) {
      log(`Error transforming ${fileName}: ${error.message}`, 'ERROR');
    }
    
    // Progress update every 20 files
    if ((i + 1) % 20 === 0) {
      log(`Transformed ${i + 1}/${files.length} files (${formatNumber(totalRecords)} records)`, 'PROGRESS');
    }
  }
  
  const duration = Date.now() - startTime;
  log(`Transformed ${formatNumber(totalRecords)} records in ${formatDuration(duration)}`, 'SUCCESS');
  
  return { ndjsonDir, ndjsonFiles, totalRecords, duration };
}

// ============================================
// PHASE 3: MONGODB IMPORT (mongoimport or bulk)
// ============================================
async function importToMongoDB(ndjsonFiles, totalRecords, integration) {
  log('PHASE 3: Importing to MongoDB...', 'PROGRESS');
  const startTime = Date.now();
  
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';
  const useMongoimport = checkMongoimport();
  
  // Connect to MongoDB
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const collection = db.collection('parts');
  
  // Step 1: Drop indexes for faster import
  log('Dropping indexes for faster import...');
  try {
    await collection.dropIndexes();
  } catch (e) {
    // Ignore if no indexes
  }
  
  // Step 2: Delete old data
  log(`Deleting old data for integration ${integration._id}...`);
  await collection.deleteMany({ integration: integration._id.toString() });
  
  let importedCount = 0;
  
  if (useMongoimport) {
    // Use mongoimport (FASTEST - 10-50x faster than Node.js)
    log('Using mongoimport for maximum speed...');
    
    // Parse MongoDB URI
    const uri = new URL(mongoUri);
    const host = uri.hostname;
    const port = uri.port || 27017;
    const database = uri.pathname.replace('/', '') || 'partsform';
    const username = uri.username;
    const password = uri.password;
    const authSource = uri.searchParams.get('authSource') || 'admin';
    
    for (const ndjsonPath of ndjsonFiles) {
      let cmd = `mongoimport`;
      cmd += ` --host ${host}`;
      cmd += ` --port ${port}`;
      if (username && password) {
        cmd += ` --username "${username}"`;
        cmd += ` --password "${decodeURIComponent(password)}"`;
        cmd += ` --authenticationDatabase ${authSource}`;
      }
      cmd += ` --db ${database}`;
      cmd += ` --collection parts`;
      cmd += ` --type json`;
      cmd += ` --file "${ndjsonPath}"`;
      cmd += ` --numInsertionWorkers ${CONFIG.MONGO_WORKERS}`;
      
      try {
        execCommand(cmd);
      } catch (e) {
        log(`mongoimport error: ${e.message}`, 'ERROR');
      }
    }
    
    // Count imported
    importedCount = await collection.countDocuments({ integration: integration._id.toString() });
    
  } else {
    // Fallback: Node.js bulk insert (still fast with w:0)
    log('mongoimport not available, using Node.js bulk insert...');
    
    const BATCH_SIZE = 50000;
    let batch = [];
    
    for (const ndjsonPath of ndjsonFiles) {
      const fileStream = fs.createReadStream(ndjsonPath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
      
      for await (const line of rl) {
        if (!line.trim()) continue;
        
        try {
          const doc = JSON.parse(line);
          doc.createdAt = new Date();
          doc.lastUpdated = new Date();
          batch.push(doc);
          
          if (batch.length >= BATCH_SIZE) {
            await collection.insertMany(batch, { ordered: false, writeConcern: { w: 0 } });
            importedCount += batch.length;
            batch = [];
            
            if (importedCount % 500000 < BATCH_SIZE) {
              log(`Imported ${formatNumber(importedCount)} records...`, 'PROGRESS');
            }
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
      
      // Delete NDJSON file after import to free disk space
      try { fs.unlinkSync(ndjsonPath); } catch (e) {}
      
      // Force GC after each file
      if (global.gc) global.gc();
    }
    
    // Insert remaining
    if (batch.length > 0) {
      await collection.insertMany(batch, { ordered: false, writeConcern: { w: 0 } });
      importedCount += batch.length;
      batch = []; // Clear batch to free memory
    }
  }
  
  // Step 3: Recreate indexes
  log('Recreating indexes...');
  await collection.createIndex({ partNumber: 1 }, { background: true });
  await collection.createIndex({ integration: 1 }, { background: true });
  await collection.createIndex({ brand: 1 }, { background: true });
  await collection.createIndex({ partNumber: 1, integration: 1 }, { background: true });
  
  const duration = Date.now() - startTime;
  const rate = Math.round(importedCount / (duration / 1000));
  log(`Imported ${formatNumber(importedCount)} records in ${formatDuration(duration)} (${formatNumber(rate)}/sec)`, 'SUCCESS');
  
  return { importedCount, duration, rate };
}

// ============================================
// PHASE 4: ELASTICSEARCH BULK INDEX
// ============================================
async function indexToElasticsearch(integration, totalRecords) {
  log('PHASE 4: Bulk indexing to Elasticsearch...', 'PROGRESS');
  const startTime = Date.now();
  
  const esNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
  const esIndex = process.env.ELASTICSEARCH_INDEX || 'automotive_parts';
  
  const esClient = new ESClient({
    node: esNode,
    requestTimeout: 120000,
  });
  
  // Check ES availability
  try {
    await esClient.cluster.health();
  } catch {
    log('Elasticsearch not available, skipping', 'ERROR');
    return { indexed: 0, duration: 0 };
  }
  
  // Put index into ingest mode
  try {
    await esClient.indices.putSettings({
      index: esIndex,
      body: {
        'index.refresh_interval': '-1',
        'index.number_of_replicas': 0,
      }
    });
  } catch (e) {
    // Index might not exist
  }
  
  // Delete old ES data
  try {
    await esClient.deleteByQuery({
      index: esIndex,
      body: { query: { term: { integration: integration._id.toString() } } },
      conflicts: 'proceed',
      refresh: false,
      wait_for_completion: true,
    });
  } catch (e) {
    // Ignore
  }
  
  // Stream from MongoDB and bulk index
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const cursor = db.collection('parts').find({ integration: integration._id.toString() }).batchSize(CONFIG.ES_BULK_SIZE);
  
  let batch = [];
  let totalIndexed = 0;
  let pendingBulks = [];
  
  const flushBatch = async (docs) => {
    if (docs.length === 0) return 0;
    
    const body = docs.flatMap(doc => [
      { index: { _index: esIndex, _id: doc._id.toString() } },
      {
        partNumber: doc.partNumber,
        description: doc.description,
        brand: doc.brand,
        supplier: doc.supplier,
        price: doc.price,
        currency: doc.currency,
        quantity: doc.quantity,
        integration: doc.integration,
        integrationName: doc.integrationName,
        fileName: doc.fileName,
      }
    ]);
    
    try {
      await esClient.bulk({ body, refresh: false });
      return docs.length;
    } catch (e) {
      log(`ES bulk error: ${e.message}`, 'ERROR');
      return 0;
    }
  };
  
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    batch.push(doc);
    
    if (batch.length >= CONFIG.ES_BULK_SIZE) {
      const batchToIndex = [...batch];
      batch = [];
      
      pendingBulks.push(flushBatch(batchToIndex));
      
      if (pendingBulks.length >= CONFIG.ES_PARALLEL) {
        const results = await Promise.all(pendingBulks);
        totalIndexed += results.reduce((a, b) => a + b, 0);
        pendingBulks = [];
        
        if (totalIndexed % 500000 < CONFIG.ES_BULK_SIZE) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = Math.round(totalIndexed / elapsed);
          log(`ES indexed ${formatNumber(totalIndexed)} docs (${formatNumber(rate)}/sec)`, 'PROGRESS');
        }
      }
    }
  }
  
  // Flush remaining
  if (batch.length > 0) pendingBulks.push(flushBatch(batch));
  if (pendingBulks.length > 0) {
    const results = await Promise.all(pendingBulks);
    totalIndexed += results.reduce((a, b) => a + b, 0);
  }
  
  // Re-enable refresh
  await esClient.indices.putSettings({
    index: esIndex,
    body: { 'index.refresh_interval': '30s' }
  });
  await esClient.indices.refresh({ index: esIndex });
  
  await esClient.close();
  
  const duration = Date.now() - startTime;
  const rate = Math.round(totalIndexed / (duration / 1000));
  log(`Indexed ${formatNumber(totalIndexed)} docs in ${formatDuration(duration)} (${formatNumber(rate)}/sec)`, 'SUCCESS');
  
  return { indexed: totalIndexed, duration, rate };
}

// ============================================
// PHASE 5: UPDATE INTEGRATION STATUS
// ============================================
async function updateIntegrationStatus(integration, results) {
  const Integration = require('../models/Integration');
  
  const totalDuration = results.download.duration + results.transform.duration + 
                        results.mongo.duration + results.es.duration;
  
  await Integration.findByIdAndUpdate(integration._id, {
    status: 'active',
    'lastSync.date': new Date(),
    'lastSync.status': 'success',
    'lastSync.duration': totalDuration,
    'lastSync.recordsProcessed': results.transform.totalRecords,
    'lastSync.recordsInserted': results.mongo.importedCount,
    'stats.totalRecords': results.mongo.importedCount,
    'stats.lastSyncRecords': results.mongo.importedCount,
    $inc: { 'stats.totalSyncs': 1, 'stats.successfulSyncs': 1 }
  });
}

// ============================================
// MAIN ENTRY POINT
// ============================================
async function runTurboSync(integrationId) {
  console.log('\n' + '═'.repeat(60));
  console.log('🚀 TURBO SYNC ENGINE v2.0');
  console.log('═'.repeat(60));
  console.log(`   Target: 75M records in 30 minutes (~42k/sec)`);
  console.log(`   Server: 96GB RAM, 18 cores, NVMe SSD`);
  console.log('═'.repeat(60) + '\n');
  
  const overallStart = Date.now();
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    log('Connected to MongoDB');
    
    // Get integration
    const Integration = require('../models/Integration');
    let integration;
    
    if (integrationId) {
      integration = await Integration.findById(integrationId);
    } else {
      integration = await Integration.findOne({ type: 'ftp', enabled: true });
    }
    
    if (!integration) {
      throw new Error('No integration found');
    }
    
    log(`Syncing: ${integration.name}`);
    
    // Update status to syncing
    await Integration.findByIdAndUpdate(integration._id, { status: 'syncing' });
    
    // Run phases
    const downloadResult = await downloadAllFiles(integration);
    const transformResult = await transformToNDJSON(downloadResult.downloadDir, downloadResult.files, integration);
    const mongoResult = await importToMongoDB(transformResult.ndjsonFiles, transformResult.totalRecords, integration);
    const esResult = await indexToElasticsearch(integration, mongoResult.importedCount);
    
    // Update integration
    await updateIntegrationStatus(integration, {
      download: downloadResult,
      transform: transformResult,
      mongo: mongoResult,
      es: esResult,
    });
    
    // Cleanup
    try {
      fs.rmSync(CONFIG.WORK_DIR, { recursive: true });
    } catch (e) {}
    
    const totalDuration = Date.now() - overallStart;
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 SYNC COMPLETE - SUMMARY');
    console.log('═'.repeat(60));
    console.log(`   Total Records: ${formatNumber(mongoResult.importedCount)}`);
    console.log(`   Total Duration: ${formatDuration(totalDuration)}`);
    console.log(`   Average Rate: ${formatNumber(Math.round(mongoResult.importedCount / (totalDuration / 1000)))}/sec`);
    console.log('═'.repeat(60));
    console.log('   Phase Breakdown:');
    console.log(`   ├─ FTP Download:  ${formatDuration(downloadResult.duration)}`);
    console.log(`   ├─ Transform:     ${formatDuration(transformResult.duration)}`);
    console.log(`   ├─ MongoDB:       ${formatDuration(mongoResult.duration)} (${formatNumber(mongoResult.rate)}/sec)`);
    console.log(`   └─ Elasticsearch: ${formatDuration(esResult.duration)} (${formatNumber(esResult.rate)}/sec)`);
    console.log('═'.repeat(60) + '\n');
    
    return { success: true, records: mongoResult.importedCount, duration: totalDuration };
    
  } catch (error) {
    log(`Sync failed: ${error.message}`, 'ERROR');
    console.error(error);
    return { success: false, error: error.message };
  } finally {
    await mongoose.disconnect();
  }
}

// Export for use by sync worker
module.exports = { runTurboSync, CONFIG };

// Direct execution
if (require.main === module) {
  const integrationId = process.argv[2];
  runTurboSync(integrationId).then(result => {
    process.exit(result.success ? 0 : 1);
  });
}
