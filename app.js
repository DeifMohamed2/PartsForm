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

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('   Please check your .env file');
  process.exit(1);
}

// Warn about optional but recommended environment variables
const recommendedEnvVars = ['GEMINI_API_KEY', 'MONGODB_URI'];
const missingRecommended = recommendedEnvVars.filter(envVar => !process.env[envVar]);
if (missingRecommended.length > 0) {
  console.warn('⚠️  Warning: Some recommended environment variables are not set:');
  missingRecommended.forEach(envVar => console.warn(`   - ${envVar} (using default)`));
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
      console.log(`🧹 Cleaning up ${staleIntegrations.length} stale syncing status(es) from previous server session...`);
      
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
    console.error('Failed to cleanup stale syncing statuses:', error.message);
  }
  
  // Initialize Elasticsearch
  try {
    await elasticsearchService.initialize();
  } catch (error) {
    console.error('Elasticsearch initialization failed:', error.message);
    console.log('⚠️  Falling back to MongoDB for search');
  }
  
  // Initialize scheduler for integration syncs (skip in development mode)
  if (process.env.NODE_ENV === 'development') {
    console.log('⏸️  Skipping sync scheduler (NODE_ENV=development)');
  } else {
    try {
      await schedulerService.initialize();
    } catch (error) {
      console.error('Scheduler initialization failed:', error.message);
    }
  }
  
  // Initialize email inquiry scheduler for automated email processing (skip in development mode)
  if (process.env.NODE_ENV === 'development') {
    console.log('⏸️  Skipping email inquiry scheduler (NODE_ENV=development)');
  } else {
    try {
      const emailInitialized = await emailInquiryScheduler.initialize();
      if (emailInitialized) {
        emailInquiryScheduler.start();
      }
    } catch (error) {
      console.error('Email inquiry scheduler initialization failed:', error.message);
      console.log('⚠️  Email inquiries will need to be manually triggered');
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

// Use routes
app.use('/', landingRoutes);
app.use('/', authRoutes); // Auth routes at root level (/login, /register, /logout)
app.use('/buyer', buyerRoutes);
app.use('/admin', adminRoutes);
app.use('/partner', partnerRoutes);

// Start server with Socket.io
server.listen(PORT, () => {
  console.log(`\n🚀 PARTSFORM Server Running!\n`);
  console.log(`   ➜ Local:    http://localhost:${PORT}`);
  console.log(`   ➜ Views:    ${path.join(__dirname, 'views')}`);
  console.log(`   ➜ Socket:   Real-time chat enabled`);
  
  // AI Status
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here') {
    console.log(`   ➜ AI:       ✅ Gemini AI is RUNNING`);
  } else {
    console.log(`   ➜ AI:       ❌ Gemini AI is NOT running (GEMINI_API_KEY not set)`);
  }
  
  // Email Inquiry Status - check config instead of isRunning (which is set async)
  const emailConfigured = !!(
    process.env.EMAIL_IMAP_USER &&
    process.env.EMAIL_IMAP_PASSWORD &&
    process.env.EMAIL_SMTP_USER &&
    process.env.EMAIL_PROCESSING_ENABLED !== 'false'
  );
  
  if (emailConfigured) {
    console.log(`   ➜ Email:    ✅ Email inquiry processor configured (starting...)`);
  } else {
    console.log(`   ➜ Email:    ⚠️  Email inquiry processor not configured`);
  }
  
  // Redis Status - try to connect then display status
  cacheService.checkConnection().then(() => {
    const status = cacheService.getStatus();
    console.log(`   ➜ Redis:    ${status.message}`);
  }).catch(() => {
    console.log(`   ➜ Redis:    ⚠️  Redis connection failed (L1 cache only)`);
  });
  console.log('');
});
