/**
 * Quotation Generator Service
 * Generates professional HTML/text quotations for email inquiries
 */

class QuotationGeneratorService {
  constructor() {
    this.companyInfo = {
      name: process.env.COMPANY_NAME || 'PartsForm',
      address: process.env.COMPANY_ADDRESS || 'Global Industrial Parts Sourcing',
      phone: process.env.COMPANY_PHONE || '',
      email: process.env.COMPANY_EMAIL || 'sales@partsform.com',
      website: process.env.COMPANY_WEBSITE || 'https://partsform.com',
      logo: process.env.COMPANY_LOGO_URL || '',
    };
    
    this.defaultCurrency = process.env.DEFAULT_CURRENCY || 'AED';
    this.defaultValidityDays = 7;
  }

  /**
   * Generate quotation from inquiry
   * @param {Object} inquiry - EmailInquiry document
   * @returns {Promise<Object>} Quotation content
   */
  async generateQuotation(inquiry) {
    try {
      const quotationNumber = inquiry.quotation?.quotationNumber || this.generateQuotationNumber();
      const validUntil = new Date(Date.now() + this.defaultValidityDays * 24 * 60 * 60 * 1000);
      
      // Calculate totals
      const { items, totals, notFoundParts } = this.calculateQuotationItems(inquiry);
      
      // Generate HTML content
      const html = this.generateHtmlQuotation({
        quotationNumber,
        validUntil,
        customer: {
          name: inquiry.from.name || 'Valued Customer',
          email: inquiry.from.email,
          company: inquiry.buyer?.company || '',
        },
        items,
        totals,
        notFoundParts,
        originalSubject: inquiry.subject,
        urgency: inquiry.aiAnalysis?.urgency || 'normal',
      });

      // Generate plain text version
      const text = this.generateTextQuotation({
        quotationNumber,
        validUntil,
        customer: {
          name: inquiry.from.name || 'Valued Customer',
          email: inquiry.from.email,
        },
        items,
        totals,
        notFoundParts,
      });

      return {
        success: true,
        quotationNumber,
        html,
        text,
        totalAmount: totals.grandTotal,
        currency: this.defaultCurrency,
        itemCount: items.length,
        validUntil,
      };
    } catch (error) {
      console.error('Quotation generation error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate unique quotation number
   */
  generateQuotationNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `QT-${year}${month}${day}-${random}`;
  }

  /**
   * Calculate quotation items and totals
   * @param {Object} inquiry - EmailInquiry document
   */
  calculateQuotationItems(inquiry) {
    const items = [];
    const notFoundParts = [];
    let subtotal = 0;

    for (const part of inquiry.extractedParts || []) {
      if (part.found && part.bestMatch) {
        const unitPrice = part.bestMatch.price || 0;
        const quantity = part.quantity || 1;
        const lineTotal = unitPrice * quantity;
        
        items.push({
          partNumber: part.partNumber,
          description: part.description || part.bestMatch.partNumber,
          brand: part.bestMatch.brand || part.brand || '-',
          supplier: part.bestMatch.supplier || '-',
          quantity,
          unitPrice,
          lineTotal,
          currency: part.bestMatch.currency || this.defaultCurrency,
          availability: part.bestMatch.quantity >= quantity ? 'In Stock' : 
                       part.bestMatch.quantity > 0 ? `${part.bestMatch.quantity} Available` : 'On Request',
          deliveryDays: part.bestMatch.deliveryDays || 'TBD',
          alternatives: part.searchResults?.length > 1 ? part.searchResults.length - 1 : 0,
        });
        
        subtotal += lineTotal;
      } else {
        notFoundParts.push({
          partNumber: part.partNumber,
          quantity: part.quantity || 1,
          brand: part.brand || '-',
          note: 'Part not found in inventory - we will source separately',
        });
      }
    }

    // Calculate totals
    const vat = 0; // Configure as needed
    const vatAmount = subtotal * (vat / 100);
    const grandTotal = subtotal + vatAmount;

    return {
      items,
      notFoundParts,
      totals: {
        subtotal,
        vat,
        vatAmount,
        grandTotal,
        currency: this.defaultCurrency,
        itemCount: items.length,
      },
    };
  }

  /**
   * Generate HTML quotation
   */
  generateHtmlQuotation(data) {
    const { quotationNumber, validUntil, customer, items, totals, notFoundParts, originalSubject, urgency } = data;
    
    const formatCurrency = (amount, currency = this.defaultCurrency) => {
      return `${currency} ${amount.toFixed(2)}`;
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    const urgencyBadge = urgency === 'urgent' || urgency === 'high' 
      ? '<span style="background-color: #dc2626; color: #ffffff; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">PRIORITY</span>'
      : '';

    const itemsHtml = items.map((item, index) => `
      <tr>
        <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; text-align: center; font-size: 14px;">${index + 1}</td>
        <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #1a2b3d; font-size: 15px;" class="dark-text">${item.partNumber}</span>
          ${item.alternatives > 0 ? `<br><span style="font-size: 12px; color: #2b5278;">+${item.alternatives} options</span>` : ''}
        </td>
        <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 14px;" class="dark-border dark-text-muted">${item.brand}</td>
        <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #1a2b3d; font-size: 15px;" class="dark-border dark-text">${item.quantity}</td>
        <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #475569; font-size: 14px;" class="dark-border dark-text-muted">${formatCurrency(item.unitPrice)}</td>
        <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #1a2b3d; font-size: 15px;" class="dark-border dark-text">${formatCurrency(item.lineTotal)}</td>
        <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;" class="dark-border">
          ${item.availability === 'In Stock' ? `
            <span style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; line-height: 1;">
              <span style="display: inline-block; margin-right: 4px;">✓</span>In<br>Stock
            </span>
          ` : item.availability === 'Low Stock' ? `
            <span style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; line-height: 1;">
              <span style="display: inline-block; margin-right: 4px;">!</span>Low<br>Stock
            </span>
          ` : item.availability === 'Out of Stock' ? `
            <span style="display: inline-block; background-color: #ef4444; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; line-height: 1;">
              <span style="display: inline-block; margin-right: 4px;">✗</span>Out of<br>Stock
            </span>
          ` : `
            <span style="display: inline-block; background-color: #6b7280; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; line-height: 1;">
              ${item.availability || 'TBD'}
            </span>
          `}
        </td>
        <td style="padding: 16px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569; font-size: 14px;" class="dark-border dark-text-muted">${item.deliveryDays}d</td>
      </tr>
    `).join('');

    const notFoundHtml = notFoundParts.length > 0 ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
        <tr>
          <td style="background-color: #fef3c7; padding: 24px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size: 16px; font-weight: 600; color: #92400e; padding-bottom: 12px;">Parts Being Sourced (${notFoundParts.length})</td>
              </tr>
              <tr>
                <td style="font-size: 14px; color: #78350f; padding-bottom: 16px;">We'll source these parts and update you separately:</td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 6px;">
                    <tr style="background-color: #fef3c7;">
                      <td style="padding: 12px; font-weight: 600; color: #92400e; font-size: 13px;">Part Number</td>
                      <td style="padding: 12px; font-weight: 600; color: #92400e; font-size: 13px; text-align: center; width: 80px;">Qty</td>
                      <td style="padding: 12px; font-weight: 600; color: #92400e; font-size: 13px;">Brand</td>
                    </tr>
                    ${notFoundParts.map(p => `
                      <tr>
                        <td style="padding: 12px; color: #78350f; font-size: 14px; font-weight: 500;">${p.partNumber}</td>
                        <td style="padding: 12px; color: #78350f; font-size: 14px; text-align: center;">${p.quantity}</td>
                        <td style="padding: 12px; color: #78350f; font-size: 14px;">${p.brand}</td>
                      </tr>
                    `).join('')}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    ` : '';

    return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Quotation ${quotationNumber}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    @media (prefers-color-scheme: dark) {
      .dark-bg { background-color: #1a1a1a !important; }
      .dark-text { color: #e5e5e5 !important; }
      .dark-text-muted { color: #a3a3a3 !important; }
      .dark-card { background-color: #262626 !important; }
      .dark-border { border-color: #404040 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <!-- Wrapper Table -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;" class="dark-bg">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);" class="dark-card">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #2b5278; padding: 40px 32px; text-align: center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">QUOTATION</td>
                </tr>
                <tr>
                  <td style="padding-top: 8px;">
                    <span style="font-size: 15px; color: rgba(255,255,255,0.85);">${this.companyInfo.name}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Quotation Info Bar -->
          <tr>
            <td style="background-color: #f8fafb; padding: 24px 32px; border-bottom: 1px solid #e2e8f0;" class="dark-card dark-border">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="vertical-align: top;">
                    <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;" class="dark-text-muted">Quotation No.</span>
                    <br>
                    <span style="font-size: 18px; font-weight: 700; color: #2b5278;">${quotationNumber}</span>
                  </td>
                  <td width="33%" style="vertical-align: top; text-align: center;">
                    <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;" class="dark-text-muted">Date</span>
                    <br>
                    <span style="font-size: 15px; color: #1a2b3d; font-weight: 500;" class="dark-text">${formatDate(new Date())}</span>
                  </td>
                  <td width="33%" style="vertical-align: top; text-align: right;">
                    <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;" class="dark-text-muted">Valid Until</span>
                    <br>
                    <span style="font-size: 15px; color: #dc2626; font-weight: 600;">${formatDate(validUntil)}</span>
                  </td>
                </tr>
              </table>
              ${urgencyBadge ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 16px;"><tr><td>${urgencyBadge}</td></tr></table>` : ''}
            </td>
          </tr>
          
          <!-- Customer Info -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #e2e8f0;" class="dark-border">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="vertical-align: top;">
                    <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;" class="dark-text-muted">Prepared For</span>
                    <br>
                    <span style="font-size: 16px; font-weight: 600; color: #1a2b3d;" class="dark-text">${customer.name}</span>
                    <br>
                    <span style="font-size: 14px; color: #64748b;" class="dark-text-muted">${customer.email}</span>
                    ${customer.company ? `<br><span style="font-size: 14px; color: #64748b;" class="dark-text-muted">${customer.company}</span>` : ''}
                  </td>
                  <td width="50%" style="vertical-align: top; text-align: right;">
                    <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;" class="dark-text-muted">Reference</span>
                    <br>
                    <span style="font-size: 14px; color: #475569; max-width: 200px; display: inline-block; word-wrap: break-word;" class="dark-text-muted">${originalSubject || 'Parts Inquiry'}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Items Section -->
          <tr>
            <td style="padding: 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td>
                    <span style="font-size: 18px; font-weight: 600; color: #1a2b3d;" class="dark-text">Quoted Items</span>
                    <span style="font-size: 14px; color: #64748b; margin-left: 8px;" class="dark-text-muted">(${items.length} items)</span>
                  </td>
                </tr>
              </table>
              
              ${items.length > 0 ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;" class="dark-border">
                  <tr style="background-color: #f8fafb;" class="dark-card">
                    <th style="padding: 14px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;" class="dark-text-muted dark-border">#</th>
                    <th style="padding: 14px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;" class="dark-text-muted dark-border">Part Number</th>
                    <th style="padding: 14px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;" class="dark-text-muted dark-border">Brand</th>
                    <th style="padding: 14px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;" class="dark-text-muted dark-border">Qty</th>
                    <th style="padding: 14px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;" class="dark-text-muted dark-border">Price</th>
                    <th style="padding: 14px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;" class="dark-text-muted dark-border">Total</th>
                    <th style="padding: 14px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;" class="dark-text-muted dark-border">Status</th>
                    <th style="padding: 14px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;" class="dark-text-muted dark-border">ETA</th>
                  </tr>
                  ${itemsHtml}
                </table>
                
                <!-- Totals -->
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-left: auto; margin-top: 24px; min-width: 260px;">
                  <tr>
                    <td style="padding: 10px 16px; text-align: right; color: #64748b; font-size: 14px;" class="dark-text-muted">Subtotal</td>
                    <td style="padding: 10px 16px; text-align: right; font-weight: 500; color: #1a2b3d; font-size: 15px;" class="dark-text">${formatCurrency(totals.subtotal)}</td>
                  </tr>
                  ${totals.vat > 0 ? `
                    <tr>
                      <td style="padding: 10px 16px; text-align: right; color: #64748b; font-size: 14px;" class="dark-text-muted">VAT (${totals.vat}%)</td>
                      <td style="padding: 10px 16px; text-align: right; color: #475569; font-size: 14px;" class="dark-text">${formatCurrency(totals.vatAmount)}</td>
                    </tr>
                  ` : ''}
                  <tr>
                    <td colspan="2" style="padding: 0;"><div style="height: 1px; background-color: #e2e8f0; margin: 8px 0;" class="dark-border"></div></td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 16px; text-align: right; font-size: 16px; font-weight: 600; color: #1a2b3d;" class="dark-text">Total</td>
                    <td style="padding: 12px 16px; text-align: right; font-size: 22px; font-weight: 700; color: #2b5278;">${formatCurrency(totals.grandTotal)}</td>
                  </tr>
                </table>
              ` : `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="text-align: center; padding: 48px 24px; background-color: #f8fafb; border-radius: 8px;" class="dark-card">
                      <span style="font-size: 15px; color: #64748b;" class="dark-text-muted">No items from inventory. All parts will be sourced separately.</span>
                    </td>
                  </tr>
                </table>
              `}
              
              ${notFoundHtml}
            </td>
          </tr>
          
          <!-- Terms -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafb; border-top: 1px solid #e2e8f0;" class="dark-card dark-border">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 13px; font-weight: 600; color: #475569; padding-bottom: 12px;" class="dark-text">Terms & Conditions</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; line-height: 1.7;" class="dark-text-muted">
                    • Valid until ${formatDate(validUntil)}<br>
                    • Prices in ${this.defaultCurrency}, subject to market conditions<br>
                    • Delivery times are estimates
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CTA -->
          <tr>
            <td style="padding: 32px; text-align: center; border-top: 1px solid #e2e8f0;" class="dark-border">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="font-size: 15px; color: #475569; padding-bottom: 20px;" class="dark-text-muted">Ready to order? Reply to this email or click below.</td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="mailto:${this.companyInfo.email}?subject=Order%20-%20${quotationNumber}" 
                       style="display: inline-block; background-color: #2b5278; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      Place Order
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1a2b3d; padding: 32px; text-align: center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 17px; font-weight: 600; color: #ffffff; padding-bottom: 8px;">${this.companyInfo.name}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.8;">
                    ${this.companyInfo.address}<br>
                    ${this.companyInfo.phone ? `${this.companyInfo.phone} • ` : ''}${this.companyInfo.email}
                    ${this.companyInfo.website ? `<br><a href="${this.companyInfo.website}" style="color: #3b82f6; text-decoration: none;">${this.companyInfo.website}</a>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
        <!-- Email Footer Note -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; margin-top: 16px;">
          <tr>
            <td style="text-align: center; font-size: 11px; color: #94a3b8;" class="dark-text-muted">
              Automated quotation • ${new Date().getFullYear()} ${this.companyInfo.name}
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
`;
  }

  /**
   * Generate plain text quotation
   */
  generateTextQuotation(data) {
    const { quotationNumber, validUntil, customer, items, totals, notFoundParts } = data;
    
    const formatCurrency = (amount, currency = this.defaultCurrency) => {
      return `${currency} ${amount.toFixed(2)}`;
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const separator = '='.repeat(60);
    const subSeparator = '-'.repeat(60);

    let text = `
${separator}
                          QUOTATION
                      ${this.companyInfo.name}
${separator}

Quotation Number: ${quotationNumber}
Date: ${formatDate(new Date())}
Valid Until: ${formatDate(validUntil)}

${subSeparator}
PREPARED FOR:
${customer.name}
${customer.email}
${separator}

QUOTED ITEMS (${items.length}):
${subSeparator}
`;

    if (items.length > 0) {
      items.forEach((item, index) => {
        text += `
${index + 1}. ${item.partNumber}
   Brand: ${item.brand} | Qty: ${item.quantity}
   Unit Price: ${formatCurrency(item.unitPrice)}
   Line Total: ${formatCurrency(item.lineTotal)}
   Status: ${item.availability}
   Delivery: ${item.deliveryDays} days
`;
      });

      text += `
${subSeparator}
                                    Subtotal: ${formatCurrency(totals.subtotal)}
${totals.vat > 0 ? `                                    VAT (${totals.vat}%): ${formatCurrency(totals.vatAmount)}` : ''}
                                    GRAND TOTAL: ${formatCurrency(totals.grandTotal)}
${separator}
`;
    } else {
      text += `
No items could be quoted from inventory.
All requested parts will be sourced separately.
`;
    }

    if (notFoundParts.length > 0) {
      text += `
PARTS BEING SOURCED (${notFoundParts.length}):
${subSeparator}
`;
      notFoundParts.forEach(p => {
        text += `- ${p.partNumber} (Qty: ${p.quantity}) - ${p.brand}\n`;
      });
      text += `
These parts are not in our current inventory.
Our team will source them and provide pricing separately.
${separator}
`;
    }

    text += `
TERMS & CONDITIONS:
- This quotation is valid until ${formatDate(validUntil)}
- Prices are in ${this.defaultCurrency}
- Delivery times are estimates
- Payment terms as per company policy

${separator}
To place an order, reply to this email.

${this.companyInfo.name}
${this.companyInfo.address}
${this.companyInfo.email}
${this.companyInfo.website || ''}
${separator}
`;

    return text;
  }
}

// Singleton instance
const quotationGenerator = new QuotationGeneratorService();

module.exports = quotationGenerator;
