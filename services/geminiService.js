/**
 * Gemini AI Service - Advanced Context-Aware Filtering with Learning
 *
 * This service provides truly intelligent search by having the AI analyze
 * ACTUAL DATA and decide what matches - not based on hardcoded rules.
 *
 * Architecture:
 * 1. Load learned context (what worked before)
 * 2. Parse user intent (what they want) - enhanced with learnings
 * 3. AI filters actual data based on understanding
 * 4. Record outcome for future learning
 */
const { GoogleGenAI } = require('@google/genai');
const aiLearningService = require('./aiLearningService');

// Validate GEMINI_API_KEY is set
if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  WARNING: GEMINI_API_KEY environment variable is not set!');
  console.warn('   AI-powered search features will not work without it.');
}

// Initialize the Gemini API (gracefully handle missing key)
let ai = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (err) {
  console.warn('⚠️ Failed to initialize Gemini API:', err.message);
}

// Initialize learning service
aiLearningService.initialize().catch((err) => {
  console.warn('⚠️ AI Learning Service initialization deferred:', err.message);
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INTENT PARSER v2 - Clean, deterministic intent extraction
 * Uses Gemini ONLY for complex natural language understanding
 * Falls back to robust local parser for reliability
 * ═══════════════════════════════════════════════════════════════════════════
 */
const INTENT_PARSER_INSTRUCTION = `You are an automotive parts search query parser. Extract structured filters from natural language.

RESPOND WITH VALID JSON ONLY. No markdown, no explanation.

CRITICAL RULES:
1. PRICE: "under $500" → maxPrice:500. "over $100" → minPrice:100. "$50-$200" → minPrice:50, maxPrice:200. "cheap"/"budget" → maxPrice:100. Currency is ALWAYS USD unless explicitly stated otherwise (AED, EUR, etc).
2. BRANDS: Distinguish VEHICLE brands (Toyota, BMW, Mercedes) from PARTS brands (Bosch, SKF, Denso). "Toyota brake pads" → vehicleBrand:"TOYOTA". "Bosch brake pads" → partsBrands:["BOSCH"].
3. CATEGORIES: Extract part types: brake, filter, engine, suspension, bearing, clutch, steering, exhaust, electrical, cooling, transmission, wheel, pump, sensor, gasket, belt, hose, etc.
4. STOCK: "in stock"/"available" → requireInStock:true. "full stock"/"plenty" → requireHighStock:true.
5. KEYWORDS: Extract ALL words that should match part descriptions. "brake pads" → ["brake","pad","pads","braking"]. Include synonyms.
6. DELIVERY: "fast delivery"/"express"/"urgent" → fastDelivery:true. "within 3 days" → maxDeliveryDays:3.
7. QUALITY: "OEM"/"genuine"/"original" → oem:true. "certified"/"verified" → certifiedSupplier:true.
8. EXCLUSIONS: "not Bosch"/"exclude Chinese" → exclude relevant items.
9. QUANTITY: "need 50 units"/"qty 100" → requestedQuantity:50/100.
10. TYPO TOLERANCE: "bosh"=BOSCH, "toyta"=TOYOTA, "bremb"=BREMBO, "mersedes"=MERCEDES.

OUTPUT FORMAT:
{
  "summary": "One-line description of what user wants",
  "searchKeywords": ["keyword1", "keyword2"],
  "partNumbers": ["ABC-123"],
  "vehicleBrand": null,
  "partsBrands": [],
  "categories": ["brake"],
  "maxPrice": null,
  "minPrice": null,
  "priceCurrency": "USD",
  "requireInStock": false,
  "requireHighStock": false,
  "fastDelivery": false,
  "maxDeliveryDays": null,
  "oem": false,
  "certifiedSupplier": false,
  "requestedQuantity": null,
  "sortPreference": null,
  "excludeBrands": [],
  "excludeOrigins": [],
  "confidence": "HIGH",
  "suggestions": ["suggestion1"]
}`;

// Remove old DATA_FILTER_INSTRUCTION - filtering is now done deterministically in code
// No more sending data to AI for filtering - this was the source of errors

// Constants for service configuration
const PARSE_TIMEOUT = 12000; // 12 second timeout for AI parsing
const MAX_BATCH_SIZE = 50; // Max items to send to AI for filtering at once

/**
 * Parse user intent from natural language query - v2
 * Uses robust local parsing FIRST, then enhances with Gemini if available
 */
async function parseUserIntent(query) {
  const startTime = Date.now();

  try {
    if (!query || query.trim().length < 2) {
      return { success: false, ...buildLocalParsedIntent(query), confidence: 'LOW' };
    }

    // STEP 1: Always do local parsing first (instant, reliable, never fails)
    const localParsed = buildLocalParsedIntent(query);

    // STEP 2: Try Gemini for enhanced understanding (optional, may fail)
    let geminiParsed = null;
    try {
      // Get learning context
      let learnedContext = { hasPriorLearning: false };
      try {
        learnedContext = await aiLearningService.getLearnedContext(query);
      } catch (e) { /* ignore */ }

      const learningPrompt = aiLearningService.generateLearningPrompt(learnedContext);

      const prompt = `${INTENT_PARSER_INSTRUCTION}\n${learningPrompt}\nUser query: "${query}"\n\nReturn ONLY valid JSON.`;

      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
          config: { temperature: 0.05, topP: 0.9, maxOutputTokens: 1024 },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), PARSE_TIMEOUT)),
      ]);

      let text = response.text.trim().replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) text = jsonMatch[0];
      geminiParsed = JSON.parse(text);
    } catch (aiError) {
      console.warn(`⚠️ Gemini parsing skipped: ${aiError.message}`);
    }

    // STEP 3: Merge - local parsed is the FOUNDATION, Gemini enhances it
    const merged = mergeIntents(localParsed, geminiParsed);
    const parseTime = Date.now() - startTime;

    console.log(`✅ Intent parsed in ${parseTime}ms:`, JSON.stringify(merged.summary));

    return { success: true, ...merged, parseTime };
  } catch (error) {
    console.warn(`⚠️ Intent parsing failed: ${error.message}`);
    return { success: false, ...buildLocalParsedIntent(query), confidence: 'LOW' };
  }
}

/**
 * Build a complete parsed intent using LOCAL rules (no AI needed)
 * This is the reliable backbone - it NEVER fails
 */
function buildLocalParsedIntent(query) {
  if (!query) return { summary: '', searchKeywords: [], partNumbers: [], categories: [], confidence: 'LOW' };

  let q = query.toLowerCase().trim();

  // ── Typo corrections ──
  const typoMap = {
    'toyta': 'toyota', 'toyata': 'toyota', 'tayota': 'toyota',
    'bosh': 'bosch', 'bosc': 'bosch',
    'bremb': 'brembo', 'bremboo': 'brembo',
    'nisaan': 'nissan', 'nisan': 'nissan',
    'mercedez': 'mercedes', 'mersedes': 'mercedes', 'merc': 'mercedes',
    'hynudai': 'hyundai', 'hyundia': 'hyundai', 'hundai': 'hyundai',
    'volkswagon': 'volkswagen', 'vw': 'volkswagen',
    'porshe': 'porsche', 'porche': 'porsche',
    'chevrolete': 'chevrolet', 'chevy': 'chevrolet',
    'acdelko': 'acdelco',
    'germn': 'german', 'japnese': 'japanese', 'chines': 'chinese',
  };
  for (const [typo, fix] of Object.entries(typoMap)) {
    q = q.replace(new RegExp(`\\b${typo}\\b`, 'g'), fix);
  }

  const result = {
    summary: '',
    searchKeywords: [],
    partNumbers: [],
    vehicleBrand: null,
    partsBrands: [],
    categories: [],
    maxPrice: null,
    minPrice: null,
    priceCurrency: 'USD',
    requireInStock: false,
    requireHighStock: false,
    fastDelivery: false,
    maxDeliveryDays: null,
    oem: false,
    certifiedSupplier: false,
    requestedQuantity: null,
    sortPreference: null,
    excludeBrands: [],
    excludeOrigins: [],
    confidence: 'MEDIUM',
    suggestions: [],
  };

  // ── Price extraction (CRITICAL - must be exact) ──
  // "under $500" / "below 500" / "less than $500" / "max $500" / "cheaper than 500"
  const maxPriceMatch = q.match(/(?:under|below|less\s+than|max|cheaper\s+than|up\s+to|no\s+more\s+than|budget|within)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/);
  if (maxPriceMatch) result.maxPrice = parseFloat(maxPriceMatch[1].replace(/,/g, ''));

  // "over $100" / "above 100" / "more than $100" / "min $100" / "at least $100"  
  const minPriceMatch = q.match(/(?:over|above|more\s+than|min|at\s+least|starting\s+from|from)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/);
  if (minPriceMatch) result.minPrice = parseFloat(minPriceMatch[1].replace(/,/g, ''));

  // "$100-$500" / "between $100 and $500"
  const rangeMatch = q.match(/\$?\s*(\d+(?:,\d{3})*)\s*[-–to]+\s*\$?\s*(\d+(?:,\d{3})*)/);
  if (rangeMatch && !maxPriceMatch && !minPriceMatch) {
    result.minPrice = parseFloat(rangeMatch[1].replace(/,/g, ''));
    result.maxPrice = parseFloat(rangeMatch[2].replace(/,/g, ''));
  }

  // "cheap" / "budget" / "affordable"
  if (/\b(cheap|budget|affordable|economical|inexpensive)\b/.test(q) && !result.maxPrice) {
    result.maxPrice = 100;
  }
  // "expensive" / "premium" / "high-end"
  if (/\b(expensive|premium|high[\s-]?end|luxury)\b/.test(q) && !result.minPrice) {
    result.minPrice = 500;
  }

  // Currency detection
  if (/\b(aed|dirham|dhs)\b/.test(q)) result.priceCurrency = 'AED';
  else if (/\b(eur|euro|€)\b/.test(q)) result.priceCurrency = 'EUR';
  else if (/\b(gbp|pound|£)\b/.test(q)) result.priceCurrency = 'GBP';

  // ── Vehicle brands vs parts brands ──
  const vehicleBrandMap = {
    'toyota': 'TOYOTA', 'honda': 'HONDA', 'nissan': 'NISSAN', 'bmw': 'BMW',
    'mercedes': 'MERCEDES-BENZ', 'audi': 'AUDI', 'volkswagen': 'VOLKSWAGEN',
    'ford': 'FORD', 'chevrolet': 'CHEVROLET', 'hyundai': 'HYUNDAI',
    'kia': 'KIA', 'mazda': 'MAZDA', 'subaru': 'SUBARU', 'lexus': 'LEXUS',
    'porsche': 'PORSCHE', 'volvo': 'VOLVO', 'jeep': 'JEEP', 'dodge': 'DODGE',
    'mitsubishi': 'MITSUBISHI', 'suzuki': 'SUZUKI', 'isuzu': 'ISUZU',
    'infiniti': 'INFINITI', 'acura': 'ACURA', 'jaguar': 'JAGUAR',
    'land rover': 'LAND ROVER', 'tesla': 'TESLA', 'peugeot': 'PEUGEOT',
    'renault': 'RENAULT', 'fiat': 'FIAT', 'alfa romeo': 'ALFA ROMEO',
  };

  const partsBrandMap = {
    'bosch': 'BOSCH', 'skf': 'SKF', 'denso': 'DENSO', 'valeo': 'VALEO',
    'brembo': 'BREMBO', 'gates': 'GATES', 'continental': 'CONTINENTAL',
    'mann': 'MANN', 'mahle': 'MAHLE', 'sachs': 'SACHS', 'bilstein': 'BILSTEIN',
    'kyb': 'KYB', 'monroe': 'MONROE', 'acdelco': 'ACDELCO', 'mopar': 'MOPAR',
    'ngk': 'NGK', 'delphi': 'DELPHI', 'aisin': 'AISIN', 'luk': 'LUK',
    'trw': 'TRW', 'ate': 'ATE', 'ferodo': 'FERODO', 'hella': 'HELLA',
    'febi': 'FEBI', 'lemforder': 'LEMFORDER', 'meyle': 'MEYLE', 'swag': 'SWAG',
    'timken': 'TIMKEN', 'nsk': 'NSK', 'ntn': 'NTN', 'fag': 'FAG',
    'motorcraft': 'MOTORCRAFT', 'osram': 'OSRAM', 'philips': 'PHILIPS',
    'moog': 'MOOG', 'dayco': 'DAYCO', 'walker': 'WALKER', 'wix': 'WIX',
    'champion': 'CHAMPION', 'exedy': 'EXEDY', 'ina': 'INA',
  };

  // Check vehicle brands
  for (const [key, val] of Object.entries(vehicleBrandMap)) {
    if (q.includes(key)) {
      result.vehicleBrand = val;
      break;
    }
  }

  // Check parts brands
  for (const [key, val] of Object.entries(partsBrandMap)) {
    if (new RegExp(`\\b${key}\\b`).test(q)) {
      result.partsBrands.push(val);
    }
  }

  // ── Categories ──
  const categoryMap = {
    'brake pad': 'brake', 'brake disc': 'brake', 'brake rotor': 'brake',
    'brake caliper': 'brake', 'brake fluid': 'brake', 'brake hose': 'brake',
    'brake drum': 'brake', 'brake shoe': 'brake', 'brake line': 'brake',
    'brake light': 'brake', 'brake': 'brake', 'braking': 'brake',
    'oil filter': 'filter', 'air filter': 'filter', 'fuel filter': 'filter',
    'cabin filter': 'filter', 'filter': 'filter',
    'engine mount': 'engine', 'engine oil': 'engine', 'engine': 'engine',
    'suspension': 'suspension', 'shock absorber': 'suspension', 'strut': 'suspension',
    'spring': 'suspension', 'control arm': 'suspension',
    'bearing': 'bearing', 'wheel bearing': 'bearing', 'hub bearing': 'bearing',
    'clutch': 'clutch', 'clutch kit': 'clutch', 'clutch plate': 'clutch',
    'steering': 'steering', 'power steering': 'steering', 'steering rack': 'steering',
    'exhaust': 'exhaust', 'muffler': 'exhaust', 'catalytic': 'exhaust',
    'alternator': 'electrical', 'starter': 'electrical', 'battery': 'electrical',
    'spark plug': 'electrical', 'ignition': 'electrical', 'coil': 'electrical',
    'radiator': 'cooling', 'thermostat': 'cooling', 'water pump': 'cooling',
    'coolant': 'cooling', 'fan': 'cooling',
    'transmission': 'transmission', 'gearbox': 'transmission',
    'timing belt': 'belt', 'serpentine belt': 'belt', 'belt': 'belt',
    'gasket': 'gasket', 'head gasket': 'gasket', 'seal': 'seal',
    'sensor': 'sensor', 'oxygen sensor': 'sensor', 'abs sensor': 'sensor',
    'injector': 'fuel', 'fuel pump': 'fuel', 'fuel': 'fuel',
    'wiper': 'wiper', 'mirror': 'body', 'bumper': 'body', 'fender': 'body',
    'headlight': 'lighting', 'tail light': 'lighting', 'lamp': 'lighting',
    'hub': 'hub', 'axle': 'axle', 'cv joint': 'axle', 'driveshaft': 'axle',
    'pump': 'pump', 'valve': 'valve', 'piston': 'engine',
    'turbo': 'turbo', 'turbocharger': 'turbo', 'supercharger': 'turbo',
  };

  const sortedCategoryKeys = Object.keys(categoryMap).sort((a, b) => b.length - a.length);
  const addedCategories = new Set();
  for (const key of sortedCategoryKeys) {
    if (q.includes(key) && !addedCategories.has(categoryMap[key])) {
      result.categories.push(categoryMap[key]);
      addedCategories.add(categoryMap[key]);
    }
  }

  // ── Search keywords (for description matching) ──
  const stopWords = new Set([
    'find', 'me', 'show', 'get', 'looking', 'for', 'need', 'want', 'the', 'a', 'an',
    'some', 'with', 'from', 'i', 'am', 'please', 'can', 'you', 'under', 'below',
    'above', 'over', 'price', 'priced', 'less', 'more', 'than', 'and', 'or', 'not',
    'no', 'up', 'to', 'at', 'least', 'most', 'around', 'about', 'in', 'of',
    'search', 'parts', 'part', 'suppliers', 'supplier', 'verified', 'certified',
    'available', 'stock', 'delivery', 'fast', 'quick', 'express', 'cheap', 'budget',
    'best', 'good', 'high', 'quality', 'premium', 'professional', 'all', 'any',
  ]);

  const words = q.replace(/[^\w\s-]/g, ' ').split(/\s+/).filter(w => {
    if (w.length < 2) return false;
    if (stopWords.has(w)) return false;
    if (/^\d+$/.test(w)) return false;
    // Don't include brand names as search keywords (they're already in brands)
    if (vehicleBrandMap[w] || partsBrandMap[w]) return false;
    return true;
  });

  // Also expand categories to related keywords
  const categoryKeywordMap = {
    'brake': ['brake', 'brakes', 'braking', 'brake pad', 'brake disc', 'brake fluid', 'brake drum', 'brake shoe'],
    'filter': ['filter', 'filters', 'filtration'],
    'engine': ['engine', 'motor'],
    'bearing': ['bearing', 'bearings'],
    'suspension': ['suspension', 'shock', 'strut', 'spring'],
    'steering': ['steering', 'steer'],
    'cooling': ['cooling', 'coolant', 'radiator', 'thermostat'],
    'electrical': ['electrical', 'electric', 'alternator', 'starter', 'battery'],
    'clutch': ['clutch'],
    'exhaust': ['exhaust', 'muffler', 'catalytic'],
    'transmission': ['transmission', 'gearbox'],
    'belt': ['belt', 'timing', 'serpentine'],
    'fuel': ['fuel', 'injector'],
    'sensor': ['sensor', 'sensors'],
    'seal': ['seal', 'sealing', 'o-ring'],
    'gasket': ['gasket', 'gaskets'],
  };

  const expandedKeywords = new Set(words);
  for (const cat of result.categories) {
    const related = categoryKeywordMap[cat] || [cat];
    related.forEach(k => expandedKeywords.add(k));
  }

  result.searchKeywords = [...expandedKeywords].slice(0, 15);

  // ── Part numbers ──
  const tokens = query.replace(/[^\w\s-]/g, ' ').split(/\s+/);
  result.partNumbers = tokens.filter(t => /\d/.test(t) && /^[A-Za-z0-9][-A-Za-z0-9_]{3,}$/.test(t) && t.length >= 4);

  // ── Stock requirements ──
  if (/\b(in\s*stock|available|have\s+it|ready)\b/.test(q)) result.requireInStock = true;
  if (/\b(full\s*stock|high\s*stock|plenty|lots|well\s*stocked|large\s*qty|bulk)\b/.test(q)) {
    result.requireHighStock = true;
    result.requireInStock = true;
  }

  // ── Delivery ──
  if (/\b(fast|express|quick|urgent|rush|asap|immediate)\b/.test(q)) result.fastDelivery = true;
  const deliveryMatch = q.match(/within\s+(\d+)\s*days?/);
  if (deliveryMatch) result.maxDeliveryDays = parseInt(deliveryMatch[1]);

  // ── OEM / Certified ──
  if (/\b(oem|genuine|original)\b/.test(q)) result.oem = true;
  if (/\b(certified|verified|trusted|authorized)\b/.test(q)) result.certifiedSupplier = true;

  // ── Quantity ──
  const qtyMatch = q.match(/(?:qty|quantity|need|order)\s*:?\s*(\d+)|x\s*(\d+)\b|(\d+)\s*(?:units?|pcs?|pieces?)/);
  if (qtyMatch) result.requestedQuantity = parseInt(qtyMatch[1] || qtyMatch[2] || qtyMatch[3]);

  // ── Exclusions ──
  const excludeBrandMatch = q.match(/(?:not|no|exclude|without|except)\s+(\w+)/g);
  if (excludeBrandMatch) {
    excludeBrandMatch.forEach(match => {
      const brand = match.replace(/^(not|no|exclude|without|except)\s+/i, '').trim();
      if (partsBrandMap[brand]) result.excludeBrands.push(partsBrandMap[brand]);
      if (vehicleBrandMap[brand]) result.excludeBrands.push(vehicleBrandMap[brand]);
    });
  }
  if (/\b(no|not|exclude|without)\s*(chinese|china)\b/.test(q)) result.excludeOrigins.push('CN');
  if (/\b(no|not|exclude|without)\s*(indian|india)\b/.test(q)) result.excludeOrigins.push('IN');

  // ── Origin preference ──
  if (/\bgerman\b/.test(q)) result.certifiedSupplier = true; // German = quality
  if (/\bjapanese\b/.test(q)) result.certifiedSupplier = true;

  // ── Sort preference ──
  if (/\bcheapest|lowest\s+price|best\s+price\b/.test(q)) result.sortPreference = 'price_asc';
  if (/\bmost\s+expensive|highest\s+price\b/.test(q)) result.sortPreference = 'price_desc';
  if (/\bmost\s+stock|highest\s+quantity\b/.test(q)) result.sortPreference = 'quantity_desc';
  if (/\bfastest\s+delivery|quickest\b/.test(q)) result.sortPreference = 'delivery_asc';

  // ── Build summary ──
  const summaryParts = [];
  if (result.categories.length > 0) summaryParts.push(result.categories.join(', ') + ' parts');
  if (result.vehicleBrand) summaryParts.push(`for ${result.vehicleBrand}`);
  if (result.partsBrands.length > 0) summaryParts.push(`by ${result.partsBrands.join(', ')}`);
  if (result.maxPrice) summaryParts.push(`under $${result.maxPrice}`);
  if (result.minPrice) summaryParts.push(`over $${result.minPrice}`);
  if (result.requireInStock) summaryParts.push('in stock');
  if (result.requireHighStock) summaryParts.push('with high availability');
  if (result.fastDelivery) summaryParts.push('with fast delivery');
  if (result.oem) summaryParts.push('OEM/genuine');
  if (result.certifiedSupplier) summaryParts.push('from certified suppliers');
  result.summary = summaryParts.length > 0 ? `Find ${summaryParts.join(' ')}` : `Search for: ${query}`;

  return result;
}

/**
 * Merge local parsing with Gemini results
 * Local parsing is ALWAYS the foundation - Gemini only enhances/overrides with higher confidence
 */
function mergeIntents(local, gemini) {
  if (!gemini) return local;

  const merged = { ...local };

  // Gemini can add search keywords we missed
  if (gemini.searchKeywords?.length > 0) {
    merged.searchKeywords = [...new Set([...local.searchKeywords, ...gemini.searchKeywords])].slice(0, 20);
  }

  // Gemini can find part numbers we missed
  if (gemini.partNumbers?.length > 0) {
    merged.partNumbers = [...new Set([...local.partNumbers, ...gemini.partNumbers])];
  }

  // Gemini overrides vehicle brand only if local didn't find one
  if (!local.vehicleBrand && gemini.vehicleBrand) {
    merged.vehicleBrand = gemini.vehicleBrand.toUpperCase();
  }

  // Gemini can add parts brands
  if (gemini.partsBrands?.length > 0) {
    merged.partsBrands = [...new Set([...local.partsBrands, ...gemini.partsBrands.map(b => b.toUpperCase())])];
  }

  // Gemini can add categories
  if (gemini.categories?.length > 0) {
    merged.categories = [...new Set([...local.categories, ...gemini.categories.map(c => c.toLowerCase())])];
  }

  // CRITICAL: Price - use local parsing if found (it's reliable), only use Gemini if local missed it
  if (local.maxPrice === null && gemini.maxPrice != null) merged.maxPrice = Number(gemini.maxPrice);
  if (local.minPrice === null && gemini.minPrice != null) merged.minPrice = Number(gemini.minPrice);

  // Stock - OR them together (if either thinks user wants stock filter, apply it)
  if (gemini.requireInStock) merged.requireInStock = true;
  if (gemini.requireHighStock) merged.requireHighStock = true;

  // Delivery
  if (gemini.fastDelivery) merged.fastDelivery = true;
  if (gemini.maxDeliveryDays && !local.maxDeliveryDays) merged.maxDeliveryDays = gemini.maxDeliveryDays;

  // OEM / Certified
  if (gemini.oem) merged.oem = true;
  if (gemini.certifiedSupplier) merged.certifiedSupplier = true;

  // Quantity
  if (!local.requestedQuantity && gemini.requestedQuantity) merged.requestedQuantity = gemini.requestedQuantity;

  // Exclusions
  if (gemini.excludeBrands?.length > 0) {
    merged.excludeBrands = [...new Set([...local.excludeBrands, ...gemini.excludeBrands])];
  }
  if (gemini.excludeOrigins?.length > 0) {
    merged.excludeOrigins = [...new Set([...local.excludeOrigins, ...gemini.excludeOrigins])];
  }

  // Summary - prefer Gemini's if it has one
  if (gemini.summary && gemini.summary.length > 10) merged.summary = gemini.summary;

  // Suggestions
  if (gemini.suggestions?.length > 0) merged.suggestions = gemini.suggestions;

  // Confidence
  merged.confidence = gemini.confidence || local.confidence;

  return merged;
}

/**
 * Deterministic data filtering v2 - NO AI needed, pure code logic
 * This replaces the old AI-based filtering that was unreliable
 * EVERY filter is applied deterministically with clear rules
 */
function filterDataWithAI(parts, parsedIntent, originalQuery) {
  const startTime = Date.now();

  if (!parts || parts.length === 0) {
    return { matchingParts: [], analysis: { totalReceived: 0, matching: 0, filtersApplied: {} } };
  }

  let filtered = [...parts];
  const totalBefore = filtered.length;
  const filtersApplied = {};

  // ── 1. KEYWORD / CATEGORY FILTERING (search descriptions) ──
  const keywords = parsedIntent.searchKeywords || [];
  const categories = parsedIntent.categories || [];
  const allSearchTerms = [...new Set([...keywords, ...categories])];

  if (allSearchTerms.length > 0) {
    filtered = filtered.filter(p => {
      const searchText = [
        p.description || '',
        p.category || '',
        p.subcategory || '',
        p.partNumber || '',
        ...(p.tags || []),
      ].join(' ').toLowerCase();

      // At least ONE search term must appear in the part's searchable text
      return allSearchTerms.some(term => searchText.includes(term.toLowerCase()));
    });
    filtersApplied.keywords = `Matched: ${allSearchTerms.join(', ')} (${totalBefore} → ${filtered.length})`;
  }

  // ── 2. VEHICLE BRAND FILTERING ──
  if (parsedIntent.vehicleBrand) {
    const vBrand = parsedIntent.vehicleBrand.toLowerCase();
    const beforeCount = filtered.length;
    filtered = filtered.filter(p => {
      const brandText = (p.brand || '').toLowerCase();
      const descText = (p.description || '').toLowerCase();
      const supplierText = (p.supplier || '').toLowerCase();
      return brandText.includes(vBrand) || descText.includes(vBrand) || supplierText.includes(vBrand);
    });
    filtersApplied.vehicleBrand = `${parsedIntent.vehicleBrand} (${beforeCount} → ${filtered.length})`;
  }

  // ── 3. PARTS BRAND FILTERING ──
  if (parsedIntent.partsBrands && parsedIntent.partsBrands.length > 0) {
    const brandsLower = parsedIntent.partsBrands.map(b => b.toLowerCase());
    const beforeCount = filtered.length;
    filtered = filtered.filter(p => {
      if (!p.brand) return false;
      const partBrand = p.brand.toLowerCase();
      return brandsLower.some(b => partBrand.includes(b) || b.includes(partBrand));
    });
    filtersApplied.partsBrands = `${parsedIntent.partsBrands.join(', ')} (${beforeCount} → ${filtered.length})`;
  }

  // ── 4. PRICE FILTERING (CRITICAL - with proper currency conversion) ──
  // Database stores prices in AED. User typically specifies in USD.
  const CURRENCY_TO_AED = {
    'USD': 3.67, 'EUR': 4.00, 'GBP': 4.65, 'AED': 1, 'SAR': 0.98, 'JPY': 0.025, 'CNY': 0.51,
  };

  const priceCurrency = (parsedIntent.priceCurrency || 'USD').toUpperCase();
  const conversionRate = CURRENCY_TO_AED[priceCurrency] || 3.67; // Default to USD→AED

  if (parsedIntent.maxPrice != null) {
    const maxPriceAED = parsedIntent.maxPrice * conversionRate;
    const beforeCount = filtered.length;
    filtered = filtered.filter(p => {
      if (p.price == null || p.price === undefined) return true; // Include parts with no price listed
      return p.price <= maxPriceAED;
    });
    filtersApplied.maxPrice = `≤ $${parsedIntent.maxPrice} ${priceCurrency} (${maxPriceAED.toFixed(0)} AED) (${beforeCount} → ${filtered.length})`;
  }

  if (parsedIntent.minPrice != null) {
    const minPriceAED = parsedIntent.minPrice * conversionRate;
    const beforeCount = filtered.length;
    filtered = filtered.filter(p => {
      if (p.price == null || p.price === undefined) return false; // Exclude parts with no price
      return p.price >= minPriceAED;
    });
    filtersApplied.minPrice = `≥ $${parsedIntent.minPrice} ${priceCurrency} (${minPriceAED.toFixed(0)} AED) (${beforeCount} → ${filtered.length})`;
  }

  // ── 5. STOCK FILTERING ──
  if (parsedIntent.requireHighStock) {
    const beforeCount = filtered.length;
    filtered = filtered.filter(p => (p.quantity || 0) >= 10);
    filtersApplied.stock = `High stock qty≥10 (${beforeCount} → ${filtered.length})`;
  } else if (parsedIntent.requireInStock) {
    const beforeCount = filtered.length;
    filtered = filtered.filter(p => (p.quantity || 0) > 0);
    filtersApplied.stock = `In stock qty>0 (${beforeCount} → ${filtered.length})`;
  }

  // ── 6. DELIVERY FILTERING ──
  if (parsedIntent.fastDelivery || parsedIntent.maxDeliveryDays) {
    const maxDays = parsedIntent.maxDeliveryDays || 5;
    const beforeCount = filtered.length;
    filtered = filtered.filter(p => {
      if (!p.deliveryDays) return true; // Include if delivery not specified
      return p.deliveryDays <= maxDays;
    });
    filtersApplied.delivery = `≤ ${maxDays} days (${beforeCount} → ${filtered.length})`;
  }

  // ── 7. EXCLUSION FILTERING ──
  if (parsedIntent.excludeBrands && parsedIntent.excludeBrands.length > 0) {
    const excludeLower = parsedIntent.excludeBrands.map(b => b.toLowerCase());
    const beforeCount = filtered.length;
    filtered = filtered.filter(p => {
      if (!p.brand) return true;
      return !excludeLower.some(b => p.brand.toLowerCase().includes(b));
    });
    filtersApplied.excludeBrands = `Excluded: ${parsedIntent.excludeBrands.join(', ')} (${beforeCount} → ${filtered.length})`;
  }

  // ── 8. QUANTITY REQUIREMENT ──
  if (parsedIntent.requestedQuantity && parsedIntent.requestedQuantity > 1) {
    const beforeCount = filtered.length;
    filtered = filtered.filter(p => (p.quantity || 0) >= parsedIntent.requestedQuantity);
    filtersApplied.quantity = `≥ ${parsedIntent.requestedQuantity} units (${beforeCount} → ${filtered.length})`;
  }

  const filterTime = Date.now() - startTime;

  return {
    matchingParts: filtered,
    analysis: {
      totalReceived: totalBefore,
      matching: filtered.length,
      excluded: totalBefore - filtered.length,
      filterTime,
      filtersApplied,
    },
  };
}

/**
 * Main AI search function v2 - combines intent parsing with clean filter format
 * Returns a standardized format for the search controller
 */
async function parseSearchQuery(query) {
  const startTime = Date.now();

  try {
    // Parse user intent (local + optional Gemini enhancement)
    const intent = await parseUserIntent(query);

    // Convert to the backward-compatible filter format
    const filters = {
      brand: intent.partsBrands || [],
      vehicleBrand: intent.vehicleBrand || null,
      category: intent.categories?.[0] || '',
      categories: intent.categories || [],
      maxPrice: intent.maxPrice,
      minPrice: intent.minPrice,
      priceCurrency: intent.priceCurrency || 'USD',
      inStock: intent.requireInStock || intent.requireHighStock || false,
      stockLevel: intent.requireHighStock ? 'high' : '',
      minQuantity: intent.requireHighStock ? 10 : null,
      fastDelivery: intent.fastDelivery || false,
      maxDeliveryDays: intent.maxDeliveryDays || null,
      oem: intent.oem || false,
      certifiedSupplier: intent.certifiedSupplier || false,
      requestedQuantity: intent.requestedQuantity || null,
      sortPreference: intent.sortPreference || null,
      exclude: {
        brands: intent.excludeBrands || [],
        origins: intent.excludeOrigins || [],
        stockLevels: intent.requireHighStock ? ['low'] : [],
      },
    };

    const parseTime = Date.now() - startTime;
    console.log(`✅ AI parsed query in ${parseTime}ms`);

    return {
      success: true,
      searchTerms: [...(intent.partNumbers || []), ...(intent.searchKeywords || [])],
      filters,
      intent: intent.summary || `Search for: ${query}`,
      suggestions: intent.suggestions || [],
      parseTime,
      // Pass full parsed intent for the deterministic filter engine
      parsedIntent: intent,
    };
  } catch (error) {
    console.warn(`⚠️ AI search error: ${error.message}`);
    const localParsed = buildLocalParsedIntent(query);
    return {
      success: false,
      searchTerms: [...(localParsed.partNumbers || []), ...(localParsed.searchKeywords || [])],
      filters: {
        brand: localParsed.partsBrands || [],
        maxPrice: localParsed.maxPrice,
        minPrice: localParsed.minPrice,
        priceCurrency: 'USD',
        inStock: localParsed.requireInStock || false,
      },
      intent: `Searching for: "${query}"`,
      suggestions: ['Try being more specific', 'Include brand names or part numbers'],
      error: error.message,
      parsedIntent: localParsed,
    };
  }
}

/**
 * Generate smart search suggestions based on user input
 * @param {string} partialQuery - The user's partial query
 * @returns {Promise<Array>} Array of search suggestions
 */
async function generateSuggestions(partialQuery) {
  try {
    const prompt = `Given this partial search query for automotive parts: "${partialQuery}"
    
Generate 5 helpful search suggestions that the user might be looking for. 
Focus on common automotive parts and brands.

Respond ONLY with a JSON array of strings, no markdown, no code blocks:
["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4", "suggestion 5"]`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 256,
      },
    });

    let text = response.text.trim();

    // Clean up response
    text = text
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();

    const suggestions = JSON.parse(text);
    return Array.isArray(suggestions) ? suggestions.slice(0, 5) : [];
  } catch (error) {
    console.error('Suggestion generation error:', error);
    return [];
  }
}

/**
 * Analyze search results and provide insights
 * @param {Array} results - The search results
 * @param {string} query - The original query
 * @returns {Promise<Object>} Analysis and recommendations
 */
async function analyzeResults(results, query) {
  try {
    if (!results || results.length === 0) {
      return {
        success: true,
        summary: 'No results found for your search',
        recommendations: [
          'Try different keywords',
          'Check for typos in part numbers',
          'Use broader search terms',
        ],
        insights: {},
      };
    }

    // Calculate statistics from results
    const prices = results.filter((r) => r.price).map((r) => r.price);
    const brands = [
      ...new Set(results.filter((r) => r.brand).map((r) => r.brand)),
    ];
    const suppliers = [
      ...new Set(results.filter((r) => r.supplier).map((r) => r.supplier)),
    ];
    const inStock = results.filter((r) => r.quantity > 0).length;

    const stats = {
      totalResults: results.length,
      inStock,
      outOfStock: results.length - inStock,
      uniqueBrands: brands.length,
      uniqueSuppliers: suppliers.length,
      priceRange:
        prices.length > 0
          ? {
              min: Math.min(...prices),
              max: Math.max(...prices),
              avg:
                Math.round(
                  (prices.reduce((a, b) => a + b, 0) / prices.length) * 100,
                ) / 100,
            }
          : null,
      topBrands: brands.slice(0, 5),
    };

    const prompt = `Analyze these automotive parts search results and provide helpful insights:

Query: "${query}"
Statistics:
- Total results: ${stats.totalResults}
- In stock: ${stats.inStock}
- Price range: ${stats.priceRange ? `$${stats.priceRange.min} - $${stats.priceRange.max}` : 'N/A'}
- Available from ${stats.uniqueSuppliers} suppliers
- Brands: ${stats.topBrands.join(', ')}

Provide a brief, helpful summary and 2-3 recommendations. Respond with ONLY valid JSON:
{
  "summary": "Brief summary of results",
  "recommendations": ["recommendation 1", "recommendation 2"],
  "bestValue": "Which option offers best value"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    });

    let text = response.text.trim();

    // Clean up response
    text = text
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();

    const analysis = JSON.parse(text);

    return {
      success: true,
      summary: analysis.summary || `Found ${stats.totalResults} results`,
      recommendations: analysis.recommendations || [],
      bestValue: analysis.bestValue || null,
      insights: stats,
    };
  } catch (error) {
    console.error('Result analysis error:', error);
    return {
      success: false,
      summary: `Found ${results.length} results for your search`,
      recommendations: [],
      insights: {},
    };
  }
}

// Old normalizeFilters, extractBasicKeywords, extractBasicFilters removed
// All functionality is now in buildLocalParsedIntent and filterDataWithAI above


// ====================================
// EXCEL DATA ANALYSIS - AI POWERED
// ====================================

/**
 * System instruction for Excel data analysis
 */
const EXCEL_ANALYSIS_INSTRUCTION = `You are an intelligent Excel/spreadsheet data analyzer for PartsForm, a B2B industrial parts marketplace. Your role is to analyze raw spreadsheet data and extract part numbers and quantities, even when the data is poorly formatted or lacks proper structure.

IMPORTANT: You MUST respond ONLY with valid JSON. No explanations, no markdown, no code blocks - just pure JSON.

When analyzing spreadsheet data:

1. **Identify Part Numbers**: Look for patterns that could be part numbers:
   - PURELY NUMERIC part numbers (e.g., "8471474", "1234567", "3123124", "7700109906") - these are VERY COMMON
   - ALPHANUMERIC part numbers with letters AND numbers in ANY position (e.g., "213ds1", "CAF-000267", "SKF-12345", "A1B2C3")
   - Part numbers with dashes, underscores, or other separators (e.g., "BRK-001", "ENG-2024-001")
   - Usually 4-20 characters long
   - May appear in any column or row
   - IMPORTANT: Do NOT skip numbers just because they lack letters - many OEM part numbers are purely numeric

2. **Identify Quantities**: Look for numeric values that could represent quantities
   - Often near part numbers
   - Usually small integers (1-1000)
   - Words like "qty", "quantity", "pcs", "pieces", "units", "count" may indicate quantity columns

3. **Identify Brands**: Look for known automotive brands
   - BOSCH, SKF, DENSO, VALEO, BREMBO, GATES, CONTINENTAL, MANN, MAHLE, etc.
   - May appear as separate column or within part descriptions

4. **Handle Poor Formatting**:
   - Data might be in any column
   - Headers might be missing
   - Multiple parts might be in one cell
   - Data might be mixed with descriptions

5. **Provide Confidence Scores**: Rate how confident you are about each extraction (high, medium, low)

Respond ONLY with this exact JSON structure:
{
  "success": true,
  "summary": "Brief description of what was found",
  "totalPartsFound": 0,
  "parts": [
    {
      "partNumber": "extracted part number",
      "quantity": 1,
      "brand": "brand if identified or null",
      "description": "any description found or null",
      "originalText": "original cell/row text",
      "confidence": "high/medium/low"
    }
  ],
  "dataQuality": {
    "hasHeaders": true/false,
    "hasPartNumberColumn": true/false,
    "hasQuantityColumn": true/false,
    "hasBrandColumn": true/false,
    "formatting": "good/fair/poor",
    "issues": ["list of identified issues"]
  },
  "suggestions": ["suggestions to improve data quality"],
  "detectedColumns": {
    "partNumber": "column name or index if detected",
    "quantity": "column name or index if detected",
    "brand": "column name or index if detected"
  }
}`;

/**
 * Analyze Excel/CSV data using AI to extract parts information
 * @param {Array} rawData - Raw data from Excel file (array of rows, each row is array of cells)
 * @param {Object} options - Additional options like filename, sheetName
 * @returns {Promise<Object>} Analyzed parts data
 */
async function analyzeExcelData(rawData, options = {}) {
  try {
    // Limit data size to prevent token overflow
    const maxRows = 100;
    const limitedData = rawData.slice(0, maxRows);

    // Convert to readable format for AI
    const dataPreview = limitedData
      .map((row, idx) => {
        if (Array.isArray(row)) {
          return `Row ${idx + 1}: ${row.map((cell) => cell ?? '').join(' | ')}`;
        } else if (typeof row === 'object') {
          return `Row ${idx + 1}: ${Object.values(row)
            .map((v) => v ?? '')
            .join(' | ')}`;
        }
        return `Row ${idx + 1}: ${row}`;
      })
      .join('\n');

    const prompt = `${EXCEL_ANALYSIS_INSTRUCTION}

Analyze this spreadsheet data and extract all part numbers with their quantities:

File: ${options.filename || 'Unknown'}
Sheet: ${options.sheetName || 'Sheet1'}
Total rows: ${rawData.length}

Data:
${dataPreview}

Remember: Respond with ONLY valid JSON, no markdown formatting, no code blocks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 4096,
      },
    });

    let text = response.text.trim();

    // Clean up the response - remove any markdown code blocks
    text = text
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();

    // Try to extract JSON if wrapped in other content
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    // Parse the JSON response
    const parsed = JSON.parse(text);

    // Validate and normalize the response
    return {
      success: true,
      summary:
        parsed.summary ||
        `Found ${parsed.parts?.length || 0} parts in the spreadsheet`,
      totalPartsFound: parsed.parts?.length || 0,
      parts: Array.isArray(parsed.parts)
        ? parsed.parts.map((part) => ({
            partNumber: String(part.partNumber || '')
              .trim()
              .toUpperCase(),
            quantity: parseInt(part.quantity, 10) || 1,
            brand: part.brand || null,
            description: part.description || null,
            originalText: part.originalText || null,
            confidence: part.confidence || 'medium',
            selected: true, // Default to selected for search
          }))
        : [],
      dataQuality: parsed.dataQuality || {
        hasHeaders: false,
        hasPartNumberColumn: false,
        hasQuantityColumn: false,
        hasBrandColumn: false,
        formatting: 'unknown',
        issues: [],
      },
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      detectedColumns: parsed.detectedColumns || {},
      originalRowCount: rawData.length,
      processedRowCount: limitedData.length,
      aiPowered: true,
    };
  } catch (error) {
    console.error('Excel AI analysis error:', error);

    // Fallback to basic extraction
    return fallbackExcelExtraction(rawData, options);
  }
}

/**
 * Fallback extraction when AI fails
 */
function fallbackExcelExtraction(rawData, options = {}) {
  const parts = [];
  // Pattern to match:
  // 1. Purely numeric part numbers (4+ digits)
  // 2. Alphanumeric part numbers (letters + numbers in any combination)
  const partNumberPattern = /[A-Z0-9][-A-Z0-9_]{3,20}/gi;
  // Additional pattern for purely numeric part numbers
  const numericPartPattern = /\b\d{4,15}\b/g;

  for (const row of rawData) {
    const rowStr = Array.isArray(row)
      ? row.join(' ')
      : typeof row === 'object'
        ? Object.values(row).join(' ')
        : String(row);

    // First, extract alphanumeric matches
    const alphanumericMatches = rowStr.match(partNumberPattern) || [];
    // Then, extract purely numeric matches
    const numericMatches = rowStr.match(numericPartPattern) || [];

    // Combine all matches
    const allMatches = [
      ...new Set([...alphanumericMatches, ...numericMatches]),
    ];

    for (const match of allMatches) {
      // Skip common non-part-number patterns
      if (
        /^(ROW|COL|SHEET|TABLE|TOTAL|SUM|COUNT|QTY|QUANTITY|PRICE|BRAND|NAME|DESC)/i.test(
          match,
        )
      ) {
        continue;
      }

      // Skip very small numbers that are likely quantities (1-999)
      if (/^\d+$/.test(match) && parseInt(match, 10) < 1000) {
        continue;
      }

      // Accept if: purely numeric (4+ digits) OR has both letters and numbers
      const isPurelyNumeric = /^\d{4,}$/.test(match);
      const isAlphanumeric = /[A-Z]/i.test(match) && /[0-9]/.test(match);

      if (isPurelyNumeric || isAlphanumeric) {
        parts.push({
          partNumber: match.toUpperCase(),
          quantity: 1,
          brand: null,
          description: null,
          originalText: rowStr.substring(0, 100),
          confidence: isPurelyNumeric ? 'medium' : 'low',
          selected: true,
        });
      }
    }
  }

  // Remove duplicates
  const uniqueParts = parts.filter(
    (part, index, self) =>
      index === self.findIndex((p) => p.partNumber === part.partNumber),
  );

  return {
    success: true,
    summary: `Found ${uniqueParts.length} potential part numbers (basic extraction)`,
    totalPartsFound: uniqueParts.length,
    parts: uniqueParts,
    dataQuality: {
      hasHeaders: false,
      hasPartNumberColumn: false,
      hasQuantityColumn: false,
      hasBrandColumn: false,
      formatting: 'unknown',
      issues: ['AI analysis unavailable, using basic pattern matching'],
    },
    suggestions: [
      'For better results, ensure part numbers are in a dedicated column',
      'Add a header row with "Part Number" and "Quantity" labels',
    ],
    detectedColumns: {},
    originalRowCount: rawData.length,
    processedRowCount: rawData.length,
    aiPowered: false,
  };
}

/**
 * Recommend best parts from search results based on AI analysis
 * @param {Array} searchResults - Array of search results from DB
 * @param {Array} requestedParts - Array of requested parts with quantities
 * @returns {Promise<Object>} Recommended parts with selection
 */
async function recommendBestParts(searchResults, requestedParts) {
  try {
    if (!searchResults || searchResults.length === 0) {
      return {
        success: true,
        recommendations: [],
        summary: 'No search results to analyze',
      };
    }

    // Group results by part number
    const partGroups = {};
    for (const result of searchResults) {
      const pn = result.partNumber?.toUpperCase();
      if (!partGroups[pn]) {
        partGroups[pn] = [];
      }
      partGroups[pn].push(result);
    }

    // For each requested part, find the best option
    const recommendations = [];

    for (const requested of requestedParts) {
      const pn = requested.partNumber?.toUpperCase();
      const options = partGroups[pn] || [];

      if (options.length === 0) {
        recommendations.push({
          partNumber: pn,
          requestedQuantity: requested.quantity,
          found: false,
          recommendation: null,
          alternatives: [],
          reason: 'Part not found in database',
        });
        continue;
      }

      // Sort by best value (in stock, good price, fast delivery)
      const scored = options
        .map((opt) => {
          let score = 0;

          // Prefer in-stock items
          if (opt.quantity >= requested.quantity) score += 50;
          else if (opt.quantity > 0) score += 25;

          // Lower price is better (normalize to 0-25 range)
          if (opt.price) {
            const maxPrice = Math.max(...options.map((o) => o.price || 0));
            if (maxPrice > 0) {
              score += 25 * (1 - opt.price / maxPrice);
            }
          }

          // Faster delivery is better
          if (opt.deliveryDays) {
            score += Math.max(0, 15 - opt.deliveryDays);
          }

          // Known brands get bonus
          const knownBrands = [
            'BOSCH',
            'SKF',
            'DENSO',
            'VALEO',
            'BREMBO',
            'MANN',
            'MAHLE',
            'GATES',
          ];
          if (opt.brand && knownBrands.includes(opt.brand.toUpperCase())) {
            score += 10;
          }

          return { ...opt, score };
        })
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      const alternatives = scored.slice(1, 4); // Top 3 alternatives

      recommendations.push({
        partNumber: pn,
        requestedQuantity: requested.quantity,
        found: true,
        recommendation: {
          ...best,
          selected: true,
          reason: generateRecommendationReason(best, requested.quantity),
        },
        alternatives: alternatives.map((alt) => ({
          ...alt,
          selected: false,
        })),
        totalOptions: options.length,
      });
    }

    return {
      success: true,
      recommendations,
      summary: `Analyzed ${searchResults.length} results for ${requestedParts.length} requested parts`,
      stats: {
        totalRequested: requestedParts.length,
        found: recommendations.filter((r) => r.found).length,
        notFound: recommendations.filter((r) => !r.found).length,
      },
    };
  } catch (error) {
    console.error('Recommendation error:', error);
    return {
      success: false,
      error: error.message,
      recommendations: [],
    };
  }
}

/**
 * Generate a human-readable reason for the recommendation
 */
function generateRecommendationReason(part, requestedQty) {
  const reasons = [];

  if (part.quantity >= requestedQty) {
    reasons.push('Full quantity available');
  } else if (part.quantity > 0) {
    reasons.push(`${part.quantity} units in stock`);
  }

  if (part.price) {
    reasons.push(`Best price: $${part.price.toFixed(2)}`);
  }

  if (part.deliveryDays && part.deliveryDays <= 3) {
    reasons.push('Express delivery');
  } else if (part.deliveryDays && part.deliveryDays <= 7) {
    reasons.push('Fast delivery');
  }

  if (part.brand) {
    reasons.push(`Brand: ${part.brand}`);
  }

  return reasons.join(' • ') || 'Best match';
}

module.exports = {
  parseSearchQuery,
  parseUserIntent,
  filterDataWithAI,
  generateSuggestions,
  analyzeResults,
  analyzeExcelData,
  recommendBestParts,
};
