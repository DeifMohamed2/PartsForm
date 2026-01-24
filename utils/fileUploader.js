// ====================================
// FILE UPLOADER UTILITY
// Professional file upload handling with multer
// ====================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ====================================
// CONFIGURATION
// ====================================

const UPLOAD_CONFIG = {
  // Base upload directory (relative to project root)
  baseDir: 'public/uploads',
  
  // Subdirectories for different file types
  directories: {
    profileImages: 'profile-images',
    documents: 'documents',
    temp: 'temp',
  },
  
  // File size limits (in bytes)
  limits: {
    profileImage: 5 * 1024 * 1024, // 5MB
    document: 10 * 1024 * 1024, // 10MB
  },
  
  // Allowed file types
  allowedTypes: {
    profileImage: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  
  // File extensions mapping
  extensions: {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  },
};

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Ensure directory exists, create if not
 */
const ensureDirectoryExists = (dirPath) => {
  const fullPath = path.join(process.cwd(), dirPath);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
  }
  return fullPath;
};

/**
 * Generate unique filename
 */
const generateUniqueFilename = (userId, originalName, mimeType) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = UPLOAD_CONFIG.extensions[mimeType] || path.extname(originalName);
  return `${userId}_${timestamp}_${randomString}${extension}`;
};

/**
 * Get public URL from file path
 */
const getPublicUrl = (filePath) => {
  // Convert file path to URL path (remove 'public' prefix)
  const relativePath = filePath.replace(/\\/g, '/');
  if (relativePath.startsWith('public/')) {
    return '/' + relativePath.substring(7);
  }
  return '/' + relativePath;
};

/**
 * Delete file safely
 */
const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(process.cwd(), 'public', filePath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlink(fullPath, (err) => {
        if (err) {
          console.error('Error deleting file:', err);
          reject(err);
        } else {
          console.log(`Deleted file: ${fullPath}`);
          resolve(true);
        }
      });
    } else {
      resolve(false); // File doesn't exist
    }
  });
};

/**
 * Validate file type
 */
const validateFileType = (mimeType, allowedTypes) => {
  return allowedTypes.includes(mimeType);
};

// ====================================
// MULTER STORAGE CONFIGURATIONS
// ====================================

/**
 * Create disk storage for profile images
 */
const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(UPLOAD_CONFIG.baseDir, UPLOAD_CONFIG.directories.profileImages);
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const userId = req.user?._id?.toString() || 'anonymous';
    const filename = generateUniqueFilename(userId, file.originalname, file.mimetype);
    cb(null, filename);
  },
});

/**
 * File filter for profile images
 */
const profileImageFilter = (req, file, cb) => {
  if (validateFileType(file.mimetype, UPLOAD_CONFIG.allowedTypes.profileImage)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${UPLOAD_CONFIG.allowedTypes.profileImage.join(', ')}`), false);
  }
};

// ====================================
// MULTER UPLOAD INSTANCES
// ====================================

/**
 * Profile image uploader
 */
const uploadProfileImage = multer({
  storage: profileImageStorage,
  limits: {
    fileSize: UPLOAD_CONFIG.limits.profileImage,
  },
  fileFilter: profileImageFilter,
}).single('avatar');

// ====================================
// MIDDLEWARE WRAPPERS
// ====================================

/**
 * Handle profile image upload with error handling
 */
const handleProfileImageUpload = (req, res, next) => {
  uploadProfileImage(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File too large. Maximum size is ${UPLOAD_CONFIG.limits.profileImage / (1024 * 1024)}MB`,
            error: 'FILE_TOO_LARGE',
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message,
          error: err.code,
        });
      }
      // Custom errors (e.g., file type validation)
      return res.status(400).json({
        success: false,
        message: err.message,
        error: 'INVALID_FILE',
      });
    }
    next();
  });
};

// ====================================
// UTILITY FUNCTIONS FOR CONTROLLERS
// ====================================

/**
 * Process uploaded profile image and return URL
 */
const processProfileImage = (file) => {
  if (!file) {
    return null;
  }
  
  const relativePath = path.join(
    UPLOAD_CONFIG.directories.profileImages,
    file.filename
  ).replace(/\\/g, '/');
  
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: relativePath,
    url: `/uploads/${relativePath}`,
  };
};

/**
 * Delete old profile image when updating
 */
const deleteOldProfileImage = async (oldImagePath) => {
  if (oldImagePath && !oldImagePath.includes('default')) {
    try {
      await deleteFile(oldImagePath);
      return true;
    } catch (error) {
      console.error('Failed to delete old profile image:', error);
      return false;
    }
  }
  return false;
};

// ====================================
// INITIALIZATION
// ====================================

/**
 * Initialize upload directories
 */
const initializeUploadDirectories = () => {
  Object.values(UPLOAD_CONFIG.directories).forEach((dir) => {
    const dirPath = path.join(UPLOAD_CONFIG.baseDir, dir);
    ensureDirectoryExists(dirPath);
  });
  console.log('Upload directories initialized');
};

// ====================================
// EXPORTS
// ====================================

module.exports = {
  // Configuration
  UPLOAD_CONFIG,
  
  // Middleware
  handleProfileImageUpload,
  
  // Utility functions
  processProfileImage,
  deleteOldProfileImage,
  deleteFile,
  getPublicUrl,
  ensureDirectoryExists,
  generateUniqueFilename,
  validateFileType,
  
  // Initialization
  initializeUploadDirectories,
};
