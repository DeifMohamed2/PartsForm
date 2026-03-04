#!/usr/bin/env node
/**
 * Cleanup supplier ES index - removes ALL orphan duplicates and re-indexes from MongoDB.
 * Use when search shows duplicate parts (e.g. same part 3x) but DB has only 1.
 *
 * Usage:
 *   node scripts/cleanupSupplierEsIndex.js <supplierId>              # All files for supplier
 *   node scripts/cleanupSupplierEsIndex.js <supplierId> <fileName>    # Single file
 *
 * Example:
 *   node scripts/cleanupSupplierEsIndex.js 507f1f77bcf86cd799439011
 *   node scripts/cleanupSupplierEsIndex.js 507f1f77bcf86cd799439011 "APMG price 7 days_AB4_part1.csv"
 */
require('dotenv').config();
const mongoose = require('mongoose');
const elasticsearchService = require('../services/elasticsearchService');
const supplierPartsService = require('../services/supplierPartsService');
const Supplier = require('../models/Supplier');

async function main() {
  const supplierId = process.argv[2];
  const fileName = process.argv[3] || null;

  if (!supplierId) {
    console.error('Usage: node scripts/cleanupSupplierEsIndex.js <supplierId> [fileName]');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform');
    console.log('Connected to MongoDB');

    const supplier = await Supplier.findById(supplierId).select('companyName name').lean();
    if (!supplier) {
      console.error('Supplier not found:', supplierId);
      process.exit(1);
    }
    const supplierName = supplier.companyName || supplier.name || '';

    await elasticsearchService.initialize();
    if (!elasticsearchService.isAvailable) {
      console.error('Elasticsearch is not available');
      process.exit(1);
    }

    if (fileName) {
      // Get part numbers for this file (for orphan delete)
      const Part = require('../models/Part');
      const parts = await Part.find({
        'source.type': 'supplier_upload',
        'source.supplierId': new mongoose.Types.ObjectId(supplierId),
        fileName
      }, '_id partNumber').lean();
      const docIds = parts.map((p) => p._id);
      const partNumbers = parts.map((p) => p.partNumber);

      console.log(`\nDeleting ALL ES docs for file "${fileName}" (supplier: ${supplierName})...`);
      const del = await elasticsearchService.deleteBySupplierFile(supplierId, fileName, docIds, supplierName, partNumbers);
      console.log(`Deleted ${del.deleted} docs from ES`);

      const indexed = await supplierPartsService.indexSupplierParts(supplierId, fileName);
      console.log(`Re-indexed ${indexed.indexed} docs from MongoDB`);
    } else {
      // Delete entire supplier from ES
      const parts = await require('../models/Part').find({
        'source.type': 'supplier_upload',
        'source.supplierId': new mongoose.Types.ObjectId(supplierId)
      }, '_id partNumber').lean();
      const docIds = parts.map((p) => p._id);
      const partNumbers = parts.map((p) => p.partNumber);

      console.log(`\nDeleting ALL ES docs for supplier "${supplierName}"...`);
      const del = await elasticsearchService.deleteBySupplier(supplierId, docIds, supplierName);
      console.log(`Deleted ${del.deleted} docs from ES`);

      // Re-index all parts for this supplier (no fileName filter)
      const indexed = await supplierPartsService.indexSupplierParts(supplierId, null);
      console.log(`Re-indexed ${indexed.indexed} docs from MongoDB`);
    }

    console.log('\n✅ Cleanup complete. Search results should now show correct counts.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
