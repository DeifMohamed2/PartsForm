/**
 * Schema Validator for Search Intent
 * 
 * Validates and normalizes LLM-generated intent objects to ensure
 * they conform to the expected schema. Catches hallucinations and
 * invalid values before they can corrupt search results.
 */

// Valid values for constrained fields
const VALID_VALUES = {
  categories: new Set([
    'filter', 'oil filter', 'air filter', 'fuel filter', 'cabin filter',
    'brake pad', 'brake disc', 'brake caliper', 'brake line',
    'spark plug', 'glow plug', 'ignition coil',
    'belt', 'timing belt', 'serpentine belt', 'v-belt',
    'bearing', 'wheel bearing', 'hub bearing',
    'gasket', 'head gasket', 'valve cover gasket',
    'sensor', 'o2 sensor', 'maf sensor', 'map sensor', 'abs sensor',
    'pump', 'water pump', 'fuel pump', 'oil pump', 'power steering pump',
    'shock absorber', 'strut', 'spring',
    'control arm', 'ball joint', 'tie rod', 'sway bar link',
    'battery', 'alternator', 'starter',
    'wiper blade', 'wiper arm',
    'headlight', 'taillight', 'bulb',
    'clutch', 'clutch kit', 'clutch disc', 'pressure plate',
    'radiator', 'thermostat', 'water hose',
    'oil', 'engine oil', 'transmission fluid', 'brake fluid',
  ]),
  
  positions: new Set([
    'front', 'rear', 'left', 'right',
    'front left', 'front right', 'rear left', 'rear right',
    'upper', 'lower', 'inner', 'outer',
    'driver', 'passenger',
  ]),
  
  searchTypes: new Set([
    'partNumber', 'fitment', 'catalog', 'general', 'cross-reference',
  ]),
  
  // Known automotive brands (subset)
  knownBrands: new Set([
    'ac delco', 'acdelco', 'aisin', 'ate', 'bando', 'beck/arnley', 'bilstein',
    'bosch', 'brembo', 'cardone', 'continental', 'dayco', 'delphi', 'denso',
    'dorman', 'exedy', 'fag', 'febi', 'ferodo', 'gates', 'gm', 'goodyear',
    'hella', 'hengst', 'koyo', 'lemforder', 'luk', 'mahle', 'mann', 'moog',
    'monroe', 'motorcraft', 'ngk', 'nissens', 'nsk', 'ntn', 'philips',
    'sachs', 'skf', 'timken', 'textar', 'trw', 'valeo', 'wagner', 'wix',
  ]),
};

// Schema definition
const INTENT_SCHEMA = {
  // Core identification
  partNumber: {
    type: 'string',
    maxLength: 50,
    pattern: /^[\w\-\.\/\s]+$/,
  },
  crossReference: {
    type: 'string',
    maxLength: 50,
    pattern: /^[\w\-\.\/\s]+$/,
  },
  
  // Product classification
  category: {
    type: 'string',
    maxLength: 100,
    validate: (val) => {
      const normalized = val.toLowerCase().trim();
      // Allow if it's a known category or contains known category
      return VALID_VALUES.categories.has(normalized) ||
        Array.from(VALID_VALUES.categories).some(c => normalized.includes(c));
    },
  },
  brand: {
    type: 'array',
    itemType: 'string',
    maxItems: 10,
    itemMaxLength: 50,
  },
  
  // Vehicle context
  vehicleMake: {
    type: 'string',
    maxLength: 50,
  },
  vehicleModel: {
    type: 'string',
    maxLength: 50,
  },
  vehicleYear: {
    type: 'number',
    min: 1900,
    max: new Date().getFullYear() + 2,
  },
  vehicleYearRange: {
    type: 'object',
    properties: {
      from: { type: 'number', min: 1900, max: new Date().getFullYear() + 2 },
      to: { type: 'number', min: 1900, max: new Date().getFullYear() + 2 },
    },
  },
  engineCode: {
    type: 'string',
    maxLength: 20,
  },
  displacement: {
    type: 'number',
    min: 0.1,
    max: 20,
  },
  
  // Position/Location
  position: {
    type: 'array',
    itemType: 'string',
    maxItems: 4,
    validate: (val) => {
      const normalized = val.toLowerCase().trim();
      return VALID_VALUES.positions.has(normalized);
    },
  },
  
  // Search metadata
  searchType: {
    type: 'string',
    validate: (val) => VALID_VALUES.searchTypes.has(val.toLowerCase()),
  },
  confidence: {
    type: 'number',
    min: 0,
    max: 1,
  },
  
  // Dimensional attributes
  dimensions: {
    type: 'object',
    properties: {
      diameter: { type: 'number', min: 0 },
      width: { type: 'number', min: 0 },
      height: { type: 'number', min: 0 },
      length: { type: 'number', min: 0 },
      thread: { type: 'string', maxLength: 20 },
    },
  },
};

class SchemaValidator {
  constructor(options = {}) {
    this.strict = options.strict !== false; // Default to strict mode
    this.allowUnknownFields = options.allowUnknownFields || false;
    this.fixableFields = new Set(['brand', 'category', 'position']); // Fields we can attempt to fix
  }

  /**
   * Validate and normalize an intent object
   * Returns { valid: boolean, intent: object, errors: array, warnings: array }
   */
  validate(intent) {
    if (!intent || typeof intent !== 'object') {
      return {
        valid: false,
        intent: {},
        errors: ['Intent must be a non-null object'],
        warnings: [],
      };
    }

    const result = {
      valid: true,
      intent: {},
      errors: [],
      warnings: [],
    };

    // Process each field in the input
    for (const [key, value] of Object.entries(intent)) {
      // Skip null/undefined values
      if (value === null || value === undefined) {
        continue;
      }

      const schema = INTENT_SCHEMA[key];
      
      // Check for unknown fields
      if (!schema) {
        if (this.allowUnknownFields) {
          result.warnings.push(`Unknown field '${key}' passed through`);
          result.intent[key] = value;
        } else {
          result.warnings.push(`Unknown field '${key}' removed`);
        }
        continue;
      }

      // Validate the field
      const fieldResult = this._validateField(key, value, schema);
      
      if (fieldResult.valid) {
        result.intent[key] = fieldResult.value;
      } else {
        result.errors.push(...fieldResult.errors);
        result.valid = false;
        
        // Attempt to fix if we're not in strict mode
        if (!this.strict && this.fixableFields.has(key)) {
          const fixed = this._attemptFix(key, value, schema);
          if (fixed !== null) {
            result.intent[key] = fixed;
            result.warnings.push(`Field '${key}' was auto-corrected`);
          }
        }
      }
      
      if (fieldResult.warnings) {
        result.warnings.push(...fieldResult.warnings);
      }
    }

    return result;
  }

  /**
   * Validate a single field against its schema
   */
  _validateField(key, value, schema) {
    const result = { valid: true, value, errors: [], warnings: [] };

    // Type checking
    switch (schema.type) {
      case 'string':
        result.valid = this._validateString(value, schema, result);
        break;
        
      case 'number':
        result.valid = this._validateNumber(value, schema, result);
        break;
        
      case 'array':
        result.valid = this._validateArray(value, schema, result);
        break;
        
      case 'object':
        result.valid = this._validateObject(value, schema, result);
        break;
        
      default:
        result.errors.push(`Unknown type '${schema.type}' for field '${key}'`);
        result.valid = false;
    }

    if (!result.valid) {
      result.errors = result.errors.map(e => `${key}: ${e}`);
    }

    return result;
  }

  /**
   * Validate string field
   */
  _validateString(value, schema, result) {
    // Coerce to string if reasonable
    if (typeof value !== 'string') {
      if (typeof value === 'number' && !isNaN(value)) {
        value = String(value);
        result.warnings.push('Number coerced to string');
      } else {
        result.errors.push(`Expected string, got ${typeof value}`);
        return false;
      }
    }

    result.value = value.trim();

    // Max length check
    if (schema.maxLength && result.value.length > schema.maxLength) {
      result.value = result.value.substring(0, schema.maxLength);
      result.warnings.push(`Truncated to ${schema.maxLength} chars`);
    }

    // Pattern check
    if (schema.pattern && !schema.pattern.test(result.value)) {
      result.errors.push('Value does not match expected pattern');
      return false;
    }

    // Custom validator
    if (schema.validate && !schema.validate(result.value)) {
      result.errors.push('Value failed validation');
      return false;
    }

    return true;
  }

  /**
   * Validate number field
   */
  _validateNumber(value, schema, result) {
    // Coerce string to number
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        result.errors.push('Cannot parse string as number');
        return false;
      }
      value = parsed;
      result.warnings.push('String parsed to number');
    }

    if (typeof value !== 'number' || isNaN(value)) {
      result.errors.push(`Expected number, got ${typeof value}`);
      return false;
    }

    // Range checks
    if (schema.min !== undefined && value < schema.min) {
      result.errors.push(`Value ${value} below minimum ${schema.min}`);
      return false;
    }

    if (schema.max !== undefined && value > schema.max) {
      result.errors.push(`Value ${value} above maximum ${schema.max}`);
      return false;
    }

    result.value = value;
    return true;
  }

  /**
   * Validate array field
   */
  _validateArray(value, schema, result) {
    // Coerce single value to array
    if (!Array.isArray(value)) {
      if (typeof value === 'string') {
        value = [value];
        result.warnings.push('Single value wrapped in array');
      } else {
        result.errors.push('Expected array');
        return false;
      }
    }

    // Max items check
    if (schema.maxItems && value.length > schema.maxItems) {
      value = value.slice(0, schema.maxItems);
      result.warnings.push(`Truncated to ${schema.maxItems} items`);
    }

    // Validate each item
    const validItems = [];
    for (let i = 0; i < value.length; i++) {
      let item = value[i];
      
      if (schema.itemType === 'string') {
        if (typeof item !== 'string') {
          result.warnings.push(`Skipped non-string item at index ${i}`);
          continue;
        }
        
        item = item.trim();
        
        if (schema.itemMaxLength && item.length > schema.itemMaxLength) {
          item = item.substring(0, schema.itemMaxLength);
        }
        
        if (schema.validate && !schema.validate(item)) {
          result.warnings.push(`Item '${item}' failed validation, removed`);
          continue;
        }
      }
      
      validItems.push(item);
    }

    result.value = validItems;
    return true;
  }

  /**
   * Validate object field
   */
  _validateObject(value, schema, result) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      result.errors.push('Expected object');
      return false;
    }

    const validatedObj = {};
    
    if (schema.properties) {
      for (const [propKey, propSchema] of Object.entries(schema.properties)) {
        if (value[propKey] !== undefined) {
          const propResult = this._validateField(propKey, value[propKey], propSchema);
          if (propResult.valid) {
            validatedObj[propKey] = propResult.value;
          } else {
            result.errors.push(...propResult.errors);
          }
        }
      }
    }

    result.value = validatedObj;
    return result.errors.length === 0;
  }

  /**
   * Attempt to fix invalid values
   */
  _attemptFix(key, value, schema) {
    switch (key) {
      case 'brand':
        // Try to find close match in known brands
        if (typeof value === 'string') {
          const lower = value.toLowerCase().trim();
          for (const brand of VALID_VALUES.knownBrands) {
            if (brand.includes(lower) || lower.includes(brand)) {
              return [brand];
            }
          }
        }
        return null;

      case 'category':
        // Try to find close match
        if (typeof value === 'string') {
          const lower = value.toLowerCase().trim();
          for (const cat of VALID_VALUES.categories) {
            if (lower.includes(cat) || cat.includes(lower)) {
              return cat;
            }
          }
        }
        return null;

      case 'position':
        // Normalize position strings
        if (typeof value === 'string') {
          const normalized = value.toLowerCase().trim();
          if (VALID_VALUES.positions.has(normalized)) {
            return [normalized];
          }
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Quick check if an intent looks valid (for fast rejection)
   */
  quickCheck(intent) {
    if (!intent || typeof intent !== 'object') return false;
    
    // Must have at least one meaningful field
    const meaningfulFields = ['partNumber', 'category', 'brand', 'vehicleMake'];
    return meaningfulFields.some(f => intent[f] !== undefined && intent[f] !== null);
  }

  /**
   * Merge partial intents (from multiple parsers)
   */
  mergeIntents(primary, ...others) {
    const merged = { ...primary };
    
    for (const other of others) {
      if (!other) continue;
      
      for (const [key, value] of Object.entries(other)) {
        // Only fill in missing fields or arrays that can be combined
        if (merged[key] === undefined || merged[key] === null) {
          merged[key] = value;
        } else if (Array.isArray(merged[key]) && Array.isArray(value)) {
          // Merge arrays, deduplicate
          merged[key] = [...new Set([...merged[key], ...value])];
        }
        // Higher confidence wins
        else if (key === 'confidence' && typeof value === 'number' && value > merged[key]) {
          merged[key] = value;
        }
      }
    }
    
    return merged;
  }
}

// Factory function for creating validators with different configs
function createValidator(options = {}) {
  return new SchemaValidator(options);
}

// Pre-configured validators
const strictValidator = new SchemaValidator({ strict: true });
const lenientValidator = new SchemaValidator({ strict: false, allowUnknownFields: true });

module.exports = {
  SchemaValidator,
  createValidator,
  strictValidator,
  lenientValidator,
  VALID_VALUES,
  INTENT_SCHEMA,
};
