/**
 * Price Markup Utility
 * Applies transparent price markup to parts based on buyer's markup percentage.
 * The buyer never sees the original price - markup is applied server-side before response.
 */
const SystemSettings = require('../models/SystemSettings');

// Cache for system settings to avoid DB calls on every search
let settingsCache = {
  data: null,
  timestamp: 0,
  TTL: 60000, // Cache for 60 seconds
};

/**
 * Get the default markup percentage from system settings (cached)
 * @returns {Promise<number>} The default markup percentage
 */
const getDefaultMarkupPercentage = async () => {
  const now = Date.now();
  if (
    settingsCache.data !== null &&
    now - settingsCache.timestamp < settingsCache.TTL
  ) {
    return settingsCache.data;
  }

  try {
    const settings = await SystemSettings.getSettings();
    settingsCache.data = settings.defaultMarkupPercentage || 0;
    settingsCache.timestamp = now;
    return settingsCache.data;
  } catch (error) {
    console.error('Error fetching default markup:', error.message);
    return 0;
  }
};

/**
 * Clear the settings cache (call when settings are updated)
 */
const clearSettingsCache = () => {
  settingsCache.data = null;
  settingsCache.timestamp = 0;
};

/**
 * Get the effective markup percentage for a buyer
 * Uses buyer's custom markup if set, otherwise falls back to system default
 * @param {Object} buyer - The buyer object (must have markupPercentage field)
 * @returns {Promise<number>} The effective markup percentage
 */
const getEffectiveMarkup = async (buyer) => {
  if (!buyer) return 0;

  // If buyer has a custom markup set, use it
  if (buyer.markupPercentage !== null && buyer.markupPercentage !== undefined) {
    return buyer.markupPercentage;
  }

  // Otherwise use system default
  return await getDefaultMarkupPercentage();
};

/**
 * Apply markup to a single price value
 * @param {number} price - Original price
 * @param {number} markupPercentage - Markup percentage to apply
 * @returns {number} Price with markup applied
 */
const applyMarkupToPrice = (price, markupPercentage) => {
  if (!price || price <= 0 || !markupPercentage || markupPercentage <= 0) {
    return price;
  }
  const markedUpPrice = price * (1 + markupPercentage / 100);
  // Round to 2 decimal places
  return Math.round(markedUpPrice * 100) / 100;
};

/**
 * Apply markup to a single part object (mutates the object)
 * @param {Object} part - Part object with price field
 * @param {number} markupPercentage - Markup percentage to apply
 * @returns {Object} The same part object with markup applied to price
 */
const applyMarkupToPart = (part, markupPercentage) => {
  if (!part || !markupPercentage || markupPercentage <= 0) {
    return part;
  }

  if (part.price && part.price > 0) {
    part.price = applyMarkupToPrice(part.price, markupPercentage);
  }

  return part;
};

/**
 * Apply markup to an array of parts
 * @param {Array} parts - Array of part objects
 * @param {number} markupPercentage - Markup percentage to apply
 * @returns {Array} The same array with markup applied to all prices
 */
const applyMarkupToParts = (parts, markupPercentage) => {
  if (
    !parts ||
    !Array.isArray(parts) ||
    !markupPercentage ||
    markupPercentage <= 0
  ) {
    return parts;
  }

  return parts.map((part) => applyMarkupToPart({ ...part }, markupPercentage));
};

/**
 * Middleware-style function: get markup for the current request's buyer
 * and apply it to search results before sending response.
 * Only applies to buyer requests - admin requests always return 0.
 * @param {Object} req - Express request object (must have req.user set by auth middleware)
 * @returns {Promise<number>} The effective markup percentage for this buyer
 */
const getRequestMarkup = async (req) => {
  // Only apply markup for buyer users, not admins
  if (!req.user || req.userRole === 'admin') return 0;
  return await getEffectiveMarkup(req.user);
};

module.exports = {
  getDefaultMarkupPercentage,
  clearSettingsCache,
  getEffectiveMarkup,
  applyMarkupToPrice,
  applyMarkupToPart,
  applyMarkupToParts,
  getRequestMarkup,
};
