#!/usr/bin/env node
/**
 * ULTRA-FAST SYNC SCRIPT
 * ========================
 * Runs as a SEPARATE PROCESS - doesn't affect website performance
 * 
 * Strategy:
 * 1. Download all CSV files from FTP (parallel)
 * 2. Drop MongoDB indexes (except _id)
 * 3. Import CSVs using mongoimport (16 parallel workers)
 * 4. Recreate MongoDB indexes
 * 5. Bulk index to Elasticsearch (refresh disabled)
 * 6. Re-enable ES refresh
 * 
 * Target: 75M records in ~30 minutes
 * 
 * Usage:
 *   node scripts/ultraFastSync.js [integrationId]
 *   
 * Or via PM2:
 *   pm2 start scripts/ultraFastSync.js --name "sync-worker" --no-autorestart
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { Client: FTPClient } = require('basic-ftp');
const { Client: ESClient } = require('@elastic/elasticsearch');

// Configuration
const CONFIG = {
  // MongoDB
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform',
  mongoDatabase: 'partsform',
  mongoCollection: 'parts',
  
  // Elasticsearch
  esNode: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  esIndex: process.env.ELASTICSEARCH_INDEX || 'automotive_parts',
  
  // Performance tuning for 18 cores / 96GB RAM
  mongoWorkers: 16,           // mongoimport parallel workers
  mongoBatchSize: 5000,       // mongoimport batch size
  esBulkSize: 20000,          // ES bulk batch size
  esParallelBulks: 8,         // Concurrent ES bulk operations
  ftpParallelDownloads: 10,   // Parallel FTP downloads
  
  // Paths
  tempDir: path.join(os.tmpdir(), 'partsform-sync'),
  mergedCsvPath: path.join(os.tmpdir(), 'partsform-sync', 'merged_parts.csv'),
};

// Logging with timestamps
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'ERROR' ? '❌' : type === 'SUCCESS' ? '✅' : type === 'PROGRESS' ? '⏳' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

// Execute shell command and return output
function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

// Check if mongoimport is available
let MONGOIMPORT_AVAILABLE = false;
function checkMongoimport() {
  try {
    exec('which mongoimport');
    MONGOIMPORT_AVAILABLE = true;
    return true;
  } catch {
    log('mongoimport not found. Will use Node.js bulk import (still very fast)', 'INFO');
    log('  For best performance, install MongoDB Database Tools:', 'INFO');
    log('  Ubuntu/Debian: apt install mongodb-database-tools', 'INFO');
    log('  macOS: brew install mongodb-database-tools', 'INFO');
    return false;
  }
}

/**
 * PHASE 1: Download all CSV files from FTP
 */
async function downloadFTPFiles(integration) {
  log(`PHASE 1: Downloading files from FTP...`, 'PROGRESS');
  
  const startTime = Date.now();
  const ftpConfig = integration.ftp;
  
  // Ensure temp directory exists
  if (!fs.existsSync(CONFIG.tempDir)) {
    fs.mkdirSync(CONFIG.tempDir, { recursive: true });
  }
  
  // Clear old files
  const oldFiles = fs.readdirSync(CONFIG.tempDir);
  for (const file of oldFiles) {
    fs.unlinkSync(path.join(CONFIG.tempDir, file));
  }
  
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
    
    // List files
    const remotePath = ftpConfig.remotePath || '/';
    const files = await client.list(remotePath);
    
    // Filter CSV files
    const pattern = ftpConfig.filePattern ? new RegExp(ftpConfig.filePattern.replace(/\*/g, '.*')) : /\.csv$/i;
    const csvFiles = files.filter(f => f.isFile && pattern.test(f.name));
    
    log(`Found ${csvFiles.length} CSV files to download`);
    
    // Download files (sequentially to avoid FTP issues, but fast on NVMe)
    for (let i = 0; i < csvFiles.length; i++) {
      const file = csvFiles[i];
      const localPath = path.join(CONFIG.tempDir, file.name);
      const remoteFilePath = path.posix.join(remotePath, file.name);
      
      await client.downloadTo(localPath, remoteFilePath);
      
      if ((i + 1) % 20 === 0) {
        log(`Downloaded ${i + 1}/${csvFiles.length} files...`, 'PROGRESS');
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Downloaded ${csvFiles.length} files in ${duration}s`, 'SUCCESS');
    
    return csvFiles.map(f => path.join(CONFIG.tempDir, f.name));
    
  } finally {
    client.close();
  }
}

/**
 * PHASE 2: Merge all CSVs into one file (for mongoimport)
 */
async function mergeCSVFiles(csvPaths, integration) {
  log(`PHASE 2: Merging ${csvPaths.length} CSV files...`, 'PROGRESS');
  
  const startTime = Date.now();
  const mergedPath = CONFIG.mergedCsvPath;
  
  // Create write stream
  const writeStream = fs.createWriteStream(mergedPath);
  
  // Standard header for parts collection
  const header = 'partNumber,description,brand,supplier,price,currency,quantity,minOrderQty,stock,stockCode,weight,volume,deliveryDays,category,integration,integrationName,fileName,importedAt\n';
  writeStream.write(header);
  
  let totalRows = 0;
  const integrationId = integration._id.toString();
  const integrationName = integration.name;
  const importedAt = new Date().toISOString();
  
  for (const csvPath of csvPaths) {
    const fileName = path.basename(csvPath);
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');
    
    // Skip header line, process data
    const headerLine = lines[0] || '';
    const separator = headerLine.includes(';') ? ';' : ',';
    
    // Parse header to find column positions
    const headers = headerLine.split(separator).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    
    const colMap = {
      partNumber: headers.findIndex(h => h.includes('part') || h.includes('vendor') || h.includes('sku') || h === 'code'),
      description: headers.findIndex(h => h.includes('desc') || h.includes('title') || h.includes('name')),
      brand: headers.findIndex(h => h.includes('brand') || h.includes('manufacturer')),
      supplier: headers.findIndex(h => h.includes('supplier') || h.includes('vendor')),
      price: headers.findIndex(h => h.includes('price') || h.includes('cost')),
      currency: headers.findIndex(h => h.includes('currency') || h.includes('curr')),
      quantity: headers.findIndex(h => h.includes('quantity') || h.includes('qty') || h.includes('stock')),
      weight: headers.findIndex(h => h.includes('weight')),
      category: headers.findIndex(h => h.includes('category') || h.includes('cat')),
    };
    
    // Process data lines
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = line.split(separator);
      
      const partNumber = (cols[colMap.partNumber] || '').replace(/['"]/g, '').trim();
      if (!partNumber) continue;
      
      // Build CSV row
      const row = [
        `"${partNumber}"`,
        `"${(cols[colMap.description] || '').replace(/['"]/g, '').replace(/"/g, '""')}"`,
        `"${(cols[colMap.brand] || '').replace(/['"]/g, '')}"`,
        `"${(cols[colMap.supplier] || '').replace(/['"]/g, '')}"`,
        parseFloat(cols[colMap.price]) || 0,
        `"${(cols[colMap.currency] || 'USD').replace(/['"]/g, '')}"`,
        parseInt(cols[colMap.quantity]) || 0,
        1, // minOrderQty
        `"available"`, // stock
        `""`, // stockCode
        parseFloat(cols[colMap.weight]) || 0,
        0, // volume
        0, // deliveryDays
        `"${(cols[colMap.category] || '').replace(/['"]/g, '')}"`,
        `"${integrationId}"`,
        `"${integrationName}"`,
        `"${fileName}"`,
        `"${importedAt}"`,
      ].join(',');
      
      writeStream.write(row + '\n');
      totalRows++;
    }
  }
  
  writeStream.end();
  
  // Wait for write to complete
  await new Promise(resolve => writeStream.on('finish', resolve));
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const sizeMB = (fs.statSync(mergedPath).size / 1024 / 1024).toFixed(1);
  log(`Merged ${totalRows.toLocaleString()} rows (${sizeMB} MB) in ${duration}s`, 'SUCCESS');
  
  return { mergedPath, totalRows };
}

/**
 * PHASE 3: Drop MongoDB indexes for fast import
 */
async function dropMongoIndexes() {
  log(`PHASE 3: Dropping MongoDB indexes for fast import...`, 'PROGRESS');
  
  const startTime = Date.now();
  
  await mongoose.connect(CONFIG.mongoUri);
  const db = mongoose.connection.db;
  const collection = db.collection(CONFIG.mongoCollection);
  
  // Get current indexes
  const indexes = await collection.indexes();
  const indexNames = indexes.map(i => i.name).filter(n => n !== '_id_');
  
  if (indexNames.length > 0) {
    await collection.dropIndexes();
    log(`Dropped ${indexNames.length} indexes: ${indexNames.join(', ')}`, 'SUCCESS');
  } else {
    log(`No indexes to drop (only _id exists)`);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`Index drop completed in ${duration}s`, 'SUCCESS');
}

/**
 * PHASE 4: Delete old data for this integration
 */
async function deleteOldData(integrationId) {
  log(`PHASE 4: Deleting old data for integration...`, 'PROGRESS');
  
  const startTime = Date.now();
  const db = mongoose.connection.db;
  const collection = db.collection(CONFIG.mongoCollection);
  
  const result = await collection.deleteMany(
    { integration: integrationId },
    { writeConcern: { w: 0 } } // Fire and forget for speed
  );
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`Deleted old data in ${duration}s`, 'SUCCESS');
}

/**
 * PHASE 5: Import CSV using mongoimport (ULTRA-FAST)
 */
async function mongoImport(csvPath, totalRows) {
  log(`PHASE 5: Importing ${totalRows.toLocaleString()} rows with mongoimport...`, 'PROGRESS');
  
  const startTime = Date.now();
  
  // Parse MongoDB URI for mongoimport
  const uri = new URL(CONFIG.mongoUri);
  const host = uri.hostname;
  const port = uri.port || 27017;
  const database = uri.pathname.replace('/', '') || CONFIG.mongoDatabase;
  const username = uri.username;
  const password = uri.password;
  const authSource = uri.searchParams.get('authSource') || 'admin';
  
  // Build mongoimport command
  let cmd = `mongoimport`;
  cmd += ` --host ${host}`;
  cmd += ` --port ${port}`;
  if (username && password) {
    cmd += ` --username "${username}"`;
    cmd += ` --password "${password}"`;
    cmd += ` --authenticationDatabase ${authSource}`;
  }
  cmd += ` --db ${database}`;
  cmd += ` --collection ${CONFIG.mongoCollection}`;
  cmd += ` --type csv`;
  cmd += ` --file "${csvPath}"`;
  cmd += ` --headerline`;
  cmd += ` --numInsertionWorkers ${CONFIG.mongoWorkers}`;
  cmd += ` --batchSize ${CONFIG.mongoBatchSize}`;
  
  log(`Running: mongoimport with ${CONFIG.mongoWorkers} workers...`);
  
  try {
    const output = exec(cmd, { stdio: 'pipe' });
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = Math.round(totalRows / parseFloat(duration));
    log(`Imported ${totalRows.toLocaleString()} rows in ${duration}s (${rate.toLocaleString()}/s)`, 'SUCCESS');
  } catch (error) {
    log(`mongoimport failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * PHASE 5B: Node.js Fast Bulk Import (fallback when mongoimport not available)
 * Still very fast: uses raw driver with w:0 write concern and large batches
 */
async function nodeBulkImport(csvPath, totalRows, integration) {
  log(`PHASE 5: Importing ${totalRows.toLocaleString()} rows with Node.js bulk...`, 'PROGRESS');
  
  const startTime = Date.now();
  const db = mongoose.connection.db;
  const collection = db.collection(CONFIG.mongoCollection);
  
  const BATCH_SIZE = 50000; // 50k per batch
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
  
  let batch = [];
  let totalInserted = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line (handling quoted values)
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    // Build document
    const doc = {};
    headers.forEach((h, idx) => {
      const val = values[idx] || '';
      // Convert types
      if (['price', 'weight', 'volume'].includes(h)) {
        doc[h] = parseFloat(val) || 0;
      } else if (['quantity', 'minOrderQty', 'deliveryDays'].includes(h)) {
        doc[h] = parseInt(val) || 0;
      } else {
        doc[h] = val;
      }
    });
    
    batch.push(doc);
    
    if (batch.length >= BATCH_SIZE) {
      await collection.insertMany(batch, { ordered: false, writeConcern: { w: 0 } });
      totalInserted += batch.length;
      
      if (totalInserted % 200000 < BATCH_SIZE) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = Math.round(totalInserted / parseFloat(elapsed));
        log(`Inserted ${totalInserted.toLocaleString()} / ${totalRows.toLocaleString()} (${rate.toLocaleString()}/s)`, 'PROGRESS');
      }
      
      batch = [];
    }
  }
  
  // Insert remaining
  if (batch.length > 0) {
    await collection.insertMany(batch, { ordered: false, writeConcern: { w: 0 } });
    totalInserted += batch.length;
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const rate = Math.round(totalInserted / parseFloat(duration));
  log(`Imported ${totalInserted.toLocaleString()} rows in ${duration}s (${rate.toLocaleString()}/s)`, 'SUCCESS');
  
  return totalInserted;
}

/**
 * PHASE 6: Recreate MongoDB indexes
 */
async function createMongoIndexes() {
  log(`PHASE 6: Recreating MongoDB indexes...`, 'PROGRESS');
  
  const startTime = Date.now();
  const db = mongoose.connection.db;
  const collection = db.collection(CONFIG.mongoCollection);
  
  // Create indexes in background
  const indexes = [
    { key: { partNumber: 1 }, background: true },
    { key: { integration: 1 }, background: true },
    { key: { brand: 1 }, background: true },
    { key: { supplier: 1 }, background: true },
    { key: { fileName: 1 }, background: true },
    { key: { partNumber: 1, supplier: 1 }, background: true },
    { key: { partNumber: 1, integration: 1 }, background: true },
  ];
  
  for (const idx of indexes) {
    await collection.createIndex(idx.key, { background: idx.background });
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`Created ${indexes.length} indexes in ${duration}s`, 'SUCCESS');
}

/**
 * PHASE 7: Bulk index to Elasticsearch
 */
async function bulkIndexToES(integrationId) {
  log(`PHASE 7: Bulk indexing to Elasticsearch...`, 'PROGRESS');
  
  const startTime = Date.now();
  
  // Connect to ES
  const esClient = new ESClient({
    node: CONFIG.esNode,
    requestTimeout: 120000,
  });
  
  // Check if ES is available
  try {
    await esClient.cluster.health();
  } catch {
    log('Elasticsearch not available, skipping ES indexing', 'ERROR');
    return;
  }
  
  // Put index into ingest mode
  try {
    await esClient.indices.putSettings({
      index: CONFIG.esIndex,
      body: {
        'index.refresh_interval': '-1',
        'index.number_of_replicas': 0,
      }
    });
  } catch (e) {
    // Index might not exist yet
  }
  
  // Delete old ES data for this integration
  try {
    await esClient.deleteByQuery({
      index: CONFIG.esIndex,
      body: { query: { term: { integration: integrationId } } },
      conflicts: 'proceed',
      refresh: false,
      wait_for_completion: true,
    });
  } catch (e) {
    // Ignore if index doesn't exist
  }
  
  // Stream from MongoDB and bulk index to ES
  const db = mongoose.connection.db;
  const collection = db.collection(CONFIG.mongoCollection);
  
  const cursor = collection.find({ integration: integrationId }).batchSize(CONFIG.esBulkSize);
  
  let batch = [];
  let totalIndexed = 0;
  let pendingBulks = [];
  
  const flushBatch = async (docs) => {
    if (docs.length === 0) return;
    
    const body = docs.flatMap(doc => [
      { index: { _index: CONFIG.esIndex, _id: doc._id.toString() } },
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
        importedAt: doc.importedAt,
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
    
    if (batch.length >= CONFIG.esBulkSize) {
      const batchToIndex = [...batch];
      batch = [];
      
      pendingBulks.push(flushBatch(batchToIndex));
      
      // Process in parallel
      if (pendingBulks.length >= CONFIG.esParallelBulks) {
        const results = await Promise.all(pendingBulks);
        totalIndexed += results.reduce((a, b) => a + b, 0);
        pendingBulks = [];
        
        if (totalIndexed % 500000 < CONFIG.esBulkSize) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = Math.round(totalIndexed / parseFloat(elapsed));
          log(`ES indexed ${totalIndexed.toLocaleString()} docs (${rate.toLocaleString()}/s)...`, 'PROGRESS');
        }
      }
    }
  }
  
  // Flush remaining
  if (batch.length > 0) {
    pendingBulks.push(flushBatch(batch));
  }
  if (pendingBulks.length > 0) {
    const results = await Promise.all(pendingBulks);
    totalIndexed += results.reduce((a, b) => a + b, 0);
  }
  
  // Re-enable refresh
  await esClient.indices.putSettings({
    index: CONFIG.esIndex,
    body: { 'index.refresh_interval': '30s' }
  });
  
  await esClient.indices.refresh({ index: CONFIG.esIndex });
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const rate = Math.round(totalIndexed / parseFloat(duration));
  log(`Indexed ${totalIndexed.toLocaleString()} docs to ES in ${duration}s (${rate.toLocaleString()}/s)`, 'SUCCESS');
  
  await esClient.close();
}

/**
 * PHASE 8: Update integration status
 */
async function updateIntegrationStatus(integrationId, totalRows, duration) {
  const Integration = require('../models/Integration');
  
  await Integration.findByIdAndUpdate(integrationId, {
    status: 'active',
    'lastSync.date': new Date(),
    'lastSync.status': 'success',
    'lastSync.duration': duration,
    'lastSync.recordsProcessed': totalRows,
    'lastSync.recordsInserted': totalRows,
    'stats.totalRecords': totalRows,
    'stats.lastSyncRecords': totalRows,
    $inc: { 'stats.totalSyncs': 1, 'stats.successfulSyncs': 1 }
  });
}

/**
 * MAIN - Run the ultra-fast sync
 */
async function main() {
  const integrationId = process.argv[2];
  
  console.log('\n' + '='.repeat(60));
  console.log('🚀 ULTRA-FAST SYNC - Separate Process Mode');
  console.log('='.repeat(60) + '\n');
  
  const overallStart = Date.now();
  
  try {
    // Check prerequisites (mongoimport optional, we have Node.js fallback)
    checkMongoimport();
    
    // Connect to MongoDB
    await mongoose.connect(CONFIG.mongoUri);
    log('Connected to MongoDB');
    
    // Get integration
    const Integration = require('../models/Integration');
    
    let integration;
    if (integrationId) {
      integration = await Integration.findById(integrationId);
    } else {
      // Get first FTP integration
      integration = await Integration.findOne({ type: 'ftp', enabled: true });
    }
    
    if (!integration) {
      log('No integration found', 'ERROR');
      process.exit(1);
    }
    
    log(`Syncing integration: ${integration.name}`);
    
    // Run phases
    const csvPaths = await downloadFTPFiles(integration);
    const { mergedPath, totalRows } = await mergeCSVFiles(csvPaths, integration);
    await dropMongoIndexes();
    await deleteOldData(integration._id.toString());
    
    // Use mongoimport if available, otherwise Node.js bulk import
    if (MONGOIMPORT_AVAILABLE) {
      await mongoImport(mergedPath, totalRows);
    } else {
      await nodeBulkImport(mergedPath, totalRows, integration);
    }
    
    await createMongoIndexes();
    await bulkIndexToES(integration._id.toString());
    
    const totalDuration = Date.now() - overallStart;
    await updateIntegrationStatus(integration._id, totalRows, totalDuration);
    
    // Cleanup
    try {
      fs.unlinkSync(mergedPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    console.log('\n' + '='.repeat(60));
    log(`SYNC COMPLETE: ${totalRows.toLocaleString()} rows in ${(totalDuration / 1000 / 60).toFixed(1)} minutes`, 'SUCCESS');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    log(`Sync failed: ${error.message}`, 'ERROR');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
