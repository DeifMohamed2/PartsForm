/**
 * Test script to debug ES/MongoDB sync issues
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const Part = require('../models/Part');
  const Supplier = require('../models/Supplier');
  const elasticsearchService = require('../services/elasticsearchService');
  
  // 1. Check MongoDB parts count
  console.log('\n=== MongoDB Stats ===');
  const supplierParts = await Part.countDocuments({'source.type': 'supplier_upload'});
  console.log('Supplier uploaded parts:', supplierParts);
  
  // 2. Get supplier info
  const supplierIds = await Part.distinct('source.supplierId', {'source.type': 'supplier_upload'});
  console.log('\n=== Unique Suppliers ===');
  console.log('Found', supplierIds.length, 'supplier IDs');
  
  let targetSupplierId = null;
  for (const supplierId of supplierIds) {
    const count = await Part.countDocuments({'source.supplierId': supplierId});
    const supplier = await Supplier.findById(supplierId);
    console.log(`  - ${supplierId}: ${count} parts (${supplier?.companyName || 'Unknown'})`);
    targetSupplierId = supplierId;
  }
  
  // 3. Check ES
  console.log('\n=== Elasticsearch Stats ===');
  try {
    await elasticsearchService.initialize();
    
    // Count all docs
    const esCount = await elasticsearchService.client.count({ index: elasticsearchService.indexName });
    console.log('Total ES docs:', esCount.count);
    
    // Count docs with sourceSupplierId
    const withSourceId = await elasticsearchService.client.count({
      index: elasticsearchService.indexName,
      body: { query: { exists: { field: 'sourceSupplierId' } } }
    });
    console.log('Docs with sourceSupplierId:', withSourceId.count);
    
    // Count docs by fileName
    const byFileName = await elasticsearchService.client.search({
      index: elasticsearchService.indexName,
      body: {
        size: 0,
        aggs: {
          filenames: {
            terms: { field: 'fileName', size: 20 }
          }
        }
      }
    });
    console.log('\n=== ES Docs by fileName ===');
    byFileName.aggregations.filenames.buckets.forEach(b => {
      console.log(`  - ${b.key}: ${b.doc_count} docs`);
    });
    
    // TEST: Try deleting with document IDs
    if (targetSupplierId) {
      console.log('\n=== Testing Delete with Document IDs ===');
      
      // Get document IDs from MongoDB
      const partsInMongo = await Part.find({
        'source.type': 'supplier_upload',
        'source.supplierId': targetSupplierId
      }, '_id').lean();
      const docIds = partsInMongo.map(p => p._id);
      console.log(`MongoDB has ${docIds.length} parts for this supplier`);
      
      // Test counting how many of these IDs exist in ES
      const sample = docIds.slice(0, 10).map(id => id.toString());
      const existsInEs = await elasticsearchService.client.count({
        index: elasticsearchService.indexName,
        body: { query: { ids: { values: sample } } }
      });
      console.log(`Sample check: ${existsInEs.count}/10 MongoDB IDs exist in ES`);
    }
    
  } catch (err) {
    console.error('ES Error:', err.message);
  }
  
  await mongoose.disconnect();
  console.log('\nDone');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
