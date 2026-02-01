/**
 * CSV Parser Service
 * Parses CSV files and imports records to MongoDB and Elasticsearch
 * Memory-optimized for large files
 */
const csv = require('csv-parser');
const { Readable } = require('stream');
const fs = require('fs');
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

    const weightFields = [
      columnMapping.weight,
      'Weight', 'weight', 'WEIGHT', 'Net Weight', 'Gross Weight',
    ].filter(Boolean);

    const volumeFields = [
      columnMapping.volume,
      'Volume', 'volume', 'VOLUME',
    ].filter(Boolean);

    const deliveryFields = [
      columnMapping.delivery,
      'Delivery', 'delivery', 'DELIVERY', 'Delivery Days', 'Lead Time',
    ].filter(Boolean);

    const stockCodeFields = [
      columnMapping.stockCode,
      'Stock', 'stock', 'STOCK', 'Stock Code', 'Warehouse',
    ].filter(Boolean);

    const minLotFields = [
      columnMapping.minOrderQty,
      'MIN_LOT', 'Min Lot', 'Min Order', 'MOQ', 'Minimum Order',
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

    // Parse delivery days from format like "0/0" or "1-3"
    const parseDelivery = (val) => {
      if (!val) return null;
      const str = String(val).replace(/[=""]/g, '').trim();
      const match = str.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    };

    // Parse weight (handle European format with comma)
    const parseWeight = (val) => {
      if (!val) return null;
      const str = String(val).replace(',', '.').trim();
      const parsed = parseFloat(str);
      return isNaN(parsed) ? null : parsed;
    };

    return {
      partNumber,
      description: findValue(descriptionFields),
      supplier: findValue(supplierFields),
      brand: findValue(brandFields),
      price: this.parsePrice(findValue(priceFields)),
      currency: 'AED', // Default currency for your FTP data
      quantity: this.parseQuantity(findValue(quantityFields)),
      weight: parseWeight(findValue(weightFields)),
      volume: parseWeight(findValue(volumeFields)),
      deliveryDays: parseDelivery(findValue(deliveryFields)),
      stockCode: findValue(stockCodeFields),
      minOrderQty: this.parseQuantity(findValue(minLotFields)) || 1,
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
   * Memory-optimized: processes in small chunks, supports both buffer and file path
   * @param {Buffer|string} source - Buffer or file path to CSV
   * @param {Object} options - Import options
   */
  async parseAndImport(source, options = {}) {
    const { integration, integrationName, fileName, columnMapping = {}, onProgress } = options;

    return new Promise(async (resolve, reject) => {
      try {
        // Determine if source is a file path or buffer
        const isFilePath = typeof source === 'string';
        let fileSize = 0;
        let inputStream;
        let separator = ';'; // Default separator

        if (isFilePath) {
          // Streaming from file - memory efficient
          if (!fs.existsSync(source)) {
            return reject(new Error('CSV file not found'));
          }
          const stats = fs.statSync(source);
          fileSize = stats.size;
          
          // Read just first 1KB to detect separator
          const fd = fs.openSync(source, 'r');
          const sampleBuffer = Buffer.alloc(Math.min(1024, fileSize));
          fs.readSync(fd, sampleBuffer, 0, sampleBuffer.length, 0);
          fs.closeSync(fd);
          
          const sample = sampleBuffer.toString('utf8');
          const firstLine = sample.split('\n')[0] || '';
          const semicolonCount = firstLine.split(';').length;
          const commaCount = firstLine.split(',').length;
          separator = semicolonCount > commaCount ? ';' : ',';
          
          // Create read stream from file
          inputStream = fs.createReadStream(source, { highWaterMark: 64 * 1024 }); // 64KB chunks
          
          console.log(`📊 Streaming ${(fileSize / 1024 / 1024).toFixed(2)} MB file with separator "${separator}"`);
        } else {
          // Legacy buffer support
          if (!source || source.length === 0) {
            return reject(new Error('CSV file is empty'));
          }
          fileSize = source.length;
          
          // Detect delimiter from first 1KB only
          const sampleSize = Math.min(1024, source.length);
          const sample = source.slice(0, sampleSize).toString('utf8');
          const firstLine = sample.split('\n')[0] || '';
          const semicolonCount = firstLine.split(';').length;
          const commaCount = firstLine.split(',').length;
          separator = semicolonCount > commaCount ? ';' : ',';
          
          inputStream = Readable.from(source);
          source = null; // Release buffer reference
          
          console.log(`📊 Processing ${(fileSize / 1024 / 1024).toFixed(2)} MB buffer with separator "${separator}"`);
        }

        let batch = [];
        let totalInserted = 0;
        let totalUpdated = 0;
        let rawRecordCount = 0;
        let validRecordCount = 0;
        let esRecordIndex = 0;
        const BATCH_SIZE = 500;
        const ES_BATCH_SIZE = 200;
        let lastProgressUpdate = Date.now();
        const PROGRESS_INTERVAL = 1000;

        const mapHeaders = ({ header }) => header.trim().replace(/^["']|["']$/g, '');

        const processBatch = async (batchToProcess) => {
          if (batchToProcess.length === 0) return { inserted: 0, updated: 0 };

          try {
            // Insert to MongoDB
            const mongoResult = await Part.bulkInsert(batchToProcess, {
              integration,
              integrationName,
              fileName,
            });

            // Index in Elasticsearch in smaller sub-batches
            if (elasticsearchService.isAvailable) {
              for (let i = 0; i < batchToProcess.length; i += ES_BATCH_SIZE) {
                const esBatch = batchToProcess.slice(i, i + ES_BATCH_SIZE).map((doc, idx) => ({
                  ...doc,
                  integration: integration?.toString(),
                  integrationName,
                  fileName,
                  _id: `${integration}-${fileName}-${esRecordIndex + i + idx}`,
                }));
                
                try {
                  await elasticsearchService.bulkIndex(esBatch);
                } catch (esError) {
                  console.error(`ES batch error (non-fatal): ${esError.message}`);
                }
                
                // Small delay between ES batches
                if (i + ES_BATCH_SIZE < batchToProcess.length) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
              }
              esRecordIndex += batchToProcess.length;
            }

            return mongoResult;
          } catch (error) {
            console.error('Batch processing error:', error.message);
            throw error;
          }
        };

        let processingPromise = Promise.resolve();
        let tempFilePath = isFilePath ? source : null;

        inputStream
          .pipe(csv({ separator, skipEmptyLines: true, mapHeaders }))
          .on('data', (data) => {
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
              if (onProgress && Date.now() - lastProgressUpdate >= PROGRESS_INTERVAL) {
                onProgress({
                  processed: validRecordCount,
                  inserted: totalInserted,
                  updated: totalUpdated,
                  raw: rawRecordCount,
                });
                lastProgressUpdate = Date.now();
              }

              if (batch.length >= BATCH_SIZE) {
                inputStream.pause();
                const batchToProcess = batch;
                batch = []; // Clear batch immediately

                processingPromise = processingPromise.then(async () => {
                  try {
                    const result = await processBatch(batchToProcess);
                    totalInserted += result.inserted;
                    totalUpdated += result.updated;

                    // Force garbage collection hint by clearing array
                    batchToProcess.length = 0;

                    if (onProgress) {
                      onProgress({
                        processed: validRecordCount,
                        inserted: totalInserted,
                        updated: totalUpdated,
                        raw: rawRecordCount,
                      });
                      lastProgressUpdate = Date.now();
                    }

                    inputStream.resume();
                  } catch (err) {
                    inputStream.destroy(err);
                  }
                });
              }
            }
            
            // Clear data reference
            data = null;
          })
          .on('end', async () => {
            try {
              // Wait for any pending batch processing
              await processingPromise;

              // Process remaining batch
              if (batch.length > 0) {
                const result = await processBatch(batch);
                totalInserted += result.inserted;
                totalUpdated += result.updated;
                batch = [];
              }

              // Clean up temp file if used
              if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                  fs.unlinkSync(tempFilePath);
                  console.log('🗑️  Cleaned up temp file');
                } catch (cleanupErr) {
                  console.warn('Warning: Could not delete temp file:', cleanupErr.message);
                }
              }

              // Refresh Elasticsearch index
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

              console.log(`✅ Import complete: ${totalInserted} inserted, ${totalUpdated} updated from ${rawRecordCount} raw records`);

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
