/**
 * Supplier FTP Server Service
 * Provides FTP server functionality for suppliers to upload their data files
 * Uses ftp-srv package to create a virtual FTP server
 */
const FtpSrv = require('ftp-srv');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');
const EventEmitter = require('events');
const Supplier = require('../models/Supplier');
const DataTable = require('../models/DataTable');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const csvParserService = require('./csvParserService');

class SupplierFtpService extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.isRunning = false;
    this.config = {
      host: process.env.FTP_HOST || '0.0.0.0',
      port: parseInt(process.env.FTP_PORT) || 2121, // Non-standard port to avoid conflicts
      publicHost: process.env.FTP_PUBLIC_HOST || process.env.HOST || 'localhost',
      pasv_min: parseInt(process.env.FTP_PASV_MIN) || 10000,
      pasv_max: parseInt(process.env.FTP_PASV_MAX) || 10100,
      tls: process.env.FTP_TLS === 'true' ? {
        key: fsSync.readFileSync(process.env.FTP_TLS_KEY),
        cert: fsSync.readFileSync(process.env.FTP_TLS_CERT),
      } : false,
      baseDirectory: process.env.FTP_BASE_DIR || path.join(process.cwd(), 'ftp-uploads'),
    };
    
    // Ensure base directory exists
    this._ensureDirectory(this.config.baseDirectory);
  }

  /**
   * Ensure directory exists
   */
  async _ensureDirectory(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        logger.error('Error creating FTP directory:', error);
      }
    }
  }

  /**
   * Start the FTP server
   */
  async start() {
    if (this.isRunning) {
      logger.warn('FTP server is already running');
      return;
    }

    try {
      this.server = new FtpSrv({
        url: `ftp://${this.config.host}:${this.config.port}`,
        pasv_url: this.config.publicHost,
        pasv_min: this.config.pasv_min,
        pasv_max: this.config.pasv_max,
        tls: this.config.tls,
        anonymous: false,
        greeting: ['Welcome to PARTSFORM Supplier FTP Server'],
      });

      // Handle login
      this.server.on('login', async ({ connection, username, password }, resolve, reject) => {
        try {
          const supplier = await this._authenticateSupplier(username, password);
          
          if (!supplier) {
            logger.warn(`FTP login failed for username: ${username}`);
            return reject(new Error('Invalid credentials'));
          }

          // Get supplier's FTP directory
          const ftpDir = path.join(this.config.baseDirectory, supplier.companyCode);
          await this._ensureDirectory(ftpDir);

          // Update last access time
          await Supplier.findByIdAndUpdate(supplier._id, {
            'ftpAccess.lastAccess': new Date()
          });

          // Log successful login
          await this._logAudit(supplier, 'ftp.login', 'success', {
            ipAddress: connection.ip,
          });

          logger.info(`FTP login success: ${supplier.companyName} (${username})`);

          resolve({
            root: ftpDir,
            cwd: '/',
            fs: new SupplierFileSystem(supplier, ftpDir, this),
          });
        } catch (error) {
          logger.error('FTP login error:', error.message);
          reject(new Error('Authentication error'));
        }
      });

      // Handle client disconnect
      this.server.on('client-error', ({ connection, context, error }) => {
        logger.error('FTP client error:', { ip: connection?.ip, context, error: error.message });
      });

      await this.server.listen();
      this.isRunning = true;

      logger.info(`FTP server started on ${this.config.host}:${this.config.port}`);
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start FTP server:', error.message);
      throw error;
    }
  }

  /**
   * Stop the FTP server
   */
  async stop() {
    if (!this.isRunning || !this.server) {
      return;
    }

    try {
      await this.server.close();
      this.isRunning = false;
      this.server = null;
      logger.info('FTP server stopped');
      this.emit('stopped');
    } catch (error) {
      logger.error('Error stopping FTP server:', error.message);
    }
  }

  /**
   * Authenticate supplier by FTP credentials
   */
  async _authenticateSupplier(username, password) {
    try {
      // Find supplier by FTP username
      const supplier = await Supplier.findOne({
        'ftpAccess.username': username,
        'ftpAccess.enabled': true,
        isActive: true,
      }).select('+ftpAccess.password');

      if (!supplier) {
        return null;
      }

      // Verify password (stored as hash)
      const passwordHash = crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');

      if (passwordHash !== supplier.ftpAccess.password) {
        return null;
      }

      return supplier;
    } catch (error) {
      logger.error('FTP authentication error:', error.message);
      return null;
    }
  }

  /**
   * Log audit event
   */
  async _logAudit(supplier, action, status, details = {}) {
    try {
      await AuditLog.log({
        actor: { 
          type: 'supplier', 
          id: supplier._id, 
          name: supplier.contactName, 
          email: supplier.email 
        },
        action,
        resource: { 
          type: 'supplier', 
          id: supplier._id, 
          name: supplier.companyName 
        },
        supplier: supplier._id,
        status,
        request: details,
      });
    } catch (error) {
      logger.error('Audit log error:', error.message);
    }
  }

  /**
   * Process uploaded file
   */
  async processUploadedFile(supplier, filePath, fileName) {
    try {
      logger.info(`Processing FTP upload: ${fileName} from ${supplier.companyName}`);

      // Determine file type
      const ext = path.extname(fileName).toLowerCase();
      
      if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
        logger.warn(`Unsupported file type uploaded: ${fileName}`);
        return {
          success: false,
          message: 'Unsupported file type. Allowed: CSV, XLSX, XLS',
        };
      }

      // Check if there's a target table for auto-import
      const targetTable = await DataTable.findOne({
        supplier: supplier._id,
        'ftpSettings.enabled': true,
        'ftpSettings.autoImport': true,
        'ftpSettings.filePattern': { $regex: new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      });

      if (targetTable) {
        // Auto-import to target table
        const result = await this._autoImportToTable(supplier, targetTable, filePath, fileName);
        return result;
      }

      // Log successful upload (no auto-import)
      await this._logAudit(supplier, 'ftp.upload', 'success', {
        fileName,
        fileSize: (await fs.stat(filePath)).size,
      });

      return {
        success: true,
        message: 'File uploaded successfully',
        fileName,
      };

    } catch (error) {
      logger.error('Error processing FTP upload:', error.message);
      
      await this._logAudit(supplier, 'ftp.upload', 'failure', {
        fileName,
        error: error.message,
      });

      return {
        success: false,
        message: 'Error processing file',
        error: error.message,
      };
    }
  }

  /**
   * Auto-import file to target table
   */
  async _autoImportToTable(supplier, table, filePath, fileName) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const ext = path.extname(fileName).toLowerCase();

      let records;
      if (ext === '.csv') {
        records = await csvParserService.parseCSV(fileBuffer);
      } else {
        // For Excel files, use xlsx package
        const xlsx = require('xlsx');
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        records = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      }

      // Import records
      const DataRecord = require('../models/DataRecord');
      let imported = 0;
      let errors = 0;

      for (const record of records) {
        try {
          await DataRecord.create({
            table: table._id,
            supplier: supplier._id,
            data: record,
            createdBy: { type: 'ftp', timestamp: new Date() },
          });
          imported++;
        } catch (err) {
          errors++;
        }
      }

      // Update table record count
      table.recordCount = await DataRecord.countDocuments({ table: table._id });
      await table.save();

      // Log import
      await this._logAudit(supplier, 'ftp.auto_import', 'success', {
        fileName,
        tableName: table.name,
        imported,
        errors,
      });

      logger.info(`FTP auto-import: ${imported} records to ${table.name} for ${supplier.companyName}`);

      return {
        success: true,
        message: `Imported ${imported} records to ${table.name}`,
        imported,
        errors,
      };

    } catch (error) {
      logger.error('FTP auto-import error:', error.message);
      throw error;
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: this.isRunning,
      host: this.config.publicHost,
      port: this.config.port,
      tls: !!this.config.tls,
      baseDirectory: this.config.baseDirectory,
    };
  }

  /**
   * Generate FTP credentials for a supplier
   */
  static generateCredentials(companyCode) {
    const username = `supplier_${companyCode.toLowerCase()}`;
    const password = crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 16);
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    return {
      username,
      password, // Plain text - only shown once
      passwordHash, // Stored in database
    };
  }
}

/**
 * Custom FileSystem for FTP that tracks uploads
 */
class SupplierFileSystem {
  constructor(supplier, root, ftpService) {
    this.supplier = supplier;
    this.root = root;
    this.ftpService = ftpService;
    this.cwd = '/';
  }

  get(fileName) {
    const filePath = path.join(this.root, this.cwd, fileName);
    return fsSync.createReadStream(filePath);
  }

  async list(dirPath = '.') {
    const fullPath = path.join(this.root, this.cwd, dirPath);
    
    try {
      const files = await fs.readdir(fullPath, { withFileTypes: true });
      
      return files.map(file => {
        const filePath = path.join(fullPath, file.name);
        const stat = fsSync.statSync(filePath);
        return {
          name: file.name,
          isDirectory: () => stat.isDirectory(),
          size: stat.size,
          mtime: stat.mtime,
          mode: stat.mode,
          uid: stat.uid || 0,
          gid: stat.gid || 0,
        };
      });
    } catch (error) {
      return [];
    }
  }

  chdir(dirPath) {
    const newPath = path.posix.resolve(this.cwd, dirPath);
    const fullPath = path.join(this.root, newPath);
    
    if (fsSync.existsSync(fullPath) && fsSync.statSync(fullPath).isDirectory()) {
      this.cwd = newPath;
      return;
    }
    
    throw new Error('Directory not found');
  }

  async write(fileName, options) {
    const filePath = path.join(this.root, this.cwd, fileName);
    const writeStream = fsSync.createWriteStream(filePath);

    writeStream.on('finish', async () => {
      // Process the uploaded file
      await this.ftpService.processUploadedFile(this.supplier, filePath, fileName);
    });

    return { stream: writeStream, filePath };
  }

  async mkdir(dirPath) {
    const fullPath = path.join(this.root, this.cwd, dirPath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async delete(filePath) {
    const fullPath = path.join(this.root, this.cwd, filePath);
    await fs.unlink(fullPath);
    
    await this.ftpService._logAudit(this.supplier, 'ftp.delete', 'success', {
      fileName: filePath,
    });
  }

  async rename(from, to) {
    const fromPath = path.join(this.root, this.cwd, from);
    const toPath = path.join(this.root, this.cwd, to);
    await fs.rename(fromPath, toPath);
  }

  currentDirectory() {
    return this.cwd;
  }
}

// Create singleton instance
const ftpService = new SupplierFtpService();

module.exports = ftpService;
