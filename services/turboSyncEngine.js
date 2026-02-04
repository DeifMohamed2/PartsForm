#!/usr/bin/env node
/**
 * TURBO SYNC ENGINE v2.2 - ULTRA SPEED
 * =====================================
 * Professional-grade high-performance sync system
 * Target: 75M records in 35 minutes (~35k records/sec)
 * 
 * Architecture:
 * ┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
 * │  FTP Server │ ──▶ │ NDJSON Files │ ──▶ │ mongoimport │ ──▶ │  ES Bulk    │
 * │  (parallel) │     │ (NVMe disk)  │     │ (parallel)  │     │ (from file) │
 * └─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
 * 
 * Key optimizations:
 * 1. Download ALL files first (parallel FTP)
 * 2. Use mongoimport (Go binary, parallel processes)
 * 3. Drop collection (instant) instead of deleteMany
 * 4. ES bulk reads from NDJSON files directly (NOT from MongoDB!)
 * 5. Parallel NDJSON transformation and ES file processing
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
// CONFIGURATION - ABSOLUTE MAXIMUM SPEED
// 96GB RAM, 18 cores, NVMe SSD
// Target: 75M records in ~25 minutes
// ============================================
const CONFIG = {
  // Directories
  WORK_DIR: '/tmp/partsform-turbo-sync',
  
  // FTP - aggressive parallel downloads
  FTP_PARALLEL: 30,              // 30 parallel FTP downloads (was 20)
  FTP_TIMEOUT: 30000,            // 30s timeout per file
  
  // MongoDB - mongoimport settings
  MONGO_WORKERS: 18,             // Use all 18 cores per process
  MONGO_PARALLEL: 6,             // Run 6 mongoimport processes in parallel
  MONGO_BATCH_SIZE: 10000,       // mongoimport batch size
  SKIP_INDEXES: true,            // Skip index creation (do in background later)
  
  // Elasticsearch - ABSOLUTE MAXIMUM SPEED
  ES_BULK_SIZE: 150000,          // 150k docs per bulk (was 100k)
  ES_PARALLEL: 24,               // 24 parallel bulk operations (was 16)
  ES_REFRESH_INTERVAL: '-1',     // Disable during import
  
  // Processing - PARALLEL EVERYTHING
  TRANSFORM_PARALLEL: 16,        // Process 16 files simultaneously (was 8)
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
// PHASE 2: TRANSFORM CSVs TO NDJSON (PARALLEL STREAMING)
// Process multiple files simultaneously for 3-4x speedup
// ============================================
async function transformToNDJSON(downloadDir, files, integration) {
  log('PHASE 2: Transforming CSVs to NDJSON format (PARALLEL)...', 'PROGRESS');
  const startTime = Date.now();
  
  const ndjsonDir = path.join(CONFIG.WORK_DIR, 'ndjson');
  fs.mkdirSync(ndjsonDir, { recursive: true });
  
  const integrationId = integration._id.toString();
  const integrationName = integration.name;
  const importedAt = new Date().toISOString();
  
  let totalRecords = 0;
  const ndjsonFiles = [];
  let completedFiles = 0;
  
  // Function to transform a single file
  const transformFile = async (fileName) => {
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
            
            // Find column indices - comprehensive mapping
            colMap = {
              // Part identification
              partNumber: headers.findIndex(h => h.includes('vendor code') || h.includes('vendor_code') || h.includes('part') || h.includes('sku') || h === 'code'),
              description: headers.findIndex(h => h.includes('title') || h.includes('desc') || h.includes('name')),
              brand: headers.findIndex(h => h.includes('brand') || h.includes('manufacturer') || h.includes('make')),
              
              // Pricing
              price: headers.findIndex(h => h.includes('price') || h.includes('cost')),
              currency: headers.findIndex(h => h.includes('currency') || h.includes('curr') || h === 'aed' || h === 'usd'),
              
              // Stock & Quantity
              quantity: headers.findIndex(h => h === 'quantity' || h === 'qty'),
              minOrderQty: headers.findIndex(h => h.includes('min_lot') || h.includes('min lot') || h.includes('minorder') || h.includes('min_order') || h.includes('moq')),
              stock: headers.findIndex(h => h === 'stock' && !h.includes('code')),
              stockCode: headers.findIndex(h => h.includes('stock code') || h.includes('stock_code') || h.includes('stockcode')),
              
              // Physical properties
              weight: headers.findIndex(h => h === 'weight'),
              weightUnit: headers.findIndex(h => h.includes('weight_unit') || h.includes('weightunit')),
              volume: headers.findIndex(h => h.includes('volume') || h.includes('vol')),
              
              // Delivery
              deliveryDays: headers.findIndex(h => h.includes('delivery') || h.includes('lead_time') || h.includes('leadtime')),
              
              // Categories
              category: headers.findIndex(h => h === 'category' || h === 'cat'),
              subcategory: headers.findIndex(h => h.includes('subcategory') || h.includes('subcat') || h.includes('sub_category')),
              
              // Supplier
              supplier: headers.findIndex(h => h.includes('supplier')),
            };
            return;
          }
          
          const trimmedLine = line.trim();
          if (!trimmedLine) return;
          
          const cols = trimmedLine.split(separator);
          const partNumber = (cols[colMap.partNumber] || '').replace(/['"]/g, '').trim();
          if (!partNumber) return;
          
          // Extract stock code from filename if not in columns (e.g., "APMG price 1 day_DS1_part1.csv" -> "DS1")
          let stockCodeValue = (cols[colMap.stockCode] || '').replace(/['"]/g, '').trim();
          if (!stockCodeValue) {
            const match = fileName.match(/_([A-Z0-9]+)_part/i);
            if (match) stockCodeValue = match[1];
          }
          
          const doc = {
            partNumber,
            description: (cols[colMap.description] || '').replace(/['"]/g, ''),
            brand: (cols[colMap.brand] || '').replace(/['"]/g, ''),
            supplier: (cols[colMap.supplier] || '').replace(/['"]/g, ''),
            
            // Pricing
            price: parseFloat(cols[colMap.price]) || 0,
            currency: (cols[colMap.currency] || 'AED').replace(/['"]/g, '').toUpperCase(),
            
            // Stock & Quantity
            quantity: parseInt(cols[colMap.quantity]) || 0,
            minOrderQty: parseInt(cols[colMap.minOrderQty]) || 1,
            stock: (cols[colMap.stock] || 'unknown').replace(/['"]/g, ''),
            stockCode: stockCodeValue,
            
            // Physical properties
            weight: parseFloat(cols[colMap.weight]) || 0,
            weightUnit: (cols[colMap.weightUnit] || 'kg').replace(/['"]/g, ''),
            volume: parseFloat(cols[colMap.volume]) || 0,
            
            // Delivery
            deliveryDays: parseInt(cols[colMap.deliveryDays]) || 0,
            
            // Categories
            category: (cols[colMap.category] || '').replace(/['"]/g, ''),
            subcategory: (cols[colMap.subcategory] || '').replace(/['"]/g, ''),
            
            // Metadata
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
      
      // Delete CSV immediately to free disk space
      try { fs.unlinkSync(csvPath); } catch (e) {}
      
      return { ndjsonPath, records: fileRecords };
      
    } catch (error) {
      log(`Error transforming ${fileName}: ${error.message}`, 'ERROR');
      return { ndjsonPath: null, records: 0 };
    }
  };
  
  // Process files in parallel batches of TRANSFORM_PARALLEL
  for (let i = 0; i < files.length; i += CONFIG.TRANSFORM_PARALLEL) {
    const batch = files.slice(i, i + CONFIG.TRANSFORM_PARALLEL);
    const results = await Promise.all(batch.map(f => transformFile(f)));
    
    for (const result of results) {
      if (result.ndjsonPath) {
        ndjsonFiles.push(result.ndjsonPath);
        totalRecords += result.records;
      }
      completedFiles++;
    }
    
    // Progress update
    log(`Transformed ${completedFiles}/${files.length} files (${formatNumber(totalRecords)} records)`, 'PROGRESS');
    
    // Force GC after each batch to prevent memory buildup
    if (global.gc) global.gc();
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
  
  // Step 1: FAST DELETE - Drop entire collection instead of deleteMany (instant vs 17 min!)
  const deleteStart = Date.now();
  log('Dropping parts collection for instant cleanup...');
  try {
    await db.collection('parts').drop();
    log(`Collection dropped in ${((Date.now() - deleteStart) / 1000).toFixed(1)}s`, 'SUCCESS');
  } catch (e) {
    // Collection might not exist
    log('Collection does not exist, creating fresh');
  }
  
  // Recreate collection
  const collection = db.collection('parts');
  
  let importedCount = 0;
  
  if (useMongoimport) {
    // Use mongoimport (FASTEST - 10-50x faster than Node.js)
    // Run MONGO_PARALLEL imports simultaneously!
    log(`Using PARALLEL mongoimport (${CONFIG.MONGO_PARALLEL} concurrent) for maximum speed...`);
    
    // Parse MongoDB URI
    const uri = new URL(mongoUri);
    const host = uri.hostname;
    const port = uri.port || 27017;
    const database = uri.pathname.replace('/', '') || 'partsform';
    const username = uri.username;
    const password = uri.password;
    const authSource = uri.searchParams.get('authSource') || 'admin';
    
    // Build base command args
    const buildArgs = (ndjsonPath) => {
      const args = [
        '--host', host,
        '--port', String(port),
        '--db', database,
        '--collection', 'parts',
        '--type', 'json',
        '--file', ndjsonPath,
        '--numInsertionWorkers', String(CONFIG.MONGO_WORKERS),
      ];
      if (username && password) {
        args.push('--username', username);
        args.push('--password', decodeURIComponent(password));
        args.push('--authenticationDatabase', authSource);
      }
      return args;
    };
    
    // Run mongoimport as promise
    const runMongoimport = (ndjsonPath) => {
      return new Promise((resolve, reject) => {
        const child = spawn('mongoimport', buildArgs(ndjsonPath), {
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let stderr = '';
        child.stderr.on('data', (data) => { stderr += data.toString(); });
        
        child.on('close', (code) => {
          // Delete file after import
          // NOTE: Don't delete yet - ES indexing needs these files!
          // try { fs.unlinkSync(ndjsonPath); } catch (e) {}
          
          if (code === 0) {
            resolve({ success: true, file: path.basename(ndjsonPath) });
          } else {
            resolve({ success: false, file: path.basename(ndjsonPath), error: stderr });
          }
        });
        
        child.on('error', (err) => {
          resolve({ success: false, file: path.basename(ndjsonPath), error: err.message });
        });
      });
    };
    
    // Process in parallel batches of MONGO_PARALLEL
    let completedFiles = 0;
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < ndjsonFiles.length; i += CONFIG.MONGO_PARALLEL) {
      const batch = ndjsonFiles.slice(i, i + CONFIG.MONGO_PARALLEL);
      const results = await Promise.all(batch.map(f => runMongoimport(f)));
      
      for (const result of results) {
        completedFiles++;
        if (result.success) successCount++;
        else {
          failCount++;
          log(`mongoimport failed for ${result.file}: ${result.error}`, 'ERROR');
        }
      }
      
      // Progress update
      const percent = Math.round((completedFiles / ndjsonFiles.length) * 100);
      const elapsed = (Date.now() - startTime) / 1000;
      log(`MongoDB import: ${completedFiles}/${ndjsonFiles.length} files (${percent}%) - ${formatDuration(elapsed * 1000)} elapsed`, 'PROGRESS');
    }
    
    // Count imported (fast query since we just dropped and recreated)
    importedCount = await collection.estimatedDocumentCount();
    
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
      // NOTE: Don't delete - ES indexing needs these files!
      // try { fs.unlinkSync(ndjsonPath); } catch (e) {}
      
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
  
  // Step 3: Skip index recreation during import (saves 15-20 minutes!)
  // Indexes will be created after ES indexing completes
  if (!CONFIG.SKIP_INDEXES) {
    log('Recreating indexes...');
    await collection.createIndex({ partNumber: 1 }, { background: true });
    await collection.createIndex({ integration: 1 }, { background: true });
    await collection.createIndex({ brand: 1 }, { background: true });
    await collection.createIndex({ partNumber: 1, integration: 1 }, { background: true });
  } else {
    log('Skipping indexes (will create after ES indexing)');
  }
  
  const duration = Date.now() - startTime;
  const rate = Math.round(importedCount / (duration / 1000));
  log(`Imported ${formatNumber(importedCount)} records in ${formatDuration(duration)} (${formatNumber(rate)}/sec)`, 'SUCCESS');
  
  return { importedCount, duration, rate };
}

// ============================================
// PHASE 4: ELASTICSEARCH BULK INDEX (FROM NDJSON FILES - 10x FASTER!)
// Read directly from NDJSON files instead of MongoDB cursor
// ============================================
async function indexToElasticsearch(integration, totalRecords, ndjsonFiles) {
  log('PHASE 4: Bulk indexing to Elasticsearch (from NDJSON files)...', 'PROGRESS');
  const startTime = Date.now();
  
  const esNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
  const esIndex = process.env.ELASTICSEARCH_INDEX || 'automotive_parts';
  
  const esClient = new ESClient({
    node: esNode,
    requestTimeout: 300000,     // 5 min timeout for big bulks
    maxRetries: 3,
    compression: true,          // Compress requests
  });
  
  // Check ES availability
  try {
    await esClient.cluster.health();
  } catch {
    log('Elasticsearch not available, skipping', 'ERROR');
    return { indexed: 0, duration: 0 };
  }
  
  // Put index into MAXIMUM SPEED ingest mode
  try {
    await esClient.indices.putSettings({
      index: esIndex,
      body: {
        'index.refresh_interval': '-1',
        'index.number_of_replicas': 0,
        'index.translog.durability': 'async',
        'index.translog.sync_interval': '120s',
        'index.translog.flush_threshold_size': '2gb',
      }
    });
  } catch (e) {
    // Index might not exist
  }
  
  // Delete ALL existing data from ES index (faster than deleteByQuery)
  log('Clearing ES index...');
  try {
    await esClient.deleteByQuery({
      index: esIndex,
      body: { query: { match_all: {} } },
      conflicts: 'proceed',
      refresh: false,
      wait_for_completion: false,
      slices: 'auto',
    });
  } catch (e) {
    // Ignore
  }
  
  let totalIndexed = 0;
  let lastProgressTime = Date.now();
  const PROGRESS_INTERVAL = 10000;
  let docIdCounter = 0;
  
  log(`Starting ES bulk indexing (${CONFIG.ES_PARALLEL} parallel x ${CONFIG.ES_BULK_SIZE/1000}k batch) from ${ndjsonFiles.length} files...`);
  
  // Process a single file and return indexed count
  const processFile = async (ndjsonPath) => {
    const fileStream = fs.createReadStream(ndjsonPath, { highWaterMark: 256 * 1024 });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    
    let batch = [];
    let fileIndexed = 0;
    let pendingBulks = [];
    
    const flushBatch = async (docs) => {
      if (docs.length === 0) return 0;
      
      const body = docs.flatMap(doc => [
        { index: { _index: esIndex } },
        {
          partNumber: doc.partNumber,
          description: doc.description,
          brand: doc.brand,
          supplier: doc.supplier,
          price: doc.price,
          currency: doc.currency,
          quantity: doc.quantity,
          minOrderQty: doc.minOrderQty,
          stock: doc.stock,
          stockCode: doc.stockCode,
          weight: doc.weight,
          weightUnit: doc.weightUnit,
          volume: doc.volume,
          deliveryDays: doc.deliveryDays,
          category: doc.category,
          subcategory: doc.subcategory,
          integration: doc.integration,
          integrationName: doc.integrationName,
          fileName: doc.fileName,
        }
      ]);
      
      try {
        const result = await esClient.bulk({ body, refresh: false });
        return result.items ? result.items.length : docs.length;
      } catch (e) {
        return 0;
      }
    };
    
    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const doc = JSON.parse(line);
        batch.push(doc);
        
        if (batch.length >= CONFIG.ES_BULK_SIZE) {
          pendingBulks.push(flushBatch([...batch]));
          batch = [];
          
          // Limit concurrent bulks per file
          if (pendingBulks.length >= 4) {
            const results = await Promise.all(pendingBulks);
            fileIndexed += results.reduce((a, b) => a + b, 0);
            pendingBulks = [];
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
    
    // Flush remaining
    if (batch.length > 0) pendingBulks.push(flushBatch(batch));
    if (pendingBulks.length > 0) {
      const results = await Promise.all(pendingBulks);
      fileIndexed += results.reduce((a, b) => a + b, 0);
    }
    
    // Delete file after ES indexing
    try { fs.unlinkSync(ndjsonPath); } catch (e) {}
    
    return fileIndexed;
  };
  
  // Process files in parallel batches
  const ES_FILE_PARALLEL = 8; // Process 8 files simultaneously
  let completedFiles = 0;
  
  for (let i = 0; i < ndjsonFiles.length; i += ES_FILE_PARALLEL) {
    const batch = ndjsonFiles.slice(i, i + ES_FILE_PARALLEL);
    const results = await Promise.all(batch.map(f => processFile(f)));
    
    totalIndexed += results.reduce((a, b) => a + b, 0);
    completedFiles += batch.length;
    
    // Progress update
    const now = Date.now();
    const elapsed = (now - startTime) / 1000;
    const rate = Math.round(totalIndexed / elapsed);
    const percent = Math.round((totalIndexed / totalRecords) * 100);
    const eta = totalRecords > 0 && rate > 0 ? Math.round((totalRecords - totalIndexed) / rate) : 0;
    log(`ES indexed ${formatNumber(totalIndexed)}/${formatNumber(totalRecords)} (${percent}%) - ${formatNumber(rate)}/sec - Files: ${completedFiles}/${ndjsonFiles.length} - ETA: ${formatDuration(eta * 1000)}`, 'PROGRESS');
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
  console.log('🚀 TURBO SYNC ENGINE v2.2 - ULTRA SPEED');
  console.log('═'.repeat(60));
  console.log(`   Target: 75M records in 35 minutes (~35k/sec)`);
  console.log(`   Server: 96GB RAM, 18 cores, NVMe SSD`);
  console.log(`   NEW: ES indexes from NDJSON files (10x faster!)`);
  console.log(`   Config: FTP=${CONFIG.FTP_PARALLEL} | Transform=${CONFIG.TRANSFORM_PARALLEL} | Mongo=${CONFIG.MONGO_PARALLEL}x | ES=8 files`);
  console.log('═'.repeat(60) + '\n');
  
  const overallStart = Date.now();
  
  // STEP 0: Clean up any previous downloads immediately
  log('Cleaning up previous sync files...');
  try {
    if (fs.existsSync(CONFIG.WORK_DIR)) {
      fs.rmSync(CONFIG.WORK_DIR, { recursive: true, force: true });
      log('Previous download files removed', 'SUCCESS');
    }
  } catch (e) {
    log(`Cleanup warning: ${e.message}`, 'ERROR');
  }
  
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
    
    // ES indexing now reads from NDJSON files directly (10x faster than MongoDB cursor!)
    const esResult = await indexToElasticsearch(integration, mongoResult.importedCount, transformResult.ndjsonFiles);
    
    // PHASE 5: Create MongoDB indexes in background (after ES completes)
    if (CONFIG.SKIP_INDEXES) {
      log('PHASE 5: Creating MongoDB indexes in background...', 'PROGRESS');
      const indexStart = Date.now();
      const db = mongoose.connection.db;
      const collection = db.collection('parts');
      
      // Create indexes with background: true (non-blocking)
      await Promise.all([
        collection.createIndex({ partNumber: 1 }, { background: true }),
        collection.createIndex({ integration: 1 }, { background: true }),
        collection.createIndex({ brand: 1 }, { background: true }),
        collection.createIndex({ partNumber: 1, integration: 1 }, { background: true }),
      ]);
      
      log(`Indexes created in ${formatDuration(Date.now() - indexStart)}`, 'SUCCESS');
    }
    
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
  }
  // Note: Don't disconnect mongoose here - syncWorker manages the connection
}

// Export for use by sync worker
module.exports = { runTurboSync, CONFIG };

// Direct execution
if (require.main === module) {
  const integrationId = process.argv[2];
  runTurboSync(integrationId).then(async result => {
    await mongoose.disconnect();
    process.exit(result.success ? 0 : 1);
  });
}
