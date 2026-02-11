# AI Smart Filter - Technical Architecture & Implementation

**PartsForm B2B Automotive Parts Marketplace**  
**Version:** 2.0 (February 2026)  
**AI Engine:** Gemini 2.0 Flash (Optional) + Local NLP Parser

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Core Components](#core-components)
4. [Natural Language Processing](#natural-language-processing)
5. [Intelligent Scoring Algorithm](#intelligent-scoring-algorithm)
6. [Priority Detection & Weighting](#priority-detection--weighting)
7. [Grammar & Typo Tolerance](#grammar--typo-tolerance)
8. [Data Flow](#data-flow)
9. [API Endpoints](#api-endpoints)
10. [Frontend Implementation](#frontend-implementation)
11. [Performance Optimization](#performance-optimization)
12. [Technology Stack](#technology-stack)

---

## System Overview

The AI Smart Filter is an intelligent search system that interprets natural language queries and returns optimally ranked automotive parts based on multiple criteria including price, delivery time, stock availability, and quantity.

### Key Features

- **Natural Language Understanding**: Processes conversational queries like "find best 3 parts in this OK000009A03 based on the best price and fast in delivery"
- **Typo Tolerance**: Handles misspellings (delveir → delivery, pric → price)
- **Multiple Priority Detection**: Recognizes when users want BOTH price AND delivery (or other combinations)
- **Dynamic Weight Scoring**: Adjusts ranking weights from 5% to 70% based on user intent
- **Hybrid AI Approach**: Local deterministic parser + optional Gemini 2.0 Flash enhancement
- **Real-time Results**: Sub-500ms response time for typical queries

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INPUT (Natural Language)               │
│  "find best 3 parts in OK000009A03 based on price and delivery" │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (ai-filters.js)                      │
│  • Input validation                                              │
│  • UI state management                                           │
│  • Results rendering with color-coded badges                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ AJAX POST /buyer/api/ai-search
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND CONTROLLER (searchController.js)            │
│  • Request validation                                            │
│  • Authentication check                                          │
│  • Orchestrates NLP + DB + Scoring                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
┌───────────────────────┐  ┌──────────────────────────────┐
│  LOCAL NLP PARSER     │  │   GEMINI 2.0 FLASH (Optional)│
│ (geminiService.js)    │  │   • Advanced intent parsing  │
│ • Regex patterns      │  │   • Semantic understanding   │
│ • Typo tolerance      │  │   • Context enrichment       │
│ • Multi-priority      │  └──────────────┬───────────────┘
│   detection           │                 │
└──────────┬────────────┘                 │
           │                              │
           └───────────┬──────────────────┘
                       ▼
           ┌────────────────────────┐
           │   PARSED INTENT        │
           │  {                     │
           │    partNumbers: [...]  │
           │    sortPreference:     │
           │      "price_and_del.." │
           │    topN: 3,            │
           │    filters: {...}      │
           │  }                     │
           └──────────┬─────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌──────────────────┐    ┌────────────────────────┐
│  ELASTICSEARCH   │    │      MONGODB           │
│  • Full-text     │    │  • Part metadata       │
│    search        │    │  • Supplier data       │
│  • Fuzzy match   │    │  • Stock levels        │
│  • 10,000+ parts │    │  • Pricing in AED      │
└────────┬─────────┘    └────────┬───────────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌────────────────────────────┐
         │   RAW RESULTS              │
         │   [Part1, Part2, ...]      │
         └────────────┬───────────────┘
                      │
                      ▼
         ┌────────────────────────────────────────┐
         │   INTELLIGENT SCORING ENGINE           │
         │   • Normalize price, qty, delivery     │
         │   • Apply dynamic weights              │
         │   • Calculate composite score (0-100)  │
         │   • Rank by score DESC                 │
         └────────────┬───────────────────────────┘
                      │
                      ▼
         ┌────────────────────────────────────────┐
         │   RANKED RESULTS + AI INSIGHTS         │
         │   • Best overall (#1 recommendation)   │
         │   • Lowest price badge                 │
         │   • Fastest delivery badge             │
         │   • Trade-off insights                 │
         └────────────┬───────────────────────────┘
                      │
                      ▼ JSON Response
         ┌────────────────────────────────────────┐
         │   FRONTEND RENDERING                   │
         │   • Blue gradient for AI understanding │
         │   • Green for recommendations          │
         │   • Full-width results table           │
         │   • Colored rank badges                │
         └────────────────────────────────────────┘
```

---

## Core Components

### 1. **geminiService.js** (2,591 lines)
**Purpose:** Dual-mode NLP parser (local + optional Gemini AI)

**Responsibilities:**
- Parse natural language queries into structured intent
- Extract part numbers, quantities, price ranges, delivery constraints
- Detect single or multiple sort priorities
- Handle typos and grammatical errors
- Merge local + Gemini results when AI enabled

**Key Functions:**
```javascript
parseQueryLocalDeterministic(query, options)
  → Returns: { partNumbers, sortPreference, topN, filters, ... }

enhanceWithGemini(localResult, query, options)
  → Returns: Enhanced result with Gemini insights

mergeResults(local, gemini)
  → Returns: Best-of-both merged result
```

### 2. **searchController.js** (1,529 lines)
**Purpose:** Main search orchestrator and scoring engine

**Responsibilities:**
- Validate and authenticate requests
- Execute Elasticsearch + MongoDB queries
- Apply intelligent composite scoring
- Calculate dynamic weights based on priority
- Generate AI insights (trade-offs, recommendations)
- Return ranked results with badges

**Key Endpoint:**
```javascript
POST /buyer/api/ai-search
Body: { query: "find best 3 parts...", aiMode: true }
Response: { 
  results: [...],
  insights: [...],
  parsedFilters: {...}
}
```

### 3. **ai-filters.js** (2,021 lines)
**Purpose:** Frontend UI/UX for AI Smart Filter

**Responsibilities:**
- Render modal interface
- Handle user input and search submission
- Display results with color-coded sections
- Show filter chips, rank badges, AI recommendations
- Manage state (filters, insights, results)

**Key UI Sections:**
- AI Understanding (blue gradient)
- Active Filters (blue chips)
- AI Recommendation (green gradient)
- Results Table (full-width with rank badges)
- Suggestions (purple chips)

### 4. **ai-filters.css** (4,049 lines)
**Purpose:** Styling for AI interface

**Design System:**
- Blue (#3b82f6): AI understanding, primary actions
- Green (#10b981): Recommendations, success states
- Yellow (#f59e0b): Warnings, fastest delivery badge
- Purple (#7c3aed): Suggestions, alternative options
- Gradients: Professional depth without overdoing

---

## Natural Language Processing

### Local Deterministic Parser

The local parser uses **regex pattern matching** with **93 distinct patterns** to extract intent:

#### 1. **Part Number Extraction**
```javascript
// Pattern: Alphanumeric codes with letters AND digits, 4+ chars
const partNumberRegex = /^[A-Za-z0-9][-A-Za-z0-9_]{3,}$/;
const hasDigit = /\d/.test(token);

// Examples matched:
// ✅ "OK000009A03"
// ✅ "RC0009"
// ✅ "CAF-000267-KH"
// ✅ "06A115561B"
// ❌ "BOSCH" (no digits)
// ❌ "123" (too short)
```

#### 2. **Top N Detection**
```javascript
// Patterns:
// "best 3", "top 5", "first 10", "show me 2", "give 4"
const topNMatch = q.match(/\b(top|best|first|show\s+me|give|find)\s+(\d+)/i);

// Examples:
// "find best 3 parts" → topN = 3
// "show me top 5" → topN = 5
// "give 2 options" → topN = 2
```

#### 3. **Single Priority Detection**
```javascript
// "based on" pattern with typo tolerance
const basedOnMatch = q.match(
  /based\s+on\s+(?:the\s+|a\s+|best\s+)?(price|pric\w*|delivery|deliv\w*|delveir|qty|stock)/i
);

// Examples:
// "based on price" → sortPreference = "price_asc"
// "based on delivery" → sortPreference = "delivery_asc"
// "based on the best price" → sortPreference = "price_asc"
// "based on delveir" (typo) → sortPreference = "delivery_asc" ✅
```

#### 4. **MULTIPLE Priority Detection** (NEW)
```javascript
// Pattern: "price and delivery", "price & delivery", "delivery + price"
const multiPriorityMatch = q.match(
  /(price|pric\w*|delivery|deliv\w*|qty|stock)\s+(?:and|&|\+|,)\s+(price|pric\w*|delivery|deliv\w*|qty|stock)/i
);

// Examples:
// "price and delivery" → sortPreference = "price_and_delivery"
// "delivery & price" → sortPreference = "price_and_delivery"
// "price + qty" → sortPreference = "price_and_qty"
// "fast in delveir and cheap in pric" → sortPreference = "price_and_delivery"
```

#### 5. **Typo Tolerance Patterns**
```javascript
// Common typos handled:
"delveir" → "delivery" ✅
"delivry" → "delivery" ✅
"pric" → "price" ✅
"sorte" → "sorted" ✅
"availab" → "available" ✅

// Implementation:
/deliv|delveir|delivry|delivery|shipping/i.test(criterion)
/price|pric\w*|cost/i.test(criterion)
```

#### 6. **Natural Language Shortcuts**
```javascript
// "fast in delivery" pattern
const fastInMatch = q.match(
  /(fast|quick|cheap|expensive)\s+(?:in|on|for)\s+(delivery|delveir|price|pric\w*)/i
);

// Examples:
// "fast in delivery" → sortPreference = "delivery_asc"
// "cheap in price" → sortPreference = "price_asc"
// "quick in shipping" → sortPreference = "delivery_asc"
```

### Gemini 2.0 Flash Enhancement (Optional)

When enabled (`aiMode: true`), the system also queries Gemini:

**Advantages:**
- Semantic understanding beyond regex
- Context-aware parsing
- Handles complex multi-clause queries
- Better synonym recognition

**System Prompt (excerpt):**
```
You are an expert at parsing automotive parts search queries.
Extract: part numbers, quantities, price ranges, delivery constraints, 
sort preferences, brand filters, origin preferences.

When user says "price and delivery", set sortPreference to "price_and_delivery"
to indicate BOTH are important.

Return valid JSON only.
```

**Merging Strategy:**
```javascript
// Local parser runs first (fast, deterministic)
const local = parseQueryLocalDeterministic(query);

// Gemini enhances if enabled (slower, semantic)
if (aiMode) {
  const gemini = await enhanceWithGemini(local, query);
  return mergeResults(local, gemini);
}

// Merge logic:
// - Part numbers: union of both
// - Sort preference: Gemini > Local (AI understands context better)
// - Filters: merge max/min values
// - Keywords: union, deduplicate
```

---

## Intelligent Scoring Algorithm

### Composite Score Formula

Each part receives a **composite score (0-100)** calculated as:

```
compositeScore = (priceScore × wPrice) + 
                 (qtyScore × wQty) + 
                 (deliveryScore × wDelivery) + 
                 (stockBonus × wStock)
```

### Individual Score Calculations

#### 1. **Price Score (0-100)**
```javascript
// Lower price = better (inverted scale)
// Unless user wants expensive items (price_desc)

const minPrice = Math.min(...prices);
const maxPrice = Math.max(...prices);

if (sortPreference === 'price_desc') {
  // Higher price = better (premium products)
  priceScore = ((price - minPrice) / (maxPrice - minPrice)) × 100;
} else {
  // Lower price = better (default)
  priceScore = ((maxPrice - price) / (maxPrice - minPrice)) × 100;
}

// Edge case: single price point → 50 score
if (maxPrice === minPrice) priceScore = price > 0 ? 50 : 0;
```

#### 2. **Quantity Score (0-100)**
```javascript
// Higher quantity = better

const minQty = Math.min(...quantities);
const maxQty = Math.max(...quantities);

qtyScore = ((qty - minQty) / (maxQty - minQty)) × 100;

// Edge cases:
if (maxQty === minQty) qtyScore = qty > 0 ? 50 : 0;
if (qty === 0) qtyScore = 0; // Out of stock
```

#### 3. **Delivery Score (0-100)**
```javascript
// Fewer days = better (inverted scale)

const minDelivery = Math.min(...deliveryDays);
const maxDelivery = Math.max(...deliveryDays);

deliveryScore = ((maxDelivery - delivery) / (maxDelivery - minDelivery)) × 100;

// Edge cases:
if (delivery >= 999) deliveryScore = 0; // Unknown/very long
if (maxDelivery === minDelivery) deliveryScore = delivery < 999 ? 50 : 0;
```

#### 4. **Stock Bonus (0-20)**
```javascript
// Binary bonus for in-stock items
stockBonus = (qty > 0) ? 20 : 0;
```

### Example Calculation

**Scenario:** User wants "best price and fast delivery"

**Part A:**
- Price: $100 (min: $80, max: $150)
- Delivery: 30 days (min: 20, max: 60)
- Qty: 5000 (min: 1000, max: 10000)
- Stock: In Stock

**Normalization:**
```javascript
priceScore = ((150 - 100) / (150 - 80)) × 100 = 71.43
deliveryScore = ((60 - 30) / (60 - 20)) × 100 = 75.00
qtyScore = ((5000 - 1000) / (10000 - 1000)) × 100 = 44.44
stockBonus = 20
```

**Weights (price_and_delivery):**
```javascript
wPrice = 0.45 (45%)
wDelivery = 0.45 (45%)
wQty = 0.05 (5%)
wStock = 0.05 (5%)
```

**Composite Score:**
```javascript
score = (71.43 × 0.45) + (75.00 × 0.45) + (44.44 × 0.05) + (20 × 0.05)
      = 32.14 + 33.75 + 2.22 + 1.00
      = 69.11
```

---

## Priority Detection & Weighting

### Weight Distribution Table

| Preference | Price | Delivery | Qty | Stock | Use Case |
|------------|-------|----------|-----|-------|----------|
| **None** (balanced) | 35% | 30% | 20% | 15% | No specific preference |
| **price_asc** | **70%** | 15% | 10% | 5% | Budget-conscious |
| **price_desc** | **70%** | 15% | 10% | 5% | Premium products |
| **delivery_asc** | 15% | **70%** | 10% | 5% | Urgent orders |
| **quantity_desc** | 10% | 5% | **70%** | 15% | Bulk orders |
| **stock_priority** | 10% | 10% | 20% | **60%** | Availability critical |
| **price_and_delivery** | **45%** | **45%** | 5% | 5% | Best value + speed |
| **price_and_qty** | **45%** | 5% | **45%** | 5% | Bulk at best price |
| **delivery_and_qty** | 5% | **45%** | **45%** | 5% | Large urgent order |
| **price_and_stock** | **45%** | 5% | 5% | **45%** | Best price with availability |

### Decision Logic

```javascript
let wPrice = 0.35, wDelivery = 0.30, wQty = 0.20, wStock = 0.15;

// Single priority: 70% weight
if (sortPref === 'price_asc') {
  wPrice = 0.70; wDelivery = 0.15; wQty = 0.10; wStock = 0.05;
}
else if (sortPref === 'delivery_asc') {
  wDelivery = 0.70; wPrice = 0.15; wQty = 0.10; wStock = 0.05;
}

// DUAL priority: 45% + 45% (NEW)
else if (sortPref === 'price_and_delivery') {
  wPrice = 0.45; wDelivery = 0.45; wQty = 0.05; wStock = 0.05;
}
else if (sortPref === 'price_and_qty') {
  wPrice = 0.45; wQty = 0.45; wDelivery = 0.05; wStock = 0.05;
}

console.log(`📊 Scoring weights: Price=${wPrice}, Delivery=${wDelivery}, Qty=${wQty}, Stock=${wStock} (pref: ${sortPref || 'balanced'})`);
```

### Why 45% + 45% for Dual Priorities?

**Before (70% single):**
- User: "find parts by price and delivery"
- System: Only used price (70%), delivery barely mattered (15%)
- Result: Cheapest part with terrible delivery time ❌

**After (45% + 45% dual):**
- User: "find parts by price and delivery"
- System: Both price (45%) AND delivery (45%) drive ranking
- Result: Good price with good delivery (optimized trade-off) ✅

**Mathematical Rationale:**
- 45% + 45% = 90% total for both factors
- Remaining 10% for qty (5%) + stock (5%) prevents duplicates
- 45% each ensures BOTH factors have nearly equal influence
- Not 50% + 50% to leave room for tie-breaking

---

## Grammar & Typo Tolerance

### Typo Mapping System

```javascript
// Delivery variants
const deliveryPattern = /delivery|delivry|delveir|deliv\w*|shipping|speed/i;

"delivery" → ✅ matches
"delivry" → ✅ matches (common typo)
"delveir" → ✅ matches (keyboard slip)
"deliver" → ✅ matches (partial)
"shipping" → ✅ matches (synonym)

// Price variants
const pricePattern = /price|pric\w*|cost|value/i;

"price" → ✅ matches
"pric" → ✅ matches (incomplete)
"prices" → ✅ matches
"pricing" → ✅ matches
"cost" → ✅ matches (synonym)
```

### Natural Language Flexibility

```javascript
// "based on" accepts filler words
"based on price" → ✅
"based on the price" → ✅
"based on the best price" → ✅
"based on a good price" → ✅

// "and" accepts multiple separators
"price and delivery" → ✅
"price & delivery" → ✅
"price + delivery" → ✅
"price, delivery" → ✅

// "fast in" pattern
"fast in delivery" → ✅
"quick in shipping" → ✅
"cheap in price" → ✅
"expensive in cost" → ✅
```

### Case Insensitivity

All regex patterns use the `/i` flag:
```javascript
"BASED ON PRICE" → ✅ matches
"Based On Price" → ✅ matches
"based on price" → ✅ matches
```

---

## Data Flow

### Request Flow (Detailed)

```
1. USER INPUT
   └─> Frontend: ai-filters.js
       └─> handleAISearch()
           └─> Validate query (min 3 chars)
           └─> Show loading state

2. AJAX REQUEST
   └─> POST /buyer/api/ai-search
       Headers: { Authorization: Bearer <token> }
       Body: { 
         query: "find best 3...",
         aiMode: true,
         filters: {...}
       }

3. BACKEND PROCESSING
   └─> searchController.js
       ├─> Authenticate user (req.user)
       ├─> Parse intent (geminiService)
       │   ├─> Local regex parsing (always)
       │   └─> Gemini enhancement (if aiMode=true)
       │       └─> Merge results
       ├─> Build Elasticsearch query
       │   ├─> Match part numbers (exact + fuzzy)
       │   ├─> Apply brand filters
       │   └─> Apply origin filters
       ├─> Execute ES search
       ├─> Fetch MongoDB details for each result
       ├─> Apply additional filters (price, delivery, qty)
       ├─> Calculate composite scores
       │   ├─> Normalize price/qty/delivery
       │   ├─> Determine weights from sortPreference
       │   └─> Compute weighted score
       ├─> Sort by score DESC
       ├─> Apply topN limit (if specified)
       ├─> Generate AI insights
       │   ├─> Identify best overall (#1)
       │   ├─> Tag lowest price
       │   ├─> Tag fastest delivery
       │   └─> Create trade-off messages
       └─> Return JSON response

4. RESPONSE RENDERING
   └─> Frontend: ai-filters.js
       └─> displayAIResults()
           ├─> Render AI Understanding (blue)
           ├─> Render Active Filters (blue chips)
           ├─> Render Recommendation (green)
           ├─> Render Results Table
           │   ├─> Rank badges (colored)
           │   ├─> Part details
           │   └─> Reason rows (gray text)
           └─> Render Suggestions (purple)
```

### Database Queries

#### Elasticsearch Query
```javascript
{
  query: {
    bool: {
      should: [
        // Exact part number match (boost: 10)
        { match: { partNumber: { query: "OK000009A03", boost: 10 } } },
        
        // Vendor code match (boost: 5)
        { match: { vendorCode: { query: "OK000009A03", boost: 5 } } },
        
        // Fuzzy match (fuzziness: AUTO)
        { match: { partNumber: { query: "OK000009A03", fuzziness: "AUTO" } } }
      ],
      filter: [
        // Brand filter (if specified)
        { terms: { brand: ["HYUNDAI", "KIA"] } },
        
        // Origin filter (if specified)
        { terms: { supplierOrigin: ["DE", "JP"] } }
      ]
    }
  },
  size: 100 // Get top 100 candidates
}
```

#### MongoDB Aggregation
```javascript
// For each ES result, fetch full details
const parts = await Part.find({
  _id: { $in: elasticsearchIds }
}).populate('supplier');

// Apply backend filters
const filtered = parts.filter(p => {
  if (filters.minPrice && p.price < filters.minPrice) return false;
  if (filters.maxPrice && p.price > filters.maxPrice) return false;
  if (filters.maxDelivery && p.deliveryDays > filters.maxDelivery) return false;
  if (filters.requireInStock && p.quantity <= 0) return false;
  return true;
});
```

---

## API Endpoints

### POST /buyer/api/ai-search

**Purpose:** Main AI search endpoint

**Request:**
```json
{
  "query": "find best 3 parts in this OK000009A03 based on the best price and fast in delveir",
  "aiMode": true,
  "filters": {
    "brand": null,
    "minPrice": null,
    "maxPrice": null,
    "sortBy": null
  }
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "_id": "65f3a8...",
      "partNumber": "OK000009A03",
      "brand": "HYUNDAI",
      "description": "WRK II Tension Gauge & Remo...",
      "price": 339.24,
      "priceUSD": 92.59,
      "quantity": 10000,
      "deliveryDays": 60,
      "supplier": { "name": "ABC Auto Parts", "origin": "DE" },
      "_aiScore": 69.11,
      "_aiBadges": ["best-overall"],
      "_aiReason": "Best option — ranked by lowest price · Highest stock availability (10000 units)"
    },
    {
      "_id": "65f3a9...",
      "partNumber": "OK000009A03",
      "brand": "HYUNDAI",
      "price": 402.24,
      "priceUSD": 109.74,
      "quantity": 10000,
      "deliveryDays": 30,
      "_aiScore": 68.45,
      "_aiBadges": ["fastest-delivery"],
      "_aiReason": "Fastest delivery (30 days)"
    }
  ],
  "insights": [
    {
      "type": "tradeoff",
      "message": "Save ~19% choosing the cheapest, or get it 30 days sooner with faster option"
    }
  ],
  "parsedFilters": {
    "partNumbers": ["OK000009A03"],
    "topN": 3,
    "sortPreference": "price_and_delivery",
    "searchIntent": "Find the best two parts with part number OK000009A03 based on delivery time"
  },
  "totalResults": 2,
  "executionTime": 234
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Query must be at least 3 characters",
  "code": "INVALID_QUERY"
}
```

---

## Frontend Implementation

### State Management

```javascript
const AIFilterState = {
  // Current query
  currentQuery: '',
  
  // Parsed filters from backend
  aiParsedFilters: null,
  
  // Search results
  aiResults: [],
  
  // AI insights (recommendations, trade-offs)
  aiInsights: [],
  
  // Broad search detection
  isBroadSearch: false,
  broadSearchMessage: '',
  availableBrands: [],
  
  // Filter state
  activeFilters: {
    brand: null,
    minPrice: null,
    maxPrice: null,
    sortBy: null
  }
};
```

### Event Handlers

```javascript
// Search submission
async function handleAISearch() {
  const query = elements.aiSearchInput.value.trim();
  
  // Validation
  if (query.length < 3) {
    showError('Query must be at least 3 characters');
    return;
  }
  
  // Loading state
  showLoadingState();
  
  try {
    // AJAX request
    const response = await fetch('/buyer/api/ai-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        query: query,
        aiMode: true,
        filters: AIFilterState.activeFilters
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      AIFilterState.aiResults = data.results;
      AIFilterState.aiInsights = data.insights;
      AIFilterState.aiParsedFilters = data.parsedFilters;
      
      displayAIResults(data);
    } else {
      showError(data.error);
    }
  } catch (err) {
    showError('Search failed. Please try again.');
    console.error(err);
  } finally {
    hideLoadingState();
  }
}

// Filter removal
function removeAIFilter(filterType) {
  AIFilterState.activeFilters[filterType] = null;
  
  // Re-run search with updated filters
  handleAISearch();
}

// Add to cart from AI results
function addToCartFromAI(partId, minQty) {
  // Cart logic...
  showToast('Added to cart successfully');
}
```

### UI Rendering

```javascript
function displayAIResults(data) {
  const container = document.getElementById('ai-results-container');
  
  let html = `<div class="ai-results-container">`;
  
  // 1. AI Understanding Section (Blue)
  html += `
    <div class="ai-summary-bar">
      <svg class="ai-icon">...</svg>
      <span class="ai-summary-text">
        ${escapeHTML(data.parsedFilters.searchIntent)}
      </span>
    </div>
  `;
  
  // 2. Active Filters (Blue chips)
  if (hasFilters) {
    html += `<div class="ai-filters-bar">...filter chips...</div>`;
  }
  
  // 3. AI Recommendation (Green)
  if (data.insights.length > 0) {
    html += `
      <div class="ai-recommendation-bar">
        <svg class="ai-rec-icon">...</svg>
        <span class="rec-label">Tip</span>
        <span class="rec-text">${data.insights[0].message}</span>
      </div>
    `;
  }
  
  // 4. Results Table (Full-width)
  html += `
    <table class="ai-results-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Brand</th>
          <th>Part Number</th>
          <th>Description</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Delivery</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${data.results.map((part, i) => renderPartRow(part, i)).join('')}
      </tbody>
    </table>
  `;
  
  html += `</div>`;
  container.innerHTML = html;
}
```

---

## Performance Optimization

### 1. **Caching Strategy**
```javascript
// Part number cache (Redis)
const cachedResult = await redis.get(`ai-search:${partNumber}`);
if (cachedResult) {
  return JSON.parse(cachedResult);
}

// Cache for 5 minutes
await redis.setex(`ai-search:${partNumber}`, 300, JSON.stringify(result));
```

### 2. **Elasticsearch Optimization**
- Index size: 10,000+ parts
- Refresh interval: 30s
- Replica: 0 (single-node dev)
- Shards: 1
- Fuzzy max expansions: 50

### 3. **Database Indexing**
```javascript
// MongoDB indexes
partNumberIndex = { partNumber: 1, brand: 1 }
priceIndex = { price: 1 }
deliveryIndex = { deliveryDays: 1 }
stockIndex = { quantity: -1 }
compoundIndex = { partNumber: 1, price: 1, deliveryDays: 1 }
```

### 4. **Frontend Optimizations**
- Debounce search input (300ms)
- Lazy load results table (virtual scrolling for 100+ results)
- CSS animations: GPU-accelerated transforms
- Image lazy loading for part photos

### 5. **Response Time Targets**
| Operation | Target | Actual |
|-----------|--------|--------|
| Local NLP parsing | <50ms | ~30ms |
| Gemini API call | <1000ms | ~800ms |
| Elasticsearch query | <100ms | ~60ms |
| MongoDB fetch | <50ms | ~40ms |
| Scoring calculation | <50ms | ~20ms |
| **Total (without Gemini)** | **<300ms** | **~230ms** |
| **Total (with Gemini)** | **<1200ms** | **~950ms** |

---

## Technology Stack

### Backend
- **Node.js** v20.x
- **Express.js** v4.18.x - Web framework
- **MongoDB** v7.0 - Primary database
- **Mongoose** v8.x - ODM
- **Elasticsearch** v8.16.0 - Full-text search engine
- **Redis** v7.x - Caching layer (optional)
- **PM2** / **Nodemon** - Process management

### AI & NLP
- **Google Gemini 2.0 Flash** - Optional AI enhancement
  - Model: `gemini-2.0-flash-exp`
  - API: Generative Language API
  - Rate limit: 1500 requests/day (free tier)
- **Custom Regex Engine** - Local deterministic parser
  - 93 patterns
  - Typo tolerance
  - Multi-priority detection

### Frontend
- **Vanilla JavaScript** (ES6+)
- **Lucide Icons** v0.263.1
- **Tailwind CSS** utility classes (custom build)
- **GSAP** v3.12 - Animations (optional)

### DevOps
- **Git** - Version control
- **GitHub** - Repository
- **VS Code** - IDE
- **Postman** - API testing
- **MongoDB Compass** - Database GUI
- **Elasticsearch Dev Tools** - Query testing

### Infrastructure
- **macOS** development environment
- **Ubuntu** 22.04 production server (planned)
- **Nginx** reverse proxy (planned)
- **Let's Encrypt** SSL (planned)
- **AWS S3** file storage (planned)

---

## Configuration

### Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/partsform

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200

# Gemini API
GEMINI_API_KEY=AIzaSy...your-key-here
GEMINI_MODEL=gemini-2.0-flash-exp
GEMINI_TEMPERATURE=0.3
GEMINI_MAX_TOKENS=2000

# Redis (optional)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=false

# App
NODE_ENV=development
PORT=3000
SESSION_SECRET=your-secret-here

# AI Settings
AI_MODE_DEFAULT=true
AI_TIMEOUT_MS=5000
LOCAL_PARSER_ENABLED=true
```

### AI Tuning Parameters

```javascript
// geminiService.js
const AI_CONFIG = {
  // Temperature: 0 = deterministic, 1 = creative
  temperature: 0.3,
  
  // Max tokens for response
  maxOutputTokens: 2000,
  
  // Timeout for Gemini API call
  timeout: 5000,
  
  // Fallback to local if Gemini fails
  fallbackToLocal: true,
  
  // Cache Gemini responses
  cacheEnabled: true,
  cacheTTL: 300, // 5 minutes
};

// searchController.js
const SCORING_CONFIG = {
  // Default weights (balanced)
  defaultWeights: {
    price: 0.35,
    delivery: 0.30,
    qty: 0.20,
    stock: 0.15
  },
  
  // Single priority weight
  singlePriorityWeight: 0.70,
  
  // Dual priority weight (each)
  dualPriorityWeight: 0.45,
  
  // Stock bonus (0-20)
  stockBonusMax: 20,
  
  // Minimum composite score to include
  minScoreThreshold: 10
};
```

---

## Testing & Debugging

### Test Queries

```javascript
// 1. Basic part number search
"find best 3 parts in this OK000009A03"

// 2. Single priority (price)
"find cheapest parts for OK000009A03"

// 3. Single priority (delivery) with typo
"find parts for OK000009A03 fast in delveir"

// 4. Multiple priorities
"find best 3 parts in OK000009A03 based on price and delivery"

// 5. Complex multi-clause
"need 50 units of OK000009A03 under $100 with fast delivery from German suppliers"

// 6. Natural language with typos
"show me top 5 parts for OK000009A03 sorte by pric and delivry speed"

// 7. Brand + origin filters
"find HYUNDAI brake pads made in Germany under $50"

// 8. Stock requirements
"find parts for OK000009A03 with high stock availability"
```

### Debug Logging

```javascript
// geminiService.js
console.log('🧠 Local NLP Parse:', {
  partNumbers: result.partNumbers,
  sortPreference: result.sortPreference,
  topN: result.topN,
  filters: result.filters
});

// searchController.js
console.log('📊 Scoring weights:', {
  price: wPrice,
  delivery: wDelivery,
  qty: wQty,
  stock: wStock,
  preference: sortPref || 'balanced'
});

console.log('🏆 Top Results:', results.slice(0, 3).map(p => ({
  part: p.partNumber,
  score: p._aiScore,
  badges: p._aiBadges
})));
```

### Monitoring

```javascript
// Execution time tracking
const startTime = Date.now();

// ... processing ...

const executionTime = Date.now() - startTime;
console.log(`⏱️ AI Search completed in ${executionTime}ms`);

// Include in response
response.executionTime = executionTime;
```

---

## Future Enhancements

### Planned Features

1. **Multi-language Support**
   - Arabic, Russian, Spanish, French
   - Translate queries before parsing
   - Auto-detect language

2. **Learning System**
   - Track user click patterns
   - Adjust weights based on historical preferences
   - Personalized ranking per user

3. **Advanced AI Insights**
   - Price trend predictions
   - Delivery guarantee confidence
   - Alternative part suggestions
   - Cross-selling recommendations

4. **Voice Search**
   - Web Speech API integration
   - Audio query parsing
   - Voice response (TTS)

5. **Image Search**
   - Upload part photo
   - Visual similarity matching
   - OCR for part number extraction

6. **Batch Search**
   - Upload CSV with multiple part numbers
   - Bulk AI recommendations
   - Export results to Excel

---

## Conclusion

The AI Smart Filter represents a sophisticated blend of deterministic NLP parsing, machine learning enhancement, and intelligent multi-factor scoring. By combining:

- **93 regex patterns** for local parsing
- **Gemini 2.0 Flash** for semantic understanding
- **Dynamic weight distribution** (5%-70% per factor)
- **Multiple priority detection** (45%+45% dual weights)
- **Typo tolerance** for real-world usage
- **Sub-300ms** response times

...we achieve a search experience that understands natural language, forgives errors, and delivers optimally ranked results that match user intent—even when they ask for "fast in delveir" or "sorte by pric and delivery"! 🚀

---

**Document Version:** 1.0  
**Last Updated:** February 11, 2026  
**Maintained By:** PartsForm Development Team  
**Contact:** dev@partsform.com
