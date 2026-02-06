# Email Inquiry System - Configuration Guide

## Overview

The Email Inquiry System automatically processes incoming customer emails containing parts inquiries. When a customer sends an email with an Excel file, CSV, or text listing parts they need, the system:

1. **Receives** the email automatically
2. **Acknowledges** with an immediate auto-reply
3. **Extracts** parts from attachments using AI
4. **Searches** for parts in your inventory
5. **Generates** a professional quotation
6. **Sends** the quotation back to the customer

## Required Environment Variables

Add these to your `.env` file:

### IMAP Settings (Receiving Emails)
```env
# IMAP server for receiving emails
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_IMAP_USER=inquiries@yourcompany.com
EMAIL_IMAP_PASSWORD=your-app-password
EMAIL_IMAP_TLS=true

# Mailbox to monitor (usually INBOX)
EMAIL_MAILBOX=INBOX
```

### SMTP Settings (Sending Emails)
```env
# SMTP server for sending emails
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=inquiries@yourcompany.com
EMAIL_SMTP_PASSWORD=your-app-password
EMAIL_SMTP_SECURE=false

# Sender information shown on emails
EMAIL_SENDER_NAME=PartsForm Quotations
EMAIL_SENDER_ADDRESS=inquiries@yourcompany.com
```

### Processing Settings
```env
# Enable/disable email processing
EMAIL_PROCESSING_ENABLED=true

# How often to check for new emails (in minutes)
EMAIL_CHECK_INTERVAL=2

# Max emails to process per batch
EMAIL_BATCH_SIZE=10

# Retry failed inquiries
EMAIL_RETRY_FAILED=true
EMAIL_RETRY_INTERVAL_HOURS=1
```

### Company Information (for Quotations)
```env
COMPANY_NAME=PartsForm
COMPANY_ADDRESS=Your Company Address
COMPANY_PHONE=+1234567890
COMPANY_EMAIL=sales@yourcompany.com
COMPANY_WEBSITE=https://partsform.com
COMPANY_LOGO_URL=https://yourcompany.com/logo.png

# Default currency for quotations
DEFAULT_CURRENCY=AED
```

## Gmail Setup

If using Gmail, you need to create an App Password:

1. Go to Google Account → Security
2. Enable 2-Step Verification if not already enabled
3. Go to "App passwords"
4. Select "Mail" and your device
5. Generate and copy the 16-character password
6. Use this as `EMAIL_IMAP_PASSWORD` and `EMAIL_SMTP_PASSWORD`

**Gmail Settings:**
```env
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
```

## Outlook/Office 365 Setup

```env
EMAIL_IMAP_HOST=outlook.office365.com
EMAIL_IMAP_PORT=993
EMAIL_SMTP_HOST=smtp.office365.com
EMAIL_SMTP_PORT=587
```

## Custom Mail Server Setup

```env
EMAIL_IMAP_HOST=mail.yourserver.com
EMAIL_IMAP_PORT=993
EMAIL_IMAP_TLS=true
EMAIL_SMTP_HOST=mail.yourserver.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
```

## How It Works

### 1. Email Reception
- The system checks for new emails every X minutes (configurable)
- Only processes unread emails from the configured inbox
- Marks emails as read after processing

### 2. Auto-Acknowledgment
When a new email arrives, the customer immediately receives:
```
Subject: RE: [Original Subject] - Your Inquiry Received

We have received your parts inquiry and our AI-powered system 
is now processing your request. You'll receive a detailed 
quotation within 5-15 minutes.
```

### 3. AI Processing
The system:
- Analyzes the email body for part numbers
- Parses Excel/CSV attachments using AI
- Extracts part numbers, quantities, and brands
- Handles various formats and poorly structured data

### 4. Parts Search
For each extracted part:
- Searches your Elasticsearch/MongoDB inventory
- Finds all available options from different suppliers
- Selects the best match (in-stock, best price, fast delivery)

### 5. Quotation Generation
Creates a professional HTML quotation including:
- Company branding
- All quoted items with prices
- Availability status
- Delivery estimates
- Parts not found (marked for manual sourcing)
- Valid until date

## Admin Dashboard

Access the Email Inquiries dashboard at:
```
https://yoursite.com/admin/email-inquiries
```

Features:
- View all incoming inquiries
- See processing status (received → acknowledged → processing → quotation sent)
- View extracted parts and search results
- Resend quotations
- Retry failed inquiries
- Add admin notes
- Manual email check trigger

## Supported File Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| Excel | .xlsx, .xls | Full support with AI parsing |
| CSV | .csv | Full support |
| Text | .txt | Basic parsing |

## Email Processing Flow

```
Customer sends email
       ↓
IMAP fetches email (every 2 min)
       ↓
Save to EmailInquiry collection
       ↓
Send acknowledgment (instant)
       ↓
Parse attachments with AI
       ↓
Extract part numbers
       ↓
Search Elasticsearch/MongoDB
       ↓
Find best matches
       ↓
Generate quotation HTML
       ↓
Send quotation email
       ↓
Update status: quotation_sent
```

## Troubleshooting

### Email Not Being Received
1. Check IMAP credentials in admin → Test Config
2. Verify the mailbox name (usually "INBOX")
3. Check if firewall allows port 993 (IMAP)

### Quotation Not Sending
1. Check SMTP credentials
2. Verify sender email is authorized
3. Check email rate limits

### Parts Not Found
1. Ensure Elasticsearch is running and indexed
2. Check if part numbers in email match inventory format
3. Review AI analysis in inquiry details

### Processing Stuck
1. Check server logs for errors
2. Use "Retry" button in admin dashboard
3. Review error message in inquiry details

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/email-inquiries` | GET | List all inquiries |
| `/admin/email-inquiries/:id` | GET | Inquiry details |
| `/admin/api/email-inquiries/check-now` | POST | Manual email check |
| `/admin/api/email-inquiries/test-config` | POST | Test email config |
| `/admin/api/email-inquiries/:id/retry` | POST | Retry failed inquiry |
| `/admin/api/email-inquiries/:id/resend-quotation` | POST | Resend quotation |

## Security Notes

1. Never commit `.env` file to version control
2. Use App Passwords instead of main account passwords
3. Consider using a dedicated email address for inquiries
4. Monitor failed login attempts in email provider

## Performance Considerations

- Processing time depends on:
  - Number of parts in inquiry
  - Elasticsearch cluster size
  - Email server response time
  
- Typical processing: 5-30 seconds per inquiry
- Recommended: Process max 10 emails per batch
- Scale with multiple worker processes if needed
