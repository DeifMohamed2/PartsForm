const fs = require('fs');
const path = require('path');

const localesDir = './locales';
const languages = fs.readdirSync(localesDir).filter(f => fs.statSync(path.join(localesDir, f)).isDirectory());

// Get all keys from a JSON object recursively
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Load all translations
const translations = {};
for (const lang of languages) {
  const filePath = path.join(localesDir, lang, 'translation.json');
  if (fs.existsSync(filePath)) {
    translations[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
}

// Get English as reference
const enKeys = getAllKeys(translations.en);

// Compare each language
console.log('=== MISSING KEYS ANALYSIS ===\n');
for (const lang of languages) {
  if (lang === 'en') continue;
  
  const langKeys = getAllKeys(translations[lang]);
  const missing = enKeys.filter(k => !langKeys.includes(k));
  
  // Filter by buyer-relevant sections
  const buyerSections = ['affiliate', 'cart', 'checkout', 'contacts', 'delivery', 'orders', 'payment', 'profile', 'settings', 'tickets', 'search', 'searchResults', 'nav', 'footer', 'quickSearch', 'common'];
  const buyerMissing = missing.filter(k => buyerSections.some(s => k.startsWith(s + '.')));
  
  if (buyerMissing.length > 0) {
    console.log(`\n--- ${lang.toUpperCase()} (${buyerMissing.length} buyer keys missing) ---`);
    buyerMissing.slice(0, 40).forEach(k => console.log('  - ' + k));
    if (buyerMissing.length > 40) console.log(`  ... and ${buyerMissing.length - 40} more`);
  } else {
    console.log(`✓ ${lang.toUpperCase()} - All buyer keys present`);
  }
}
