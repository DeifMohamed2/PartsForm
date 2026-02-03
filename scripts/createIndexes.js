/**
 * Create MongoDB indexes for faster dashboard queries
 * Run: node scripts/createIndexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';

async function createIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Orders collection indexes
    console.log('\nCreating indexes on orders collection...');
    await db.collection('orders').createIndex({ createdAt: -1 });
    await db.collection('orders').createIndex({ status: 1 });
    await db.collection('orders').createIndex({ buyer: 1 });
    await db.collection('orders').createIndex({ 'pricing.total': 1 });
    await db.collection('orders').createIndex({ status: 1, createdAt: -1 });
    console.log('✓ Orders indexes created');

    // Tickets collection indexes
    console.log('\nCreating indexes on tickets collection...');
    await db.collection('tickets').createIndex({ createdAt: -1 });
    await db.collection('tickets').createIndex({ status: 1 });
    await db.collection('tickets').createIndex({ priority: 1 });
    console.log('✓ Tickets indexes created');

    // Buyers collection indexes
    console.log('\nCreating indexes on buyers collection...');
    try {
      await db.collection('buyers').createIndex({ email: 1 }, { unique: true, sparse: true });
    } catch (e) { console.log('  email index already exists'); }
    try {
      await db.collection('buyers').createIndex({ companyName: 1 });
    } catch (e) { console.log('  companyName index already exists'); }
    console.log('✓ Buyers indexes created');

    // Parts collection indexes
    console.log('\nCreating indexes on parts collection...');
    await db.collection('parts').createIndex({ partNumber: 1 });
    await db.collection('parts').createIndex({ stock: 1 });
    await db.collection('parts').createIndex({ category: 1 });
    await db.collection('parts').createIndex({ brand: 1 });
    console.log('✓ Parts indexes created');

    console.log('\n✅ All indexes created successfully!');
    
    // List all indexes
    console.log('\n--- Current Indexes ---');
    const collections = ['orders', 'tickets', 'buyers', 'parts'];
    for (const coll of collections) {
      try {
        const indexes = await db.collection(coll).indexes();
        console.log(`\n${coll}:`, indexes.map(i => i.name).join(', '));
      } catch (e) {
        console.log(`${coll}: Collection may not exist yet`);
      }
    }

  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

createIndexes();
