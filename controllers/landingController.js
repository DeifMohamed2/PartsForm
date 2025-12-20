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
 * Get Automotive industry-specific search page
 */
const getAutomotiveSearchPage = async (req, res) => {
  try {
    res.render('Landing/search-automotive', {
      title: 'Automotive Parts Search | PARTSFORM',
      industry: 'automotive',
      industryName: 'Automotive',
    });
  } catch (error) {
    console.error('Error in getAutomotiveSearchPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load automotive search page',
    });
  }
};

/**
 * Get Aviation industry-specific search page
 */
const getAviationSearchPage = async (req, res) => {
  try {
    res.render('Landing/search-aviation', {
      title: 'Aviation Parts Search | PARTSFORM',
      industry: 'aviation',
      industryName: 'Aviation',
    });
  } catch (error) {
    console.error('Error in getAviationSearchPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load aviation search page',
    });
  }
};

/**
 * Get Heavy Machinery industry-specific search page
 */
const getHeavyMachinerySearchPage = async (req, res) => {
  try {
    res.render('Landing/search-machinery', {
      title: 'Heavy Machinery Parts Search | PARTSFORM',
      industry: 'heavy-machinery',
      industryName: 'Heavy Machinery',
    });
  } catch (error) {
    console.error('Error in getHeavyMachinerySearchPage:', error);
    res.status(500).render('error', {
      title: 'Error | PARTSFORM',
      error: 'Failed to load heavy machinery search page',
    });
  }
};

/**
 * Search for parts by part number
 * POST /api/search
 */
const searchParts = async (req, res) => {
  try {
    const { partNumber } = req.body;
    const partsDatabase = req.app.locals.partsDatabase || {};

    if (!partNumber) {
      return res.status(400).json({
        success: false,
        message: 'Part number is required',
      });
    }

    const results = partsDatabase[partNumber] || [];

    res.json({
      success: results.length > 0,
      count: results.length,
      partNumber: partNumber,
      results: results,
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
  getAutomotiveSearchPage,
  getAviationSearchPage,
  getHeavyMachinerySearchPage,
  searchParts,
  getSectors,
  downloadSampleExcel,
};
