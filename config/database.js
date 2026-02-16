const mongoose = require('mongoose');

// OOM Prevention utilities
const { circuitBreakers, logThrottle } = require('../utils/oomPrevention');

// MongoDB connection configuration - optimized for bulk operations
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';
    
    // Log which database we're connecting to (hide credentials)
    const sanitizedUri = mongoURI.replace(/:\/\/[^:]+:[^@]+@/, '://****:****@');
    console.log(`📦 Connecting to MongoDB: ${sanitizedUri}`);
    
    const conn = await mongoose.connect(mongoURI, {
      // Performance optimizations for 96GB/18-core/NVMe server
      maxPoolSize: 200, // 200 connections for 18 cores
      minPoolSize: 20,
      socketTimeoutMS: 600000, // 10 min timeout for massive delete operations
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      writeConcern: {
        w: 1, // Fast writes (acknowledge from primary only)
        j: false // Don't wait for journal
      }
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Update circuit breaker on successful connection
    circuitBreakers.mongodb.recordSuccess();
    
    // Handle connection events with log throttling
    mongoose.connection.on('error', (err) => {
      circuitBreakers.mongodb.recordFailure(err);
      logThrottle.error('mongo-conn-error', `❌ MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      circuitBreakers.mongodb.recordFailure(new Error('disconnected'));
      logThrottle.log('mongo-disconnected', '⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      circuitBreakers.mongodb.recordSuccess();
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
