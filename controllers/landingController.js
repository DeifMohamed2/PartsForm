// Landing Controller
// This file contains all landing page-related controller functions

const ExcelJS = require('exceljs');

/**
 * Get landing page
 */
const getLandingPage = async (req, res) => {
  try {
    res.render('Landing/index', {
      title: 'PARTSFORM - Global Industrial Parts Sourcing',
    });
  } catch (error) {
    console.error('Error in getLandingPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load page',
    });
  }
};

/**
 * Get search page for a specific industry/sector
 */
const getSearchPage = async (req, res) => {
  try {
    const { industry } = req.params;
    const sectors = req.app.locals.sectors || [];

    // Find the sector by id
    const sector = sectors.find((s) => s.id === industry);

    if (!sector) {
      return res.status(404).render('error', {
        title: 'Sector Not Found | PARTSFORM',
        error: 'The requested sector does not exist',
      });
    }

    res.render('Landing/search', {
      title: `${sector.name} Parts Search | PARTSFORM`,
      sector: sector,
    });
  } catch (error) {
    console.error('Error in getSearchPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load search page',
    });
  }
};

/**
 * Get professional search2 page
 */
const getSearch2Page = async (req, res) => {
  try {
    res.render('Landing/search2', {
      title: 'Professional Parts Search | PARTSFORM',
    });
  } catch (error) {
    console.error('Error in getSearch2Page:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load search page',
    });
  }
};

/**
 * Get registration page
 */
const getRegisterPage = async (req, res) => {
  try {
    res.render('Landing/register', {
      title: 'Create Account | PARTSFORM',
      pageClass: 'page-register',
    });
  } catch (error) {
    console.error('Error in getRegisterPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load registration page',
    });
  }
};

/**
 * Handle user registration
 * POST /register
 */
const registerUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      country,
      city,
      shippingAddress,
      password,
      confirmPassword,
      agreeTerms,
      newsletter
    } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !phone || !companyName || !country || !city || !shippingAddress || !password) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    if (!agreeTerms) {
      return res.status(400).json({
        success: false,
        message: 'You must agree to the terms and privacy policy',
      });
    }

    // TODO: Add database user creation logic here
    // For now, just return success
    console.log('New user registration:', {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      country,
      city,
      shippingAddress,
      newsletter: newsletter === 'on'
    });

    res.json({
      success: true,
      message: 'Account created successfully',
    });
  } catch (error) {
    console.error('Error in registerUser:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating account',
    });
  }
};

// Import required services for search
const Part = require('../models/Part');
const elasticsearchService = require('../services/elasticsearchService');

/**
 * Search for parts by exact part number
 * POST /api/search
 * Returns all parts with the same part number from different suppliers
 */
const searchParts = async (req, res) => {
  try {
    const { partNumber, sortBy = 'price', sortOrder = 'asc', limit = 100 } = req.body;

    if (!partNumber) {
      return res.status(400).json({
        success: false,
        message: 'Part number is required',
      });
    }

    const trimmedPartNumber = partNumber.trim();
    let results = [];
    let total = 0;
    let source = 'mongodb';

    // Try Elasticsearch first
    const useElasticsearch = await elasticsearchService.hasDocuments();

    if (useElasticsearch) {
      try {
        const esResult = await elasticsearchService.searchByExactPartNumber(trimmedPartNumber, {
          sortBy,
          sortOrder,
          limit: parseInt(limit, 10),
        });
        results = esResult.results;
        total = esResult.total;
        source = 'elasticsearch';
      } catch (esError) {
        console.error('Elasticsearch search failed, falling back to MongoDB:', esError.message);
      }
    }

    // Fallback to MongoDB if Elasticsearch didn't return results
    if (results.length === 0) {
      // Escape special regex characters for safety
      const escapedPartNumber = trimmedPartNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      const mongoResults = await Part.find({
        // EXACT match only (case-insensitive)
        partNumber: { $regex: `^${escapedPartNumber}$`, $options: 'i' },
      })
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .limit(parseInt(limit, 10))
        .lean();

      results = mongoResults.map((part) => ({
        _id: part._id,
        partNumber: part.partNumber,
        description: part.description,
        brand: part.brand,
        supplier: part.supplier,
        unitPrice: part.price,
        price: part.price,
        currency: part.currency || 'USD',
        stock: part.quantity,
        quantity: part.quantity,
        weight: part.weight,
        delivery: part.deliveryDays,
        deliveryDays: part.deliveryDays,
      }));
      total = results.length;
      source = 'mongodb';
    } else {
      // Transform Elasticsearch results to match expected format
      results = results.map((part) => ({
        _id: part._id,
        partNumber: part.partNumber,
        description: part.description,
        brand: part.brand,
        supplier: part.supplier,
        unitPrice: part.price,
        price: part.price,
        currency: part.currency || 'USD',
        stock: part.quantity,
        quantity: part.quantity,
        weight: part.weight,
        delivery: part.deliveryDays,
        deliveryDays: part.deliveryDays,
      }));
    }

    res.json({
      success: results.length > 0,
      count: total,
      partNumber: trimmedPartNumber,
      results: results,
      source: source,
    });
  } catch (error) {
    console.error('Error in searchParts:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching for parts',
    });
  }
};

/**
 * Get all sectors data
 * GET /api/sectors
 */
const getSectors = async (req, res) => {
  try {
    const sectors = req.app.locals.sectors || [];
    res.json(sectors);
  } catch (error) {
    console.error('Error in getSectors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sectors',
    });
  }
};

/**
 * Download sample Excel file for bulk part search
 * GET /api/download-sample-excel
 */
const downloadSampleExcel = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Parts List');

    // Set column headers
    worksheet.columns = [
      { header: 'Part Number', key: 'partNumber', width: 20 },
      { header: 'Quantity', key: 'quantity', width: 15 },
      { header: 'Brand', key: 'brand', width: 20 },
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };
    worksheet.getRow(1).alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };
    worksheet.getRow(1).height = 25;

    // Add sample data
    const sampleData = [
      { partNumber: '8471474', quantity: 5, brand: 'OEM' },
      { partNumber: '1234567', quantity: 10, brand: 'Bosch' },
      { partNumber: '9876543', quantity: 2, brand: 'SKF' },
      { partNumber: '4567890', quantity: 8, brand: 'Continental' },
      { partNumber: '3210987', quantity: 15, brand: 'Parker' },
    ];

    sampleData.forEach((row, index) => {
      const worksheetRow = worksheet.addRow(row);
      worksheetRow.alignment = { vertical: 'middle', horizontal: 'left' };
      worksheetRow.height = 20;

      // Alternate row colors
      if (index % 2 === 0) {
        worksheetRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFB' },
        };
      }
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="parts_search_sample.xlsx"'
    );

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error in downloadSampleExcel:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating sample Excel file',
    });
  }
};

// Export controller functions
module.exports = {
  getLandingPage,
  getSearchPage,
  getSearch2Page,
  getRegisterPage,
  registerUser,
  searchParts,
  getSectors,
  downloadSampleExcel,
};
