/**
 * Email Inquiry Processor Service
 * AI-powered processing of email inquiries
 * Extracts parts from emails and attachments, searches for matches, generates quotations
 */
const EmailInquiry = require('../models/EmailInquiry');
const Buyer = require('../models/Buyer');
const emailService = require('./emailService');
const geminiService = require('./geminiService');
const elasticsearchService = require('./elasticsearchService');
const Part = require('../models/Part');
const quotationGenerator = require('./quotationGeneratorService');
const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * System instruction for email content analysis
 */
const EMAIL_ANALYSIS_INSTRUCTION = `You are an intelligent email analyzer for PartsForm, a B2B industrial parts marketplace. Your role is to analyze customer inquiry emails and extract parts information, understand customer intent, and provide structured data.

IMPORTANT: You MUST respond ONLY with valid JSON. No explanations, no markdown, no code blocks - just pure JSON.

When analyzing an email, extract:

1. **Parts Information**: Look for part numbers mentioned in the email body
   - PURELY NUMERIC part numbers (e.g., "8471474", "1234567")
   - ALPHANUMERIC part numbers (e.g., "CAF-000267", "SKF-12345")
   - Extract quantities if mentioned (e.g., "10 pcs", "qty: 5")
   - Look for brand names mentioned alongside parts

2. **Customer Intent**:
   - What are they looking for?
   - Is it urgent?
   - Any special requirements?

3. **Language Detection**: Detect the email's language

4. **Urgency Assessment**:
   - "urgent", "asap", "immediately" → urgent
   - "soon", "this week" → high
   - Normal inquiry → normal
   - General question → low

Respond ONLY with this exact JSON structure:
{
  "success": true,
  "summary": "Brief summary of the inquiry",
  "customerIntent": "What the customer is looking for",
  "urgency": "low/normal/high/urgent",
  "language": "en/ar/es/fr/etc",
  "partsFromBody": [
    {
      "partNumber": "extracted part number",
      "quantity": 1,
      "brand": "brand if mentioned or null",
      "context": "surrounding text for context"
    }
  ],
  "hasAttachment": true/false,
  "suggestions": ["any suggestions for processing"]
}`;

class EmailInquiryProcessor {
  constructor() {
    this.isProcessing = false;
    this.processingQueue = [];
  }

  /**
   * Process a single email into an inquiry
   * @param {Object} email - Formatted email object from emailService
   * @returns {Promise<Object>} Processing result
   */
  async processEmail(email) {
    const startTime = Date.now();
    let inquiry = null;

    try {
      // Skip no-reply and system emails (additional safety check)
      const senderEmail = (email.from?.email || '').toLowerCase();
      const skipPatterns = ['noreply', 'no-reply', 'mailer-daemon', 'postmaster', 'notifications@', 'alert@', 'donotreply', 'bounce', 'feedback@'];
      if (skipPatterns.some(pattern => senderEmail.includes(pattern))) {
        console.log(`⏭️  Skipping system email from: ${senderEmail}`);
        return { success: true, skipped: true, reason: 'system_email' };
      }

      // Check if email already processed (by messageId)
      const existing = await EmailInquiry.findOne({ messageId: email.messageId });
      if (existing) {
        console.log(`📧 Email ${email.messageId} already processed`);
        return { success: true, skipped: true, inquiry: existing };
      }

      // Create inquiry record
      inquiry = new EmailInquiry({
        messageId: email.messageId,
        from: email.from,
        to: email.to,
        subject: email.subject,
        body: email.body,
        receivedAt: email.receivedAt,
        status: 'received',
      });

      await inquiry.save();
      console.log(`📝 Created inquiry: ${inquiry._id}`);

      // Step 1: Send acknowledgment immediately
      const ackStartTime = Date.now();
      const language = await this.detectLanguage(email.body.text || email.subject);
      
      const ackResult = await emailService.sendAcknowledgment(
        email.from.email,
        email.from.name,
        email.subject,
        language
      );

      if (ackResult.success) {
        inquiry.status = 'acknowledged';
        inquiry.processingTime = {
          ...inquiry.processingTime,
          acknowledgementSent: Date.now() - ackStartTime,
        };
        await inquiry.save();
      }

      // Step 2: Process attachments
      const attachmentStartTime = Date.now();
      inquiry.status = 'processing';
      await inquiry.save();

      let allExtractedParts = [];
      
      // Process email body first
      const bodyAnalysis = await this.analyzeEmailBody(email.body.text || '');
      if (bodyAnalysis.success && bodyAnalysis.partsFromBody) {
        allExtractedParts.push(...bodyAnalysis.partsFromBody.map(p => ({
          ...p,
          source: 'email_body',
          confidence: 'medium',
        })));
      }

      // Update AI analysis
      inquiry.aiAnalysis = {
        summary: bodyAnalysis.summary || '',
        customerIntent: bodyAnalysis.customerIntent || '',
        urgency: bodyAnalysis.urgency || 'normal',
        language: bodyAnalysis.language || 'en',
        suggestions: bodyAnalysis.suggestions || [],
        processingNotes: [],
      };

      // Process attachments
      if (email.attachments && email.attachments.length > 0) {
        inquiry.aiAnalysis.processingNotes.push(`Processing ${email.attachments.length} attachment(s)`);
        
        for (const attachment of email.attachments) {
          try {
            // Save attachment
            const savedPath = await emailService.saveAttachment(attachment, inquiry._id.toString());
            
            // Parse attachment
            const parsed = await emailService.parseAttachment(attachment);
            
            const attachmentRecord = {
              filename: attachment.filename,
              contentType: attachment.contentType,
              size: attachment.size,
              path: savedPath,
              processed: parsed.success,
              partsExtracted: 0,
            };

            if (parsed.success && parsed.data) {
              // Use Gemini to analyze the attachment data
              const attachmentAnalysis = await geminiService.analyzeExcelData(parsed.data, {
                filename: attachment.filename,
              });

              if (attachmentAnalysis.success && attachmentAnalysis.parts) {
                const attachmentParts = attachmentAnalysis.parts.map(p => ({
                  ...p,
                  source: 'attachment',
                  sourceFile: attachment.filename,
                }));
                allExtractedParts.push(...attachmentParts);
                attachmentRecord.partsExtracted = attachmentParts.length;
              }
            }

            inquiry.attachments.push(attachmentRecord);
          } catch (attError) {
            console.error(`Error processing attachment ${attachment.filename}:`, attError.message);
            inquiry.aiAnalysis.processingNotes.push(`Error processing ${attachment.filename}: ${attError.message}`);
          }
        }
      }

      inquiry.processingTime.partsExtracted = Date.now() - attachmentStartTime;

      // Deduplicate parts
      const uniqueParts = this.deduplicateParts(allExtractedParts);
      inquiry.extractedParts = uniqueParts.map(p => ({
        partNumber: p.partNumber,
        quantity: p.quantity || 1,
        brand: p.brand,
        description: p.description,
        confidence: p.confidence || 'medium',
        originalText: p.originalText || p.context,
        found: false,
        searchResults: [],
      }));
      inquiry.totalPartsRequested = inquiry.extractedParts.length;

      await inquiry.save();
      console.log(`🔍 Extracted ${inquiry.extractedParts.length} unique parts`);

      // Step 3: Search for parts
      const searchStartTime = Date.now();
      inquiry.status = 'searching';
      await inquiry.save();

      if (inquiry.extractedParts.length > 0) {
        const searchResult = await this.searchForParts(inquiry.extractedParts);
        
        inquiry.extractedParts = searchResult.parts;
        inquiry.totalPartsFound = searchResult.found;
        inquiry.totalPartsNotFound = searchResult.notFound;
      }

      inquiry.processingTime.searchCompleted = Date.now() - searchStartTime;
      await inquiry.save();

      // Step 4: Generate and send quotation
      const quotationStartTime = Date.now();
      
      // Try to link to existing buyer
      const buyer = await Buyer.findOne({ email: email.from.email });
      if (buyer) {
        inquiry.buyer = buyer._id;
        inquiry.aiAnalysis.processingNotes.push(`Linked to existing buyer: ${buyer.company || buyer.email}`);
      }

      // Generate quotation
      const quotation = await quotationGenerator.generateQuotation(inquiry);
      
      if (quotation.success) {
        inquiry.quotation = {
          generatedAt: new Date(),
          totalAmount: quotation.totalAmount,
          currency: quotation.currency,
          itemCount: quotation.itemCount,
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          emailContent: quotation.html,
          quotationNumber: inquiry.generateQuotationNumber(),
        };

        inquiry.status = 'quotation_ready';
        await inquiry.save();

        // Send quotation email
        const sendResult = await emailService.sendEmail({
          to: email.from.email,
          subject: `PartsForm Quotation #${inquiry.quotation.quotationNumber} - ${email.subject}`,
          text: quotation.text,
          html: quotation.html,
        });

        if (sendResult.success) {
          inquiry.quotation.sentAt = new Date();
          inquiry.status = 'quotation_sent';
        }
      }

      inquiry.processingTime.quotationGenerated = Date.now() - quotationStartTime;
      inquiry.processingTime.totalTime = Date.now() - startTime;
      
      await inquiry.save();

      // Mark email as read in IMAP
      if (email.uid) {
        await emailService.markAsRead(email.uid);
      }

      console.log(`✅ Inquiry ${inquiry._id} processed in ${inquiry.processingTime.totalTime}ms`);
      
      return {
        success: true,
        inquiry,
        processingTime: inquiry.processingTime.totalTime,
      };

    } catch (error) {
      console.error('Email processing error:', error);
      
      if (inquiry) {
        inquiry.status = 'failed';
        inquiry.error = {
          message: error.message,
          stack: error.stack,
          occurredAt: new Date(),
        };
        await inquiry.save();
      }

      return {
        success: false,
        error: error.message,
        inquiry,
      };
    }
  }

  /**
   * Analyze email body using Gemini AI
   * @param {string} bodyText - Email body text
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeEmailBody(bodyText) {
    try {
      // Check if API key is configured
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key-here') {
        console.warn('⚠️  Gemini API key not configured - skipping AI analysis');
        return {
          success: false,
          partsFromBody: [],
          summary: 'AI analysis skipped - API key not configured',
          customerIntent: 'Unknown',
          urgency: 'normal',
          language: 'en',
        };
      }

      if (!bodyText || bodyText.trim().length < 10) {
        return {
          success: true,
          partsFromBody: [],
          summary: 'Email body is empty or too short',
          customerIntent: 'Unknown',
          urgency: 'normal',
          language: 'en',
        };
      }

      const prompt = `${EMAIL_ANALYSIS_INSTRUCTION}

Analyze this customer inquiry email:

---
${bodyText.substring(0, 3000)}
---

Remember: Respond with ONLY valid JSON, no markdown formatting, no code blocks.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      });

      let text = response.text.trim();
      text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        text = jsonMatch[0];
      }

      return JSON.parse(text);
    } catch (error) {
      console.error('Email body analysis error:', error.message);
      // Return graceful fallback instead of crashing
      return {
        success: false,
        partsFromBody: [],
        summary: 'AI analysis failed',
        customerIntent: 'Unknown',
        urgency: 'normal',
        language: 'en',
        error: error.message,
      };
    }
  }

  /**
   * Detect language of text
   * @param {string} text - Text to analyze
   * @returns {Promise<string>} Language code
   */
  async detectLanguage(text) {
    try {
      // Simple language detection based on character patterns
      if (/[\u0600-\u06FF]/.test(text)) return 'ar';
      if (/[\u0400-\u04FF]/.test(text)) return 'ru';
      if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
      
      // Default to English
      return 'en';
    } catch {
      return 'en';
    }
  }

  /**
   * Deduplicate parts list
   * @param {Array} parts - Array of parts
   * @returns {Array} Deduplicated parts
   */
  deduplicateParts(parts) {
    const seen = new Map();
    
    for (const part of parts) {
      const key = part.partNumber?.toUpperCase();
      if (!key) continue;
      
      if (!seen.has(key)) {
        seen.set(key, part);
      } else {
        // Merge quantities
        const existing = seen.get(key);
        existing.quantity = (existing.quantity || 1) + (part.quantity || 1);
        // Keep higher confidence
        if (part.confidence === 'high' && existing.confidence !== 'high') {
          existing.confidence = 'high';
        }
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Search for parts in database
   * @param {Array} extractedParts - Array of extracted parts
   * @returns {Promise<Object>} Search results
   */
  async searchForParts(extractedParts) {
    const partNumbers = extractedParts.map(p => p.partNumber);
    let found = 0;
    let notFound = 0;

    // Try Elasticsearch first
    const useElasticsearch = await elasticsearchService.hasDocuments();
    let searchResults = [];

    if (useElasticsearch) {
      try {
        const esResult = await elasticsearchService.searchMultiplePartNumbers(partNumbers, {
          limitPerPart: 10,
        });
        searchResults = esResult.results;
      } catch (error) {
        console.error('ES search error:', error.message);
      }
    }

    // Fallback to MongoDB if needed
    if (searchResults.length === 0) {
      const upperCaseParts = partNumbers.map(pn => pn.toUpperCase());
      searchResults = await Part.find({
        partNumber: { $in: upperCaseParts },
      }).limit(500).lean();
    }

    // Group results by part number
    const resultsByPart = {};
    for (const result of searchResults) {
      const pn = result.partNumber?.toUpperCase();
      if (!resultsByPart[pn]) {
        resultsByPart[pn] = [];
      }
      resultsByPart[pn].push(result);
    }

    // Update extracted parts with search results
    const updatedParts = extractedParts.map(part => {
      const pn = part.partNumber?.toUpperCase();
      const results = resultsByPart[pn] || [];
      
      if (results.length > 0) {
        found++;
        
        // Find best match (lowest price, in stock)
        const sortedResults = results.sort((a, b) => {
          // Prioritize in-stock items
          const aInStock = (a.quantity || 0) >= (part.quantity || 1);
          const bInStock = (b.quantity || 0) >= (part.quantity || 1);
          if (aInStock !== bInStock) return bInStock ? 1 : -1;
          
          // Then by price
          return (a.price || 0) - (b.price || 0);
        });

        const best = sortedResults[0];
        
        // Ensure partId is always a string
        const getPartId = (r) => r._id ? (typeof r._id === 'string' ? r._id : r._id.toString()) : null;
        
        return {
          ...part,
          found: true,
          searchResults: sortedResults.slice(0, 10).map(r => ({
            partId: getPartId(r),
            partNumber: r.partNumber,
            brand: r.brand,
            supplier: r.supplier,
            price: r.price,
            currency: r.currency || 'AED',
            quantity: r.quantity,
            deliveryDays: r.deliveryDays,
            selected: getPartId(r) === getPartId(best),
          })),
          bestMatch: {
            partId: getPartId(best),
            partNumber: best.partNumber,
            brand: best.brand,
            supplier: best.supplier,
            price: best.price,
            currency: best.currency || 'AED',
            quantity: best.quantity,
            deliveryDays: best.deliveryDays,
            reason: this.generateMatchReason(best, part.quantity),
          },
        };
      } else {
        notFound++;
        return {
          ...part,
          found: false,
          searchResults: [],
          bestMatch: null,
        };
      }
    });

    return {
      parts: updatedParts,
      found,
      notFound,
      totalResults: searchResults.length,
    };
  }

  /**
   * Generate reason for best match selection
   */
  generateMatchReason(part, requestedQty) {
    const reasons = [];
    
    if ((part.quantity || 0) >= (requestedQty || 1)) {
      reasons.push('In stock');
    } else if (part.quantity > 0) {
      reasons.push(`${part.quantity} available`);
    }
    
    if (part.price) {
      reasons.push(`$${part.price.toFixed(2)}`);
    }
    
    if (part.deliveryDays <= 3) {
      reasons.push('Fast delivery');
    }
    
    if (part.brand) {
      reasons.push(part.brand);
    }
    
    return reasons.join(' • ') || 'Best available option';
  }

  /**
   * Process all new emails in inbox
   * @returns {Promise<Object>} Processing summary
   */
  async processNewEmails() {
    if (this.isProcessing) {
      console.log('⏳ Already processing emails, skipping...');
      return { skipped: true };
    }

    this.isProcessing = true;
    const results = {
      total: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Fetch new emails
      const emails = await emailService.fetchNewEmails();
      results.total = emails.length;

      if (emails.length === 0) {
        console.log('📭 No new emails to process');
        return results;
      }

      console.log(`📬 Processing ${emails.length} new emails...`);

      // Process each email
      for (const rawEmail of emails) {
        try {
          const email = emailService.formatEmail(rawEmail);
          const result = await this.processEmail(email);
          
          if (result.skipped) {
            results.skipped++;
          } else if (result.success) {
            results.processed++;
          } else {
            results.failed++;
            results.errors.push(result.error);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(error.message);
        }
      }

      console.log(`✅ Email processing complete: ${results.processed} processed, ${results.failed} failed, ${results.skipped} skipped`);
      
    } catch (error) {
      console.error('Email batch processing error:', error);
      results.errors.push(error.message);
    } finally {
      this.isProcessing = false;
    }

    return results;
  }

  /**
   * Process only the latest N emails (called from IDLE mode)
   * @param {number} numNewMsgs - Number of new messages detected
   * @returns {Promise<Object>} Processing summary
   */
  async processLatestEmails(numNewMsgs = 1) {
    if (this.isProcessing) {
      console.log('⏳ Already processing emails, skipping...');
      return { skipped: true };
    }

    this.isProcessing = true;
    const results = {
      total: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Fetch ONLY the latest emails that just arrived
      const emails = await emailService.fetchLatestEmails(numNewMsgs);
      results.total = emails.length;

      if (emails.length === 0) {
        console.log('📭 No new emails to process');
        return results;
      }

      console.log(`📬 Processing ${emails.length} newly arrived email(s)...`);

      // Process each email
      for (const rawEmail of emails) {
        try {
          const email = emailService.formatEmail(rawEmail);
          const result = await this.processEmail(email);
          
          if (result.skipped) {
            results.skipped++;
          } else if (result.success) {
            results.processed++;
          } else {
            results.failed++;
            results.errors.push(result.error);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(error.message);
        }
      }

      console.log(`✅ Email processing complete: ${results.processed} processed, ${results.failed} failed, ${results.skipped} skipped`);
      
    } catch (error) {
      console.error('Email batch processing error:', error);
      results.errors.push(error.message);
    } finally {
      this.isProcessing = false;
    }

    return results;
  }

  /**
   * Retry failed inquiry
   * @param {string} inquiryId - Inquiry ID
   * @returns {Promise<Object>} Retry result
   */
  async retryInquiry(inquiryId) {
    try {
      const inquiry = await EmailInquiry.findById(inquiryId);
      if (!inquiry) {
        return { success: false, error: 'Inquiry not found' };
      }

      if (inquiry.status !== 'failed') {
        return { success: false, error: 'Inquiry is not in failed status' };
      }

      inquiry.error.retryCount = (inquiry.error.retryCount || 0) + 1;
      inquiry.status = 'received';
      await inquiry.save();

      // Reprocess
      const email = {
        messageId: inquiry.messageId,
        from: inquiry.from,
        to: inquiry.to,
        subject: inquiry.subject,
        body: inquiry.body,
        receivedAt: inquiry.receivedAt,
        attachments: [],
      };

      return this.processEmail(email);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const emailInquiryProcessor = new EmailInquiryProcessor();

module.exports = emailInquiryProcessor;
