const mongoose = require('mongoose');

// MongoDB connection configuration - optimized for bulk operations
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';
    
    // Log which database we're connecting to (hide credentials)
    const sanitizedUri = mongoURI.replace(/:\/\/[^:]+:[^@]+@/, '://****:****@');
    console.log(`📦 Connecting to MongoDB: ${sanitizedUri}`);
    
    const conn = await mongoose.connect(mongoURI, {
      // Performance optimizations for bulk operations
      maxPoolSize: 100, // More connections for parallel operations
      minPoolSize: 10,
      socketTimeoutMS: 120000, // 2 min timeout for large bulk ops
      serverSelectionTimeoutMS: 30000,
      writeConcern: {
        w: 1, // Fast writes (acknowledge from primary only)
        j: false // Don't wait for journal
      }
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
