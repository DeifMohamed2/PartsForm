/**
 * Rebuild MongoDB Text Indexes for Parts Collection
 * Ensures text search works correctly
 * 
 * Usage: node scripts/rebuildIndexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Part = require('../models/Part');
const connectDB = require('../config/database');

async function rebuildIndexes() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   🔧 MONGODB INDEX REBUILD');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    await connectDB();

    console.log('📋 Dropping existing indexes...');
    try {
      await Part.collection.dropIndexes();
      console.log('   ✅ Indexes dropped\n');
    } catch (error) {
      console.log('   ⚠️  No indexes to drop or error:', error.message, '\n');
    }

    console.log('📋 Creating new indexes...');
    
    // Ensure text index is created
    await Part.collection.createIndex(
      { 
        partNumber: 'text', 
        description: 'text', 
        brand: 'text',
        supplier: 'text',
        category: 'text',
        tags: 'text'
      },
      {
        weights: {
          partNumber: 10,
          brand: 5,
          description: 3,
          supplier: 2,
          category: 2,
          tags: 1
        },
        name: 'parts_text_search_index'
      }
    );
    console.log('   ✅ Text search index created');

    // Create other indexes
    await Part.collection.createIndex({ partNumber: 1 });
    console.log('   ✅ Part number index created');

    await Part.collection.createIndex({ brand: 1 });
    console.log('   ✅ Brand index created');

    await Part.collection.createIndex({ supplier: 1 });
    console.log('   ✅ Supplier index created');

    await Part.collection.createIndex({ category: 1 });
    console.log('   ✅ Category index created');

    await Part.collection.createIndex({ price: 1 });
    console.log('   ✅ Price index created');

    await Part.collection.createIndex({ stock: 1 });
    console.log('   ✅ Stock index created');

    await Part.collection.createIndex({ importedAt: -1 });
    console.log('   ✅ Import date index created');

    await Part.collection.createIndex({ partNumber: 1, supplier: 1 });
    console.log('   ✅ Compound index (partNumber, supplier) created');

    // Get index info
    const indexes = await Part.collection.indexes();
    console.log(`\n📊 Total indexes: ${indexes.length}`);
    indexes.forEach((idx, i) => {
      console.log(`   ${i + 1}. ${idx.name}`);
    });

    // Test text search
    console.log('\n📋 Testing text search...');
    const results = await Part.find({ $text: { $search: 'brake' } }).limit(5);
    console.log(`   Found ${results.length} results for "brake"`);
    if (results.length > 0) {
      console.log(`   Sample: ${results[0].partNumber} - ${results[0].description.slice(0, 40)}...`);
      console.log('   ✅ Text search is working!\n');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   ✅ INDEX REBUILD COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

rebuildIndexes();
