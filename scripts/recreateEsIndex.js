#!/usr/bin/env node
/**
 * Recreate Elasticsearch index - fixes mapping conflicts (e.g. deliveryDays integer→keyword).
 * Run after changing Part schema field types. All indexed data will be lost.
 * Re-sync or re-import supplier parts to repopulate.
 *
 * Usage: node scripts/recreateEsIndex.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const elasticsearchService = require('../services/elasticsearchService');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform');
    console.log('Connected to MongoDB');

    await elasticsearchService.initialize();
    if (!elasticsearchService.isAvailable) {
      console.error('Elasticsearch is not available');
      process.exit(1);
    }

    console.log('Deleting and recreating ES index...');
    await elasticsearchService.deleteAndRecreateIndex();
    console.log('✅ ES index recreated successfully. Re-sync or re-import to repopulate.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
