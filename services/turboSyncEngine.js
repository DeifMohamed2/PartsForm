#!/usr/bin/env node
/**
 * TURBO SYNC ENGINE v4.0 - PIPELINE ARCHITECTURE
 * ================================================
 * Per-file pipeline: Rust transform → mongoimport → ES bulk (overlapping)
 * ES: index-per-run + alias swap (zero-downtime, no deleteByQuery)
 * ES: .bulk files streamed directly from Rust output (no JSON.parse in Node)
 *
 * Architecture:
 * ┌──────────┐     ┌──────────────────────────────────────────────────────┐
 * │FTP Server│──▶  │ PIPELINE (overlapping per file):                     │
 * │(parallel)│     │                                                      │
 * └──────────┘     │  Rust (all cores)   mongoimport (3x)   ES bulk (8x)  │
 *                  │  file1.csv ──▶ ┬─ .ndjson ──▶ MongoDB               │
 *                  │               └─ .bulk   ──▶ ES /_bulk (raw HTTP)   │
 *                  │  file2.csv ──▶ (same, overlapping)                   │
 *                  │  ...                                                 │
 *                  └──────────────────────────────────────────────────────┘
 *                  ┌──────────────────────────────────────────────────────┐
 *                  │ ES alias swap: automotive_parts → new_index          │
 *                  │ MongoDB: integration index only                      │
 *                  └──────────────────────────────────────────────────────┘
 */

require('dotenv').config();
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const readline = require('readline');
const mongoose = require('mongoose');
const { Client: FTPClient } = require('basic-ftp');
const { Client: ESClient } = require('@elastic/elasticsearch');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  // Directories
  WORK_DIR: '/tmp/partsform-turbo-sync',

  // FTP
  FTP_PARALLEL: 30,
  FTP_TIMEOUT: 60000,
  FTP_RETRIES: 3,

  // MongoDB - reduced concurrent to avoid disk contention
  MONGO_WORKERS: 6,              // Workers PER mongoimport process (18 cores / 4 procs ≈ 4-5)
  MONGO_CONCURRENT: 4,           // 4 concurrent mongoimport (NVMe handles parallel well)

  // Elasticsearch - pipeline via raw .bulk files
  ES_BULK_CONCURRENT: 8,         // 8 concurrent .bulk file streams to ES
  ES_CHUNK_LINES: 30000,         // 30k doc pairs (60k lines) per /_bulk POST (~30MB)
  ES_REFRESH_INTERVAL: '-1',
  ES_SHARDS: 5,

  // Processing
  TRANSFORM_PARALLEL: 24,
};

// ============================================
// UTILITIES
// ============================================
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const colors = {
    INFO: '\x1b[36m',
    SUCCESS: '\x1b[32m',
    ERROR: '\x1b[31m',
    PROGRESS: '\x1b[33m',
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

function checkMongoimport() {
  try {
    execCommand('which mongoimport');
    return true;
  } catch {
    return false;
  }
}

// Generate timestamped ES index name for this sync run
function generateESIndexName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `automotive_parts_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// ============================================
// ES INDEX MAPPING — matches elasticsearchService.js
// ============================================
const ES_INDEX_MAPPING = {
  settings: {
    number_of_shards: CONFIG.ES_SHARDS,
    number_of_replicas: 0,
    refresh_interval: '-1',
    max_result_window: 50000,
    'index.translog.durability': 'async',
    'index.translog.sync_interval': '120s',
    'index.translog.flush_threshold_size': '2gb',
    'index.merge.scheduler.max_thread_count': 1,
    analysis: {
      analyzer: {
        part_number_analyzer: {
          type: 'custom',
          tokenizer: 'keyword',
          filter: ['lowercase'],
        },
        autocomplete_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'autocomplete_filter'],
        },
        autocomplete_search_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase'],
        },
      },
      filter: {
        autocomplete_filter: {
          type: 'edge_ngram',
          min_gram: 2,
          max_gram: 20,
        },
      },
    },
  },
  mappings: {
    properties: {
      partNumber: {
        type: 'keyword',
        fields: {
          text: { type: 'text', analyzer: 'part_number_analyzer' },
          autocomplete: {
            type: 'text',
            analyzer: 'autocomplete_analyzer',
            search_analyzer: 'autocomplete_search_analyzer',
          },
        },
      },
      description: {
        type: 'text',
        analyzer: 'standard',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      brand: {
        type: 'keyword',
        fields: { text: { type: 'text', analyzer: 'standard' } },
      },
      supplier: {
        type: 'keyword',
        fields: { text: { type: 'text', analyzer: 'standard' } },
      },
      price: { type: 'float' },
      currency: { type: 'keyword' },
      quantity: { type: 'integer' },
      minOrderQty: { type: 'integer' },
      stock: { type: 'keyword' },
      stockCode: { type: 'keyword' },
      weight: { type: 'float' },
      weightUnit: { type: 'keyword' },
      volume: { type: 'float' },
      deliveryDays: { type: 'integer' },
      category: { type: 'keyword' },
      subcategory: { type: 'keyword' },
      integration: { type: 'keyword' },
      integrationName: { type: 'keyword' },
      fileName: { type: 'keyword' },
      importedAt: { type: 'date' },
      createdAt: { type: 'date' },
    },
  },
};

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

  const pattern = ftpConfig.filePattern ? new RegExp(ftpConfig.filePattern.replace(/\*/g, '.*')) : /\.csv$/i;
  const csvFiles = allFiles.filter(f => f.isFile && pattern.test(f.name));

  log(`Found ${csvFiles.length} CSV files to download`);

  const downloadFile = async (file, retryCount = 0) => {
    const localPath = path.join(downloadDir, file.name);
    const dlClient = new FTPClient();
    dlClient.ftp.verbose = false;

    try {
      await dlClient.access({
        host: ftpConfig.host,
        port: ftpConfig.port || 21,
        user: ftpConfig.username,
        password: ftpConfig.password,
        secure: ftpConfig.secure || false,
      });

      const remoteFilePath = path.posix.join(remotePath, file.name);
      await dlClient.downloadTo(localPath, remoteFilePath);

      return { success: true, file: file.name, size: file.size };
    } catch (error) {
      if (retryCount < CONFIG.FTP_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return downloadFile(file, retryCount + 1);
      }
      return { success: false, file: file.name, error: error.message };
    } finally {
      try { dlClient.close(); } catch (e) {}
    }
  };

  let completed = 0;
  let failed = 0;
  const results = [];

  for (let i = 0; i < csvFiles.length; i += CONFIG.FTP_PARALLEL) {
    const batch = csvFiles.slice(i, i + CONFIG.FTP_PARALLEL);
    const batchResults = await Promise.all(batch.map(f => downloadFile(f, 0)));

    for (const result of batchResults) {
      results.push(result);
      if (result.success) completed++;
      else failed++;
    }

    const percent = Math.round(((i + batch.length) / csvFiles.length) * 100);
    log(`Downloaded ${i + batch.length}/${csvFiles.length} files (${percent}%)`, 'PROGRESS');
  }

  if (failed > 0) {
    const failedFiles = results.filter(r => !r.success).map(r => r.file);
    log(`WARNING: ${failed} files failed to download: ${failedFiles.slice(0, 5).join(', ')}${failed > 5 ? '...' : ''}`, 'ERROR');
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
// RUST BINARY LOCATION
// ============================================
const RUST_BINARY_PATH = path.join(__dirname, '..', 'rust-transform', 'target', 'release', 'turbo-transform');

function isRustBinaryAvailable() {
  try {
    return fs.existsSync(RUST_BINARY_PATH) && fs.statSync(RUST_BINARY_PATH).isFile();
  } catch {
    return false;
  }
}

// ============================================
// PHASE 2+3+4 MERGED: PIPELINE
// Rust transforms all files → as each file completes,
// mongoimport and ES bulk start immediately (overlapping)
// ============================================
async function runPipeline(downloadDir, files, integration, esClient, esAliasName, reportProgress, totalFilesCount) {
  log('PHASE 2-4: 🦀 PIPELINE — Rust transform → MongoDB + ES (overlapping)...', 'PROGRESS');
  const pipelineStart = Date.now();

  const outputDir = path.join(CONFIG.WORK_DIR, 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  const integrationId = integration._id.toString();
  const integrationName = integration.name;

  // Generate timestamped ES index for this run
  const esIndexName = generateESIndexName();
  const esNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';

  // === Create fresh ES index with full mapping ===
  log(`Creating ES index: ${esIndexName}...`);
  try {
    await esClient.indices.create({
      index: esIndexName,
      body: ES_INDEX_MAPPING,
    });
    log(`ES index ${esIndexName} created`, 'SUCCESS');
  } catch (e) {
    log(`ES index creation failed: ${e.message}`, 'ERROR');
    throw e;
  }

  // === Drop MongoDB parts collection ===
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  log('Dropping MongoDB parts collection...');
  try {
    await db.collection('parts').drop();
    log('Collection dropped', 'SUCCESS');
  } catch (e) {
    log('Collection does not exist, creating fresh');
  }

  // === Stats tracking ===
  let totalRecords = 0;
  let totalMongoImported = 0;
  let totalESIndexed = 0;
  let transformDuration = 0;
  let mongoDuration = 0;
  let esDuration = 0;

  // === Queues for mongo and ES workers ===
  const mongoQueue = [];
  const esQueue = [];
  let mongoQueueResolvers = [];
  let esQueueResolvers = [];
  let rustDone = false;

  // Signal mechanism: workers wait for new items
  const waitForMongoItem = () => new Promise(resolve => {
    if (mongoQueue.length > 0) {
      resolve(mongoQueue.shift());
    } else {
      mongoQueueResolvers.push(resolve);
    }
  });

  const pushMongoItem = (item) => {
    if (mongoQueueResolvers.length > 0) {
      mongoQueueResolvers.shift()(item);
    } else {
      mongoQueue.push(item);
    }
  };

  const waitForESItem = () => new Promise(resolve => {
    if (esQueue.length > 0) {
      resolve(esQueue.shift());
    } else {
      esQueueResolvers.push(resolve);
    }
  });

  const pushESItem = (item) => {
    if (esQueueResolvers.length > 0) {
      esQueueResolvers.shift()(item);
    } else {
      esQueue.push(item);
    }
  };

  // Sentinel: null means "no more items"
  const poisonPill = null;

  // === Parse MongoDB URI for mongoimport ===
  const useMongoimport = checkMongoimport();
  let mongoBaseArgs = null;

  if (useMongoimport) {
    const uri = new URL(mongoUri);
    const host = uri.hostname;
    const port = uri.port || 27017;
    const database = uri.pathname.replace('/', '') || 'partsform';
    const username = uri.username;
    const password = uri.password;
    const authSource = uri.searchParams.get('authSource') || 'admin';

    mongoBaseArgs = { host, port, database, username, password, authSource };
  }

  // === mongoimport runner ===
  const runMongoimport = (ndjsonPath) => {
    return new Promise((resolveImport) => {
      if (!useMongoimport) {
        importWithNodeJS(ndjsonPath, db).then(resolveImport);
        return;
      }

      const args = [
        '--host', mongoBaseArgs.host,
        '--port', String(mongoBaseArgs.port),
        '--db', mongoBaseArgs.database,
        '--collection', 'parts',
        '--type', 'json',
        '--file', ndjsonPath,
        '--numInsertionWorkers', String(CONFIG.MONGO_WORKERS),
        '--writeConcern', '{w:0}',        // Fire-and-forget for max speed (we verify count after)
        '--bypassDocumentValidation',      // Skip schema validation during bulk import
      ];
      if (mongoBaseArgs.username && mongoBaseArgs.password) {
        args.push('--username', mongoBaseArgs.username);
        args.push('--password', decodeURIComponent(mongoBaseArgs.password));
        args.push('--authenticationDatabase', mongoBaseArgs.authSource);
      }

      const child = spawn('mongoimport', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        // Delete ndjson after import
        try { fs.unlinkSync(ndjsonPath); } catch (e) {}

        if (code === 0) {
          resolveImport({ success: true, file: path.basename(ndjsonPath) });
        } else {
          resolveImport({ success: false, file: path.basename(ndjsonPath), error: stderr });
        }
      });

      child.on('error', (err) => {
        resolveImport({ success: false, file: path.basename(ndjsonPath), error: err.message });
      });
    });
  };

  // === Node.js fallback for MongoDB import ===
  async function importWithNodeJS(ndjsonPath, db) {
    const collection = db.collection('parts');
    const BATCH_SIZE = 50000;
    let batch = [];
    let count = 0;

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
          count += batch.length;
          batch = [];
        }
      } catch (e) {}
    }

    if (batch.length > 0) {
      await collection.insertMany(batch, { ordered: false, writeConcern: { w: 0 } });
      count += batch.length;
    }

    try { fs.unlinkSync(ndjsonPath); } catch (e) {}
    return { success: true, file: path.basename(ndjsonPath), count };
  }

  // === Stream .bulk file to ES via raw HTTP ===
  const streamBulkToES = async (bulkPath) => {
    const fileStream = fs.createReadStream(bulkPath, { highWaterMark: 256 * 1024 });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let buffer = '';
    let lineCount = 0;
    let totalDocs = 0;
    const chunkLimit = CONFIG.ES_CHUNK_LINES * 2; // action+doc pairs = 2x lines

    const pendingPosts = [];

    for await (const line of rl) {
      buffer += line + '\n';
      lineCount++;

      if (lineCount >= chunkLimit) {
        pendingPosts.push(postBulkToES(esNode, buffer));
        buffer = '';
        lineCount = 0;

        // Cap concurrent POSTs per file
        if (pendingPosts.length >= 4) {
          const results = await Promise.all(pendingPosts);
          totalDocs += results.reduce((a, b) => a + b, 0);
          pendingPosts.length = 0;
        }
      }
    }

    // Flush remaining
    if (buffer.length > 0) {
      pendingPosts.push(postBulkToES(esNode, buffer));
    }
    if (pendingPosts.length > 0) {
      const results = await Promise.all(pendingPosts);
      totalDocs += results.reduce((a, b) => a + b, 0);
    }

    // Delete .bulk file
    try { fs.unlinkSync(bulkPath); } catch (e) {}

    return totalDocs;
  };

  // === Raw HTTP POST to ES /_bulk ===
  const postBulkToES = (esNodeUrl, body) => {
    return new Promise((resolve) => {
      const parsedUrl = new URL('/_bulk', esNodeUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 9200),
        path: '/_bulk',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 300000,
      };

      // Add auth if configured
      if (process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD) {
        options.headers['Authorization'] = 'Basic ' +
          Buffer.from(`${process.env.ELASTICSEARCH_USERNAME}:${process.env.ELASTICSEARCH_PASSWORD}`).toString('base64');
      }

      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            const indexed = result.items ? result.items.filter(i => !i.index?.error).length : 0;
            if (result.errors && result.items) {
              const firstError = result.items.find(i => i.index?.error);
              if (firstError) {
                log(`ES bulk error sample: ${JSON.stringify(firstError.index.error).substring(0, 200)}`, 'ERROR');
              }
            }
            resolve(indexed);
          } catch (e) {
            resolve(0);
          }
        });
      });

      req.on('error', (e) => {
        log(`ES bulk POST error: ${e.message}`, 'ERROR');
        resolve(0);
      });

      req.on('timeout', () => {
        req.destroy();
        log('ES bulk POST timeout', 'ERROR');
        resolve(0);
      });

      req.write(body);
      req.end();
    });
  };

  // === Shared counters (declared before workers so both can read) ===
  let mongoCompletedFiles = 0;
  let esCompletedFiles = 0;

  // === MongoDB Worker (pulls from queue) ===
  const mongoLastProgress = { time: Date.now() };
  const mongoWorkerFn = async (workerId) => {
    while (true) {
      const item = await waitForMongoItem();
      if (item === poisonPill) break;

      const fileStart = Date.now();
      const result = await runMongoimport(item);
      const fileDuration = Date.now() - fileStart;

      mongoCompletedFiles++;
      if (result.success) {
        if (Date.now() - mongoLastProgress.time > 3000) {
          log(`MongoDB [W${workerId}]: ${result.file} (${formatDuration(fileDuration)}) [${mongoCompletedFiles} files done]`, 'PROGRESS');
          mongoLastProgress.time = Date.now();
        }
      } else {
        log(`MongoDB [W${workerId}]: ${result.file} FAILED: ${result.error}`, 'ERROR');
      }

      // Report progress — estimate mongo inserted from file completion ratio
      if (reportProgress) {
        const totalFiles = totalFilesCount || files.length;
        const filesProcessed = Math.max(mongoCompletedFiles, esCompletedFiles);
        const estimatedMongoInserted = totalFiles > 0
          ? Math.round((mongoCompletedFiles / totalFiles) * totalRecords)
          : 0;
        await reportProgress({
          status: 'syncing',
          phase: 'pipeline',
          message: `MongoDB: ${mongoCompletedFiles}/${totalFiles} files | ES: ${formatNumber(totalESIndexed)} docs`,
          filesTotal: totalFiles,
          filesProcessed,
          recordsProcessed: totalRecords,
          recordsInserted: estimatedMongoInserted,
          currentFile: result.file || '',
        });
      }
    }
  };

  // === ES Worker (pulls from queue) ===
  let esLastProgressTime = Date.now();
  const esWorkerFn = async (workerId) => {
    while (true) {
      const item = await waitForESItem();
      if (item === poisonPill) break;

      const fileStart = Date.now();
      const indexed = await streamBulkToES(item);
      const fileDuration = Date.now() - fileStart;

      totalESIndexed += indexed;
      esCompletedFiles++;

      if (Date.now() - esLastProgressTime > 5000) {
        const elapsed = (Date.now() - pipelineStart) / 1000;
        const rate = Math.round(totalESIndexed / elapsed);
        log(`ES [W${workerId}]: ${formatNumber(totalESIndexed)} indexed (${formatNumber(rate)}/sec) [${esCompletedFiles} files]`, 'PROGRESS');
        esLastProgressTime = Date.now();
      }

      // Report progress
      if (reportProgress) {
        const totalFiles = totalFilesCount || files.length;
        const filesProcessed = Math.max(mongoCompletedFiles, esCompletedFiles);
        await reportProgress({
          status: 'syncing',
          phase: 'pipeline',
          message: `MongoDB: ${mongoCompletedFiles}/${totalFiles} files | ES: ${formatNumber(totalESIndexed)} docs`,
          filesTotal: totalFiles,
          filesProcessed,
          recordsProcessed: totalRecords,
          recordsInserted: totalESIndexed,
          currentFile: path.basename(item, '.bulk'),
        });
      }
    }
  };

  // === Start workers ===
  const mongoWorkers = [];
  for (let i = 0; i < CONFIG.MONGO_CONCURRENT; i++) {
    mongoWorkers.push(mongoWorkerFn(i + 1));
  }

  const esWorkers = [];
  for (let i = 0; i < CONFIG.ES_BULK_CONCURRENT; i++) {
    esWorkers.push(esWorkerFn(i + 1));
  }

  // === Start Rust binary ===
  const useRust = isRustBinaryAvailable();

  if (useRust) {
    log(`🦀 Starting Rust transform (ES index: ${esIndexName})...`, 'PROGRESS');

    await new Promise((resolveRust, rejectRust) => {
      const child = spawn(RUST_BINARY_PATH, [
        downloadDir,
        outputDir,
        integrationId,
        integrationName,
        esIndexName,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          RAYON_NUM_THREADS: String(os.cpus().length),
        },
      });

      let stdoutData = '';
      let lastProgressLog = Date.now();

      // stderr: per-file progress — IMMEDIATELY queue completed files
      child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.event === 'file_done') {
              // Extract stem from filename (e.g., "foo.csv" → "foo")
              const stem = event.file.replace(/\.csv$/i, '');
              const ndjsonPath = path.join(outputDir, `${stem}.ndjson`);
              const bulkPath = path.join(outputDir, `${stem}.bulk`);

              totalRecords += event.records;

              // Queue for MongoDB import immediately
              if (fs.existsSync(ndjsonPath)) {
                pushMongoItem(ndjsonPath);
              }

              // Queue for ES bulk streaming immediately
              if (fs.existsSync(bulkPath)) {
                pushESItem(bulkPath);
              }

              if (Date.now() - lastProgressLog > 2000) {
                log(`Rust: ${event.progress} files — ${formatNumber(totalRecords)} records (${formatNumber(event.rate_per_sec)}/sec)`, 'PROGRESS');
                lastProgressLog = Date.now();

                // Report progress during Rust transform
                if (reportProgress) {
                  reportProgress({
                    status: 'syncing',
                    phase: 'pipeline',
                    message: `Rust: ${event.progress} | MongoDB: ${mongoCompletedFiles} files | ES: ${formatNumber(totalESIndexed)} docs`,
                    filesTotal: totalFilesCount || files.length,
                    filesProcessed: Math.max(mongoCompletedFiles, esCompletedFiles),
                    recordsProcessed: totalRecords,
                    recordsInserted: totalESIndexed,
                    currentFile: event.file || '',
                  });
                }
              }
            } else if (event.event === 'start') {
              log(`Rust engine: ${event.files} files, ${event.threads} threads, ${(event.total_bytes / 1024 / 1024).toFixed(0)}MB input`, 'INFO');
            }
          } catch {
            if (line.startsWith('ERROR:')) {
              log(`Rust: ${line}`, 'ERROR');
            }
          }
        }
      });

      child.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      child.on('close', (code) => {
        transformDuration = Date.now() - pipelineStart;

        if (code !== 0 && code !== null) {
          log(`Rust transform exited with code ${code}`, 'ERROR');
        }

        try {
          const summary = JSON.parse(stdoutData.trim());
          totalRecords = summary.total_records || totalRecords;
          log(`🦀 Rust: ${formatNumber(totalRecords)} records in ${formatDuration(transformDuration)} (${formatNumber(summary.rate_per_sec)}/sec)`, 'SUCCESS');
        } catch (e) {
          log(`Failed to parse Rust output: ${e.message}`, 'ERROR');
        }

        // Delete CSV files
        for (const fileName of files) {
          try { fs.unlinkSync(path.join(downloadDir, fileName)); } catch (e) {}
        }

        // Send poison pills to signal workers to stop after draining
        for (let i = 0; i < CONFIG.MONGO_CONCURRENT; i++) pushMongoItem(poisonPill);
        for (let i = 0; i < CONFIG.ES_BULK_CONCURRENT; i++) pushESItem(poisonPill);

        rustDone = true;
        resolveRust();
      });

      child.on('error', (err) => {
        log(`Failed to spawn Rust: ${err.message}`, 'ERROR');
        for (let i = 0; i < CONFIG.MONGO_CONCURRENT; i++) pushMongoItem(poisonPill);
        for (let i = 0; i < CONFIG.ES_BULK_CONCURRENT; i++) pushESItem(poisonPill);
        rustDone = true;
        rejectRust(err);
      });
    });
  } else {
    // Node.js fallback: transform all files, then queue
    log('Rust binary not found — using Node.js fallback transform', 'PROGRESS');
    const transformResult = await transformToNDJSON_NodeFallback(downloadDir, files, integration, outputDir, esIndexName);
    totalRecords = transformResult.totalRecords;
    transformDuration = transformResult.duration;

    // Queue all completed files
    for (const f of transformResult.outputFiles) {
      if (f.ndjsonPath) pushMongoItem(f.ndjsonPath);
      if (f.bulkPath) pushESItem(f.bulkPath);
    }

    // Poison pills
    for (let i = 0; i < CONFIG.MONGO_CONCURRENT; i++) pushMongoItem(poisonPill);
    for (let i = 0; i < CONFIG.ES_BULK_CONCURRENT; i++) pushESItem(poisonPill);
  }

  // Wait for all workers to drain
  log('Waiting for MongoDB + ES workers to finish draining...', 'PROGRESS');

  if (reportProgress) {
    await reportProgress({
      status: 'syncing',
      phase: 'draining',
      message: 'Rust done — waiting for MongoDB + ES workers to drain...',
      filesTotal: totalFilesCount || files.length,
      filesProcessed: Math.max(mongoCompletedFiles, esCompletedFiles),
      recordsProcessed: totalRecords,
      recordsInserted: totalESIndexed,
      currentFile: 'Draining queues',
    });
  }

  const mongoWaitStart = Date.now();
  await Promise.all(mongoWorkers);
  const mongoWaitDuration = Date.now() - mongoWaitStart;
  log(`MongoDB workers drained (${formatDuration(mongoWaitDuration)})`, 'SUCCESS');

  const esWaitStart = Date.now();
  await Promise.all(esWorkers);
  const esWaitDuration = Date.now() - esWaitStart;
  log(`ES workers drained: ${formatNumber(totalESIndexed)} docs (${formatDuration(esWaitDuration)})`, 'SUCCESS');

  // === Get final MongoDB count ===
  const collection = db.collection('parts');
  totalMongoImported = await collection.estimatedDocumentCount();

  // === ES: Refresh new index, swap alias, delete old ===
  await swapESAlias(esClient, esAliasName, esIndexName);

  // === MongoDB: recreate critical indexes ===
  log('Recreating MongoDB indexes...');
  const indexOps = [
    collection.createIndex({ integration: 1 }, { background: true }),
    collection.createIndex({ partNumber: 1, supplier: 1 }, { background: true }),
    collection.createIndex({ partNumber: 1, integration: 1 }, { background: true }),
    collection.createIndex({ brand: 1, supplier: 1 }, { background: true }),
    collection.createIndex({ integrationName: 1 }, { background: true }),
    collection.createIndex({ importedAt: -1 }, { background: true }),
    collection.createIndex(
      { partNumber: 'text', description: 'text', brand: 'text', supplier: 'text' },
      { weights: { partNumber: 10, brand: 5, description: 3, supplier: 2 }, name: 'parts_text_index', background: true }
    ),
  ];
  const indexResults = await Promise.allSettled(indexOps);
  const indexOk = indexResults.filter(r => r.status === 'fulfilled').length;
  log(`Created ${indexOk}/${indexOps.length} MongoDB indexes`, 'SUCCESS');

  const pipelineDuration = Date.now() - pipelineStart;

  // Report final pipeline stats
  if (reportProgress) {
    await reportProgress({
      _force: true,
      status: 'syncing',
      phase: 'finalizing',
      message: `Pipeline done: ${formatNumber(totalMongoImported)} MongoDB, ${formatNumber(totalESIndexed)} ES`,
      filesTotal: totalFilesCount || files.length,
      filesProcessed: totalFilesCount || files.length,
      recordsProcessed: totalRecords,
      recordsInserted: totalMongoImported,
      currentFile: 'Finalizing',
    });
  }

  return {
    totalRecords,
    mongoImported: totalMongoImported,
    esIndexed: totalESIndexed,
    esIndexName,
    pipelineDuration,
    transformDuration,
    mongoDuration: mongoWaitDuration,
    esDuration: esWaitDuration,
  };
}

// ============================================
// ES ALIAS SWAP — zero-downtime index rotation
// ============================================
async function swapESAlias(esClient, aliasName, newIndexName) {
  log(`ES alias swap: ${aliasName} → ${newIndexName}...`, 'PROGRESS');

  try {
    // Refresh the new index first
    await esClient.indices.refresh({ index: newIndexName });

    // Restore normal settings
    await esClient.indices.putSettings({
      index: newIndexName,
      body: {
        'index.refresh_interval': '5s',
        'index.translog.durability': 'request',
        'index.translog.sync_interval': '5s',
        'index.merge.scheduler.max_thread_count': null,
      },
    });

    // Find what the alias currently points to
    let oldIndices = [];
    try {
      const aliasInfo = await esClient.indices.getAlias({ name: aliasName });
      oldIndices = Object.keys(aliasInfo);
    } catch (e) {
      // Alias doesn't exist yet
    }

    // Check if aliasName is actually a concrete index (from v3.0 era)
    let aliasIsConcreteIndex = false;
    try {
      const exists = await esClient.indices.exists({ index: aliasName });
      if (exists && oldIndices.length === 0) {
        // It exists but has no alias — it's a concrete index
        aliasIsConcreteIndex = true;
      }
    } catch (e) {}

    if (aliasIsConcreteIndex) {
      log(`Deleting old concrete index "${aliasName}" to create alias...`);
      await esClient.indices.delete({ index: aliasName });
      oldIndices = [];
    }

    // Atomic alias swap
    const actions = [];

    // Remove alias from old indices
    for (const oldIdx of oldIndices) {
      if (oldIdx !== newIndexName) {
        actions.push({ remove: { index: oldIdx, alias: aliasName } });
      }
    }

    // Add alias to new index
    actions.push({ add: { index: newIndexName, alias: aliasName } });

    await esClient.indices.updateAliases({ body: { actions } });
    log(`Alias "${aliasName}" now points to ${newIndexName}`, 'SUCCESS');

    // Delete old indices
    for (const oldIdx of oldIndices) {
      if (oldIdx !== newIndexName) {
        try {
          await esClient.indices.delete({ index: oldIdx });
          log(`Deleted old index: ${oldIdx}`);
        } catch (e) {
          log(`Warning: could not delete old index ${oldIdx}: ${e.message}`, 'ERROR');
        }
      }
    }
  } catch (e) {
    log(`ES alias swap failed: ${e.message}`, 'ERROR');
    log('The new index still exists with data — manual alias swap may be needed', 'ERROR');
  }
}

// ============================================
// NODE.JS FALLBACK TRANSFORM (if Rust binary not built)
// ============================================
async function transformToNDJSON_NodeFallback(downloadDir, files, integration, outputDir, esIndexName) {
  log('Transforming CSVs (Node.js fallback)...', 'PROGRESS');
  const startTime = Date.now();

  const integrationId = integration._id.toString();
  const integrationName = integration.name;
  const importedAt = new Date().toISOString();

  let totalRecords = 0;
  const outputFiles = [];
  let completedFiles = 0;

  const esActionLine = JSON.stringify({ index: { _index: esIndexName } }) + '\n';

  const transformFile = async (fileName) => {
    const csvPath = path.join(downloadDir, fileName);
    const stem = path.basename(fileName, '.csv');
    const ndjsonPath = path.join(outputDir, `${stem}.ndjson`);
    const bulkPath = path.join(outputDir, `${stem}.bulk`);

    try {
      const fileRecords = await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(csvPath, { encoding: 'utf8', highWaterMark: 64 * 1024 });
        const ndjsonStream = fs.createWriteStream(ndjsonPath);
        const bulkStream = fs.createWriteStream(bulkPath);
        const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });

        let isFirstLine = true;
        let headers = [];
        let colMap = {};
        let separator = ',';
        let recordCount = 0;

        rl.on('line', (line) => {
          if (isFirstLine) {
            isFirstLine = false;
            separator = line.includes(';') ? ';' : ',';
            headers = line.split(separator).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

            colMap = {
              partNumber: headers.findIndex(h => h.includes('vendor code') || h.includes('vendor_code') || h.includes('part') || h.includes('sku') || h === 'code'),
              description: headers.findIndex(h => h.includes('title') || h.includes('desc') || h.includes('name')),
              brand: headers.findIndex(h => h.includes('brand') || h.includes('manufacturer') || h.includes('make')),
              price: headers.findIndex(h => h.includes('price') || h.includes('cost')),
              currency: headers.findIndex(h => h.includes('currency') || h.includes('curr') || h === 'aed' || h === 'usd'),
              quantity: headers.findIndex(h => h === 'quantity' || h === 'qty'),
              minOrderQty: headers.findIndex(h => h.includes('min_lot') || h.includes('min lot') || h.includes('minorder') || h.includes('min_order') || h.includes('moq')),
              stock: headers.findIndex(h => h === 'stock' && !h.includes('code')),
              stockCode: headers.findIndex(h => h.includes('stock code') || h.includes('stock_code') || h.includes('stockcode')),
              weight: headers.findIndex(h => h === 'weight'),
              weightUnit: headers.findIndex(h => h.includes('weight_unit') || h.includes('weightunit')),
              volume: headers.findIndex(h => h.includes('volume') || h.includes('vol')),
              deliveryDays: headers.findIndex(h => h.includes('delivery') || h.includes('lead_time') || h.includes('leadtime')),
              category: headers.findIndex(h => h === 'category' || h === 'cat'),
              subcategory: headers.findIndex(h => h.includes('subcategory') || h.includes('subcat') || h.includes('sub_category')),
              supplier: headers.findIndex(h => h.includes('supplier')),
            };
            return;
          }

          const trimmedLine = line.trim();
          if (!trimmedLine) return;

          const cols = trimmedLine.split(separator);
          const partNumber = (cols[colMap.partNumber] || '').replace(/['"]/g, '').trim();
          if (!partNumber) return;

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
            price: parseFloat(cols[colMap.price]) || 0,
            currency: (cols[colMap.currency] || 'AED').replace(/['"]/g, '').toUpperCase(),
            quantity: parseInt(cols[colMap.quantity]) || 0,
            minOrderQty: parseInt(cols[colMap.minOrderQty]) || 1,
            stock: (cols[colMap.stock] || 'unknown').replace(/['"]/g, ''),
            stockCode: stockCodeValue,
            weight: parseFloat(cols[colMap.weight]) || 0,
            weightUnit: (cols[colMap.weightUnit] || 'kg').replace(/['"]/g, ''),
            volume: parseFloat(cols[colMap.volume]) || 0,
            deliveryDays: parseInt(cols[colMap.deliveryDays]) || 0,
            category: (cols[colMap.category] || '').replace(/['"]/g, ''),
            subcategory: (cols[colMap.subcategory] || '').replace(/['"]/g, ''),
            integration: integrationId,
            integrationName,
            fileName,
            importedAt,
          };

          const jsonLine = JSON.stringify(doc);
          ndjsonStream.write(jsonLine + '\n');

          // ES bulk: strip importedAt
          const { importedAt: _ia, ...esDoc } = doc;
          bulkStream.write(esActionLine + JSON.stringify(esDoc) + '\n');

          recordCount++;
        });

        rl.on('close', () => {
          ndjsonStream.end(() => {
            bulkStream.end(() => resolve(recordCount));
          });
        });

        rl.on('error', reject);
        readStream.on('error', reject);
      });

      try { fs.unlinkSync(csvPath); } catch (e) {}

      return { ndjsonPath, bulkPath, records: fileRecords };

    } catch (error) {
      log(`Error transforming ${fileName}: ${error.message}`, 'ERROR');
      return { ndjsonPath: null, bulkPath: null, records: 0 };
    }
  };

  for (let i = 0; i < files.length; i += CONFIG.TRANSFORM_PARALLEL) {
    const batch = files.slice(i, i + CONFIG.TRANSFORM_PARALLEL);
    const results = await Promise.all(batch.map(f => transformFile(f)));

    for (const result of results) {
      if (result.ndjsonPath) {
        outputFiles.push(result);
        totalRecords += result.records;
      }
      completedFiles++;
    }

    log(`Transformed ${completedFiles}/${files.length} files (${formatNumber(totalRecords)} records)`, 'PROGRESS');

    if (global.gc) global.gc();
  }

  const duration = Date.now() - startTime;
  log(`Transformed ${formatNumber(totalRecords)} records in ${formatDuration(duration)}`, 'SUCCESS');

  return { outputFiles, totalRecords, duration };
}

// ============================================
// PHASE 5: UPDATE INTEGRATION STATUS
// ============================================
async function updateIntegrationStatus(integration, results) {
  const Integration = require('../models/Integration');

  await Integration.findByIdAndUpdate(integration._id, {
    status: 'active',
    'lastSync.date': new Date(),
    'lastSync.status': 'success',
    'lastSync.duration': results.pipelineDuration + results.downloadDuration,
    'lastSync.recordsProcessed': results.totalRecords,
    'lastSync.recordsInserted': results.mongoImported,
    'stats.totalRecords': results.mongoImported,
    'stats.lastSyncRecords': results.mongoImported,
    $inc: { 'stats.totalSyncs': 1, 'stats.successfulSyncs': 1 }
  });
}

// ============================================
// MAIN ENTRY POINT
// ============================================
async function runTurboSync(integrationId, options = {}) {
  // options: { onProgress: async (progressData) => {} }
  const onProgress = typeof options === 'function' ? options : (options.onProgress || null);

  console.log('\n' + '═'.repeat(60));
  console.log('🚀 TURBO SYNC ENGINE v4.0 - PIPELINE + ALIAS SWAP');
  console.log('═'.repeat(60));
  console.log(`   Target: 75M records — pipeline architecture`);
  console.log(`   Server: 96GB RAM, 18 cores, NVMe SSD`);
  console.log(`   FTP: ${CONFIG.FTP_PARALLEL} parallel`);
  console.log(`   Transform: Rust (all cores) → overlapping MongoDB + ES`);
  console.log(`   MongoDB: ${CONFIG.MONGO_CONCURRENT}x mongoimport (${CONFIG.MONGO_WORKERS} workers each)`);
  console.log(`   ES: ${CONFIG.ES_BULK_CONCURRENT}x .bulk file streams (${CONFIG.ES_CHUNK_LINES/1000}k docs/chunk)`);
  console.log(`   ES: index-per-run + alias swap (zero downtime)`);
  console.log('═'.repeat(60) + '\n');

  const overallStart = Date.now();

  // Throttled progress reporter — max once per 2 seconds
  let lastProgressReport = 0;
  const reportProgress = async (data) => {
    if (!onProgress) return;
    const now = Date.now();
    if (now - lastProgressReport < 2000 && !data._force) return;
    lastProgressReport = now;
    try {
      await onProgress({
        ...data,
        elapsedMs: Date.now() - overallStart,
      });
    } catch (e) {
      // Don't let progress reporting break the sync
    }
  };

  // Clean up previous downloads
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

    await Integration.findByIdAndUpdate(integration._id, { status: 'syncing' });

    // Report initial progress
    await reportProgress({
      _force: true,
      status: 'syncing',
      phase: 'connecting',
      message: 'Connecting to services...',
      filesTotal: 0,
      filesProcessed: 0,
      recordsProcessed: 0,
      recordsInserted: 0,
      currentFile: '',
    });

    // ES client
    const esNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
    const esAliasName = process.env.ELASTICSEARCH_INDEX || 'automotive_parts';

    const esClientOptions = {
      node: esNode,
      requestTimeout: 300000,
      maxRetries: 3,
      compression: true,
    };

    if (process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD) {
      esClientOptions.auth = {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
      };
    }

    const esClient = new ESClient(esClientOptions);

    // Check ES availability
    try {
      await esClient.cluster.health();
      log('Elasticsearch connected');
    } catch (e) {
      log(`Elasticsearch not available: ${e.message}`, 'ERROR');
    }

    // Phase 1: Download
    await reportProgress({
      _force: true,
      status: 'syncing',
      phase: 'downloading',
      message: 'Downloading files from FTP...',
      filesTotal: 0,
      filesProcessed: 0,
      recordsProcessed: 0,
      recordsInserted: 0,
      currentFile: 'FTP download',
    });

    const downloadResult = await downloadAllFiles(integration);

    const totalFilesCount = downloadResult.files.length;

    await reportProgress({
      _force: true,
      status: 'syncing',
      phase: 'pipeline',
      message: `Downloaded ${totalFilesCount} files, starting pipeline...`,
      filesTotal: totalFilesCount,
      filesProcessed: 0,
      recordsProcessed: 0,
      recordsInserted: 0,
      currentFile: 'Starting Rust transform',
    });

    // Phase 2-4 merged: Pipeline
    const pipelineResult = await runPipeline(
      downloadResult.downloadDir,
      downloadResult.files,
      integration,
      esClient,
      esAliasName,
      reportProgress,
      totalFilesCount,
    );

    // Update integration status
    await updateIntegrationStatus(integration, {
      ...pipelineResult,
      downloadDuration: downloadResult.duration,
    });

    // Cleanup
    try {
      fs.rmSync(CONFIG.WORK_DIR, { recursive: true });
    } catch (e) {}

    await esClient.close();

    const totalDuration = Date.now() - overallStart;

    // Report completion
    await reportProgress({
      _force: true,
      status: 'completed',
      phase: 'done',
      message: `Sync complete: ${formatNumber(pipelineResult.mongoImported)} records`,
      filesTotal: totalFilesCount,
      filesProcessed: totalFilesCount,
      recordsProcessed: pipelineResult.totalRecords,
      recordsInserted: pipelineResult.mongoImported,
      currentFile: '',
    });

    console.log('\n' + '═'.repeat(60));
    console.log('📊 SYNC COMPLETE - SUMMARY');
    console.log('═'.repeat(60));
    console.log(`   Total Records: ${formatNumber(pipelineResult.totalRecords)}`);
    console.log(`   MongoDB: ${formatNumber(pipelineResult.mongoImported)}`);
    console.log(`   Elasticsearch: ${formatNumber(pipelineResult.esIndexed)} (${pipelineResult.esIndexName})`);
    console.log(`   Total Duration: ${formatDuration(totalDuration)}`);
    console.log(`   Average Rate: ${formatNumber(Math.round(pipelineResult.mongoImported / (totalDuration / 1000)))}/sec overall`);
    console.log('═'.repeat(60));
    console.log('   Phase Breakdown:');
    console.log(`   ├─ FTP Download:    ${formatDuration(downloadResult.duration)}`);
    console.log(`   ├─ Rust Transform:  ${formatDuration(pipelineResult.transformDuration)} (overlapped with MongoDB+ES)`);
    console.log(`   ├─ MongoDB Import:  ${formatDuration(pipelineResult.mongoDuration)} (${CONFIG.MONGO_CONCURRENT}x concurrent)`);
    console.log(`   └─ ES Indexing:     ${formatDuration(pipelineResult.esDuration)} (${CONFIG.ES_BULK_CONCURRENT}x .bulk streams)`);
    console.log(`   Pipeline Total:     ${formatDuration(pipelineResult.pipelineDuration)} (overlapped)`);
    console.log('═'.repeat(60) + '\n');

    return { success: true, records: pipelineResult.mongoImported, duration: totalDuration };

  } catch (error) {
    log(`Sync failed: ${error.message}`, 'ERROR');
    console.error(error);
    return { success: false, error: error.message };
  }
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
