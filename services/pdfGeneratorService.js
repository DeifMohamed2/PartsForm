/**
 * PDF Generator Service
 * Generates professional PDF quotations for buyers
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

class PDFGeneratorService {
  constructor() {
    // PartsForm brand colors (matching logo - dark navy blue theme)
    this.colors = {
      primary: '#1e3a5f',      // Dark navy blue (main brand color)
      primaryDark: '#152a45',   // Darker navy
      secondary: '#1f2937',     // Dark gray for text
      text: '#374151',          // Medium gray for body text
      textLight: '#6b7280',     // Light gray for secondary text
      border: '#e5e7eb',        // Light border
      background: '#f8fafc',    // Very light blue-gray background
      accent: '#3b82f6',        // Accent blue for highlights
      white: '#ffffff',
    };
    
    // PartsForm default branding
    this.defaultCompany = {
      name: 'PartsForm',
      email: 'sales@partsform.com',
      phone: '+971 4 XXX XXXX',
      address: 'Dubai, United Arab Emirates',
    };
    
    // Path to PartsForm logo
    this.logoPath = path.join(__dirname, '..', 'public', 'images', 'PARTSFORM-LOGO.png');
  }

  /**
   * Generate quotation PDF
   * @param {Object} data - Quotation data
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generateQuotationPDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const {
          companyName,
          companyEmail,
          companyPhone,
          companyAddress,
          logoBase64,
          customerName,
          customerEmail,
          markup,
          currency,
          validity,
          quotationNumber,
          notes,
          items,
        } = data;

        // Use provided company details or fallback to defaults
        const finalCompanyName = companyName || this.defaultCompany.name;
        const finalCompanyEmail = companyEmail || this.defaultCompany.email;
        const finalCompanyPhone = companyPhone || this.defaultCompany.phone;
        const finalCompanyAddress = companyAddress || this.defaultCompany.address;

        const currencySymbols = {
          AED: 'AED',
          USD: '$',
          EUR: '€',
          GBP: '£',
          SAR: 'SAR',
        };

        const currencySymbol = currencySymbols[currency] || currency;
        const markupMultiplier = 1 + ((markup || 0) / 100);
        const today = new Date();
        const validUntil = new Date(today.getTime() + (validity || 7) * 24 * 60 * 60 * 1000);

        // Create PDF document
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: `Quotation ${quotationNumber}`,
            Author: finalCompanyName,
            Subject: 'Parts Quotation',
          },
        });

        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const pageWidth = doc.page.width - 100;
        let yPosition = 50;

        // ========== HEADER ==========
        // Logo - use uploaded logo if provided, otherwise use default PartsForm logo
        try {
          if (logoBase64) {
            // Use user-uploaded logo
            const logoData = logoBase64.replace(/^data:image\/\w+;base64,/, '');
            const logoBuffer = Buffer.from(logoData, 'base64');
            doc.image(logoBuffer, 50, yPosition, { width: 140 });
            yPosition = Math.max(yPosition + 70, 120);
          } else if (fs.existsSync(this.logoPath)) {
            // Use default PartsForm logo
            doc.image(this.logoPath, 50, yPosition, { width: 140 });
            yPosition = Math.max(yPosition + 70, 120);
          }
        } catch (e) {
          console.error('Error loading logo:', e);
        }

        // QUOTATION title on the right
        doc.fillColor(this.colors.primary)
           .fontSize(28)
           .font('Helvetica-Bold')
           .text('QUOTATION', 300, 50, { align: 'right', width: pageWidth - 250 });

        // Quotation number
        doc.fillColor(this.colors.secondary)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(quotationNumber, 300, 82, { align: 'right', width: pageWidth - 250 });

        // Date and validity
        doc.fillColor(this.colors.textLight)
           .fontSize(10)
           .font('Helvetica')
           .text(`Date: ${this.formatDate(today)}`, 300, 100, { align: 'right', width: pageWidth - 250 })
           .text(`Valid Until: ${this.formatDate(validUntil)}`, 300, 115, { align: 'right', width: pageWidth - 250 });

        yPosition = Math.max(yPosition, 140);

        // Company info
        if (finalCompanyName) {
          doc.fillColor(this.colors.secondary)
             .fontSize(14)
             .font('Helvetica-Bold')
             .text(finalCompanyName, 50, yPosition);
          yPosition += 18;
        }

        doc.fillColor(this.colors.textLight)
           .fontSize(9)
           .font('Helvetica');
        
        if (finalCompanyAddress) {
          doc.text(finalCompanyAddress, 50, yPosition);
          yPosition += 12;
        }
        if (finalCompanyEmail || finalCompanyPhone) {
          const contact = [finalCompanyEmail, finalCompanyPhone].filter(Boolean).join(' • ');
          doc.text(contact, 50, yPosition);
          yPosition += 12;
        }

        yPosition += 20;

        // Divider line
        doc.strokeColor(this.colors.primary)
           .lineWidth(3)
           .moveTo(50, yPosition)
           .lineTo(pageWidth + 50, yPosition)
           .stroke();

        yPosition += 25;

        // ========== CUSTOMER & QUOTATION INFO BOXES ==========
        const boxHeight = 60;
        const boxWidth = (pageWidth - 20) / 2;

        // Customer box
        doc.fillColor(this.colors.background)
           .rect(50, yPosition, boxWidth, boxHeight)
           .fill();
        
        doc.strokeColor(this.colors.border)
           .lineWidth(1)
           .rect(50, yPosition, boxWidth, boxHeight)
           .stroke();

        doc.fillColor(this.colors.textLight)
           .fontSize(8)
           .font('Helvetica-Bold')
           .text('QUOTATION FOR', 60, yPosition + 10);

        doc.fillColor(this.colors.secondary)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(customerName || 'Valued Customer', 60, yPosition + 25);

        if (customerEmail) {
          doc.fillColor(this.colors.textLight)
             .fontSize(9)
             .font('Helvetica')
             .text(customerEmail, 60, yPosition + 42);
        }

        // Quotation details box
        doc.fillColor(this.colors.background)
           .rect(60 + boxWidth, yPosition, boxWidth, boxHeight)
           .fill();
        
        doc.strokeColor(this.colors.border)
           .lineWidth(1)
           .rect(60 + boxWidth, yPosition, boxWidth, boxHeight)
           .stroke();

        doc.fillColor(this.colors.textLight)
           .fontSize(8)
           .font('Helvetica-Bold')
           .text('QUOTATION DETAILS', 70 + boxWidth, yPosition + 10);

        doc.fillColor(this.colors.secondary)
           .fontSize(10)
           .font('Helvetica')
           .text(`Reference: ${quotationNumber}`, 70 + boxWidth, yPosition + 25)
           .text(`Total Items: ${items.length} • Currency: ${currency}`, 70 + boxWidth, yPosition + 40);

        yPosition += boxHeight + 25;

        // ========== ITEMS TABLE ==========
        doc.fillColor(this.colors.secondary)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('Quoted Items', 50, yPosition);

        doc.fillColor(this.colors.accent)
           .fontSize(10)
           .font('Helvetica')
           .text(`(${items.length} items)`, 140, yPosition + 2);

        yPosition += 25;

        // Table header
        const tableTop = yPosition;
        const colWidths = [30, 100, 70, 150, 40, 70, 70];
        const tableWidth = colWidths.reduce((a, b) => a + b, 0);
        
        // Header background
        doc.fillColor(this.colors.primary)
           .rect(50, tableTop, tableWidth, 25)
           .fill();

        // Header text
        const headers = ['#', 'Part Number', 'Brand', 'Description', 'Qty', 'Unit Price', 'Total'];
        let xPos = 50;
        doc.fillColor(this.colors.white)
           .fontSize(8)
           .font('Helvetica-Bold');

        headers.forEach((header, i) => {
          const align = i >= 4 ? 'right' : 'left';
          const padding = i >= 4 ? -5 : 5;
          doc.text(header, xPos + padding, tableTop + 8, { width: colWidths[i] - 10, align });
          xPos += colWidths[i];
        });

        yPosition = tableTop + 25;

        // Table rows
        let subtotal = 0;
        items.forEach((item, index) => {
          const originalPrice = parseFloat(item.price) || 0;
          const markedUpPrice = originalPrice * markupMultiplier;
          const total = markedUpPrice;
          subtotal += total;

          // Check if we need a new page
          if (yPosition > doc.page.height - 150) {
            doc.addPage();
            yPosition = 50;
          }

          // Alternate row background
          if (index % 2 === 0) {
            doc.fillColor(this.colors.background)
               .rect(50, yPosition, tableWidth, 22)
               .fill();
          }

          // Row border
          doc.strokeColor(this.colors.border)
             .lineWidth(0.5)
             .moveTo(50, yPosition + 22)
             .lineTo(50 + tableWidth, yPosition + 22)
             .stroke();

          // Row data
          xPos = 50;
          doc.fillColor(this.colors.textLight).fontSize(8).font('Helvetica');
          doc.text(`${index + 1}`, xPos + 5, yPosition + 7, { width: colWidths[0] - 10 });
          xPos += colWidths[0];

          doc.fillColor(this.colors.secondary).font('Helvetica-Bold');
          doc.text(item.code || item.partNumber || '-', xPos + 5, yPosition + 7, { width: colWidths[1] - 10 });
          xPos += colWidths[1];

          doc.fillColor(this.colors.accent).font('Helvetica');
          doc.text(item.brand || '-', xPos + 5, yPosition + 7, { width: colWidths[2] - 10 });
          xPos += colWidths[2];

          doc.fillColor(this.colors.text).font('Helvetica');
          const desc = (item.description || '-').substring(0, 40);
          doc.text(desc, xPos + 5, yPosition + 7, { width: colWidths[3] - 10 });
          xPos += colWidths[3];

          doc.fillColor(this.colors.secondary).font('Helvetica-Bold');
          doc.text('1', xPos - 5, yPosition + 7, { width: colWidths[4] - 10, align: 'right' });
          xPos += colWidths[4];

          doc.fillColor(this.colors.textLight).font('Helvetica');
          doc.text(`${currencySymbol} ${markedUpPrice.toFixed(2)}`, xPos - 5, yPosition + 7, { width: colWidths[5] - 10, align: 'right' });
          xPos += colWidths[5];

          doc.fillColor(this.colors.secondary).font('Helvetica-Bold');
          doc.text(`${currencySymbol} ${total.toFixed(2)}`, xPos - 5, yPosition + 7, { width: colWidths[6] - 10, align: 'right' });

          yPosition += 22;
        });

        yPosition += 15;

        // Check if we need a new page for totals section
        if (yPosition > doc.page.height - 100) {
          doc.addPage();
          yPosition = 50;
        }

        // ========== TOTALS ==========
        // Totals box on the right
        const totalsWidth = 180;
        const totalsX = 50 + tableWidth - totalsWidth;

        // Subtotal
        doc.fillColor(this.colors.textLight)
           .fontSize(10)
           .font('Helvetica')
           .text('Subtotal:', totalsX, yPosition, { width: 80 });
        doc.fillColor(this.colors.secondary)
           .text(`${currencySymbol} ${subtotal.toFixed(2)}`, totalsX + 80, yPosition, { width: 90, align: 'right' });

        yPosition += 20;

        // Grand total
        doc.strokeColor(this.colors.primary)
           .lineWidth(2)
           .moveTo(totalsX, yPosition - 5)
           .lineTo(totalsX + totalsWidth, yPosition - 5)
           .stroke();

        doc.fillColor(this.colors.secondary)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('Grand Total:', totalsX, yPosition + 5, { width: 80 });
        doc.fillColor(this.colors.primary)
           .fontSize(14)
           .text(`${currencySymbol} ${subtotal.toFixed(2)}`, totalsX + 80, yPosition + 3, { width: 90, align: 'right' });

        yPosition += 40;

        // ========== NOTES ==========
        if (notes) {
          // Check if we need a new page
          if (yPosition > doc.page.height - 120) {
            doc.addPage();
            yPosition = 50;
          }

          doc.fillColor('#e8f4f8')
             .rect(50, yPosition, pageWidth, 60)
             .fill();
          
          doc.strokeColor(this.colors.primary)
             .lineWidth(1)
             .rect(50, yPosition, pageWidth, 60)
             .stroke();

          doc.fillColor(this.colors.primary)
             .fontSize(10)
             .font('Helvetica-Bold')
             .text('Additional Notes', 60, yPosition + 10);

          doc.fillColor(this.colors.text)
             .fontSize(9)
             .font('Helvetica')
             .text(notes, 60, yPosition + 28, { width: pageWidth - 20 });

          yPosition += 75;
        }

        // ========== FOOTER ==========
        // Check if footer needs new page
        if (yPosition > doc.page.height - 50) {
          doc.addPage();
          yPosition = 50;
        }
        
        // Add footer right after content with some spacing
        yPosition += 20;
        
        doc.strokeColor(this.colors.border)
           .lineWidth(0.5)
           .moveTo(50, yPosition)
           .lineTo(pageWidth + 50, yPosition)
           .stroke();

        doc.fillColor(this.colors.textLight)
           .fontSize(8)
           .font('Helvetica')
           .text(
             `${finalCompanyName || ''} • Quotation generated on ${this.formatDate(today)}`,
             50,
             yPosition + 8,
             { align: 'center', width: pageWidth }
           );

        // Finalize PDF
        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Format date
   */
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}

// Singleton instance
const pdfGenerator = new PDFGeneratorService();

module.exports = pdfGenerator;
