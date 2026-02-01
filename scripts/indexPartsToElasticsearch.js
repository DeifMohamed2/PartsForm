/**
 * Elasticsearch Indexing Script for Automotive Parts
 * Indexes all parts from MongoDB into Elasticsearch for fast search
 * 
 * Usage: node scripts/indexPartsToElasticsearch.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Part = require('../models/Part');
const connectDB = require('../config/database');
const { Client } = require('@elastic/elasticsearch');

// Elasticsearch configuration
const ES_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
const INDEX_NAME = 'automotive_parts';
const BATCH_SIZE = 1000;

/**
 * Create Elasticsearch client
 */
function createClient() {
  const config = {
    node: ES_NODE,
    maxRetries: 3,
    requestTimeout: 60000,
    sniffOnStart: false
  };

  if (process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD) {
    config.auth = {
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD
    };
  }

  return new Client(config);
}

/**
 * Create or update the index mapping
 */
async function createIndex(client) {
  try {
    const indexExists = await client.indices.exists({ index: INDEX_NAME });

    if (!indexExists) {
      await client.indices.create({
        index: INDEX_NAME,
        body: {
          settings: {
            number_of_shards: 3,
            number_of_replicas: 1,
            refresh_interval: '30s',
            max_result_window: 10000,
            analysis: {
              analyzer: {
                part_number_analyzer: {
                  type: 'custom',
                  tokenizer: 'keyword',
                  filter: ['lowercase']
                },
                autocomplete_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'autocomplete_filter']
                },
                autocomplete_search_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase']
                }
              },
              filter: {
                autocomplete_filter: {
                  type: 'edge_ngram',
                  min_gram: 2,
                  max_gram: 20
                }
              }
            }
          },
          mappings: {
            properties: {
              partNumber: {
                type: 'text',
                analyzer: 'part_number_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                  autocomplete: {
                    type: 'text',
                    analyzer: 'autocomplete_analyzer',
                    search_analyzer: 'autocomplete_search_analyzer'
                  }
                }
              },
              description: {
                type: 'text',
                analyzer: 'standard',
                fields: {
                  autocomplete: {
                    type: 'text',
                    analyzer: 'autocomplete_analyzer',
                    search_analyzer: 'autocomplete_search_analyzer'
                  }
                }
              },
              brand: {
                type: 'text',
                fields: { keyword: { type: 'keyword' } }
              },
              supplier: {
                type: 'text',
                fields: { keyword: { type: 'keyword' } }
              },
              category: {
                type: 'keyword'
              },
              subcategory: {
                type: 'keyword'
              },
              price: { type: 'float' },
              currency: { type: 'keyword' },
              quantity: { type: 'integer' },
              stock: { type: 'keyword' },
              weight: { type: 'float' },
              weightUnit: { type: 'keyword' },
              deliveryDays: { type: 'integer' },
              tags: { type: 'keyword' },
              integrationName: { type: 'keyword' },
              importedAt: { type: 'date' },
              mongoId: { type: 'keyword' }
            }
          }
        }
      });
      console.log('✅ Index created successfully');
    } else {
      console.log('ℹ️  Index already exists');
    }
  } catch (error) {
    console.error('❌ Error creating index:', error.message);
    throw error;
  }
}

/**
 * Transform MongoDB document to Elasticsearch document
 */
function transformPart(part) {
  return {
    partNumber: part.partNumber,
    description: part.description,
    brand: part.brand,
    supplier: part.supplier,
    category: part.category,
    subcategory: part.subcategory,
    price: part.price,
    currency: part.currency,
    quantity: part.quantity,
    stock: part.stock,
    weight: part.weight,
    weightUnit: part.weightUnit,
    deliveryDays: part.deliveryDays,
    tags: part.tags,
    integrationName: part.integrationName,
    importedAt: part.importedAt,
    mongoId: part._id.toString()
  };
}

/**
 * Index all parts to Elasticsearch
 */
async function indexParts(client) {
  const totalParts = await Part.countDocuments();
  console.log(`📦 Indexing ${totalParts.toLocaleString()} parts to Elasticsearch...`);

  let indexed = 0;
  let failed = 0;
  const startTime = Date.now();

  // Process in batches using cursor
  const cursor = Part.find().cursor();
  let batch = [];

  for await (const part of cursor) {
    batch.push(part);

    if (batch.length >= BATCH_SIZE) {
      const result = await indexBatch(client, batch);
      indexed += result.indexed;
      failed += result.failed;
      
      const progress = (((indexed + failed) / totalParts) * 100).toFixed(1);
      process.stdout.write(`\r   Progress: ${progress}% - Indexed: ${indexed.toLocaleString()}, Failed: ${failed.toLocaleString()}`);
      
      batch = [];
    }
  }

  // Index remaining parts
  if (batch.length > 0) {
    const result = await indexBatch(client, batch);
    indexed += result.indexed;
    failed += result.failed;
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n\n✅ Indexing complete!`);
  console.log(`   Total indexed: ${indexed.toLocaleString()}`);
  console.log(`   Total failed: ${failed.toLocaleString()}`);
  console.log(`   Total time: ${totalTime}s`);
  console.log(`   Rate: ${(indexed / totalTime).toFixed(0)} docs/sec`);

  // Update isIndexed flag in MongoDB
  await Part.updateMany({}, { $set: { isIndexed: true } });
  console.log('   Updated isIndexed flag in MongoDB');
}

/**
 * Index a batch of parts
 */
async function indexBatch(client, parts) {
  const operations = parts.flatMap(part => [
    { index: { _index: INDEX_NAME, _id: part._id.toString() } },
    transformPart(part)
  ]);

  try {
    const response = await client.bulk({ refresh: false, body: operations });
    
    let indexed = 0;
    let failed = 0;
    
    if (response.errors) {
      for (const item of response.items) {
        if (item.index.error) {
          failed++;
        } else {
          indexed++;
        }
      }
    } else {
      indexed = parts.length;
    }

    return { indexed, failed };
  } catch (error) {
    console.error('\n❌ Batch indexing error:', error.message);
    return { indexed: 0, failed: parts.length };
  }
}

/**
 * Verify index statistics
 */
async function verifyIndex(client) {
  console.log('\n📊 Elasticsearch Index Statistics:');
  
  try {
    const stats = await client.indices.stats({ index: INDEX_NAME });
    const count = await client.count({ index: INDEX_NAME });
    
    console.log(`   Documents: ${count.count.toLocaleString()}`);
    console.log(`   Index size: ${(stats._all.primaries.store.size_in_bytes / 1024 / 1024).toFixed(2)} MB`);
    
    // Refresh index
    await client.indices.refresh({ index: INDEX_NAME });
    console.log('   Index refreshed');
  } catch (error) {
    console.error('   Error getting stats:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   🔍 ELASTICSEARCH INDEXING SCRIPT');
  console.log('   Index automotive parts for ultra-fast search');
  console.log('═══════════════════════════════════════════════════════════════');

  let client;
  
  try {
    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await connectDB();

    // Connect to Elasticsearch
    console.log('🔌 Connecting to Elasticsearch...');
    client = createClient();
    
    const health = await client.cluster.health({}, { requestTimeout: 5000 });
    console.log(`✅ Elasticsearch connected - Status: ${health.status}`);

    // Create index
    console.log('\n📁 Creating/verifying index...');
    await createIndex(client);

    // Index all parts
    console.log('');
    await indexParts(client);

    // Verify
    await verifyIndex(client);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   ✅ INDEXING COMPLETE - Search is ready!');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n⚠️  Elasticsearch is not running.');
      console.log('   The parts are stored in MongoDB and can be searched there.');
      console.log('   To enable fast search, start Elasticsearch and run this script again.');
    } else {
      console.error('\n❌ Error:', error.message);
    }
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

main();
