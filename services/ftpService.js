/**
 * FTP Service
 * Simplified version based on working implementation from THings of FTP Connection
 * Handles FTP connections, file listing, and downloading
 * Supports parallel downloads with isolated client instances
 */
const ftp = require('basic-ftp');
const { PassThrough } = require('stream');
const fs = require('fs');
const path = require('path');
const os = require('os');

class FTPService {
  constructor() {
    this.client = new ftp.Client();
    this.currentCredentials = null;
    this.debug = false; // Set to true for detailed FTP logging
    this.productionMode = process.env.NODE_ENV === 'production' || process.env.SYNC_PRODUCTION_MODE === 'true';
  }

  /**
   * Create a new isolated FTP client for parallel operations
   * Each client is independent and can be used concurrently
   */
  createIsolatedClient() {
    return new ftp.Client();
  }

  /**
   * Download file using an isolated client (for parallel downloads)
   * Creates its own connection, downloads, and closes - fully independent
   */
  async downloadToTempFileParallel(remotePath, credentials) {
    const client = this.createIsolatedClient();
    
    try {
      const accessConfig = {
        host: (credentials.host || '').trim(),
        port: credentials.port || 21,
        user: (credentials.username || credentials.user || '').trim(),
        password: credentials.password,
        secure: credentials.secure !== undefined ? credentials.secure : false,
      };
      
      await client.access(accessConfig);
      
      // Change to remote directory if specified
      const remoteDir = credentials?.remotePath || '/';
      if (remoteDir && remoteDir !== '/') {
        try {
          await client.cd(remoteDir);
        } catch (cdError) {
          // Directory may not exist or already in correct dir
        }
      }
      
      const fileName = remotePath.split('/').pop();
      
      // Create temp file path
      const tempDir = path.join(os.tmpdir(), 'partsform-ftp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempFilePath = path.join(tempDir, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${fileName}`);
      
      // Download directly to file
      await client.downloadTo(tempFilePath, remotePath);
      
      return tempFilePath;
    } catch (error) {
      throw error;
    } finally {
      // Always close the isolated client
      try {
        client.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }

  /**
   * Debug logger
   */
  _debug(message, data = null) {
    if (this.debug) {
      const timestamp = new Date().toISOString();
      if (data) {
        console.log(`[FTP DEBUG ${timestamp}] ${message}`, data);
      } else {
        console.log(`[FTP DEBUG ${timestamp}] ${message}`);
      }
    }
  }

  /**
   * Connect to FTP server
   */
  async connect(credentials = null) {
    try {
      const creds = credentials || this.currentCredentials;
      
      if (!creds) {
        throw new Error('FTP credentials are required');
      }
      
      this.currentCredentials = creds;
      
      const accessConfig = {
        host: (creds.host || '').trim(),
        port: creds.port || 21,
        user: (creds.username || creds.user || '').trim(),
        password: creds.password,
        secure: creds.secure !== undefined ? creds.secure : false,
      };
      
      this._debug(`Connecting to ${accessConfig.host}:${accessConfig.port}`);
      this._debug('Access config:', { 
        host: accessConfig.host, 
        port: accessConfig.port, 
        user: accessConfig.user,
        secure: accessConfig.secure 
      });
      
      // Enable verbose logging if debug is on
      if (this.debug) {
        this.client.ftp.verbose = true;
      }
      
      await this.client.access(accessConfig);
      
      this._debug(`✅ FTP connected successfully to ${creds.host}`);
      if (!this.productionMode) console.log(`✅ FTP connected to ${creds.host}`);
      return true;
    } catch (error) {
      this._debug(`❌ FTP connection error: ${error.message}`, { 
        code: error.code, 
        stack: error.stack 
      });
      console.error('FTP connection error:', error);
      throw error;
    }
  }

  /**
   * Test FTP connection
   */
  async testConnection(credentials) {
    this._debug('Testing FTP connection...');
    try {
      await this.connect(credentials);
      
      // Try to list directory to verify full access
      const remotePath = credentials.remotePath || '/';
      this._debug(`Testing access to remote path: ${remotePath}`);
      
      const files = await this.client.list(remotePath);
      
      this._debug(`Test connection successful, found ${files.length} files`);
      await this.close();
      
      return {
        success: true,
        message: 'Connection successful',
        filesFound: files.length,
      };
    } catch (error) {
      this._debug(`Test connection failed: ${error.message}`, { code: error.code });
      await this.close();
      return {
        success: false,
        message: error.message,
        error: error.code || 'CONNECTION_FAILED',
      };
    }
  }

  /**
   * List files on FTP server
   */
  async listFiles(credentials = null, remotePath = '/') {
    try {
      if (credentials || this.client.closed) {
        await this.connect(credentials);
      }
      
      this._debug(`Listing files at path: ${remotePath}`);
      const allFiles = await this.client.list(remotePath);
      this._debug(`Raw file list received: ${allFiles.length} items`);
      
      // Filter based on file pattern (default: CSV files)
      const filePattern = credentials?.filePattern || '*.csv';
      const pattern = this._patternToRegex(filePattern);
      
      this._debug(`Filtering with pattern: ${filePattern}`);
      
      const files = allFiles.filter((file) => {
        const isFile = file.type === 1;
        const matchesPattern = pattern.test(file.name.toLowerCase());
        if (this.debug && matchesPattern) {
          this._debug(`  File: ${file.name}, type: ${file.type}, isFile: ${isFile}, matches: ${matchesPattern}`);
        }
        return isFile && matchesPattern;
      });

      console.log(`📂 Found ${files.length} matching files in ${remotePath}`);
      this._debug(`Filtered to ${files.length} matching files`);
      
      // Close connection after listing (like working implementation)
      await this.close();
      
      return files;
    } catch (error) {
      this._debug(`Error listing files: ${error.message}`, { 
        code: error.code, 
        stack: error.stack 
      });
      console.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Download file from FTP server to a temporary file (memory-efficient for large files)
   * Returns the path to the temp file
   */
  async downloadToTempFile(remotePath, credentials = null) {
    try {
      if (credentials || this.client.closed) {
        await this.connect(credentials);
      }
      
      // Change to remote directory if specified
      const remoteDir = credentials?.remotePath || '/';
      if (remoteDir && remoteDir !== '/') {
        try {
          this._debug(`Changing to remote directory: ${remoteDir}`);
          await this.client.cd(remoteDir);
        } catch (cdError) {
          this._debug(`Warning: Could not change to directory ${remoteDir}: ${cdError.message}`);
        }
      }
      
      const fileName = remotePath.split('/').pop();
      this._debug(`Downloading file to temp: ${remotePath}`);
      
      // Create temp file path
      const tempDir = path.join(os.tmpdir(), 'partsform-ftp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempFilePath = path.join(tempDir, `${Date.now()}-${fileName}`);
      
      // Download directly to file (memory efficient)
      await this.client.downloadTo(tempFilePath, remotePath);
      
      const stats = fs.statSync(tempFilePath);
      if (!this.productionMode) console.log(`📥 Downloaded ${fileName} (${this._formatBytes(stats.size)}) to temp file`);
      this._debug(`Download complete: ${fileName} - ${this._formatBytes(stats.size)}`);
      
      return tempFilePath;
    } catch (error) {
      this._debug(`Error downloading file ${remotePath}: ${error.message}`);
      console.error(`Error downloading file ${remotePath}:`, error);
      await this.close();
      throw error;
    }
  }

  /**
   * Download file from FTP server (returns buffer - for backward compatibility)
   * For large files (>10MB), consider using downloadToTempFile instead
   */
  async downloadFile(remotePath, credentials = null) {
    try {
      if (credentials || this.client.closed) {
        await this.connect(credentials);
      }
      
      // Change to remote directory if specified (before downloading)
      const remoteDir = credentials?.remotePath || '/';
      if (remoteDir && remoteDir !== '/') {
        try {
          this._debug(`Changing to remote directory: ${remoteDir}`);
          await this.client.cd(remoteDir);
        } catch (cdError) {
          this._debug(`Warning: Could not change to directory ${remoteDir}: ${cdError.message}`);
          // Continue anyway - might be able to access file from root
        }
      }
      
      const fileName = remotePath.split('/').pop();
      this._debug(`Downloading file: ${remotePath}`);
      
      const chunks = [];
      const stream = new PassThrough();
      
      const downloadPromise = new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        
        stream.on('error', (err) => {
          reject(err);
        });
      });
      
      await this.client.downloadTo(stream, remotePath);
      
      const buffer = await downloadPromise;
      
      console.log(`📥 Downloaded ${fileName} (${this._formatBytes(buffer.length)})`);
      this._debug(`Download complete: ${fileName} - ${this._formatBytes(buffer.length)}`);
      
      return buffer;
    } catch (error) {
      this._debug(`Error downloading file ${remotePath}: ${error.message}`, {
        code: error.code,
        stack: error.stack
      });
      console.error(`Error downloading file ${remotePath}:`, error);
      // Close connection on error
      await this.close();
      throw error;
    }
  }

  /**
   * Close FTP connection
   */
  async close() {
    try {
      if (this.client && !this.client.closed) {
        this._debug('Closing FTP connection...');
        this.client.close();
        this._debug('FTP connection closed');
      }
    } catch (error) {
      this._debug(`Error closing FTP connection: ${error.message}`);
      // Ignore close errors
    }
  }

  /**
   * Force close and reset (for use between file batches)
   */
  async forceReset() {
    this._debug('Force resetting FTP connection...');
    await this.close();
    // Create a new client instance
    this.client = new ftp.Client();
    if (this.debug) {
      this.client.ftp.verbose = true;
    }
    await this._sleep(1000);
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convert file pattern to regex
   */
  _patternToRegex(pattern) {
    const escaped = pattern
      .toLowerCase()
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
  }

  /**
   * Format bytes to human readable
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled) {
    this.debug = enabled;
    if (this.client) {
      this.client.ftp.verbose = enabled;
    }
  }
}

// Export singleton
module.exports = new FTPService();
