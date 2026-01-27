/**
 * Test Script for Automotive Parts
 * Verifies that all generated parts are searchable and properly structured
 * 
 * Usage: node scripts/testAutomotiveParts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Part = require('../models/Part');
const connectDB = require('../config/database');

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   🧪 AUTOMOTIVE PARTS TEST SUITE');
  console.log('   Verifying search functionality and data integrity');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    await connectDB();

    let passed = 0;
    let failed = 0;

    // Test 1: Total count
    console.log('📋 Test 1: Database Count');
    const totalParts = await Part.countDocuments();
    console.log(`   Total parts: ${totalParts.toLocaleString()}`);
    if (totalParts >= 5000) {
      console.log('   ✅ PASSED\n');
      passed++;
    } else {
      console.log('   ❌ FAILED - Expected at least 5000 parts\n');
      failed++;
    }

    // Test 2: Search by part number prefix
    console.log('📋 Test 2: Part Number Search (Brake Pads - BP prefix)');
    const brakePads = await Part.find({ partNumber: /^BP/ }).limit(10);
    console.log(`   Found: ${brakePads.length} brake pad parts`);
    if (brakePads.length > 0) {
      console.log(`   Sample: ${brakePads[0].partNumber} - ${brakePads[0].brand}`);
      console.log('   ✅ PASSED\n');
      passed++;
    } else {
      console.log('   ❌ FAILED - No brake pad parts found\n');
      failed++;
    }

    // Test 3: Brand search
    console.log('📋 Test 3: Brand Search (Bosch)');
    const boschParts = await Part.find({ brand: 'Bosch' }).limit(10);
    console.log(`   Found: ${boschParts.length} Bosch parts`);
    if (boschParts.length > 0) {
      console.log(`   Sample: ${boschParts[0].partNumber} - ${boschParts[0].description.slice(0, 50)}...`);
      console.log('   ✅ PASSED\n');
      passed++;
    } else {
      console.log('   ❌ FAILED - No Bosch parts found\n');
      failed++;
    }

    // Test 4: Category search
    console.log('📋 Test 4: Category Search (Engine)');
    const engineParts = await Part.find({ category: 'Engine' }).limit(10);
    console.log(`   Found: ${engineParts.length} engine parts`);
    if (engineParts.length > 0) {
      console.log(`   Sample: ${engineParts[0].partNumber} - ${engineParts[0].subcategory}`);
      console.log('   ✅ PASSED\n');
      passed++;
    } else {
      console.log('   ❌ FAILED - No engine parts found\n');
      failed++;
    }

    // Test 5: Text search
    console.log('📋 Test 5: Full Text Search ("brake rotor")');
    const textResults = await Part.find({ $text: { $search: 'brake rotor' } }).limit(10);
    console.log(`   Found: ${textResults.length} results`);
    if (textResults.length > 0) {
      console.log(`   Sample: ${textResults[0].partNumber} - ${textResults[0].description.slice(0, 50)}...`);
      console.log('   ✅ PASSED\n');
      passed++;
    } else {
      console.log('   ⚠️  WARNING - Text search may need index rebuild\n');
      failed++;
    }

    // Test 6: Price range filter
    console.log('📋 Test 6: Price Range Filter ($50 - $150)');
    const priceRangeParts = await Part.find({ 
      price: { $gte: 50, $lte: 150 } 
    }).limit(10);
    console.log(`   Found: ${priceRangeParts.length} parts`);
    if (priceRangeParts.length > 0) {
      console.log(`   Price range: $${priceRangeParts[0].price}`);
      console.log('   ✅ PASSED\n');
      passed++;
    } else {
      console.log('   ❌ FAILED - No parts in price range\n');
      failed++;
    }

    // Test 7: Stock status
    console.log('📋 Test 7: Stock Status Check');
    const stockCounts = await Part.aggregate([
      { $group: { _id: '$stock', count: { $sum: 1 } } }
    ]);
    console.log('   Stock distribution:');
    for (const s of stockCounts) {
      console.log(`   • ${s._id}: ${s.count.toLocaleString()}`);
    }
    if (stockCounts.length >= 2) {
      console.log('   ✅ PASSED\n');
      passed++;
    } else {
      console.log('   ❌ FAILED - Invalid stock distribution\n');
      failed++;
    }

    // Test 8: Categories validation
    console.log('📋 Test 8: Categories Validation');
    const categories = await Part.distinct('category');
    console.log(`   Found ${categories.length} categories:`);
    categories.slice(0, 5).forEach(c => console.log(`   • ${c}`));
    if (categories.length > 5) console.log(`   • ... and ${categories.length - 5} more`);
    if (categories.length >= 10) {
      console.log('   ✅ PASSED\n');
      passed++;
    } else {
      console.log('   ❌ FAILED - Expected at least 10 categories\n');
      failed++;
    }

    // Test 9: Supplier data
    console.log('📋 Test 9: Supplier Data Validation');
    const suppliers = await Part.distinct('supplier');
    console.log(`   Found ${suppliers.length} unique suppliers`);
    if (suppliers.length >= 10) {
      console.log('   ✅ PASSED\n');
      passed++;
    } else {
      console.log('   ❌ FAILED - Expected at least 10 suppliers\n');
      failed++;
    }

    // Test 10: Sample parts display
    console.log('📋 Test 10: Sample Parts Display');
    const samples = await Part.find()
      .sort({ importedAt: -1 })
      .limit(5)
      .select('partNumber brand category price stock');
    
    console.log('   Latest parts:');
    samples.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.partNumber} | ${p.brand} | ${p.category} | $${p.price} | ${p.stock}`);
    });
    console.log('   ✅ PASSED\n');
    passed++;

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`   📊 TEST RESULTS: ${passed}/${passed + failed} PASSED`);
    if (failed === 0) {
      console.log('   ✅ ALL TESTS PASSED - Parts are ready for use!');
    } else {
      console.log(`   ⚠️  ${failed} test(s) need attention`);
    }
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

runTests();
