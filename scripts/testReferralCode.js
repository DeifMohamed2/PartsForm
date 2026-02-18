/**
 * Test Script for Referral Code Validation
 * Run: node scripts/testReferralCode.js [codeToTest]
 * 
 * Tests the referral code validation logic including the hasReachedLimit fix
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ReferralCode = require('../models/ReferralCode');
const ReferralPartner = require('../models/ReferralPartner');

async function testReferralCode(codeToTest) {
  try {
    // Connect to MongoDB
    const dbUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';
    await mongoose.connect(dbUrl);
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Check hasReachedLimit with maxUses = 0
    console.log('=== Test 1: hasReachedLimit with maxUses = 0 ===');
    const testCode1 = new ReferralCode({
      code: 'TEST-UNLIMITED-0',
      maxUses: 0,
      stats: { totalUses: 0 }
    });
    const result1 = testCode1.hasReachedLimit();
    console.log(`maxUses: 0, totalUses: 0 => hasReachedLimit: ${result1}`);
    console.log(`Expected: false (0 means unlimited), Got: ${result1}`);
    console.log(result1 === false ? '✅ PASS' : '❌ FAIL');
    console.log('');

    // Test 2: Check hasReachedLimit with maxUses = null
    console.log('=== Test 2: hasReachedLimit with maxUses = null ===');
    const testCode2 = new ReferralCode({
      code: 'TEST-UNLIMITED-NULL',
      maxUses: null,
      stats: { totalUses: 10 }
    });
    const result2 = testCode2.hasReachedLimit();
    console.log(`maxUses: null, totalUses: 10 => hasReachedLimit: ${result2}`);
    console.log(`Expected: false (null means unlimited), Got: ${result2}`);
    console.log(result2 === false ? '✅ PASS' : '❌ FAIL');
    console.log('');

    // Test 3: Check hasReachedLimit with actual limit
    console.log('=== Test 3: hasReachedLimit with actual limit ===');
    const testCode3 = new ReferralCode({
      code: 'TEST-LIMITED',
      maxUses: 5,
      stats: { totalUses: 5 }
    });
    const result3 = testCode3.hasReachedLimit();
    console.log(`maxUses: 5, totalUses: 5 => hasReachedLimit: ${result3}`);
    console.log(`Expected: true (limit reached), Got: ${result3}`);
    console.log(result3 === true ? '✅ PASS' : '❌ FAIL');
    console.log('');

    // Test 4: Test actual code from database
    if (codeToTest) {
      console.log(`=== Test 4: Validate code "${codeToTest}" from database ===`);
      const dbCode = await ReferralCode.findOne({ code: codeToTest.toUpperCase() })
        .populate('referralPartner', 'firstName lastName email status');
      
      if (dbCode) {
        console.log('Code found in database:');
        console.log(`  - Code: ${dbCode.code}`);
        console.log(`  - Name: ${dbCode.name}`);
        console.log(`  - Status: ${dbCode.status}`);
        console.log(`  - maxUses: ${dbCode.maxUses}`);
        console.log(`  - totalUses: ${dbCode.stats?.totalUses || 0}`);
        console.log(`  - validFrom: ${dbCode.validFrom}`);
        console.log(`  - validUntil: ${dbCode.validUntil}`);
        console.log(`  - Partner: ${dbCode.referralPartner?.firstName} ${dbCode.referralPartner?.lastName}`);
        console.log(`  - Partner Status: ${dbCode.referralPartner?.status}`);
        console.log('');
        console.log('Validation checks:');
        console.log(`  - isValid(): ${dbCode.isValid()}`);
        console.log(`  - hasReachedLimit(): ${dbCode.hasReachedLimit()}`);
        
        // Test findValidCode
        const validCode = await ReferralCode.findValidCode(codeToTest);
        console.log(`  - findValidCode(): ${validCode ? 'FOUND' : 'NOT FOUND'}`);
        
        if (validCode) {
          console.log('');
          console.log('✅ Code is VALID and ready to use!');
        } else {
          console.log('');
          console.log('❌ Code validation FAILED. Check the above issues.');
        }
      } else {
        console.log(`❌ Code "${codeToTest}" not found in database`);
      }
    }

    console.log('\n=== Test Summary ===');
    console.log('All core tests passed if you see ✅ PASS above.');
    console.log('The fix makes maxUses = 0 behave as "unlimited" (same as null).');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Get code from command line argument or default
const codeArg = process.argv[2] || 'DEIMOH-52LEWU';
console.log('🔍 Testing Referral Code System\n');
console.log(`Testing with code: ${codeArg}\n`);
testReferralCode(codeArg);
