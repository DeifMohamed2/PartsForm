const fs = require('fs');
const path = require('path');

const finalKeys = {
  it: { filterAll: 'Tutti', filterHigh: 'Alta', filterMedium: 'Media', filterLow: 'Bassa', aiSuggestions: 'Suggerimenti IA' },
  ja: { filterAll: 'すべて', filterHigh: '高', filterMedium: '中', filterLow: '低', aiSuggestions: 'AI提案' },
  ko: { filterAll: '전체', filterHigh: '높음', filterMedium: '중간', filterLow: '낮음', aiSuggestions: 'AI 제안' },
  nl: { filterAll: 'Alle', filterHigh: 'Hoog', filterMedium: 'Gemiddeld', filterLow: 'Laag', aiSuggestions: 'AI Suggesties' },
  pl: { filterAll: 'Wszystkie', filterHigh: 'Wysoka', filterMedium: 'Średnia', filterLow: 'Niska', aiSuggestions: 'Sugestie AI' },
  pt: { filterAll: 'Todos', filterHigh: 'Alta', filterMedium: 'Média', filterLow: 'Baixa', aiSuggestions: 'Sugestões IA' },
  tr: { filterAll: 'Tümü', filterHigh: 'Yüksek', filterMedium: 'Orta', filterLow: 'Düşük', aiSuggestions: 'YZ Önerileri' },
  zh: { filterAll: '全部', filterHigh: '高', filterMedium: '中', filterLow: '低', aiSuggestions: 'AI建议' }
};

for (const [lang, keys] of Object.entries(finalKeys)) {
  const filePath = path.join('./locales', lang, 'translation.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data.searchResults) data.searchResults = {};
  if (!data.searchResults.excel) data.searchResults.excel = {};
  Object.assign(data.searchResults.excel, keys);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log('✓ Updated ' + lang);
}
console.log('\n✓ Done!');
