/**
 * Cleanup orphaned ES documents
 * Run this to fix duplicates issue
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function cleanup() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const elasticsearchService = require('../services/elasticsearchService');
  await elasticsearchService.initialize();
  
  // Count current ES docs
  let count = await elasticsearchService.client.count({ index: elasticsearchService.indexName });
  console.log('Before cleanup - Total ES docs:', count.count);
  
  // Delete all supplier uploaded docs from ES (by fileName since that's the only reliable field)
  const fileName = 'APMG price  7 days_AB4_part1.csv';
  console.log(`\nDeleting orphaned docs with fileName: "${fileName}"`);
  
  const deleteResult = await elasticsearchService.client.deleteByQuery({
    index: elasticsearchService.indexName,
    body: {
      query: { term: { fileName: fileName } }
    },
    refresh: true,
    conflicts: 'proceed'
  });
  console.log('Deleted:', deleteResult.deleted, 'documents');
  
  // Verify
  count = await elasticsearchService.client.count({ index: elasticsearchService.indexName });
  console.log('\nAfter cleanup - Total ES docs:', count.count);
  
  await mongoose.disconnect();
  console.log('\nCleanup complete!');
}

cleanup().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
