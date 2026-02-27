/**
 * Comprehensive Test Script for Supplier Parts System
 * Tests all supplier parts functionality:
 * - Authentication
 * - Dashboard stats
 * - Parts CRUD
 * - Import/Export
 * - Bulk operations
 * - File management
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Part = require('../models/Part');
const Supplier = require('../models/Supplier');
const supplierPartsService = require('../services/supplierPartsService');
const bcrypt = require('bcrypt');

// Test configuration
const TEST_SUPPLIER = {
  companyName: 'Test Supplier Parts Co',
  companyCode: 'TSP-TEST-001',
  email: 'test-parts@example.com',
  password: 'TestPassword123!',
  contactName: 'Test User'
};

// Sample parts data
const SAMPLE_PARTS_CSV = `Part Number,Description,Brand,Price,Quantity
TST-001,Test Brake Pad Front,BREMBO,125.50,100
TST-002,Test Air Filter,K&N,45.00,50
TST-003,Test Oil Filter,MANN,22.00,200
TST-004,Test Spark Plug,NGK,15.00,500
TST-005,Test Radiator Hose,Gates,35.00,75`;

// Test results tracking
let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

function logResult(testName, passed, details = '') {
  if (passed) {
    testsPassed++;
    console.log(`  ✅ ${testName}`);
  } else {
    testsFailed++;
    console.log(`  ❌ ${testName}: ${details}`);
  }
  testResults.push({ testName, passed, details });
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('   SUPPLIER PARTS SYSTEM - COMPREHENSIVE TEST SUITE');
  console.log('='.repeat(60) + '\n');

  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform');
    console.log('   Connected to MongoDB\n');

    // Cleanup old test data
    console.log('🧹 Cleaning up old test data...');
    await Part.deleteMany({ 'source.supplierCode': TEST_SUPPLIER.companyCode });
    await Supplier.deleteOne({ email: TEST_SUPPLIER.email });
    console.log('   Cleanup complete\n');

    // ==================== TEST SECTION 1: Supplier Setup ====================
    console.log('📋 TEST SECTION 1: Supplier Setup');
    console.log('-'.repeat(40));

    // Create test supplier
    let testSupplier;
    try {
      const hashedPassword = await bcrypt.hash(TEST_SUPPLIER.password, 10);
      testSupplier = await Supplier.create({
        ...TEST_SUPPLIER,
        password: hashedPassword,
        status: 'active',
        isFirstLogin: false,
        permissions: ['read_data', 'write_data', 'delete_data', 'import_data', 'export_data']
      });
      logResult('Create test supplier', true);
    } catch (err) {
      logResult('Create test supplier', false, err.message);
      throw err;
    }

    // ==================== TEST SECTION 2: Parts Import ====================
    console.log('\n📋 TEST SECTION 2: Parts Import');
    console.log('-'.repeat(40));

    // Test file parsing
    try {
      const fileBuffer = Buffer.from(SAMPLE_PARTS_CSV);
      const parsed = await supplierPartsService.parseFile(fileBuffer, 'test.csv');
      logResult('Parse CSV file', 
        parsed.headers.length === 5 && parsed.rows.length === 5,
        `Headers: ${parsed.headers.length}, Rows: ${parsed.rows.length}`
      );
    } catch (err) {
      logResult('Parse CSV file', false, err.message);
    }

    // Test column mapping
    try {
      const testRow = {
        'Part Number': 'TEST-MAP',
        'Description': 'Test Mapping',
        'Brand': 'TestBrand',
        'Price': '99.99',
        'Quantity': '50'
      };
      const mapped = supplierPartsService.mapToPart(testRow);
      logResult('Column auto-mapping', 
        mapped.partNumber === 'TEST-MAP' && mapped.price === 99.99,
        JSON.stringify(mapped)
      );
    } catch (err) {
      logResult('Column auto-mapping', false, err.message);
    }

    // Test full import
    let importResult;
    try {
      const fileBuffer = Buffer.from(SAMPLE_PARTS_CSV);
      importResult = await supplierPartsService.importFromFile(
        testSupplier,
        fileBuffer,
        'test-import.csv',
        { replaceExisting: false }
      );
      logResult('Import parts from file', 
        importResult.imported === 5,
        `Imported: ${importResult.imported}, Errors: ${importResult.errors?.length || 0}`
      );
    } catch (err) {
      logResult('Import parts from file', false, err.message);
    }

    // ==================== TEST SECTION 3: Parts Retrieval ====================
    console.log('\n📋 TEST SECTION 3: Parts Retrieval');
    console.log('-'.repeat(40));

    // Test get supplier stats
    try {
      const stats = await supplierPartsService.getStats(testSupplier._id);
      logResult('Get supplier stats',
        stats.totalParts === 5 && stats.uniqueBrands === 4,
        `Parts: ${stats.totalParts}, Brands: ${stats.uniqueBrands}`
      );
    } catch (err) {
      logResult('Get supplier stats', false, err.message);
    }

    // Test get parts with pagination
    try {
      const partsResult = await supplierPartsService.getParts(testSupplier._id, {
        page: 1,
        limit: 10,
        sortBy: 'partNumber',
        sortOrder: 'asc'
      });
      logResult('Get parts with pagination',
        partsResult.results.length === 5 && partsResult.total === 5,
        `Results: ${partsResult.results.length}, Total: ${partsResult.total}`
      );
    } catch (err) {
      logResult('Get parts with pagination', false, err.message);
    }

    // Test search functionality
    try {
      const searchResult = await supplierPartsService.getParts(testSupplier._id, {
        search: 'Brake',
        page: 1,
        limit: 10
      });
      logResult('Search parts by keyword',
        searchResult.results.length === 1 && searchResult.results[0].partNumber === 'TST-001',
        `Found: ${searchResult.results.length}`
      );
    } catch (err) {
      logResult('Search parts by keyword', false, err.message);
    }

    // Test get single part
    let singlePart;
    try {
      const partsResult = await supplierPartsService.getParts(testSupplier._id, {});
      const partId = partsResult.results[0]._id;
      singlePart = await supplierPartsService.getPart(testSupplier._id, partId);
      logResult('Get single part by ID',
        singlePart.partNumber === 'TST-001',
        `Part: ${singlePart.partNumber}`
      );
    } catch (err) {
      logResult('Get single part by ID', false, err.message);
    }

    // ==================== TEST SECTION 4: Parts Update ====================
    console.log('\n📋 TEST SECTION 4: Parts Update');
    console.log('-'.repeat(40));

    // Test update single part
    try {
      const partsResult = await supplierPartsService.getParts(testSupplier._id, {});
      const partToUpdate = partsResult.results[0];
      
      const updated = await supplierPartsService.updatePart(testSupplier, partToUpdate._id, {
        price: 150.00,
        quantity: 200
      });
      logResult('Update single part',
        updated.price === 150 && updated.quantity === 200,
        `New price: ${updated.price}, New qty: ${updated.quantity}`
      );
    } catch (err) {
      logResult('Update single part', false, err.message);
    }

    // Test bulk update
    try {
      const partsResult = await supplierPartsService.getParts(testSupplier._id, {});
      const partIds = partsResult.results.slice(0, 2).map(p => p._id);
      
      const bulkResult = await supplierPartsService.bulkUpdateParts(testSupplier, partIds, {
        price: 100
      });
      logResult('Bulk update parts',
        bulkResult.updated === 2,
        `Updated: ${bulkResult.updated}`
      );
    } catch (err) {
      logResult('Bulk update parts', false, err.message);
    }

    // ==================== TEST SECTION 5: Import Files ====================
    console.log('\n📋 TEST SECTION 5: Import Files Management');
    console.log('-'.repeat(40));

    // Test get import files
    try {
      const files = await supplierPartsService.getImportFiles(testSupplier._id);
      logResult('Get import files list',
        files.length === 1 && files[0].fileName === 'test-import.csv',
        `Files: ${files.length}, Name: ${files[0]?.fileName}`
      );
    } catch (err) {
      logResult('Get import files list', false, err.message);
    }

    // ==================== TEST SECTION 6: Export ====================
    console.log('\n📋 TEST SECTION 6: Export');
    console.log('-'.repeat(40));

    // Test export to Excel
    try {
      const exportResult = await supplierPartsService.exportToExcel(testSupplier._id, {});
      logResult('Export parts to Excel',
        exportResult.buffer && exportResult.count === 5,
        `Exported: ${exportResult.count} parts, Buffer size: ${exportResult.buffer.length} bytes`
      );
    } catch (err) {
      logResult('Export parts to Excel', false, err.message);
    }

    // ==================== TEST SECTION 7: Delete Operations ====================
    console.log('\n📋 TEST SECTION 7: Delete Operations');
    console.log('-'.repeat(40));

    // Test delete single part
    try {
      const partsResult = await supplierPartsService.getParts(testSupplier._id, {});
      const partToDelete = partsResult.results[4]; // Delete last part
      
      const deleteResult = await supplierPartsService.deleteParts(testSupplier, {
        partIds: [partToDelete._id]
      });
      logResult('Delete single part',
        deleteResult.deleted === 1,
        `Deleted: ${deleteResult.deleted}`
      );
    } catch (err) {
      logResult('Delete single part', false, err.message);
    }

    // Verify deletion
    try {
      const partsResult = await supplierPartsService.getParts(testSupplier._id, {});
      logResult('Verify part count after deletion',
        partsResult.total === 4,
        `Remaining: ${partsResult.total}`
      );
    } catch (err) {
      logResult('Verify part count after deletion', false, err.message);
    }

    // ==================== TEST SECTION 8: Part Model Methods ====================
    console.log('\n📋 TEST SECTION 8: Part Model Static Methods');
    console.log('-'.repeat(40));

    // Test getSupplierParts static method
    try {
      const partsResult = await Part.getSupplierParts(testSupplier._id, {
        filters: { inStock: true }
      });
      logResult('Part.getSupplierParts with inStock filter',
        partsResult.results.every(p => p.quantity > 0),
        `All in stock: ${partsResult.results.length}`
      );
    } catch (err) {
      logResult('Part.getSupplierParts with inStock filter', false, err.message);
    }

    // Test getSupplierStats static method
    try {
      const stats = await Part.getSupplierStats(testSupplier._id);
      logResult('Part.getSupplierStats static method',
        typeof stats.totalParts === 'number' && typeof stats.avgPrice === 'number',
        `Total: ${stats.totalParts}, Avg Price: ${stats.avgPrice}`
      );
    } catch (err) {
      logResult('Part.getSupplierStats static method', false, err.message);
    }

    // ==================== TEST SECTION 9: Replace Import ====================
    console.log('\n📋 TEST SECTION 9: Replace Existing Import');
    console.log('-'.repeat(40));

    // Test replace existing file
    try {
      const newCSV = `Part Number,Description,Brand,Price,Quantity
NEW-001,New Part 1,NewBrand,199.99,50
NEW-002,New Part 2,NewBrand,299.99,75`;

      const fileBuffer = Buffer.from(newCSV);
      const replaceResult = await supplierPartsService.importFromFile(
        testSupplier,
        fileBuffer,
        'test-import.csv', // Same filename
        { replaceExisting: true }
      );
      logResult('Replace existing import file',
        replaceResult.imported === 2,
        `Imported: ${replaceResult.imported}`
      );
    } catch (err) {
      logResult('Replace existing import file', false, err.message);
    }

    // Verify replacement
    try {
      const partsResult = await supplierPartsService.getParts(testSupplier._id, {});
      const hasNewParts = partsResult.results.some(p => p.partNumber === 'NEW-001');
      const hasOldParts = partsResult.results.some(p => p.partNumber === 'TST-001');
      logResult('Verify replacement removed old parts',
        hasNewParts && !hasOldParts,
        `New parts: ${hasNewParts}, Old parts remain: ${hasOldParts}`
      );
    } catch (err) {
      logResult('Verify replacement removed old parts', false, err.message);
    }

    // ==================== CLEANUP ====================
    console.log('\n🧹 Cleanup...');
    await Part.deleteMany({ 'source.supplierCode': TEST_SUPPLIER.companyCode });
    await Supplier.deleteOne({ email: TEST_SUPPLIER.email });
    console.log('   Test data cleaned up');

  } catch (error) {
    console.error('\n💥 CRITICAL ERROR:', error.message);
  } finally {
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('   TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`   ✅ Passed: ${testsPassed}`);
    console.log(`   ❌ Failed: ${testsFailed}`);
    console.log(`   📊 Total:  ${testsPassed + testsFailed}`);
    console.log('='.repeat(60) + '\n');

    // Exit
    await mongoose.disconnect();
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

// Run tests
runTests().catch(console.error);
