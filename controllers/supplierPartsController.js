/**
 * Supplier Parts Controller
 * Handles all API endpoints for supplier parts management
 * - Parts CRUD operations
 * - File import/export
 * - Bulk operations
 * - Dashboard stats
 */
const supplierPartsService = require('../services/supplierPartsService');
const Part = require('../models/Part');
const logger = require('../utils/logger');

// ==================== DASHBOARD ====================

/**
 * Get dashboard statistics
 * GET /api/supplier/dashboard
 */
const getDashboard = async (req, res) => {
  try {
    const stats = await supplierPartsService.getStats(req.supplier._id);
    const files = await supplierPartsService.getImportFiles(req.supplier._id);
    
    res.json({
      success: true,
      ...stats,
      files
    });
  } catch (error) {
    logger.error('Dashboard error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load dashboard' 
    });
  }
};

// ==================== PARTS CRUD ====================

/**
 * Get parts list with pagination
 * GET /api/supplier/parts
 */
const getParts = async (req, res) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 250, 500),
      search: req.query.search || '',
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc',
      filters: {
        brand: req.query.brand,
        minPrice: req.query.minPrice,
        maxPrice: req.query.maxPrice,
        inStock: req.query.inStock === 'true',
        fileName: req.query.fileName
      }
    };
    
    const result = await supplierPartsService.getParts(req.supplier._id, options);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Get parts error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load parts' 
    });
  }
};

/**
 * Get single part
 * GET /api/supplier/parts/:partId
 */
const getPart = async (req, res) => {
  try {
    const part = await supplierPartsService.getPart(req.supplier._id, req.params.partId);
    
    res.json({
      success: true,
      ...part
    });
  } catch (error) {
    logger.error('Get part error:', error.message);
    res.status(404).json({ 
      success: false, 
      message: error.message || 'Part not found' 
    });
  }
};

/**
 * Update part
 * PUT /api/supplier/parts/:partId
 */
const updatePart = async (req, res) => {
  try {
    const allowedUpdates = ['description', 'brand', 'price', 'quantity', 'currency', 
                           'stock', 'weight', 'deliveryDays', 'category'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    const part = await supplierPartsService.updatePart(req.supplier, req.params.partId, updates);
    
    res.json({
      success: true,
      message: 'Part updated successfully',
      part
    });
  } catch (error) {
    logger.error('Update part error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to update part' 
    });
  }
};

/**
 * Delete part
 * DELETE /api/supplier/parts/:partId
 */
const deletePart = async (req, res) => {
  try {
    const result = await supplierPartsService.deleteParts(req.supplier, {
      partIds: [req.params.partId]
    });
    
    res.json({
      success: true,
      message: 'Part deleted successfully',
      deleted: result.deleted
    });
  } catch (error) {
    logger.error('Delete part error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete part' 
    });
  }
};

// ==================== BULK OPERATIONS ====================

/**
 * Bulk update parts
 * PUT /api/supplier/parts/bulk
 */
const bulkUpdateParts = async (req, res) => {
  try {
    const { partIds, updates } = req.body;
    
    if (!partIds || !partIds.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'No parts selected' 
      });
    }
    
    const result = await supplierPartsService.bulkUpdateParts(req.supplier, partIds, updates);
    
    res.json({
      success: true,
      message: `${result.updated} parts updated`,
      ...result
    });
  } catch (error) {
    logger.error('Bulk update error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update parts' 
    });
  }
};

/**
 * Bulk delete parts
 * DELETE /api/supplier/parts/bulk
 */
const bulkDeleteParts = async (req, res) => {
  try {
    const { partIds } = req.body;
    
    if (!partIds || !partIds.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'No parts selected' 
      });
    }
    
    const result = await supplierPartsService.deleteParts(req.supplier, { partIds });
    
    res.json({
      success: true,
      message: `${result.deleted} parts deleted`,
      ...result
    });
  } catch (error) {
    logger.error('Bulk delete error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete parts' 
    });
  }
};

/**
 * Delete ALL parts for supplier
 * DELETE /api/supplier/parts/delete-all
 */
const deleteAllParts = async (req, res) => {
  try {
    const Part = require('../models/Part');
    const AuditLog = require('../models/AuditLog');
    const elasticsearchService = require('../services/elasticsearchService');
    
    // Delete all parts for this supplier from MongoDB
    const result = await Part.deleteMany({ 
      'source.supplierId': req.supplier._id 
    });
    
    // Delete all parts for this supplier from Elasticsearch
    try {
      const esResult = await elasticsearchService.deleteBySupplier(req.supplier._id);
      logger.info(`Deleted ${esResult.deleted} parts from Elasticsearch for supplier ${req.supplier._id}`);
    } catch (esErr) {
      logger.error('ES delete error during delete all:', esErr.message);
    }
    
    // Log the action
    await AuditLog.log({
      actor: { 
        type: 'supplier', 
        id: req.supplier._id, 
        name: req.supplier.contactName 
      },
      action: 'parts.delete_all',
      resource: { type: 'parts', name: 'All parts' },
      supplier: req.supplier._id,
      status: 'success',
      changes: { deletedCount: result.deletedCount }
    });
    
    logger.info(`Deleted ALL ${result.deletedCount} parts for supplier ${req.supplier._id}`);
    
    res.json({
      success: true,
      message: `Successfully deleted all parts`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    logger.error('Delete all parts error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete all parts' 
    });
  }
};

// ==================== IMPORT/EXPORT ====================

/**
 * Import parts from file
 * POST /api/supplier/parts/import
 */
const importParts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const deleteOption = req.body.deleteOption || 'none';
    let deletedCount = 0;
    const elasticsearchService = require('../services/elasticsearchService');
    
    // Handle data deletion based on option
    if (deleteOption === 'all') {
      // Delete all supplier parts from MongoDB
      const Part = require('../models/Part');
      const result = await Part.deleteMany({ 
        'source.supplierId': req.supplier._id 
      });
      deletedCount = result.deletedCount;
      // Also delete from Elasticsearch
      await elasticsearchService.deleteBySupplier(req.supplier._id);
      logger.info(`Deleted all ${deletedCount} parts for supplier ${req.supplier._id}`);
    } else if (deleteOption === 'brand') {
      // Delete parts by brand
      const brands = JSON.parse(req.body.brands || '[]');
      if (brands.length) {
        const Part = require('../models/Part');
        const result = await Part.deleteMany({ 
          'source.supplierId': req.supplier._id,
          brand: { $in: brands }
        });
        deletedCount = result.deletedCount;
        // TODO: Delete from ES by brand (would need to implement)
        logger.info(`Deleted ${deletedCount} parts for brands: ${brands.join(', ')}`);
      }
    } else if (deleteOption === 'specificFile') {
      // Delete parts from specific chosen file
      const deleteFileName = req.body.deleteFileName;
      if (deleteFileName) {
        const Part = require('../models/Part');
        const result = await Part.deleteMany({ 
          'source.supplierId': req.supplier._id,
          fileName: deleteFileName
        });
        deletedCount = result.deletedCount;
        // Also delete from Elasticsearch
        await elasticsearchService.deleteBySupplierFile(req.supplier._id, deleteFileName);
        logger.info(`Deleted ${deletedCount} parts from file: ${deleteFileName}`);
      }
    } else if (deleteOption === 'file') {
      // Delete parts from same filename (handled in service)
    }
    
    const options = {
      replaceExisting: deleteOption === 'file',
      deleteOption
    };
    
    const result = await supplierPartsService.importFromFile(
      req.supplier,
      req.file.buffer,
      req.file.originalname,
      options
    );
    
    res.json({
      success: true,
      message: `Successfully imported ${result.imported} parts`,
      deleted: deletedCount + (result.deleted || 0),
      ...result
    });
  } catch (error) {
    logger.error('Import error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Import failed' 
    });
  }
};

/**
 * Export parts to Excel
 * GET /api/supplier/parts/export
 */
const exportParts = async (req, res) => {
  try {
    const options = {
      fileName: req.query.fileName
    };
    
    const { buffer, count } = await supplierPartsService.exportToExcel(req.supplier._id, options);
    
    const exportFileName = options.fileName 
      ? `parts_${options.fileName.replace(/\.[^/.]+$/, '')}_export.xlsx`
      : `parts_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName}"`);
    res.send(buffer);
    
  } catch (error) {
    logger.error('Export error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Export failed' 
    });
  }
};

/**
 * Preview import file
 * POST /api/supplier/parts/preview
 */
const previewImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const preview = await supplierPartsService.previewFile(
      req.file.buffer,
      req.file.originalname,
      10
    );
    
    res.json({
      success: true,
      ...preview
    });
  } catch (error) {
    logger.error('Preview error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Preview failed' 
    });
  }
};

// ==================== FILES ====================

/**
 * Get list of imported files
 * GET /api/supplier/files
 */
const getFiles = async (req, res) => {
  try {
    const files = await supplierPartsService.getImportFiles(req.supplier._id);
    res.json(files);
  } catch (error) {
    logger.error('Get files error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load files' 
    });
  }
};

/**
 * Delete all parts from a file
 * DELETE /api/supplier/files/:fileName
 */
const deleteFile = async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.params.fileName);
    
    const result = await supplierPartsService.deleteParts(req.supplier, { fileName });
    
    res.json({
      success: true,
      message: `Deleted ${result.deleted} parts from ${fileName}`,
      ...result
    });
  } catch (error) {
    logger.error('Delete file error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete file' 
    });
  }
};

// ==================== DATA MANAGEMENT ====================

/**
 * Get supplier's brands
 * GET /api/supplier/brands
 */
const getBrands = async (req, res) => {
  try {
    const brands = await supplierPartsService.getSupplierBrands(req.supplier._id);
    res.json({
      success: true,
      brands
    });
  } catch (error) {
    logger.error('Get brands error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load brands' 
    });
  }
};

/**
 * Get import summary for data management
 * GET /api/supplier/import-summary
 */
const getImportSummary = async (req, res) => {
  try {
    const summary = await supplierPartsService.getImportSummary(req.supplier._id);
    res.json({
      success: true,
      ...summary
    });
  } catch (error) {
    logger.error('Get import summary error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load import summary' 
    });
  }
};

/**
 * Delete parts by criteria (brand, file, etc)
 * DELETE /api/supplier/parts/criteria
 */
const deletePartsByCriteria = async (req, res) => {
  try {
    const { brand, fileName, deleteAll } = req.body;
    
    if (!brand && !fileName && !deleteAll) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please specify deletion criteria (brand, fileName, or deleteAll)' 
      });
    }
    
    const criteria = {};
    if (brand) criteria.brand = brand;
    if (fileName) criteria.fileName = fileName;
    
    const result = await supplierPartsService.deletePartsByCriteria(req.supplier._id, criteria);
    
    res.json({
      success: true,
      message: `Deleted ${result.deleted} parts`,
      ...result
    });
  } catch (error) {
    logger.error('Delete by criteria error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete parts' 
    });
  }
};

/**
 * Re-sync Elasticsearch index with MongoDB
 * POST /api/supplier/parts/reindex
 * This clears ES data for the supplier and re-indexes from MongoDB
 */
const reindexParts = async (req, res) => {
  try {
    const elasticsearchService = require('../services/elasticsearchService');
    
    // First, delete all ES data for this supplier
    const deleteResult = await elasticsearchService.deleteBySupplier(req.supplier._id);
    logger.info(`Cleared ${deleteResult.deleted} ES documents for supplier ${req.supplier._id}`);
    
    // Then re-index from MongoDB
    const indexResult = await supplierPartsService.indexSupplierParts(req.supplier._id);
    logger.info(`Re-indexed ${indexResult.indexed} parts to ES for supplier ${req.supplier._id}`);
    
    res.json({
      success: true,
      message: `Re-indexed ${indexResult.indexed} parts`,
      deleted: deleteResult.deleted,
      indexed: indexResult.indexed
    });
  } catch (error) {
    logger.error('Reindex error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reindex parts' 
    });
  }
};

module.exports = {
  // Dashboard
  getDashboard,
  
  // Parts CRUD
  getParts,
  getPart,
  updatePart,
  deletePart,
  deleteAllParts,
  
  // Bulk operations
  bulkUpdateParts,
  bulkDeleteParts,
  
  // Import/Export
  importParts,
  exportParts,
  previewImport,
  
  // Files
  getFiles,
  deleteFile,
  
  // Data Management
  getBrands,
  getImportSummary,
  deletePartsByCriteria,
  reindexParts
};
