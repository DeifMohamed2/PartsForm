/**
 * Cleanup Stale Sync Data
 * Removes error messages from integrations that have no actual sync data
 */
const mongoose = require('mongoose');
const Integration = require('../models/Integration');

async function cleanup() {
  try {
    await mongoose.connect('mongodb://localhost:27017/partsform');
    console.log('Connected to MongoDB');

    // Clear stale lastSync error when no actual sync data exists
    const result = await Integration.updateMany(
      { 
        'lastSync.error': { $exists: true },
        $or: [
          { 'lastSync.recordsProcessed': { $in: [null, 0] } },
          { 'lastSync.recordsProcessed': { $exists: false } }
        ]
      },
      { 
        $unset: { 
          'lastSync.error': '',
          'lastSync.status': ''
        }
      }
    );
    console.log('Cleaned up', result.modifiedCount, 'integrations with stale error messages');
    
    // Also reset any stuck syncing status
    const result2 = await Integration.updateMany(
      { status: 'syncing' },
      { status: 'active' }
    );
    console.log('Reset', result2.modifiedCount, 'stuck syncing statuses');
    
    console.log('Cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

cleanup();
