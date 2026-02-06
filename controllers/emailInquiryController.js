/**
 * Email Inquiry Controller
 * Handles admin routes for viewing and managing email inquiries
 */
const EmailInquiry = require('../models/EmailInquiry');
const emailInquiryProcessor = require('../services/emailInquiryProcessor');
const emailInquiryScheduler = require('../services/emailInquiryScheduler');
const emailService = require('../services/emailService');
const quotationGenerator = require('../services/quotationGeneratorService');

/**
 * Get all email inquiries with pagination
 * GET /admin/email-inquiries
 */
const getEmailInquiries = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'all';
    const search = req.query.search || '';

    // Build query
    const query = {};
    if (status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { 'from.email': { $regex: search, $options: 'i' } },
        { 'from.name': { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { 'quotation.quotationNumber': { $regex: search, $options: 'i' } },
      ];
    }

    const [inquiries, total, stats] = await Promise.all([
      EmailInquiry.find(query)
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('buyer', 'name email company')
        .lean(),
      EmailInquiry.countDocuments(query),
      EmailInquiry.getStats(),
    ]);

    const unreadCount = await EmailInquiry.getUnreadCount();
    const schedulerStatus = emailInquiryScheduler.getStatus();

    res.render('admin/email-inquiries', {
      title: 'Email Inquiries',
      inquiries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats,
      unreadCount,
      schedulerStatus,
      currentStatus: status,
      search,
    });
  } catch (error) {
    console.error('Get email inquiries error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load email inquiries',
      error: error.message,
    });
  }
};

/**
 * Get single email inquiry details
 * GET /admin/email-inquiries/:id
 */
const getEmailInquiryDetails = async (req, res) => {
  try {
    const inquiry = await EmailInquiry.findById(req.params.id)
      .populate('buyer', 'name email company phone')
      .populate('order')
      .populate('adminNotes.addedBy', 'name email');

    if (!inquiry) {
      return res.status(404).render('error', {
        title: 'Not Found',
        message: 'Email inquiry not found',
      });
    }

    // Mark as read
    if (!inquiry.isRead) {
      inquiry.isRead = true;
      await inquiry.save();
    }

    res.render('admin/email-inquiry-details', {
      title: `Inquiry: ${inquiry.subject}`,
      inquiry,
    });
  } catch (error) {
    console.error('Get inquiry details error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load inquiry details',
      error: error.message,
    });
  }
};

/**
 * API: Get inquiry statistics
 * GET /admin/api/email-inquiries/stats
 */
const getInquiryStats = async (req, res) => {
  try {
    const statistics = await emailInquiryScheduler.getStatistics();
    res.json({
      success: true,
      ...statistics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * API: Trigger manual email check
 * POST /admin/api/email-inquiries/check-now
 */
const triggerEmailCheck = async (req, res) => {
  try {
    const result = await emailInquiryScheduler.triggerManualCheck();
    res.json({
      success: true,
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * API: Retry failed inquiry
 * POST /admin/api/email-inquiries/:id/retry
 */
const retryInquiry = async (req, res) => {
  try {
    const result = await emailInquiryProcessor.retryInquiry(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * API: Resend quotation
 * POST /admin/api/email-inquiries/:id/resend-quotation
 */
const resendQuotation = async (req, res) => {
  try {
    const inquiry = await EmailInquiry.findById(req.params.id);
    
    if (!inquiry) {
      return res.status(404).json({
        success: false,
        error: 'Inquiry not found',
      });
    }

    if (!inquiry.quotation?.emailContent) {
      return res.status(400).json({
        success: false,
        error: 'No quotation available to resend',
      });
    }

    const sendResult = await emailService.sendEmail({
      to: inquiry.from.email,
      subject: `PartsForm Quotation #${inquiry.quotation.quotationNumber} (Resent)`,
      html: inquiry.quotation.emailContent,
    });

    if (sendResult.success) {
      inquiry.quotation.sentAt = new Date();
      await inquiry.save();
    }

    res.json(sendResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * API: Regenerate quotation
 * POST /admin/api/email-inquiries/:id/regenerate-quotation
 */
const regenerateQuotation = async (req, res) => {
  try {
    const inquiry = await EmailInquiry.findById(req.params.id);
    
    if (!inquiry) {
      return res.status(404).json({
        success: false,
        error: 'Inquiry not found',
      });
    }

    const quotation = await quotationGenerator.generateQuotation(inquiry);
    
    if (quotation.success) {
      inquiry.quotation = {
        generatedAt: new Date(),
        totalAmount: quotation.totalAmount,
        currency: quotation.currency,
        itemCount: quotation.itemCount,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        emailContent: quotation.html,
        quotationNumber: inquiry.quotation?.quotationNumber || inquiry.generateQuotationNumber(),
      };
      inquiry.status = 'quotation_ready';
      await inquiry.save();
    }

    res.json({
      success: quotation.success,
      quotation: quotation.success ? {
        quotationNumber: inquiry.quotation.quotationNumber,
        totalAmount: quotation.totalAmount,
        itemCount: quotation.itemCount,
      } : null,
      error: quotation.error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * API: Update inquiry status
 * PATCH /admin/api/email-inquiries/:id/status
 */
const updateInquiryStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['received', 'acknowledged', 'processing', 'searching', 
                          'quotation_ready', 'quotation_sent', 'order_created', 'failed', 'spam'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    const inquiry = await EmailInquiry.findById(req.params.id);
    
    if (!inquiry) {
      return res.status(404).json({
        success: false,
        error: 'Inquiry not found',
      });
    }

    inquiry.status = status;
    
    if (note) {
      inquiry.adminNotes.push({
        note: `Status changed to ${status}: ${note}`,
        addedBy: req.admin._id,
        addedAt: new Date(),
      });
    }

    await inquiry.save();

    res.json({
      success: true,
      status: inquiry.status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * API: Add admin note
 * POST /admin/api/email-inquiries/:id/notes
 */
const addNote = async (req, res) => {
  try {
    const { note } = req.body;
    
    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Note is required',
      });
    }

    const inquiry = await EmailInquiry.findById(req.params.id);
    
    if (!inquiry) {
      return res.status(404).json({
        success: false,
        error: 'Inquiry not found',
      });
    }

    inquiry.adminNotes.push({
      note: note.trim(),
      addedBy: req.admin._id,
      addedAt: new Date(),
    });

    await inquiry.save();

    res.json({
      success: true,
      note: inquiry.adminNotes[inquiry.adminNotes.length - 1],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * API: Mark as read/unread
 * PATCH /admin/api/email-inquiries/:id/read
 */
const markAsRead = async (req, res) => {
  try {
    const { isRead } = req.body;
    
    const inquiry = await EmailInquiry.findByIdAndUpdate(
      req.params.id,
      { isRead: isRead !== false },
      { new: true }
    );

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        error: 'Inquiry not found',
      });
    }

    res.json({
      success: true,
      isRead: inquiry.isRead,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * API: Delete inquiry
 * DELETE /admin/api/email-inquiries/:id
 */
const deleteInquiry = async (req, res) => {
  try {
    const inquiry = await EmailInquiry.findByIdAndDelete(req.params.id);
    
    if (!inquiry) {
      return res.status(404).json({
        success: false,
        error: 'Inquiry not found',
      });
    }

    res.json({
      success: true,
      message: 'Inquiry deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * API: Test email configuration
 * POST /admin/api/email-inquiries/test-config
 */
const testEmailConfig = async (req, res) => {
  try {
    const results = await emailInquiryScheduler.testConfiguration();
    res.json({
      success: results.imap.success && results.smtp.success,
      results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * API: Toggle scheduler
 * POST /admin/api/email-inquiries/scheduler/toggle
 */
const toggleScheduler = async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (enabled) {
      const initialized = await emailInquiryScheduler.initialize();
      if (initialized) {
        emailInquiryScheduler.start();
      }
    } else {
      emailInquiryScheduler.stop();
    }

    res.json({
      success: true,
      status: emailInquiryScheduler.getStatus(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * API: Get all inquiries (JSON)
 * GET /admin/api/email-inquiries
 */
const getInquiriesApi = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const query = status ? { status } : {};

    const [inquiries, total] = await Promise.all([
      EmailInquiry.find(query)
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-body.html -quotation.emailContent')
        .lean(),
      EmailInquiry.countDocuments(query),
    ]);

    res.json({
      success: true,
      inquiries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getEmailInquiries,
  getEmailInquiryDetails,
  getInquiryStats,
  triggerEmailCheck,
  retryInquiry,
  resendQuotation,
  regenerateQuotation,
  updateInquiryStatus,
  addNote,
  markAsRead,
  deleteInquiry,
  testEmailConfig,
  toggleScheduler,
  getInquiriesApi,
};
