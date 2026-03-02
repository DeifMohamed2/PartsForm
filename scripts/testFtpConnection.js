/**
 * Test FTP Connection and List Files
 * Tests the FTP connection to diagnose why syncs are finding 0 files
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Client: FTPClient } = require('basic-ftp');

async function testFTPConnection() {
  console.log('='.repeat(60));
  console.log('FTP CONNECTION TEST');
  console.log('='.repeat(60));
  
  try {
    // Connect to MongoDB
    console.log('\n1. Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
    
    // Get integration
    const Integration = require('../models/Integration');
    const integration = await Integration.findOne({ type: 'ftp' });
    
    if (!integration) {
      console.error('❌ No FTP integration found');
      process.exit(1);
    }
    
    console.log(`\n2. Found integration: ${integration.name}`);
    console.log(`   Host: ${integration.ftp.host}`);
    console.log(`   Port: ${integration.ftp.port || 21}`);
    console.log(`   Username: ${integration.ftp.username}`);
    console.log(`   Remote Path: ${integration.ftp.remotePath || '/'}`);
    console.log(`   File Pattern: ${integration.ftp.filePattern || '*.csv'}`);
    console.log(`   Secure: ${integration.ftp.secure || false}`);
    
    // Test FTP connection
    console.log('\n3. Connecting to FTP server...');
    const client = new FTPClient();
    client.ftp.verbose = true; // Show all FTP commands
    
    await client.access({
      host: integration.ftp.host,
      port: integration.ftp.port || 21,
      user: integration.ftp.username,
      password: integration.ftp.password,
      secure: integration.ftp.secure || false,
    });
    
    console.log('✅ FTP connection successful');
    
    // List files in remote path
    const remotePath = integration.ftp.remotePath || '/';
    console.log(`\n4. Listing files in: ${remotePath}`);
    
    const allFiles = await client.list(remotePath);
    console.log(`\n📂 Total items found: ${allFiles.length}`);
    
    // Show all items
    console.log('\n5. All items in directory:');
    allFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.name} (type: ${file.type}, size: ${file.size} bytes)`);
    });
    
    // Filter CSV files
    const filePattern = integration.ftp.filePattern || '*.csv';
    const pattern = new RegExp(
      '^' + filePattern
        .toLowerCase()
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
      'i'
    );
    
    console.log(`\n6. Filtering with pattern: ${filePattern}`);
    console.log(`   Regex: ${pattern}`);
    
    const csvFiles = allFiles.filter(file => {
      const isFile = file.type === 1;
      const matchesPattern = pattern.test(file.name.toLowerCase());
      if (isFile) {
        console.log(`   - ${file.name}: type=${file.type}, isFile=${isFile}, matches=${matchesPattern}`);
      }
      return isFile && matchesPattern;
    });
    
    console.log(`\n✅ Found ${csvFiles.length} matching CSV files`);
    
    if (csvFiles.length > 0) {
      console.log('\n7. Matching files:');
      csvFiles.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      });
    } else {
      console.log('\n⚠️  NO FILES MATCH THE PATTERN!');
      console.log('   Possible issues:');
      console.log('   - Wrong file pattern');
      console.log('   - Files are in a subdirectory');
      console.log('   - No CSV files on server');
      console.log('   - Files have different extensions');
    }
    
    // Close connection
    client.close();
    console.log('\n8. FTP connection closed');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n9. MongoDB connection closed');
    console.log('='.repeat(60));
    process.exit(0);
  }
}

// Run test
testFTPConnection();
