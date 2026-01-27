/**
 * CSV Parser Service
 * Parses CSV files and imports records to MongoDB and Elasticsearch
 */
const csv = require('csv-parser');
const { Readable } = require('stream');
const Part = require('../models/Part');
const elasticsearchService = require('./elasticsearchService');

class CSVParserService {
  /**
   * Parse CSV buffer to records
   */
  async parseCSV(buffer, columnMapping = {}) {
    return new Promise((resolve, reject) => {
      if (!buffer || buffer.length === 0) {
        reject(new Error('CSV file is empty or invalid'));
        return;
      }

      const results = [];
      let headersDetected = null;

      // Detect delimiter
      const bufferStr = buffer.toString('utf8');
      const firstLine = bufferStr.split('\n')[0] || '';
      const semicolonCount = firstLine.split(';').length;
      const commaCount = firstLine.split(',').length;
      const separator = semicolonCount > commaCount ? ';' : ',';

      console.log(`🔍 Detected CSV separator: "${separator}"`);

      const mapHeaders = ({ header }) => header.trim().replace(/^["']|["']$/g, '');

      const stream = Readable.from(buffer);
      stream
        .pipe(csv({ separator, skipEmptyLines: true, mapHeaders }))
        .on('data', (data) => {
          if (!headersDetected) {
            headersDetected = Object.keys(data);
            console.log('📋 CSV Headers:', headersDetected.slice(0, 10).join(', '));
          }

          const normalized = this.normalizeRecord(data, columnMapping);
          if (normalized) {
            results.push(normalized);
          }
        })
        .on('end', () => {
          console.log(`📊 Parsed ${results.length} valid records`);
          resolve(results);
        })
        .on('error', reject);
    });
  }

  /**
   * Normalize a CSV record to standard format
   */
  normalizeRecord(data, columnMapping = {}) {
    // Column name mappings (handle various formats)
    const partNumberFields = [
      columnMapping.partNumber,
      'Part Number', 'PartNumber', 'part_number', 'partNumber',
      'PART NUMBER', 'Part #', 'SKU', 'sku', 'VENDOR CODE',
      'Vendor Code', 'vendor_code', 'vendorCode', 'VendorCode',
      'Item Number', 'Item #', 'Product Code', 'Code',
    ].filter(Boolean);

    const descriptionFields = [
      columnMapping.description,
      'Description', 'description', 'DESCRIPTION', 'Product Description',
      'TITLE', 'Title', 'title', 'Name', 'Product Name',
    ].filter(Boolean);

    const supplierFields = [
      columnMapping.supplier,
      'Supplier', 'supplier', 'SUPPLIER', 'Vendor', 'vendor',
      'VENDOR', 'Manufacturer', 'MFR',
    ].filter(Boolean);

    const brandFields = [
      columnMapping.brand,
      'Brand', 'brand', 'BRAND', 'Make', 'Manufacturer',
    ].filter(Boolean);

    const priceFields = [
      columnMapping.price,
      'Price', 'price', 'PRICE', 'Cost', 'cost', 'COST',
      'Unit Price', 'PRICE,AED', 'Price (AED)', 'Price (USD)',
    ].filter(Boolean);

    const quantityFields = [
      columnMapping.quantity,
      'Quantity', 'quantity', 'QUANTITY', 'Qty', 'QTY',
      'Stock', 'stock', 'STOCK', 'Available',
    ].filter(Boolean);

    const originFields = [
      columnMapping.origin,
      'Origin', 'origin', 'ORIGIN', 'Country', 'country',
      'Country of Origin', 'Made In',
    ].filter(Boolean);

    // Find values using field mappings
    const findValue = (fields) => {
      for (const field of fields) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
          return String(data[field]).replace(/^["']|["']$/g, '').trim();
        }
      }
      return '';
    };

    const partNumber = findValue(partNumberFields);
    if (!partNumber) return null;

    return {
      partNumber,
      description: findValue(descriptionFields),
      supplier: findValue(supplierFields),
      brand: findValue(brandFields),
      price: this.parsePrice(findValue(priceFields)),
      quantity: this.parseQuantity(findValue(quantityFields)),
      origin: findValue(originFields),
      rawData: data,
    };
  }

  /**
   * Parse price string to number
   */
  parsePrice(price) {
    if (!price) return null;

    let priceStr = String(price).trim();

    // Handle European format (comma as decimal)
    if (/^\d+,\d{1,2}$/.test(priceStr)) {
      priceStr = priceStr.replace(',', '.');
    } else if (/,/.test(priceStr)) {
      priceStr = priceStr.replace(/,/g, '');
    }

    // Remove currency symbols
    priceStr = priceStr.replace(/[$€£¥AED\s]/gi, '');

    const parsed = parseFloat(priceStr);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse quantity string to number
   */
  parseQuantity(qty) {
    if (!qty) return 0;
    const parsed = parseInt(String(qty).replace(/[^\d]/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Parse and import CSV to database and Elasticsearch
   */
  async parseAndImport(buffer, options = {}) {
    const { integration, integrationName, fileName, columnMapping = {}, onProgress } = options;

    return new Promise(async (resolve, reject) => {
      try {
        if (!buffer || buffer.length === 0) {
          return reject(new Error('CSV file is empty'));
        }

        let batch = [];
        let totalInserted = 0;
        let totalUpdated = 0;
        let rawRecordCount = 0;
        let validRecordCount = 0;
        const BATCH_SIZE = 5000;
        let lastProgressUpdate = Date.now();
        const PROGRESS_INTERVAL = 500; // Update progress every 500ms

        // Detect delimiter
        const bufferStr = buffer.toString('utf8');
        const firstLine = bufferStr.split('\n')[0] || '';
        const semicolonCount = firstLine.split(';').length;
        const commaCount = firstLine.split(',').length;
        const separator = semicolonCount > commaCount ? ';' : ',';

        const mapHeaders = ({ header }) => header.trim().replace(/^["']|["']$/g, '');

        const processBatch = async (batchToProcess) => {
          if (batchToProcess.length === 0) return { inserted: 0, updated: 0 };

          try {
            // Insert to MongoDB
            const mongoResult = await Part.bulkUpsert(batchToProcess, {
              integration,
              fileName,
            });

            // Index in Elasticsearch
            if (elasticsearchService.isAvailable) {
              const docsWithIds = batchToProcess.map((doc, idx) => ({
                ...doc,
                integration: integration?.toString(),
                integrationName,
                fileName,
                _id: `${integration}-${fileName}-${rawRecordCount - batchToProcess.length + idx}`,
              }));
              await elasticsearchService.bulkIndex(docsWithIds);
            }

            return mongoResult;
          } catch (error) {
            console.error('Batch processing error:', error.message);
            throw error;
          }
        };

        // Emit progress update if callback provided
        const emitProgress = () => {
          if (onProgress && Date.now() - lastProgressUpdate >= PROGRESS_INTERVAL) {
            onProgress({
              processed: validRecordCount,
              inserted: totalInserted,
              updated: totalUpdated,
              raw: rawRecordCount,
            });
            lastProgressUpdate = Date.now();
          }
        };

        const stream = Readable.from(buffer);
        stream
          .pipe(csv({ separator, skipEmptyLines: true, mapHeaders }))
          .on('data', async (data) => {
            rawRecordCount++;

            const normalized = this.normalizeRecord(data, columnMapping);
            if (normalized) {
              validRecordCount++;

              const record = {
                ...normalized,
                integration,
                integrationName,
                fileName,
                importedAt: new Date(),
                createdAt: new Date(),
              };

              batch.push(record);

              // Emit progress periodically
              emitProgress();

              if (batch.length >= BATCH_SIZE) {
                stream.pause();
                const batchToProcess = [...batch];
                batch = [];

                const result = await processBatch(batchToProcess);
                totalInserted += result.inserted;
                totalUpdated += result.updated;

                // Emit progress after batch
                if (onProgress) {
                  onProgress({
                    processed: validRecordCount,
                    inserted: totalInserted,
                    updated: totalUpdated,
                    raw: rawRecordCount,
                  });
                  lastProgressUpdate = Date.now();
                }

                stream.resume();
              }
            }
          })
          .on('end', async () => {
            try {
              // Process remaining batch
              if (batch.length > 0) {
                const result = await processBatch(batch);
                totalInserted += result.inserted;
                totalUpdated += result.updated;
              }

              // Refresh Elasticsearch index and invalidate cache
              if (elasticsearchService.isAvailable) {
                await elasticsearchService.refreshIndex();
                elasticsearchService.invalidateDocCountCache();
              }

              // Final progress update
              if (onProgress) {
                onProgress({
                  processed: validRecordCount,
                  inserted: totalInserted,
                  updated: totalUpdated,
                  raw: rawRecordCount,
                  complete: true,
                });
              }

              console.log(`✅ Import complete: ${totalInserted} inserted, ${totalUpdated} updated`);

              resolve({
                success: true,
                rawRecords: rawRecordCount,
                validRecords: validRecordCount,
                inserted: totalInserted,
                updated: totalUpdated,
                total: validRecordCount,
              });
            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Export singleton
const csvParserService = new CSVParserService();
module.exports = csvParserService;
