// Load environment variables FIRST - before anything else
require('dotenv').config({ quiet: true });

const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const i18next = require('./config/i18n');
const middleware = require('i18next-http-middleware');
const connectDB = require('./config/database');
const { initializeUploadDirectories } = require('./utils/fileUploader');

// Professional Logger
const logger = require('./utils/logger');
const {
  requestIdMiddleware,
  morganMiddleware,
  errorLoggerMiddleware,
  securityLoggerMiddleware,
  slowRequestLoggerMiddleware,
} = require('./middleware/requestLogger');
const errorTracker = require('./services/errorTrackerService');

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('FATAL: Missing required environment variables', { missingEnvVars });
  missingEnvVars.forEach(envVar => logger.error(`Missing: ${envVar}`));
  process.exit(1);
}

// Warn about optional but recommended environment variables
const recommendedEnvVars = ['GEMINI_API_KEY', 'MONGODB_URI'];
const missingRecommended = recommendedEnvVars.filter(envVar => !process.env[envVar]);
if (missingRecommended.length > 0) {
  logger.warn('Some recommended environment variables are not set', { missingRecommended });
}

// Services
const elasticsearchService = require('./services/elasticsearchService');
const schedulerService = require('./services/schedulerService');
const socketService = require('./services/socketService');
const emailInquiryScheduler = require('./services/emailInquiryScheduler');

// Redis cache service (for new search pipeline)
const { cacheService } = require('./services/search/utils/cacheService');

// Models
const Integration = require('./models/Integration');

// Connect to MongoDB
connectDB().then(async () => {
  // Cleanup stale "syncing" statuses from server restart
  try {
    const staleIntegrations = await Integration.find({ status: 'syncing' });
    if (staleIntegrations.length > 0) {
      logger.info(`Cleaning up ${staleIntegrations.length} stale syncing status(es)`);
      
      for (const integration of staleIntegrations) {
        // Only set error message if there was actual sync progress
        const hadProgress = integration.lastSync && integration.lastSync.recordsProcessed > 0;
        
        if (hadProgress) {
          // Had progress - mark as interrupted with the data
          integration.status = 'active';
          integration.lastSync.status = 'interrupted';
          integration.lastSync.error = 'Sync interrupted by server restart';
        } else {
          // No progress - just reset status, clear any stale lastSync error
          integration.status = 'active';
          if (integration.lastSync) {
            integration.lastSync.status = null;
            integration.lastSync.error = null;
          }
        }
        await integration.save();
      }
    }
  } catch (error) {
    logger.error('Failed to cleanup stale syncing statuses', { error: error.message });
  }
  
  // Initialize Elasticsearch
  try {
    await elasticsearchService.initialize();
    logger.info('Elasticsearch initialized successfully');
  } catch (error) {
    logger.error('Elasticsearch initialization failed', { error: error.message });
    logger.warn('Falling back to MongoDB for search');
  }
  
  // Initialize scheduler for integration syncs (skip in development mode)
  if (process.env.NODE_ENV === 'development') {
    logger.info('Skipping sync scheduler (NODE_ENV=development)');
  } else {
    try {
      await schedulerService.initialize();
      logger.info('Scheduler service initialized');
    } catch (error) {
      logger.error('Scheduler initialization failed', { error: error.message });
    }
  }
  
  // Initialize email inquiry scheduler for automated email processing (skip in development mode)
  if (process.env.NODE_ENV === 'development') {
    logger.info('Skipping email inquiry scheduler (NODE_ENV=development)');
  } else {
    try {
      const emailInitialized = await emailInquiryScheduler.initialize();
      if (emailInitialized) {
        emailInquiryScheduler.start();
        logger.info('Email inquiry scheduler started');
      }
    } catch (error) {
      logger.error('Email inquiry scheduler initialization failed', { error: error.message });
      logger.warn('Email inquiries will need to be manually triggered');
    }
  }
});

// Initialize upload directories
initializeUploadDirectories();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.io for real-time communication
const io = socketService.initialize(server);

// Make io available to routes/controllers
app.set('io', io);
app.set('socketService', socketService);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware (before routes)
app.use(requestIdMiddleware);
app.use(morganMiddleware);
app.use(securityLoggerMiddleware);
if (process.env.NODE_ENV !== 'production') {
  app.use(slowRequestLoggerMiddleware);
}

// i18n Middleware
app.use(middleware.handle(i18next));

// Make translation function and language info available to all views
app.use((req, res, next) => {
  res.locals.t = req.t;
  res.locals.i18n = req.i18n;
  res.locals.currentLang = req.language || 'en';
  res.locals.isRTL = req.language === 'ar';
  res.locals.dir = req.language === 'ar' ? 'rtl' : 'ltr';
  next();
});

// Routes
const landingRoutes = require('./routes/landing');
const buyerRoutes = require('./routes/buyer');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const partnerRoutes = require('./routes/partner');
const supplierRoutes = require('./routes/supplier');
const supplierViewRoutes = require('./routes/supplierViews');

// Use routes
app.use('/', landingRoutes);
app.use('/', authRoutes); // Auth routes at root level (/login, /register, /logout)
app.use('/buyer', buyerRoutes);
app.use('/admin', adminRoutes);
app.use('/partner', partnerRoutes);
app.use('/api/supplier', supplierRoutes); // Supplier API routes
app.use('/supplier', supplierViewRoutes); // Supplier portal views

// 404 Handler - Catch all unmatched routes
app.use((req, res, next) => {
  logger.warn('404 Not Found', {
    requestId: req.requestId,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });
  
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(404).json({
      success: false,
      message: 'Page not found',
      requestId: req.requestId,
    });
  }
  
  res.status(404).render('error', {
    title: '404 - Page Not Found',
    error: 'Page Not Found',
    requestId: req.requestId,
    user: req.user || null,
    userRole: req.user?.role || null,
  });
});

// Error logging middleware (after routes)
app.use(errorLoggerMiddleware);

// Global error handler
app.use((err, req, res, next) => {
  // Track error
  errorTracker.trackError(err, {
    requestId: req.requestId,
    userId: req.user?.id || req.admin?.id,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  // Log error
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
  });
  
  // Send error response
  const statusCode = err.status || err.statusCode || 500;
  
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(statusCode).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
      requestId: req.requestId,
    });
  }
  
  res.status(statusCode).render('error', {
    title: 'Error',
    error: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
    requestId: req.requestId,
    user: req.user || null,
    userRole: req.user?.role || null,
  });
});

// Start server with Socket.io
server.listen(PORT, () => {
  logger.info('PARTSFORM Server Started', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    pid: process.pid,
  });
  
  console.log(`\n🚀 PARTSFORM Server Running!\n`);
  console.log(`   ➜ Local:    http://localhost:${PORT}`);
  console.log(`   ➜ Logs:     ${path.join(__dirname, 'logs')}`);
  console.log(`   ➜ Socket:   Real-time chat enabled`);
  
  // AI Status
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here') {
    console.log(`   ➜ AI:       ✅ Gemini AI is RUNNING`);
    logger.info('Gemini AI enabled');
  } else {
    console.log(`   ➜ AI:       ❌ Gemini AI is NOT running (GEMINI_API_KEY not set)`);
    logger.warn('Gemini AI not configured');
  }
  
  // Email Inquiry Status - check config instead of isRunning (which is set async)
  const emailConfigured = !!(
    process.env.EMAIL_IMAP_USER &&
    process.env.EMAIL_IMAP_PASSWORD &&
    process.env.EMAIL_SMTP_USER &&
    process.env.EMAIL_PROCESSING_ENABLED !== 'false'
  );
  
  if (emailConfigured) {
    console.log(`   ➜ Email:    ✅ Email inquiry processor configured`);
    logger.info('Email inquiry processor configured');
  } else {
    console.log(`   ➜ Email:    ⚠️  Email inquiry processor not configured`);
  }
  
  // Redis Status - try to connect then display status
  cacheService.checkConnection().then(() => {
    const status = cacheService.getStatus();
    console.log(`   ➜ Redis:    ${status.message}`);
    logger.info('Cache service status', { status: status.message });
  }).catch(() => {
    console.log(`   ➜ Redis:    ⚠️  Redis connection failed (L1 cache only)`);
    logger.warn('Redis connection failed, using L1 cache only');
  });
  
  // FTP Server Status
  if (process.env.ENABLE_FTP_SERVER === 'true') {
    const supplierFtpService = require('./services/supplierFtpService');
    supplierFtpService.start().then(() => {
      const ftpPort = process.env.FTP_PORT || 2121;
      console.log(`   ➜ FTP:      ✅ Supplier FTP server on port ${ftpPort}`);
      logger.info('Supplier FTP server started', { port: ftpPort });
    }).catch(err => {
      console.log(`   ➜ FTP:      ❌ FTP server failed to start: ${err.message}`);
      logger.error('FTP server failed to start', { error: err.message });
    });
  } else {
    console.log(`   ➜ FTP:      ⚠️  FTP server disabled (ENABLE_FTP_SERVER not set)`);
  }
  
  console.log(`   ➜ Logger:   ✅ Winston logger active`);
  console.log('');
});
