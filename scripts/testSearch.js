/**
 * Quick Search Test Script
 * Test the search functionality directly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Part = require('../models/Part');
const connectDB = require('../config/database');

async function testSearch() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   🔍 SEARCH FUNCTIONALITY TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    await connectDB();

    // Test 1: Exact match for SRK84331X
    console.log('📋 Test 1: Exact match for SRK84331X');
    const exactMatch = await Part.findOne({ partNumber: 'SRK84331X' });
    if (exactMatch) {
      console.log('   ✅ FOUND:', exactMatch.partNumber);
      console.log('   Description:', exactMatch.description);
      console.log('   Brand:', exactMatch.brand);
      console.log('   Price:', exactMatch.price);
    } else {
      console.log('   ❌ NOT FOUND');
    }

    // Test 2: Using searchParts method
    console.log('\n📋 Test 2: Using searchParts() method');
    const searchResult = await Part.searchParts('SRK84331X', { limit: 10 });
    console.log('   Results count:', searchResult.results.length);
    if (searchResult.results.length > 0) {
      console.log('   ✅ First result:', searchResult.results[0].partNumber);
    } else {
      console.log('   ❌ No results from searchParts');
    }

    // Test 3: Regex search for SRK prefix
    console.log('\n📋 Test 3: Regex search for SRK* prefix');
    const regexResults = await Part.find({ 
      partNumber: { $regex: 'SRK', $options: 'i' } 
    }).limit(5);
    console.log('   Results:', regexResults.length);
    regexResults.forEach(p => console.log('   •', p.partNumber, '-', p.brand));

    // Test 4: Search "Moog" brand
    console.log('\n📋 Test 4: Search for "Moog" brand parts');
    const moogParts = await Part.searchParts('Moog', { limit: 5 });
    console.log('   Results:', moogParts.results.length);
    moogParts.results.forEach(p => console.log('   •', p.partNumber, '-', p.description.slice(0, 40)));

    // Test 5: Search "Steering Rack"
    console.log('\n📋 Test 5: Search for "Steering Rack"');
    const steeringParts = await Part.searchParts('Steering Rack', { limit: 5 });
    console.log('   Results:', steeringParts.results.length);
    steeringParts.results.forEach(p => console.log('   •', p.partNumber, '-', p.description.slice(0, 40)));

    // Test 6: General "brake" search
    console.log('\n📋 Test 6: Search for "brake"');
    const brakeParts = await Part.searchParts('brake', { limit: 5 });
    console.log('   Results:', brakeParts.results.length);
    brakeParts.results.forEach(p => console.log('   •', p.partNumber, '-', p.brand));

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   ✅ SEARCH TESTS COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

testSearch();
