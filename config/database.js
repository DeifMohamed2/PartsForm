const mongoose = require('mongoose');
const logger = require('../utils/logger');

// OOM Prevention utilities
const { circuitBreakers, logThrottle } = require('../utils/oomPrevention');

// MongoDB connection configuration - optimized for bulk operations
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';
    
    logger.info('Connecting to MongoDB', { service: 'partsform', event: 'DATABASE_CONNECTING' });
    
    const conn = await mongoose.connect(mongoURI, {
      // Connection pool - balanced for 18-core server
      maxPoolSize: 50, // Reasonable pool size (was 200 - too aggressive)
      minPoolSize: 5,
      socketTimeoutMS: 120000, // 2 min timeout (was 10 min - zombie connections)
      serverSelectionTimeoutMS: 10000, // 10s server selection
      connectTimeoutMS: 10000, // 10s connect timeout
      writeConcern: {
        w: 1, // Fast writes (acknowledge from primary only)
        j: false // Don't wait for journal
      }
    });

    logger.info('System: DATABASE_CONNECTED', { service: 'partsform', event: 'DATABASE_CONNECTED' });
    logger.info('Database connected successfully', { service: 'partsform', host: conn.connection.host });
    
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
      logger.info('Database reconnected', { service: 'partsform', event: 'DATABASE_RECONNECTED' });
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('Database connection closed', { service: 'partsform', event: 'DATABASE_CLOSED' });
      process.exit(0);
    });

    return conn;
  } catch (error) {
    logger.error('Database connection failed', { service: 'partsform', event: 'DATABASE_ERROR', error: error.message });
    process.exit(1);
  }
};

module.exports = connectDB;
