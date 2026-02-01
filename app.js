const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const i18next = require('./config/i18n');
const middleware = require('i18next-http-middleware');
const connectDB = require('./config/database');
const { initializeUploadDirectories } = require('./utils/fileUploader');

// Services
const elasticsearchService = require('./services/elasticsearchService');
const schedulerService = require('./services/schedulerService');
const socketService = require('./services/socketService');

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
  
  // Initialize scheduler for integration syncs
  try {
    await schedulerService.initialize();
  } catch (error) {
    console.error('Scheduler initialization failed:', error.message);
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// Sectors data - Automotive only
const sectors = [
  {
    id: 'automotive',
    name: 'Automotive',
  },
];

// Set app locals for global access
app.locals.sectors = sectors;

// Routes
const landingRoutes = require('./routes/landing');
const buyerRoutes = require('./routes/buyer');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

// Use routes
app.use('/', landingRoutes);
app.use('/', authRoutes); // Auth routes at root level (/login, /register, /logout)
app.use('/buyer', buyerRoutes);
app.use('/admin', adminRoutes);

// Start server with Socket.io
server.listen(PORT, () => {
  console.log(`\n🚀 PARTSFORM Server Running!\n`);
  console.log(`   ➜ Local:    http://localhost:${PORT}`);
  console.log(`   ➜ Views:    ${path.join(__dirname, 'views')}`);
  console.log(`   ➜ Socket:   Real-time chat enabled`);
});
