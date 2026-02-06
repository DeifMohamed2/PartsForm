/**
 * Email Service
 * Handles IMAP (receiving) and SMTP (sending) email operations
 * Supports attachment parsing including Excel, CSV, PDF, and images
 */
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const ExcelJS = require('exceljs');
const csv = require('csv-parser');
const { Readable } = require('stream');

class EmailService {
  constructor() {
    this.imap = null;
    this.smtpTransporter = null;
    this.isConnected = false;
    this.isIdling = false;
    this.isReconnecting = false; // Prevent duplicate reconnect attempts
    this.uploadDir = path.join(__dirname, '../public/uploads/email-attachments');
    this.lastCheckedUID = null;
    
    // Track when the service started
    this.startTime = new Date();
    this.isFirstRun = true;
    this.processedIdsLoaded = false; // Only load once
    
    // Set to track processed message IDs (in-memory cache)
    this.processedMessageIds = new Set();
    
    // Callback for new email notifications (IDLE mode)
    this.onNewEmailCallback = null;
    
    // Configuration from environment
    this.config = {
      imap: {
        user: process.env.EMAIL_IMAP_USER,
        password: process.env.EMAIL_IMAP_PASSWORD,
        host: process.env.EMAIL_IMAP_HOST,
        port: parseInt(process.env.EMAIL_IMAP_PORT, 10) || 993,
        tls: process.env.EMAIL_IMAP_TLS !== 'false',
        tlsOptions: { rejectUnauthorized: false },
      },
      smtp: {
        host: process.env.EMAIL_SMTP_HOST,
        port: parseInt(process.env.EMAIL_SMTP_PORT, 10) || 587,
        secure: process.env.EMAIL_SMTP_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_SMTP_USER,
          pass: process.env.EMAIL_SMTP_PASSWORD,
        },
      },
      // Email to monitor for inquiries
      inquiryEmail: process.env.EMAIL_INQUIRY_ADDRESS || 'inquiries@partsform.com',
      // Sender details for outgoing emails
      sender: {
        name: process.env.EMAIL_SENDER_NAME || 'PartsForm Quotations',
        email: process.env.EMAIL_SENDER_ADDRESS || process.env.EMAIL_SMTP_USER,
      },
      // Mailbox to monitor
      mailbox: process.env.EMAIL_MAILBOX || 'INBOX',
    };
  }

  /**
   * Check if email service is properly configured
   */
  isConfigured() {
    return !!(
      this.config.imap.user &&
      this.config.imap.password &&
      this.config.imap.host &&
      this.config.smtp.host &&
      this.config.smtp.auth.user &&
      this.config.smtp.auth.pass
    );
  }

  /**
   * Pre-load processed message IDs from database to avoid duplicate processing
   */
  async loadProcessedMessageIds() {
    try {
      const EmailInquiry = require('../models/EmailInquiry');
      // Load last 30 days of message IDs to cache
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const existingEmails = await EmailInquiry.find(
        { receivedAt: { $gte: thirtyDaysAgo } },
        { messageId: 1 }
      ).lean();
      
      existingEmails.forEach(email => {
        this.processedMessageIds.add(email.messageId);
      });
      
      console.log(`📧 Loaded ${this.processedMessageIds.size} processed email IDs from database`);
    } catch (err) {
      console.warn('⚠️  Could not load processed message IDs:', err.message);
    }
  }

  /**
   * Initialize IMAP connection
   */
  async connectImap() {
    if (!this.isConfigured()) {
      console.warn('⚠️  Email service not configured. Set EMAIL_IMAP_* and EMAIL_SMTP_* environment variables.');
      return false;
    }

    // Pre-load processed message IDs from database (only once)
    if (!this.processedIdsLoaded) {
      await this.loadProcessedMessageIds();
      this.processedIdsLoaded = true;
    }

    return new Promise((resolve, reject) => {
      this.imap = new Imap(this.config.imap);

      this.imap.once('ready', () => {
        console.log('✅ IMAP connected successfully');
        this.isConnected = true;
        resolve(true);
      });

      this.imap.once('error', (err) => {
        console.error('❌ IMAP connection error:', err.message);
        this.isConnected = false;
        reject(err);
      });

      this.imap.once('end', () => {
        console.log('📧 IMAP connection ended');
        this.isConnected = false;
      });

      this.imap.connect();
    });
  }

  /**
   * Initialize SMTP transporter
   */
  initializeSmtp() {
    if (!this.isConfigured()) {
      console.warn('⚠️  SMTP not configured');
      return false;
    }

    this.smtpTransporter = nodemailer.createTransport(this.config.smtp);
    console.log('✅ SMTP transporter initialized');
    return true;
  }

  /**
   * Verify SMTP connection
   */
  async verifySmtp() {
    if (!this.smtpTransporter) {
      this.initializeSmtp();
    }

    try {
      await this.smtpTransporter.verify();
      console.log('✅ SMTP connection verified');
      return true;
    } catch (error) {
      console.error('❌ SMTP verification failed:', error.message);
      return false;
    }
  }

  /**
   * Disconnect IMAP
   */
  disconnect() {
    if (this.imap) {
      this.stopIdle();
      this.imap.end();
      this.isConnected = false;
    }
  }

  /**
   * Start IMAP IDLE mode for real-time email notifications
   * @param {Function} onNewEmail - Callback when new email arrives
   */
  async startIdle(onNewEmail) {
    if (!this.isConnected) {
      await this.connectImap();
    }

    this.onNewEmailCallback = onNewEmail;

    return new Promise((resolve, reject) => {
      this.imap.openBox(this.config.mailbox, false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        console.log('📬 IMAP IDLE mode started - listening for new emails in real-time');
        this.isIdling = true;

        // Listen for new mail events
        this.imap.on('mail', (numNewMsgs) => {
          console.log(`📩 New email notification: ${numNewMsgs} new message(s)`);
          if (this.onNewEmailCallback) {
            // Small delay to ensure email is fully received
            setTimeout(() => {
              this.onNewEmailCallback(numNewMsgs);
            }, 1000);
          }
        });

        // Listen for expunge events (email deleted)
        this.imap.on('expunge', (seqno) => {
          console.log(`🗑️  Email ${seqno} was deleted`);
        });

        // Handle connection errors during IDLE
        this.imap.on('error', (err) => {
          console.error('❌ IMAP IDLE error:', err.message);
          this.isIdling = false;
          // Don't reconnect here - let 'close' event handle it to avoid duplicates
        });

        // Handle connection close - single point of reconnection
        this.imap.on('close', (hadError) => {
          console.log(`📧 IMAP connection closed${hadError ? ' with error' : ''}`);
          this.isIdling = false;
          this.isConnected = false;
          
          // Only reconnect if we have a callback and not already reconnecting
          if (this.onNewEmailCallback && !this.isReconnecting) {
            this.isReconnecting = true;
            setTimeout(() => {
              console.log('🔄 Attempting to reconnect IMAP...');
              this.reconnectIdle();
            }, 5000);
          }
        });

        resolve(true);
      });
    });
  }

  /**
   * Reconnect IMAP IDLE after disconnect
   */
  async reconnectIdle() {
    // Already reconnecting, skip
    if (!this.isReconnecting) {
      this.isReconnecting = true;
    }
    
    try {
      // Clean up old connection
      if (this.imap) {
        this.imap.removeAllListeners();
        try {
          this.imap.end();
        } catch (e) {
          // Ignore errors when ending
        }
      }
      
      this.imap = null;
      this.isConnected = false;
      this.isIdling = false;
      
      // Wait a moment before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconnect
      await this.connectImap();
      
      // Restore IDLE mode
      if (this.onNewEmailCallback) {
        await this.startIdle(this.onNewEmailCallback);
        console.log('✅ IMAP IDLE reconnected successfully');
      }
      
      this.isReconnecting = false;
    } catch (error) {
      console.error('❌ IMAP reconnect failed:', error.message);
      this.isReconnecting = false;
      // Retry in 30 seconds
      setTimeout(() => {
        if (!this.isReconnecting) {
          this.isReconnecting = true;
          this.reconnectIdle();
        }
      }, 30000);
    }
  }

  /**
   * Stop IMAP IDLE mode
   */
  stopIdle() {
    this.isIdling = false;
    this.onNewEmailCallback = null;
    if (this.imap) {
      this.imap.removeAllListeners('mail');
      this.imap.removeAllListeners('expunge');
    }
    console.log('⏹️  IMAP IDLE mode stopped');
  }

  /**
   * Fetch ONLY the latest N emails that just arrived
   * This is called when IDLE mode detects new emails
   * @param {number} numToFetch - Number of recent emails to fetch
   * @returns {Promise<Array>} Array of parsed emails
   */
  async fetchLatestEmails(numToFetch = 1) {
    if (!this.isConnected) {
      await this.connectImap();
    }

    const EmailInquiry = require('../models/EmailInquiry');

    return new Promise((resolve, reject) => {
      this.imap.openBox(this.config.mailbox, false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        // Get only the most recent N emails (using sequence numbers from the end)
        const totalMessages = box.messages.total;
        if (totalMessages === 0) {
          console.log('📭 No emails in mailbox');
          resolve([]);
          return;
        }

        // Fetch from last message, going back numToFetch
        const startSeq = Math.max(1, totalMessages - numToFetch + 1);
        const fetchRange = `${startSeq}:${totalMessages}`;

        console.log(`📨 Fetching latest ${numToFetch} email(s) (seq: ${fetchRange})`);

        const emails = [];
        const fetch = this.imap.seq.fetch(fetchRange, {
          bodies: '',
          markSeen: false,
        });

        fetch.on('message', (msg, seqno) => {
          let buffer = '';

          msg.on('body', (stream) => {
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
          });

          msg.once('attributes', (attrs) => {
            buffer = { raw: buffer, uid: attrs.uid };
          });

          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(buffer.raw);
              parsed.uid = buffer.uid;

              const messageId = parsed.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

              // Skip if already processed
              if (this.processedMessageIds.has(messageId)) {
                console.log('⏭️  Skipping already processed email');
                return;
              }

              // Check database
              try {
                const exists = await EmailInquiry.findOne({ messageId }).lean();
                if (exists) {
                  this.processedMessageIds.add(messageId);
                  console.log('⏭️  Skipping email already in database');
                  return;
                }
              } catch (dbErr) {
                // Continue on DB error
              }

              // Skip system emails
              const senderEmail = (parsed.from?.value?.[0]?.address || '').toLowerCase();
              const skipPatterns = ['noreply', 'no-reply', 'mailer-daemon', 'postmaster', 'notifications', 'alert@', 'donotreply'];
              if (skipPatterns.some(pattern => senderEmail.includes(pattern))) {
                console.log('⏭️  Skipping system/no-reply email');
                return;
              }

              this.processedMessageIds.add(messageId);
              emails.push(parsed);
            } catch (parseErr) {
              console.error('Email parse error:', parseErr.message);
            }
          });
        });

        fetch.once('error', (fetchErr) => {
          reject(fetchErr);
        });

        fetch.once('end', () => {
          setTimeout(() => {
            if (emails.length > 0) {
              console.log(`✅ Found ${emails.length} new email(s) to process`);
            } else {
              console.log('📭 No new emails to process');
            }
            resolve(emails);
          }, 500);
        });
      });
    });
  }

  /**
   * Fetch new unread emails from inbox
   * Checks against database to avoid processing duplicates
   * @returns {Promise<Array>} Array of parsed emails
   */
  async fetchNewEmails() {
    if (!this.isConnected) {
      await this.connectImap();
    }

    // Import EmailInquiry model to check for existing emails
    const EmailInquiry = require('../models/EmailInquiry');

    return new Promise((resolve, reject) => {
      this.imap.openBox(this.config.mailbox, false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        // Search for UNSEEN emails only
        // On first run, limit to last 7 days to avoid processing very old emails
        let searchCriteria;
        if (this.isFirstRun) {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          const sinceDate = oneWeekAgo.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }).replace(/ /g, '-');
          searchCriteria = ['UNSEEN', ['SINCE', sinceDate]];
        } else {
          searchCriteria = ['UNSEEN'];
        }

        this.imap.search(searchCriteria, async (searchErr, results) => {
          if (searchErr) {
            reject(searchErr);
            return;
          }

          if (!results || results.length === 0) {
            console.log('📭 No new emails');
            this.isFirstRun = false;
            resolve([]);
            return;
          }

          console.log(`📬 Found ${results.length} candidate emails`);

          const emails = [];
          const skippedCount = { old: 0, system: 0 };
          const fetch = this.imap.fetch(results, {
            bodies: '',
            markSeen: false, // We'll mark as seen after processing
          });

          fetch.on('message', (msg, seqno) => {
            let buffer = '';

            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
            });

            msg.once('attributes', (attrs) => {
              // Store UID for later marking as read
              buffer = { raw: buffer, uid: attrs.uid };
            });

            msg.once('end', async () => {
              try {
                const parsed = await simpleParser(buffer.raw);
                parsed.uid = buffer.uid;
                
                const messageId = parsed.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                // Filter 1: Check if already processed (in-memory cache first for speed)
                if (this.processedMessageIds.has(messageId)) {
                  skippedCount.old++;
                  return;
                }
                
                // Filter 2: Check database for existing email
                try {
                  const existingEmail = await EmailInquiry.findOne({ messageId }).lean();
                  if (existingEmail) {
                    this.processedMessageIds.add(messageId); // Cache it
                    skippedCount.old++;
                    return;
                  }
                } catch (dbErr) {
                  // Continue if DB check fails - we'll catch duplicates on insert
                }
                
                // Filter 3: Skip no-reply and system emails
                const senderEmail = (parsed.from?.value?.[0]?.address || '').toLowerCase();
                const skipPatterns = ['noreply', 'no-reply', 'mailer-daemon', 'postmaster', 'notifications', 'alert@', 'donotreply'];
                if (skipPatterns.some(pattern => senderEmail.includes(pattern))) {
                  skippedCount.system++;
                  return; // Skip system emails
                }
                
                // Add to cache to prevent duplicate processing in same batch
                this.processedMessageIds.add(messageId);
                
                emails.push(parsed);
              } catch (parseErr) {
                console.error('Email parse error:', parseErr.message);
              }
            });
          });

          fetch.once('error', (fetchErr) => {
            reject(fetchErr);
          });

          fetch.once('end', () => {
            // Give time for all messages to be parsed
            setTimeout(() => {
              this.isFirstRun = false;
              const totalSkipped = skippedCount.old + skippedCount.system;
              if (totalSkipped > 0) {
                console.log(`⏭️  Skipped ${totalSkipped} emails (${skippedCount.old} already processed, ${skippedCount.system} system/no-reply)`);
              }
              if (emails.length > 0) {
                console.log(`📬 Processing ${emails.length} new customer emails`);
              }
              resolve(emails);
            }, 500);
          });
        });
      });
    });
  }

  /**
   * Mark email as read/seen
   * @param {number} uid - Email UID
   */
  async markAsRead(uid) {
    if (!this.isConnected) return;

    return new Promise((resolve, reject) => {
      this.imap.addFlags(uid, ['\\Seen'], (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  /**
   * Parse email into our format
   * @param {Object} parsedEmail - Email parsed by mailparser
   * @returns {Object} Formatted email data
   */
  formatEmail(parsedEmail) {
    return {
      messageId: parsedEmail.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uid: parsedEmail.uid,
      from: {
        email: parsedEmail.from?.value?.[0]?.address || '',
        name: parsedEmail.from?.value?.[0]?.name || '',
      },
      to: {
        email: parsedEmail.to?.value?.[0]?.address || '',
        name: parsedEmail.to?.value?.[0]?.name || '',
      },
      subject: parsedEmail.subject || '(No Subject)',
      body: {
        text: parsedEmail.text || '',
        html: parsedEmail.html || '',
      },
      receivedAt: parsedEmail.date || new Date(),
      attachments: (parsedEmail.attachments || []).map(att => ({
        filename: att.filename || 'unnamed',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        content: att.content, // Buffer
      })),
    };
  }

  /**
   * Save attachment to disk
   * @param {Object} attachment - Attachment object with content buffer
   * @param {string} inquiryId - Email inquiry ID for folder organization
   * @returns {Promise<string>} Saved file path
   */
  async saveAttachment(attachment, inquiryId) {
    // Ensure upload directory exists
    const inquiryDir = path.join(this.uploadDir, inquiryId);
    await fs.mkdir(inquiryDir, { recursive: true });

    // Sanitize filename
    const sanitizedName = attachment.filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 200);

    const filePath = path.join(inquiryDir, sanitizedName);
    
    await fs.writeFile(filePath, attachment.content);
    
    return filePath;
  }

  /**
   * Parse Excel file and extract data
   * @param {Buffer|string} source - File buffer or path
   * @returns {Promise<Array>} Array of row data
   */
  async parseExcel(source) {
    const workbook = new ExcelJS.Workbook();
    
    if (Buffer.isBuffer(source)) {
      await workbook.xlsx.load(source);
    } else {
      await workbook.xlsx.readFile(source);
    }

    const allData = [];
    
    workbook.eachSheet((worksheet) => {
      worksheet.eachRow((row, rowNumber) => {
        const rowData = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          let value = cell.value;
          // Handle different cell types
          if (value && typeof value === 'object') {
            if (value.text) value = value.text;
            else if (value.result) value = value.result;
            else if (value.richText) {
              value = value.richText.map(rt => rt.text).join('');
            } else {
              value = String(value);
            }
          }
          rowData.push(value);
        });
        if (rowData.some(cell => cell !== null && cell !== '')) {
          allData.push(rowData);
        }
      });
    });

    return allData;
  }

  /**
   * Parse CSV file and extract data
   * @param {Buffer|string} source - File buffer or path
   * @returns {Promise<Array>} Array of row data
   */
  async parseCsv(source) {
    return new Promise((resolve, reject) => {
      const results = [];
      let stream;

      if (Buffer.isBuffer(source)) {
        stream = Readable.from(source);
      } else {
        stream = require('fs').createReadStream(source);
      }

      stream
        .pipe(csv())
        .on('data', (data) => results.push(Object.values(data)))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  /**
   * Parse any supported attachment
   * @param {Object} attachment - Attachment object
   * @returns {Promise<Object>} Parsed data with type info
   */
  async parseAttachment(attachment) {
    const { filename, contentType, content } = attachment;
    const ext = path.extname(filename).toLowerCase();

    try {
      // Excel files
      if (ext === '.xlsx' || ext === '.xls' || 
          contentType?.includes('spreadsheet') || 
          contentType?.includes('excel')) {
        const data = await this.parseExcel(content);
        return {
          type: 'excel',
          filename,
          data,
          success: true,
        };
      }

      // CSV files
      if (ext === '.csv' || contentType?.includes('csv')) {
        const data = await this.parseCsv(content);
        return {
          type: 'csv',
          filename,
          data,
          success: true,
        };
      }

      // Plain text files
      if (ext === '.txt' || contentType?.includes('text/plain')) {
        const text = content.toString('utf8');
        // Split by newlines
        const lines = text.split(/\r?\n/).map(line => [line]);
        return {
          type: 'text',
          filename,
          data: lines,
          success: true,
        };
      }

      // Unsupported type
      return {
        type: 'unsupported',
        filename,
        contentType,
        success: false,
        message: `Unsupported file type: ${ext || contentType}`,
      };
    } catch (error) {
      return {
        type: 'error',
        filename,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(options) {
    if (!this.smtpTransporter) {
      this.initializeSmtp();
    }

    const mailOptions = {
      from: `"${this.config.sender.name}" <${this.config.sender.email}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo || this.config.inquiryEmail,
      attachments: options.attachments || [],
    };

    try {
      const result = await this.smtpTransporter.sendMail(mailOptions);
      console.log(`✉️  Email sent to ${options.to}: ${result.messageId}`);
      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
      };
    } catch (error) {
      console.error('❌ Email send error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send auto-acknowledgment email
   * @param {string} toEmail - Recipient email
   * @param {string} toName - Recipient name
   * @param {string} originalSubject - Original email subject
   * @param {string} language - Language for response (en, ar, etc.)
   */
  async sendAcknowledgment(toEmail, toName, originalSubject, language = 'en') {
    const firstName = (toName || 'there').split(' ')[0];
    const templates = {
      en: {
        subject: `RE: ${originalSubject} - We're on it! ⚡`,
        text: `Hi ${firstName},

Got it! Your quotation is being prepared now.

⚡ Expected delivery: Under 2 minutes

PartsForm`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px;">
          
          <!-- Logo/Brand Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 24px;">
              <span style="font-size: 28px; font-weight: 700; color: #2b5278; letter-spacing: -0.5px;">PartsForm</span>
            </td>
          </tr>
          
          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(43, 82, 120, 0.12);">
                
                <!-- Success Icon Header -->
                <tr>
                  <td style="background-color: #2b5278; padding: 48px 32px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="width: 72px; height: 72px; background-color: rgba(255,255,255,0.15); border-radius: 50%; text-align: center; vertical-align: middle;">
                          <span style="font-size: 36px; line-height: 72px;">✓</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 20px 0 0 0; font-size: 22px; font-weight: 600; color: #ffffff;">Inquiry Received</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 20px 0; font-size: 17px; color: #1a2b3d; line-height: 1.5;">
                      Hi <strong>${firstName}</strong>, we're preparing your quotation now.
                    </p>
                    
                    <!-- Time Badge -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <span style="font-size: 32px;">⚡</span>
                          <p style="margin: 8px 0 0 0; font-size: 15px; color: #166534; font-weight: 600;">
                            Your quote in <span style="color: #15803d; font-size: 18px;">under 2 min</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                Questions? Just reply to this email.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      },
      ar: {
        subject: `RE: ${originalSubject} - نعمل على طلبك! ⚡`,
        text: `مرحباً ${firstName},

تم استلام طلبك! جاري إعداد عرض الأسعار الآن.

⚡ الوقت المتوقع: أقل من دقيقتين

بارتسفورم`,
        html: `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; direction: rtl;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px;">
          
          <!-- Logo/Brand Header -->
          <tr>
            <td style="text-align: center; padding-bottom: 24px;">
              <span style="font-size: 28px; font-weight: 700; color: #2b5278; letter-spacing: -0.5px;">بارتسفورم</span>
            </td>
          </tr>
          
          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(43, 82, 120, 0.12);">
                
                <!-- Success Icon Header -->
                <tr>
                  <td style="background-color: #2b5278; padding: 48px 32px; text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="width: 72px; height: 72px; background-color: rgba(255,255,255,0.15); border-radius: 50%; text-align: center; vertical-align: middle;">
                          <span style="font-size: 36px; line-height: 72px;">✓</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 20px 0 0 0; font-size: 22px; font-weight: 600; color: #ffffff;">تم استلام الطلب</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 20px 0; font-size: 17px; color: #1a2b3d; line-height: 1.6;">
                      مرحباً <strong>${firstName}</strong>، نقوم بإعداد عرض الأسعار الآن.
                    </p>
                    
                    <!-- Time Badge -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <span style="font-size: 32px;">⚡</span>
                          <p style="margin: 8px 0 0 0; font-size: 15px; color: #166534; font-weight: 600;">
                            عرض السعر خلال <span style="color: #15803d; font-size: 18px;">أقل من دقيقتين</span>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                لديك أسئلة؟ رد على هذا البريد.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      },
    };

    const template = templates[language] || templates.en;
    
    return this.sendEmail({
      to: toEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }
}

// Singleton instance
const emailService = new EmailService();

module.exports = emailService;
