/**
 * Token-Based Query Parser
 * 
 * Extracts features from search queries using tokenization and pattern matching.
 * This replaces the brittle regex-heavy approach with a more robust token-based system.
 * 
 * Features extracted:
 * - Part numbers (OEM, cross-reference)
 * - Brands (manufacturer names)
 * - Categories (product types)
 * - Vehicles (make, model, year)
 * - Attributes (size, material, etc.)
 */

// Token patterns for automotive parts domain
const PATTERNS = {
  // Part number patterns
  partNumber: {
    // OEM-style: letters + numbers, possibly with dashes/dots
    // Examples: 04152-YZZA1, A0001153V007, 6PK1045
    oem: /^[A-Z]{1,4}[-.\/]?\d{3,}[-.\w]*$/i,
    
    // Pure numeric with separator: 123-456-789
    numeric: /^\d{2,}[-.\s]?\d{2,}([-.\s]?\d+)?$/,
    
    // Alphanumeric mixed: 5W30, 10W40
    alphaNum: /^\d+[A-Z]+\d+$/i,
    
    // VIN-style (17 chars)
    vin: /^[A-HJ-NPR-Z0-9]{17}$/i,
  },
  
  // Brand names (common automotive brands)
  brandIndicators: new Set([
    'toyota', 'honda', 'nissan', 'mazda', 'subaru', 'mitsubishi', 'lexus', 'acura', 'infiniti',
    'ford', 'chevrolet', 'chevy', 'gmc', 'dodge', 'chrysler', 'jeep', 'cadillac', 'buick',
    'mercedes', 'bmw', 'audi', 'volkswagen', 'vw', 'porsche', 'volvo', 'saab',
    'hyundai', 'kia', 'daewoo', 'ssangyong',
    'bosch', 'denso', 'ngk', 'gates', 'moog', 'monroe', 'acdelco', 'motorcraft',
    'febi', 'lemforder', 'sachs', 'bilstein', 'mann', 'mahle', 'hengst',
    'aisin', 'koyo', 'nsk', 'ntn', 'skf',
    'brembo', 'ferodo', 'textar', 'ate', 'trw', 'akebono',
    'continental', 'goodyear', 'michelin', 'bridgestone', 'pirelli',
    'mobil', 'castrol', 'shell', 'valvoline', 'pennzoil',
  ]),
  
  // Category keywords
  categoryIndicators: {
    'filter': ['filter', 'фильтр', 'filtro', 'filtre'],
    'oil filter': ['oil filter', 'масляный', 'aceite'],
    'air filter': ['air filter', 'воздушный', 'aire'],
    'fuel filter': ['fuel filter', 'топливный', 'combustible'],
    'cabin filter': ['cabin filter', 'салонный', 'habitaculo'],
    'brake pad': ['brake pad', 'pad', 'тормозные колодки', 'pastilla'],
    'brake disc': ['brake disc', 'rotor', 'тормозной диск', 'disco'],
    'spark plug': ['spark plug', 'свеча', 'bujia'],
    'belt': ['belt', 'ремень', 'correa', 'serpentine', 'timing'],
    'bearing': ['bearing', 'подшипник', 'rodamiento'],
    'gasket': ['gasket', 'прокладка', 'junta'],
    'sensor': ['sensor', 'датчик'],
    'pump': ['pump', 'насос', 'bomba'],
    'shock': ['shock', 'strut', 'амортизатор'],
    'suspension': ['suspension', 'подвеска', 'arm', 'ball joint', 'tie rod'],
    'battery': ['battery', 'аккумулятор', 'bateria'],
    'wiper': ['wiper', 'дворник', 'limpiaparabrisas'],
    'lamp': ['lamp', 'bulb', 'лампа', 'headlight', 'taillight'],
    'clutch': ['clutch', 'сцепление'],
    'radiator': ['radiator', 'радиатор'],
  },
  
  // Vehicle indicators
  vehicleIndicators: {
    makes: new Set([
      'toyota', 'honda', 'nissan', 'mazda', 'subaru', 'mitsubishi', 'suzuki', 'isuzu',
      'ford', 'chevrolet', 'gmc', 'dodge', 'chrysler', 'jeep', 'ram',
      'mercedes', 'bmw', 'audi', 'volkswagen', 'porsche', 'mini',
      'hyundai', 'kia', 'genesis',
      'lexus', 'acura', 'infiniti', 'lincoln', 'cadillac', 'buick',
      'volvo', 'saab', 'jaguar', 'land rover', 'range rover',
      'fiat', 'alfa romeo', 'maserati', 'ferrari', 'lamborghini',
      'peugeot', 'renault', 'citroen', 'opel', 'vauxhall',
      'lada', 'uaz', 'gaz', 'kamaz',
    ]),
    
    // Model patterns that indicate vehicle context
    modelPatterns: /\b(camry|corolla|civic|accord|altima|sentra|mustang|f-150|silverado|tahoe|explorer|cherokee|wrangler|rav4|cr-v|cx-5|outback|forester|3\s?series|5\s?series|a4|a6|golf|jetta|passat|tucson|sportage|elantra|sonata)\b/i,
  },
  
  // Year patterns
  yearPattern: /\b(19[89]\d|20[0-2]\d)\b/,
  
  // Engine patterns
  enginePatterns: {
    // Displacement: 2.0, 3.5L, 1800cc
    displacement: /\b(\d+\.?\d*)\s*[lL]?\s*(litre|liter|[lL])?\b|\b(\d{3,4})\s*cc\b/i,
    
    // Engine codes: 2JZ, VQ35, EJ25, K20
    code: /\b([A-Z]{1,2}\d{1,2}[A-Z]?\d?)\b/i,
    
    // Turbo/NA indicators
    aspiration: /\b(turbo|supercharged|hybrid|diesel|petrol|gasoline)\b/i,
  },
  
  // Position/Location indicators
  positionIndicators: {
    'front': ['front', 'передний', 'delantero', 'avant'],
    'rear': ['rear', 'back', 'задний', 'trasero', 'arriere'],
    'left': ['left', 'lh', 'driver', 'левый', 'izquierdo', 'gauche'],
    'right': ['right', 'rh', 'passenger', 'правый', 'derecho', 'droit'],
    'upper': ['upper', 'top', 'верхний'],
    'lower': ['lower', 'bottom', 'нижний'],
    'inner': ['inner', 'internal', 'внутренний'],
    'outer': ['outer', 'external', 'внешний', 'наружный'],
  },
  
  // Size/Dimension patterns
  sizePatterns: {
    // Diameter: 25mm, 1.5"
    diameter: /\b(\d+(?:\.\d+)?)\s*(mm|cm|in|inch|inches|")\b/i,
    
    // Thickness/Width
    thickness: /\b(\d+(?:\.\d+)?)\s*(?:mm|cm)?\s*(?:thick|thickness|width)\b/i,
    
    // Thread size: M12x1.5
    thread: /\bM(\d+)\s*[xX]\s*(\d+(?:\.\d+)?)\b/,
  },
};

class TokenParser {
  constructor() {
    this.confidence = 0;
    this.features = {};
  }

  /**
   * Main parse method - extracts all features from query
   */
  parse(query, options = {}) {
    if (!query || typeof query !== 'string') {
      return this._emptyResult();
    }

    // Normalize and tokenize
    const normalizedQuery = this._normalize(query);
    const tokens = this._tokenize(normalizedQuery);
    
    // Extract features
    const result = {
      originalQuery: query,
      normalizedQuery,
      tokens,
      
      // Core features
      partNumbers: this._extractPartNumbers(tokens, normalizedQuery),
      brands: this._extractBrands(tokens),
      categories: this._extractCategories(tokens, normalizedQuery),
      
      // Vehicle context
      vehicle: this._extractVehicle(tokens, normalizedQuery),
      
      // Attributes
      position: this._extractPosition(tokens),
      size: this._extractSize(normalizedQuery),
      engine: this._extractEngine(normalizedQuery),
      
      // Meta
      confidence: 0,
      method: 'token',
      
      // For compatibility with existing system
      searchType: 'general',
      filters: {},
    };
    
    // Calculate confidence and determine search type
    result.confidence = this._calculateConfidence(result);
    result.searchType = this._determineSearchType(result);
    
    // Build compatible filter structure
    result.filters = this._buildFilters(result);
    
    return result;
  }

  /**
   * Normalize query text
   */
  _normalize(query) {
    return query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')  // Collapse whitespace
      .replace(/['"]/g, '')  // Remove quotes
      .replace(/[^\w\s\-\.\/]/g, ' '); // Keep only word chars, spaces, and common separators
  }

  /**
   * Tokenize query into words
   */
  _tokenize(query) {
    return query
      .split(/[\s,;]+/)
      .filter(t => t.length > 0);
  }

  /**
   * Extract part numbers from tokens
   */
  _extractPartNumbers(tokens, fullQuery) {
    const partNumbers = [];
    
    // Check each token against part number patterns
    for (const token of tokens) {
      const normalized = token.toUpperCase();
      
      // Check OEM pattern
      if (PATTERNS.partNumber.oem.test(normalized) && normalized.length >= 5) {
        partNumbers.push({
          value: normalized,
          type: 'oem',
          confidence: 0.9,
        });
        continue;
      }
      
      // Check numeric pattern (but not years)
      if (PATTERNS.partNumber.numeric.test(token) && !PATTERNS.yearPattern.test(token)) {
        partNumbers.push({
          value: token,
          type: 'numeric',
          confidence: 0.7,
        });
        continue;
      }
      
      // Check alphanumeric (like oil grades 5W30)
      if (PATTERNS.partNumber.alphaNum.test(token)) {
        partNumbers.push({
          value: normalized,
          type: 'code',
          confidence: 0.6,
        });
      }
    }
    
    // Also check full query for part numbers with spaces removed
    const compactQuery = fullQuery.replace(/\s/g, '').toUpperCase();
    if (PATTERNS.partNumber.oem.test(compactQuery) && compactQuery.length >= 6 && partNumbers.length === 0) {
      partNumbers.push({
        value: compactQuery,
        type: 'oem',
        confidence: 0.7,
      });
    }
    
    return partNumbers;
  }

  /**
   * Extract brand names from tokens
   */
  _extractBrands(tokens) {
    const brands = [];
    
    for (const token of tokens) {
      const lower = token.toLowerCase();
      
      if (PATTERNS.brandIndicators.has(lower)) {
        brands.push({
          value: this._capitalize(lower),
          confidence: 0.85,
        });
      }
    }
    
    return brands;
  }

  /**
   * Extract product categories
   */
  _extractCategories(tokens, fullQuery) {
    const categories = [];
    const queryLower = fullQuery.toLowerCase();
    
    // Check each category against its indicators
    for (const [category, indicators] of Object.entries(PATTERNS.categoryIndicators)) {
      for (const indicator of indicators) {
        if (queryLower.includes(indicator.toLowerCase())) {
          categories.push({
            value: category,
            matchedOn: indicator,
            confidence: indicator.length > 5 ? 0.9 : 0.7,
          });
          break; // Don't add same category multiple times
        }
      }
    }
    
    return categories;
  }

  /**
   * Extract vehicle information
   */
  _extractVehicle(tokens, fullQuery) {
    const vehicle = {
      make: null,
      model: null,
      year: null,
      confidence: 0,
    };
    
    // Check for make
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (PATTERNS.vehicleIndicators.makes.has(lower)) {
        vehicle.make = this._capitalize(lower);
        vehicle.confidence += 0.3;
        break;
      }
    }
    
    // Check for model
    const modelMatch = fullQuery.match(PATTERNS.vehicleIndicators.modelPatterns);
    if (modelMatch) {
      vehicle.model = this._capitalize(modelMatch[1]);
      vehicle.confidence += 0.3;
    }
    
    // Check for year
    const yearMatch = fullQuery.match(PATTERNS.yearPattern);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      if (year >= 1980 && year <= new Date().getFullYear() + 1) {
        vehicle.year = year;
        vehicle.confidence += 0.3;
      }
    }
    
    // Only return if we found something
    if (vehicle.make || vehicle.model || vehicle.year) {
      return vehicle;
    }
    
    return null;
  }

  /**
   * Extract position/location info
   */
  _extractPosition(tokens) {
    const positions = [];
    
    for (const token of tokens) {
      const lower = token.toLowerCase();
      for (const [position, indicators] of Object.entries(PATTERNS.positionIndicators)) {
        if (indicators.some(ind => lower.includes(ind.toLowerCase()))) {
          positions.push(position);
        }
      }
    }
    
    return [...new Set(positions)]; // Deduplicate
  }

  /**
   * Extract size/dimension info
   */
  _extractSize(query) {
    const size = {};
    
    // Check diameter
    const diamMatch = query.match(PATTERNS.sizePatterns.diameter);
    if (diamMatch) {
      size.diameter = {
        value: parseFloat(diamMatch[1]),
        unit: diamMatch[2].toLowerCase().replace('"', 'inch'),
      };
    }
    
    // Check thread size
    const threadMatch = query.match(PATTERNS.sizePatterns.thread);
    if (threadMatch) {
      size.thread = {
        major: parseInt(threadMatch[1]),
        pitch: parseFloat(threadMatch[2]),
      };
    }
    
    return Object.keys(size).length > 0 ? size : null;
  }

  /**
   * Extract engine information
   */
  _extractEngine(query) {
    const engine = {};
    
    // Check displacement
    const dispMatch = query.match(PATTERNS.enginePatterns.displacement);
    if (dispMatch) {
      if (dispMatch[1]) {
        engine.displacement = parseFloat(dispMatch[1]);
        engine.displacementUnit = 'L';
      } else if (dispMatch[3]) {
        engine.displacement = parseInt(dispMatch[3]);
        engine.displacementUnit = 'cc';
      }
    }
    
    // Check engine code
    const codeMatch = query.match(PATTERNS.enginePatterns.code);
    if (codeMatch) {
      engine.code = codeMatch[1].toUpperCase();
    }
    
    // Check aspiration
    const aspMatch = query.match(PATTERNS.enginePatterns.aspiration);
    if (aspMatch) {
      engine.aspiration = aspMatch[1].toLowerCase();
    }
    
    return Object.keys(engine).length > 0 ? engine : null;
  }

  /**
   * Calculate overall parsing confidence
   */
  _calculateConfidence(result) {
    let confidence = 0.2; // Base confidence for any parsed query
    let factors = 0;
    
    // Part numbers are high confidence
    if (result.partNumbers.length > 0) {
      confidence += result.partNumbers[0].confidence * 0.4;
      factors++;
    }
    
    // Brands boost confidence
    if (result.brands.length > 0) {
      confidence += 0.15;
      factors++;
    }
    
    // Categories are important
    if (result.categories.length > 0) {
      confidence += result.categories[0].confidence * 0.2;
      factors++;
    }
    
    // Vehicle context helps
    if (result.vehicle) {
      confidence += result.vehicle.confidence * 0.15;
      factors++;
    }
    
    // Normalize confidence to 0-1 range
    return Math.min(1, confidence);
  }

  /**
   * Determine search type based on extracted features
   */
  _determineSearchType(result) {
    // If we have a high-confidence part number, it's a part number search
    if (result.partNumbers.length > 0 && result.partNumbers[0].confidence >= 0.8) {
      return 'partNumber';
    }
    
    // If we have vehicle + category, it's a fitment search
    if (result.vehicle && result.categories.length > 0) {
      return 'fitment';
    }
    
    // If we have brand + category, it's a catalog search
    if (result.brands.length > 0 && result.categories.length > 0) {
      return 'catalog';
    }
    
    // Default to general search
    return 'general';
  }

  /**
   * Build filter structure for compatibility with existing system
   */
  _buildFilters(result) {
    const filters = {};
    
    // Part number filter
    if (result.partNumbers.length > 0) {
      filters.partNumber = result.partNumbers[0].value;
    }
    
    // Brand filter
    if (result.brands.length > 0) {
      filters.brand = result.brands.map(b => b.value);
    }
    
    // Category filter
    if (result.categories.length > 0) {
      filters.category = result.categories[0].value;
    }
    
    // Vehicle filters
    if (result.vehicle) {
      if (result.vehicle.make) filters.vehicleMake = result.vehicle.make;
      if (result.vehicle.model) filters.vehicleModel = result.vehicle.model;
      if (result.vehicle.year) filters.vehicleYear = result.vehicle.year;
    }
    
    // Position filters
    if (result.position.length > 0) {
      filters.position = result.position;
    }
    
    return filters;
  }

  /**
   * Helper: Capitalize first letter
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Return empty result structure
   */
  _emptyResult() {
    return {
      originalQuery: '',
      normalizedQuery: '',
      tokens: [],
      partNumbers: [],
      brands: [],
      categories: [],
      vehicle: null,
      position: [],
      size: null,
      engine: null,
      confidence: 0,
      method: 'token',
      searchType: 'general',
      filters: {},
    };
  }
}

// Singleton instance
const tokenParser = new TokenParser();

module.exports = {
  TokenParser,
  tokenParser,
  PATTERNS, // Export for testing
};
