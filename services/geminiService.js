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
 * MULTILINGUAL SUPPORT - Professional 15-language understanding
 * Supports: Arabic, German, English, Spanish, French, Italian, Japanese,
 *           Korean, Dutch, Polish, Portuguese, Russian, Turkish, Ukrainian, Chinese
 * ═══════════════════════════════════════════════════════════════════════════
 */
const MULTILINGUAL_DICTIONARY = {
  // ═══════════════════════════════════════════════════════════════════════════
  // PRICE & QUANTITY TERMS
  // ═══════════════════════════════════════════════════════════════════════════
  price: {
    ar: ['سعر', 'ثمن', 'تكلفة', 'قيمة'],
    de: ['preis', 'kosten', 'wert'],
    es: ['precio', 'costo', 'coste', 'valor'],
    fr: ['prix', 'coût', 'tarif', 'valeur'],
    it: ['prezzo', 'costo', 'valore'],
    ja: ['価格', '値段', 'プライス', 'コスト'],
    ko: ['가격', '비용', '값'],
    nl: ['prijs', 'kosten', 'waarde'],
    pl: ['cena', 'koszt', 'wartość'],
    pt: ['preço', 'custo', 'valor'],
    ru: ['цена', 'стоимость', 'цену'],
    tr: ['fiyat', 'maliyet', 'değer'],
    ua: ['ціна', 'вартість', 'коштує'],
    zh: ['价格', '价钱', '费用', '成本']
  },
  cheap: {
    ar: ['رخيص', 'اقتصادي', 'موفر', 'بسعر منخفض'],
    de: ['billig', 'günstig', 'preiswert', 'erschwinglich'],
    es: ['barato', 'económico', 'asequible', 'bajo precio'],
    fr: ['pas cher', 'bon marché', 'économique', 'abordable'],
    it: ['economico', 'conveniente', 'a buon mercato'],
    ja: ['安い', '格安', 'お買い得', '低価格'],
    ko: ['싼', '저렴한', '경제적인'],
    nl: ['goedkoop', 'betaalbaar', 'voordelig'],
    pl: ['tani', 'niedrogi', 'ekonomiczny'],
    pt: ['barato', 'econômico', 'acessível'],
    ru: ['дешевый', 'недорогой', 'экономичный', 'дёшево'],
    tr: ['ucuz', 'ekonomik', 'uygun fiyat'],
    ua: ['дешевий', 'недорогий', 'економний'],
    zh: ['便宜', '实惠', '经济', '低价']
  },
  expensive: {
    ar: ['غالي', 'مكلف', 'باهظ'],
    de: ['teuer', 'hochpreisig', 'kostspielig'],
    es: ['caro', 'costoso', 'premium'],
    fr: ['cher', 'coûteux', 'onéreux'],
    it: ['costoso', 'caro', 'premium'],
    ja: ['高い', '高価', 'プレミアム'],
    ko: ['비싼', '고가의', '프리미엄'],
    nl: ['duur', 'prijzig', 'kostbaar'],
    pl: ['drogi', 'kosztowny'],
    pt: ['caro', 'premium'],
    ru: ['дорогой', 'дорого', 'премиум'],
    tr: ['pahalı', 'premium'],
    ua: ['дорогий', 'коштовний'],
    zh: ['贵', '昂贵', '高价']
  },
  under: {
    ar: ['تحت', 'أقل من', 'دون', 'ما دون'],
    de: ['unter', 'weniger als', 'bis zu', 'maximal'],
    es: ['menos de', 'bajo', 'hasta', 'máximo'],
    fr: ['moins de', 'sous', 'jusqu\'à', 'maximum'],
    it: ['sotto', 'meno di', 'fino a', 'massimo'],
    ja: ['以下', '未満', 'まで'],
    ko: ['이하', '미만', '까지'],
    nl: ['onder', 'minder dan', 'tot'],
    pl: ['poniżej', 'mniej niż', 'do'],
    pt: ['abaixo de', 'menos de', 'até'],
    ru: ['меньше', 'ниже', 'до', 'не более'],
    tr: ['altında', 'den az', 'kadar'],
    ua: ['менше', 'нижче', 'до'],
    zh: ['以下', '低于', '不超过']
  },
  over: {
    ar: ['فوق', 'أكثر من', 'أعلى من'],
    de: ['über', 'mehr als', 'mindestens'],
    es: ['más de', 'sobre', 'mínimo'],
    fr: ['plus de', 'au-dessus', 'minimum'],
    it: ['sopra', 'più di', 'minimo'],
    ja: ['以上', '超', '最低'],
    ko: ['이상', '초과', '최소'],
    nl: ['boven', 'meer dan', 'minimaal'],
    pl: ['powyżej', 'więcej niż', 'minimum'],
    pt: ['acima de', 'mais de', 'mínimo'],
    ru: ['больше', 'выше', 'от', 'минимум'],
    tr: ['üstünde', 'den fazla', 'minimum'],
    ua: ['більше', 'вище', 'від'],
    zh: ['以上', '超过', '大于']
  },
  quantity: {
    ar: ['كمية', 'عدد', 'قطعة', 'وحدة'],
    de: ['menge', 'anzahl', 'stück', 'einheit'],
    es: ['cantidad', 'unidad', 'pieza', 'número'],
    fr: ['quantité', 'unité', 'pièce', 'nombre'],
    it: ['quantità', 'unità', 'pezzi', 'numero'],
    ja: ['数量', '個数', '台', '個'],
    ko: ['수량', '개수', '단위'],
    nl: ['aantal', 'hoeveelheid', 'stuks'],
    pl: ['ilość', 'sztuk', 'jednostka'],
    pt: ['quantidade', 'unidade', 'peça'],
    ru: ['количество', 'штук', 'единиц', 'шт'],
    tr: ['miktar', 'adet', 'birim'],
    ua: ['кількість', 'штук', 'одиниць'],
    zh: ['数量', '个数', '件', '台']
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK & AVAILABILITY
  // ═══════════════════════════════════════════════════════════════════════════
  inStock: {
    ar: ['متوفر', 'في المخزون', 'موجود', 'متاح'],
    de: ['auf lager', 'verfügbar', 'vorrätig', 'lieferbar'],
    es: ['en stock', 'disponible', 'en existencia', 'hay'],
    fr: ['en stock', 'disponible', 'en inventaire'],
    it: ['disponibile', 'in magazzino', 'in stock'],
    ja: ['在庫あり', '在庫有', '入荷', 'ストック'],
    ko: ['재고 있음', '재고있음', '구매 가능'],
    nl: ['op voorraad', 'beschikbaar', 'leverbaar'],
    pl: ['na stanie', 'dostępny', 'w magazynie'],
    pt: ['em estoque', 'disponível', 'pronta entrega'],
    ru: ['в наличии', 'есть в наличии', 'доступно', 'на складе'],
    tr: ['stokta', 'mevcut', 'bulunur'],
    ua: ['в наявності', 'є в наявності', 'доступно'],
    zh: ['有货', '现货', '库存', '有存货']
  },
  outOfStock: {
    ar: ['غير متوفر', 'نفذ', 'غير موجود'],
    de: ['nicht auf lager', 'nicht verfügbar', 'ausverkauft'],
    es: ['agotado', 'sin stock', 'no disponible'],
    fr: ['rupture', 'épuisé', 'non disponible'],
    it: ['esaurito', 'non disponibile'],
    ja: ['在庫なし', '品切れ', '売り切れ'],
    ko: ['재고 없음', '품절'],
    nl: ['niet op voorraad', 'uitverkocht'],
    pl: ['brak', 'niedostępny', 'wyprzedane'],
    pt: ['esgotado', 'sem estoque', 'indisponível'],
    ru: ['нет в наличии', 'отсутствует', 'распродано'],
    tr: ['stokta yok', 'tükendi'],
    ua: ['немає в наявності', 'відсутній'],
    zh: ['无货', '缺货', '售罄']
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // DELIVERY & SHIPPING
  // ═══════════════════════════════════════════════════════════════════════════
  delivery: {
    ar: ['توصيل', 'شحن', 'إرسال', 'تسليم'],
    de: ['lieferung', 'versand', 'zustellung'],
    es: ['entrega', 'envío', 'despacho'],
    fr: ['livraison', 'expédition', 'envoi'],
    it: ['consegna', 'spedizione', 'invio'],
    ja: ['配送', '配達', '出荷', 'デリバリー'],
    ko: ['배송', '배달', '발송'],
    nl: ['levering', 'verzending', 'bezorging'],
    pl: ['dostawa', 'wysyłka', 'przesyłka'],
    pt: ['entrega', 'envio', 'frete'],
    ru: ['доставка', 'отправка', 'пересылка'],
    tr: ['teslimat', 'kargo', 'gönderim'],
    ua: ['доставка', 'відправка', 'пересилка'],
    zh: ['配送', '发货', '运输', '快递']
  },
  fast: {
    ar: ['سريع', 'عاجل', 'فوري', 'خاطف'],
    de: ['schnell', 'express', 'eilig', 'sofort'],
    es: ['rápido', 'urgente', 'express', 'inmediato'],
    fr: ['rapide', 'urgent', 'express', 'immédiat'],
    it: ['veloce', 'rapido', 'urgente', 'express'],
    ja: ['速い', '急ぎ', '即日', 'エクスプレス'],
    ko: ['빠른', '급한', '익스프레스'],
    nl: ['snel', 'express', 'spoed'],
    pl: ['szybki', 'ekspres', 'pilny'],
    pt: ['rápido', 'urgente', 'expresso'],
    ru: ['быстро', 'срочно', 'экспресс', 'быстрая'],
    tr: ['hızlı', 'acil', 'ekspres'],
    ua: ['швидко', 'терміново', 'експрес'],
    zh: ['快速', '急', '加急', '极速']
  },
  freeShipping: {
    ar: ['شحن مجاني', 'توصيل مجاني'],
    de: ['kostenloser versand', 'versandkostenfrei'],
    es: ['envío gratis', 'envío gratuito'],
    fr: ['livraison gratuite', 'port gratuit'],
    it: ['spedizione gratuita', 'consegna gratuita'],
    ja: ['送料無料', '無料配送'],
    ko: ['무료 배송', '배송비 무료'],
    nl: ['gratis verzending', 'verzendkosten vrij'],
    pl: ['darmowa wysyłka', 'bezpłatna dostawa'],
    pt: ['frete grátis', 'entrega gratuita'],
    ru: ['бесплатная доставка', 'бесплатно доставка'],
    tr: ['ücretsiz kargo', 'bedava gönderim'],
    ua: ['безкоштовна доставка', 'доставка безкоштовно'],
    zh: ['免运费', '包邮', '免费配送']
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // QUALITY & TYPE
  // ═══════════════════════════════════════════════════════════════════════════
  oem: {
    ar: ['أصلي', 'أصيل', 'من المصنع', 'جينوين'],
    de: ['original', 'oem', 'echt', 'genuine'],
    es: ['original', 'oem', 'genuino', 'de fábrica'],
    fr: ['original', 'oem', 'd\'origine', 'authentique'],
    it: ['originale', 'oem', 'genuino', 'di fabbrica'],
    ja: ['純正', 'OEM', 'オリジナル', '正規品'],
    ko: ['순정', '정품', 'OEM', '오리지널'],
    nl: ['origineel', 'oem', 'echt', 'fabriek'],
    pl: ['oryginalny', 'oem', 'fabryczny'],
    pt: ['original', 'oem', 'genuíno', 'de fábrica'],
    ru: ['оригинал', 'оригинальный', 'заводской', 'OEM'],
    tr: ['orijinal', 'oem', 'gerçek', 'fabrika'],
    ua: ['оригінал', 'оригінальний', 'заводський'],
    zh: ['原装', '原厂', 'OEM', '正品']
  },
  aftermarket: {
    ar: ['بديل', 'غير أصلي', 'ما بعد البيع'],
    de: ['aftermarket', 'nachbau', 'ersatzmarkt', 'zubehör'],
    es: ['aftermarket', 'genérico', 'alternativo'],
    fr: ['aftermarket', 'secondaire', 'générique'],
    it: ['aftermarket', 'ricambio', 'generico'],
    ja: ['社外品', 'アフターマーケット', '汎用'],
    ko: ['애프터마켓', '호환', '범용'],
    nl: ['aftermarket', 'generiek', 'vervangend'],
    pl: ['aftermarket', 'zamiennik', 'nieoryginalny'],
    pt: ['aftermarket', 'paralelo', 'genérico'],
    ru: ['аналог', 'неоригинал', 'афтермаркет', 'заменитель'],
    tr: ['aftermarket', 'yedek', 'muadil'],
    ua: ['аналог', 'неоригінал', 'замінник'],
    zh: ['副厂', '替代', '通用', '后市场']
  },
  premium: {
    ar: ['ممتاز', 'فاخر', 'عالي الجودة'],
    de: ['premium', 'hochwertig', 'qualität'],
    es: ['premium', 'alta calidad', 'superior'],
    fr: ['premium', 'haute qualité', 'supérieur'],
    it: ['premium', 'alta qualità', 'superiore'],
    ja: ['プレミアム', '高品質', '上質'],
    ko: ['프리미엄', '고품질', '상급'],
    nl: ['premium', 'hoge kwaliteit', 'superior'],
    pl: ['premium', 'wysokiej jakości'],
    pt: ['premium', 'alta qualidade', 'superior'],
    ru: ['премиум', 'высокое качество', 'премиальный'],
    tr: ['premium', 'yüksek kalite', 'üstün'],
    ua: ['преміум', 'висока якість'],
    zh: ['高端', '优质', '顶级', '精品']
  },
  warranty: {
    ar: ['ضمان', 'كفالة', 'مكفول'],
    de: ['garantie', 'gewährleistung'],
    es: ['garantía', 'garantizado'],
    fr: ['garantie', 'garanti'],
    it: ['garanzia', 'garantito'],
    ja: ['保証', '保証付き', 'ワランティ'],
    ko: ['보증', '워런티'],
    nl: ['garantie', 'gegarandeerd'],
    pl: ['gwarancja', 'gwarantowany'],
    pt: ['garantia', 'garantido'],
    ru: ['гарантия', 'с гарантией', 'гарантийный'],
    tr: ['garanti', 'garantili'],
    ua: ['гарантія', 'з гарантією'],
    zh: ['保修', '质保', '有保障']
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // SORTING & COMPARISON
  // ═══════════════════════════════════════════════════════════════════════════
  best: {
    ar: ['أفضل', 'أحسن', 'الأفضل'],
    de: ['beste', 'bester', 'am besten', 'top'],
    es: ['mejor', 'mejores', 'el mejor', 'top'],
    fr: ['meilleur', 'meilleures', 'le meilleur', 'top'],
    it: ['migliore', 'migliori', 'il migliore', 'top'],
    ja: ['最高', 'ベスト', '一番', 'トップ'],
    ko: ['최고', '베스트', '가장 좋은', '탑'],
    nl: ['beste', 'top', 'hoogste'],
    pl: ['najlepszy', 'najlepsze', 'top'],
    pt: ['melhor', 'melhores', 'o melhor', 'top'],
    ru: ['лучший', 'лучшие', 'лучше', 'топ'],
    tr: ['en iyi', 'en iyisi', 'top'],
    ua: ['найкращий', 'кращий', 'топ'],
    zh: ['最好', '最佳', '顶级', '优选']
  },
  cheapest: {
    ar: ['الأرخص', 'الأقل سعراً'],
    de: ['billigste', 'günstigste', 'am günstigsten'],
    es: ['más barato', 'el más económico'],
    fr: ['le moins cher', 'le plus économique'],
    it: ['il più economico', 'il più conveniente'],
    ja: ['最安', '一番安い', '最安値'],
    ko: ['가장 싼', '최저가'],
    nl: ['goedkoopste', 'laagste prijs'],
    pl: ['najtańszy', 'najniższa cena'],
    pt: ['mais barato', 'menor preço'],
    ru: ['самый дешевый', 'дешевле всего', 'самая низкая цена'],
    tr: ['en ucuz', 'en uygun'],
    ua: ['найдешевший', 'найнижча ціна'],
    zh: ['最便宜', '最低价', '最划算']
  },
  fastest: {
    ar: ['الأسرع', 'أسرع توصيل'],
    de: ['schnellste', 'am schnellsten'],
    es: ['más rápido', 'el más rápido'],
    fr: ['le plus rapide', 'au plus vite'],
    it: ['il più veloce', 'più rapido'],
    ja: ['最速', '一番早い'],
    ko: ['가장 빠른', '최고속'],
    nl: ['snelste', 'snelst'],
    pl: ['najszybszy', 'najszybciej'],
    pt: ['mais rápido', 'o mais rápido'],
    ru: ['самый быстрый', 'быстрее всего'],
    tr: ['en hızlı', 'en süratli'],
    ua: ['найшвидший', 'швидше за все'],
    zh: ['最快', '最速']
  },
  compare: {
    ar: ['قارن', 'مقارنة', 'قابل'],
    de: ['vergleichen', 'vergleich', 'gegenüber'],
    es: ['comparar', 'comparación', 'versus'],
    fr: ['comparer', 'comparaison', 'versus'],
    it: ['confrontare', 'confronto', 'versus'],
    ja: ['比較', '比べる', '対比'],
    ko: ['비교', '대비'],
    nl: ['vergelijken', 'vergelijking'],
    pl: ['porównaj', 'porównanie'],
    pt: ['comparar', 'comparação', 'versus'],
    ru: ['сравнить', 'сравнение', 'против'],
    tr: ['karşılaştır', 'karşılaştırma'],
    ua: ['порівняти', 'порівняння'],
    zh: ['比较', '对比', '对照']
  },
  alternative: {
    ar: ['بديل', 'بدائل', 'معادل'],
    de: ['alternative', 'ersatz', 'gleichwertig'],
    es: ['alternativa', 'sustituto', 'equivalente'],
    fr: ['alternative', 'substitut', 'équivalent'],
    it: ['alternativa', 'sostituto', 'equivalente'],
    ja: ['代替', '代わり', '互換'],
    ko: ['대안', '대체품', '호환품'],
    nl: ['alternatief', 'vervanger', 'equivalent'],
    pl: ['alternatywa', 'zamiennik', 'odpowiednik'],
    pt: ['alternativa', 'substituto', 'equivalente'],
    ru: ['альтернатива', 'замена', 'эквивалент', 'аналог'],
    tr: ['alternatif', 'muadil', 'eşdeğer'],
    ua: ['альтернатива', 'заміна', 'еквівалент'],
    zh: ['替代品', '代替', '等效']
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH & FIND
  // ═══════════════════════════════════════════════════════════════════════════
  find: {
    ar: ['ابحث', 'جد', 'اعثر', 'أريد'],
    de: ['finden', 'suchen', 'ich brauche', 'zeig mir'],
    es: ['buscar', 'encontrar', 'necesito', 'quiero'],
    fr: ['chercher', 'trouver', 'je veux', 'j\'ai besoin'],
    it: ['cercare', 'trovare', 'ho bisogno', 'voglio'],
    ja: ['探す', '検索', '見つける', '欲しい'],
    ko: ['찾기', '검색', '필요합니다'],
    nl: ['zoeken', 'vinden', 'ik wil', 'ik nodig'],
    pl: ['szukaj', 'znajdź', 'potrzebuję', 'chcę'],
    pt: ['buscar', 'encontrar', 'preciso', 'quero'],
    ru: ['найти', 'искать', 'мне нужно', 'хочу'],
    tr: ['bul', 'ara', 'istiyorum', 'lazım'],
    ua: ['знайти', 'шукати', 'мені потрібно', 'хочу'],
    zh: ['找', '搜索', '查找', '需要', '要']
  },
  show: {
    ar: ['أظهر', 'اعرض', 'أرني'],
    de: ['zeigen', 'anzeigen'],
    es: ['mostrar', 'ver', 'enseñar'],
    fr: ['montrer', 'afficher', 'voir'],
    it: ['mostrare', 'visualizzare', 'vedere'],
    ja: ['表示', '見せて', '出して'],
    ko: ['보여줘', '표시'],
    nl: ['tonen', 'laten zien'],
    pl: ['pokaż', 'wyświetl'],
    pt: ['mostrar', 'exibir', 'ver'],
    ru: ['показать', 'покажи', 'отобразить'],
    tr: ['göster', 'listele'],
    ua: ['показати', 'покажи'],
    zh: ['显示', '展示', '看看']
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // PARTS CATEGORIES (Main automotive parts)
  // ═══════════════════════════════════════════════════════════════════════════
  brake: {
    ar: ['فرامل', 'مكابح', 'بريك'],
    de: ['bremse', 'bremsen', 'bremsbelag'],
    es: ['freno', 'frenos', 'pastillas'],
    fr: ['frein', 'freins', 'plaquette'],
    it: ['freno', 'freni', 'pastiglie'],
    ja: ['ブレーキ', 'ブレーキパッド'],
    ko: ['브레이크', '제동'],
    nl: ['rem', 'remmen', 'remblok'],
    pl: ['hamulec', 'hamulce', 'klocki'],
    pt: ['freio', 'freios', 'pastilha'],
    ru: ['тормоз', 'тормоза', 'тормозные колодки'],
    tr: ['fren', 'frenler', 'balata'],
    ua: ['гальмо', 'гальма', 'гальмівні колодки'],
    zh: ['刹车', '制动', '刹车片']
  },
  filter: {
    ar: ['فلتر', 'مرشح', 'مصفي'],
    de: ['filter', 'luftfilter', 'ölfilter'],
    es: ['filtro', 'filtros'],
    fr: ['filtre', 'filtres'],
    it: ['filtro', 'filtri'],
    ja: ['フィルター', 'フィルタ'],
    ko: ['필터', '여과기'],
    nl: ['filter', 'filters'],
    pl: ['filtr', 'filtry'],
    pt: ['filtro', 'filtros'],
    ru: ['фильтр', 'фильтры'],
    tr: ['filtre', 'filtreler'],
    ua: ['фільтр', 'фільтри'],
    zh: ['滤清器', '过滤器', '滤芯']
  },
  oilFilter: {
    ar: ['فلتر زيت', 'فلتر الزيت'],
    de: ['ölfilter'],
    es: ['filtro de aceite'],
    fr: ['filtre à huile'],
    it: ['filtro olio'],
    ja: ['オイルフィルター', 'オイルエレメント'],
    ko: ['오일 필터'],
    nl: ['oliefilter'],
    pl: ['filtr oleju'],
    pt: ['filtro de óleo'],
    ru: ['масляный фильтр'],
    tr: ['yağ filtresi'],
    ua: ['масляний фільтр'],
    zh: ['机油滤清器', '机油滤芯']
  },
  airFilter: {
    ar: ['فلتر هواء', 'فلتر الهواء'],
    de: ['luftfilter'],
    es: ['filtro de aire'],
    fr: ['filtre à air'],
    it: ['filtro aria'],
    ja: ['エアフィルター', 'エアクリーナー'],
    ko: ['에어 필터'],
    nl: ['luchtfilter'],
    pl: ['filtr powietrza'],
    pt: ['filtro de ar'],
    ru: ['воздушный фильтр'],
    tr: ['hava filtresi'],
    ua: ['повітряний фільтр'],
    zh: ['空气滤清器', '空滤']
  },
  engine: {
    ar: ['محرك', 'موتور'],
    de: ['motor', 'engine'],
    es: ['motor', 'motores'],
    fr: ['moteur', 'moteurs'],
    it: ['motore', 'motori'],
    ja: ['エンジン', 'モーター'],
    ko: ['엔진', '모터'],
    nl: ['motor', 'engine'],
    pl: ['silnik', 'silniki'],
    pt: ['motor', 'motores'],
    ru: ['двигатель', 'мотор'],
    tr: ['motor', 'motorlar'],
    ua: ['двигун', 'мотор'],
    zh: ['发动机', '引擎', '马达']
  },
  suspension: {
    ar: ['تعليق', 'نظام التعليق'],
    de: ['federung', 'fahrwerk', 'aufhängung'],
    es: ['suspensión', 'amortiguador'],
    fr: ['suspension', 'amortisseur'],
    it: ['sospensione', 'ammortizzatore'],
    ja: ['サスペンション', 'ショック'],
    ko: ['서스펜션', '현가장치'],
    nl: ['ophanging', 'vering'],
    pl: ['zawieszenie', 'amortyzator'],
    pt: ['suspensão', 'amortecedor'],
    ru: ['подвеска', 'амортизатор'],
    tr: ['süspansiyon', 'amortisör'],
    ua: ['підвіска', 'амортизатор'],
    zh: ['悬挂', '悬架', '减震']
  },
  bearing: {
    ar: ['محمل', 'رولمان بلي', 'بلي'],
    de: ['lager', 'kugellager', 'radlager'],
    es: ['rodamiento', 'cojinete'],
    fr: ['roulement', 'palier'],
    it: ['cuscinetto', 'cuscinetti'],
    ja: ['ベアリング', '軸受'],
    ko: ['베어링', '축받이'],
    nl: ['lager', 'kogellager'],
    pl: ['łożysko', 'łożyska'],
    pt: ['rolamento', 'mancal'],
    ru: ['подшипник', 'подшипники'],
    tr: ['rulman', 'yatak'],
    ua: ['підшипник', 'підшипники'],
    zh: ['轴承', '轴瓦']
  },
  clutch: {
    ar: ['كلتش', 'قابض', 'دبرياج'],
    de: ['kupplung', 'kupplungssatz'],
    es: ['embrague', 'clutch'],
    fr: ['embrayage', 'disque'],
    it: ['frizione', 'disco frizione'],
    ja: ['クラッチ'],
    ko: ['클러치'],
    nl: ['koppeling'],
    pl: ['sprzęgło'],
    pt: ['embreagem'],
    ru: ['сцепление', 'диск сцепления'],
    tr: ['debriyaj', 'kavrama'],
    ua: ['зчеплення', 'диск зчеплення'],
    zh: ['离合器']
  },
  steering: {
    ar: ['توجيه', 'مقود', 'دركسيون'],
    de: ['lenkung', 'steuerung'],
    es: ['dirección', 'volante'],
    fr: ['direction', 'volant'],
    it: ['sterzo', 'direzione'],
    ja: ['ステアリング', 'ハンドル'],
    ko: ['스티어링', '조향'],
    nl: ['stuurinrichting', 'besturing'],
    pl: ['kierownica', 'układ kierowniczy'],
    pt: ['direção', 'volante'],
    ru: ['рулевое управление', 'рулевая'],
    tr: ['direksiyon'],
    ua: ['кермо', 'рульове управління'],
    zh: ['转向', '方向盘']
  },
  exhaust: {
    ar: ['عادم', 'شكمان', 'إكزوست'],
    de: ['auspuff', 'abgas'],
    es: ['escape', 'tubo de escape'],
    fr: ['échappement', 'pot'],
    it: ['scarico', 'marmitta'],
    ja: ['排気', 'マフラー', 'エキゾースト'],
    ko: ['배기', '머플러'],
    nl: ['uitlaat', 'uitlaatpijp'],
    pl: ['wydech', 'układ wydechowy'],
    pt: ['escapamento', 'descarga'],
    ru: ['выхлоп', 'выхлопная система', 'глушитель'],
    tr: ['egzoz'],
    ua: ['вихлоп', 'глушник'],
    zh: ['排气', '排气管', '消声器']
  },
  cooling: {
    ar: ['تبريد', 'نظام التبريد', 'راديتر'],
    de: ['kühlung', 'kühler', 'kühlsystem'],
    es: ['refrigeración', 'radiador', 'enfriamiento'],
    fr: ['refroidissement', 'radiateur'],
    it: ['raffreddamento', 'radiatore'],
    ja: ['冷却', 'ラジエーター', '冷却系'],
    ko: ['냉각', '라디에이터'],
    nl: ['koeling', 'radiateur'],
    pl: ['chłodzenie', 'chłodnica'],
    pt: ['arrefecimento', 'radiador', 'refrigeração'],
    ru: ['охлаждение', 'радиатор', 'система охлаждения'],
    tr: ['soğutma', 'radyatör'],
    ua: ['охолодження', 'радіатор'],
    zh: ['冷却', '散热', '水箱']
  },
  electrical: {
    ar: ['كهربائي', 'كهرباء'],
    de: ['elektrisch', 'elektrik'],
    es: ['eléctrico', 'electrónico'],
    fr: ['électrique', 'électronique'],
    it: ['elettrico', 'elettronica'],
    ja: ['電気', '電装', 'エレクトリック'],
    ko: ['전기', '전자'],
    nl: ['elektrisch', 'elektra'],
    pl: ['elektryczny', 'elektryka'],
    pt: ['elétrico', 'eletrônico'],
    ru: ['электрика', 'электрический'],
    tr: ['elektrik', 'elektronik'],
    ua: ['електрика', 'електричний'],
    zh: ['电气', '电子', '电路']
  },
  transmission: {
    ar: ['ناقل حركة', 'قير', 'جيربكس'],
    de: ['getriebe', 'schaltgetriebe'],
    es: ['transmisión', 'caja de cambios'],
    fr: ['transmission', 'boîte de vitesses'],
    it: ['trasmissione', 'cambio'],
    ja: ['トランスミッション', 'ギアボックス', '変速機'],
    ko: ['트랜스미션', '변속기'],
    nl: ['transmissie', 'versnellingsbak'],
    pl: ['skrzynia biegów', 'przekładnia'],
    pt: ['transmissão', 'câmbio'],
    ru: ['коробка передач', 'трансмиссия', 'КПП'],
    tr: ['şanzıman', 'vites kutusu'],
    ua: ['коробка передач', 'трансмісія'],
    zh: ['变速箱', '传动', '变速器']
  },
  turbo: {
    ar: ['تيربو', 'شاحن توربيني'],
    de: ['turbo', 'turbolader'],
    es: ['turbo', 'turbocompresor'],
    fr: ['turbo', 'turbocompresseur'],
    it: ['turbo', 'turbocompressore'],
    ja: ['ターボ', 'ターボチャージャー'],
    ko: ['터보', '터보차저'],
    nl: ['turbo', 'turbocharger'],
    pl: ['turbo', 'turbosprężarka'],
    pt: ['turbo', 'turbocompressor'],
    ru: ['турбо', 'турбина', 'турбонаддув'],
    tr: ['turbo', 'turboşarj'],
    ua: ['турбо', 'турбіна'],
    zh: ['涡轮', '增压器', '涡轮增压']
  },
  spark: {
    ar: ['شمعة', 'بوجيه', 'شمعات إشعال'],
    de: ['zündkerze', 'kerze'],
    es: ['bujía', 'bujías'],
    fr: ['bougie', 'bougies'],
    it: ['candela', 'candele'],
    ja: ['スパークプラグ', '点火プラグ'],
    ko: ['점화 플러그', '스파크 플러그'],
    nl: ['bougie', 'bougies'],
    pl: ['świeca zapłonowa', 'świece'],
    pt: ['vela', 'velas'],
    ru: ['свеча зажигания', 'свечи'],
    tr: ['buji', 'ateşleme bujisi'],
    ua: ['свічка запалювання', 'свічки'],
    zh: ['火花塞', '点火塞']
  },
  sensor: {
    ar: ['حساس', 'مستشعر', 'سنسر'],
    de: ['sensor', 'fühler', 'geber'],
    es: ['sensor', 'sensores'],
    fr: ['capteur', 'sonde'],
    it: ['sensore', 'sensori'],
    ja: ['センサー', 'センサ'],
    ko: ['센서'],
    nl: ['sensor', 'voeler'],
    pl: ['czujnik', 'sensor'],
    pt: ['sensor', 'sensores'],
    ru: ['датчик', 'сенсор'],
    tr: ['sensör'],
    ua: ['датчик', 'сенсор'],
    zh: ['传感器', '感应器']
  },
  gasket: {
    ar: ['جوان', 'حشية', 'جوانات'],
    de: ['dichtung', 'zylinderkopfdichtung'],
    es: ['junta', 'empaque'],
    fr: ['joint', 'joints'],
    it: ['guarnizione', 'guarnizioni'],
    ja: ['ガスケット', 'パッキン'],
    ko: ['가스켓', '개스킷'],
    nl: ['pakking', 'afdichting'],
    pl: ['uszczelka', 'uszczelki'],
    pt: ['junta', 'gaxeta'],
    ru: ['прокладка', 'уплотнитель'],
    tr: ['conta', 'sızdırmazlık'],
    ua: ['прокладка', 'ущільнювач'],
    zh: ['垫片', '密封垫']
  },
  belt: {
    ar: ['سير', 'حزام', 'سيور'],
    de: ['riemen', 'keilriemen', 'zahnriemen'],
    es: ['correa', 'cinturón'],
    fr: ['courroie', 'ceinture'],
    it: ['cinghia', 'cinghie'],
    ja: ['ベルト', 'タイミングベルト'],
    ko: ['벨트'],
    nl: ['riem', 'snaar'],
    pl: ['pasek', 'pas'],
    pt: ['correia', 'cinto'],
    ru: ['ремень', 'ремни'],
    tr: ['kayış', 'bant'],
    ua: ['ремінь', 'ремені'],
    zh: ['皮带', '正时皮带']
  },
  pump: {
    ar: ['مضخة', 'طلمبة', 'بمب'],
    de: ['pumpe', 'wasserpumpe'],
    es: ['bomba', 'bombas'],
    fr: ['pompe', 'pompes'],
    it: ['pompa', 'pompe'],
    ja: ['ポンプ', 'ウォーターポンプ'],
    ko: ['펌프'],
    nl: ['pomp', 'pompen'],
    pl: ['pompa', 'pompy'],
    pt: ['bomba', 'bombas'],
    ru: ['насос', 'помпа'],
    tr: ['pompa'],
    ua: ['насос', 'помпа'],
    zh: ['泵', '水泵']
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // CONDITION
  // ═══════════════════════════════════════════════════════════════════════════
  new: {
    ar: ['جديد', 'جديدة'],
    de: ['neu', 'neuware'],
    es: ['nuevo', 'nueva'],
    fr: ['neuf', 'nouveau'],
    it: ['nuovo', 'nuova'],
    ja: ['新品', '新しい'],
    ko: ['새것', '신품'],
    nl: ['nieuw'],
    pl: ['nowy', 'nowa'],
    pt: ['novo', 'nova'],
    ru: ['новый', 'новая'],
    tr: ['yeni'],
    ua: ['новий', 'нова'],
    zh: ['新', '新品', '全新']
  },
  used: {
    ar: ['مستعمل', 'مستخدم'],
    de: ['gebraucht', 'benutzt'],
    es: ['usado', 'segunda mano'],
    fr: ['occasion', 'utilisé'],
    it: ['usato', 'seconda mano'],
    ja: ['中古', '使用済み'],
    ko: ['중고', '사용한'],
    nl: ['gebruikt', 'tweedehands'],
    pl: ['używany', 'z drugiej ręki'],
    pt: ['usado', 'segunda mão'],
    ru: ['б/у', 'бу', 'подержанный'],
    tr: ['ikinci el', 'kullanılmış'],
    ua: ['б/в', 'вживаний'],
    zh: ['二手', '旧', '使用过']
  },
  refurbished: {
    ar: ['مجدد', 'معاد التصنيع'],
    de: ['aufbereitet', 'refurbished', 'wiederaufbereitet'],
    es: ['reacondicionado', 'restaurado'],
    fr: ['reconditionné', 'remis à neuf'],
    it: ['ricondizionato', 'rigenerato'],
    ja: ['リファービッシュ', '再生品', 'リビルト'],
    ko: ['리퍼', '재생품'],
    nl: ['refurbished', 'gereviseerd'],
    pl: ['odnowiony', 'regenerowany'],
    pt: ['recondicionado', 'restaurado'],
    ru: ['восстановленный', 'реманофакт'],
    tr: ['yenilenmiş', 'onarılmış'],
    ua: ['відновлений', 'реманофакт'],
    zh: ['翻新', '再制造', '修复']
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // ORIGINS / COUNTRIES
  // ═══════════════════════════════════════════════════════════════════════════
  german: {
    ar: ['ألماني', 'المانيا', 'ألمانية'],
    de: ['deutsch', 'deutschland', 'deutsche'],
    es: ['alemán', 'alemania'],
    fr: ['allemand', 'allemagne'],
    it: ['tedesco', 'germania'],
    ja: ['ドイツ', 'ドイツ製'],
    ko: ['독일', '독일산'],
    nl: ['duits', 'duitsland'],
    pl: ['niemiecki', 'niemcy'],
    pt: ['alemão', 'alemanha'],
    ru: ['немецкий', 'германия', 'германский'],
    tr: ['alman', 'almanya'],
    ua: ['німецький', 'німеччина'],
    zh: ['德国', '德国产']
  },
  japanese: {
    ar: ['ياباني', 'يابانية', 'اليابان'],
    de: ['japanisch', 'japan'],
    es: ['japonés', 'japón'],
    fr: ['japonais', 'japon'],
    it: ['giapponese', 'giappone'],
    ja: ['日本', '日本製', '国産'],
    ko: ['일본', '일본산'],
    nl: ['japans', 'japan'],
    pl: ['japoński', 'japonia'],
    pt: ['japonês', 'japão'],
    ru: ['японский', 'япония', 'японское'],
    tr: ['japon', 'japonya'],
    ua: ['японський', 'японія'],
    zh: ['日本', '日本产']
  },
  american: {
    ar: ['أمريكي', 'أمريكا', 'امريكية'],
    de: ['amerikanisch', 'usa', 'amerika'],
    es: ['americano', 'estadounidense', 'usa'],
    fr: ['américain', 'usa', 'états-unis'],
    it: ['americano', 'usa', 'stati uniti'],
    ja: ['アメリカ', 'アメリカ製', '米国'],
    ko: ['미국', '미국산'],
    nl: ['amerikaans', 'usa', 'amerika'],
    pl: ['amerykański', 'usa', 'ameryka'],
    pt: ['americano', 'usa', 'estados unidos'],
    ru: ['американский', 'сша', 'американское'],
    tr: ['amerikan', 'abd', 'amerika'],
    ua: ['американський', 'сша'],
    zh: ['美国', '美国产']
  },
  korean: {
    ar: ['كوري', 'كورية', 'كوريا'],
    de: ['koreanisch', 'korea'],
    es: ['coreano', 'corea'],
    fr: ['coréen', 'corée'],
    it: ['coreano', 'corea'],
    ja: ['韓国', '韓国製'],
    ko: ['한국', '한국산', '국산'],
    nl: ['koreaans', 'korea'],
    pl: ['koreański', 'korea'],
    pt: ['coreano', 'coreia'],
    ru: ['корейский', 'корея'],
    tr: ['koreli', 'kore'],
    ua: ['корейський', 'корея'],
    zh: ['韩国', '韩国产']
  },
  chinese: {
    ar: ['صيني', 'صينية', 'الصين'],
    de: ['chinesisch', 'china'],
    es: ['chino', 'china'],
    fr: ['chinois', 'chine'],
    it: ['cinese', 'cina'],
    ja: ['中国', '中国製'],
    ko: ['중국', '중국산'],
    nl: ['chinees', 'china'],
    pl: ['chiński', 'chiny'],
    pt: ['chinês', 'china'],
    ru: ['китайский', 'китай'],
    tr: ['çin', 'çinli'],
    ua: ['китайський', 'китай'],
    zh: ['中国', '国产']
  },
  european: {
    ar: ['أوروبي', 'أوروبية', 'أوروبا'],
    de: ['europäisch', 'europa', 'eu'],
    es: ['europeo', 'europa'],
    fr: ['européen', 'europe'],
    it: ['europeo', 'europa'],
    ja: ['ヨーロッパ', '欧州'],
    ko: ['유럽', '유럽산'],
    nl: ['europees', 'europa'],
    pl: ['europejski', 'europa'],
    pt: ['europeu', 'europa'],
    ru: ['европейский', 'европа'],
    tr: ['avrupa', 'avrupalı'],
    ua: ['європейський', 'європа'],
    zh: ['欧洲', '欧洲产']
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // FUEL TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  diesel: {
    ar: ['ديزل', 'سولار'],
    de: ['diesel'],
    es: ['diésel', 'diesel'],
    fr: ['diesel'],
    it: ['diesel', 'gasolio'],
    ja: ['ディーゼル', '軽油'],
    ko: ['디젤'],
    nl: ['diesel'],
    pl: ['diesel', 'olej napędowy'],
    pt: ['diesel'],
    ru: ['дизель', 'дизельный'],
    tr: ['dizel'],
    ua: ['дизель', 'дизельний'],
    zh: ['柴油', '柴油车']
  },
  petrol: {
    ar: ['بنزين', 'وقود'],
    de: ['benzin', 'benziner'],
    es: ['gasolina', 'nafta'],
    fr: ['essence'],
    it: ['benzina'],
    ja: ['ガソリン', 'ガソリン車'],
    ko: ['가솔린', '휘발유'],
    nl: ['benzine'],
    pl: ['benzyna'],
    pt: ['gasolina'],
    ru: ['бензин', 'бензиновый'],
    tr: ['benzin', 'benzinli'],
    ua: ['бензин', 'бензиновий'],
    zh: ['汽油', '汽油车']
  },
  hybrid: {
    ar: ['هايبرد', 'هجين'],
    de: ['hybrid'],
    es: ['híbrido'],
    fr: ['hybride'],
    it: ['ibrido'],
    ja: ['ハイブリッド'],
    ko: ['하이브리드'],
    nl: ['hybride'],
    pl: ['hybrydowy', 'hybryda'],
    pt: ['híbrido'],
    ru: ['гибрид', 'гибридный'],
    tr: ['hibrit'],
    ua: ['гібрид', 'гібридний'],
    zh: ['混动', '混合动力']
  },
  electric: {
    ar: ['كهربائي', 'كهرباء'],
    de: ['elektrisch', 'elektro'],
    es: ['eléctrico'],
    fr: ['électrique'],
    it: ['elettrico'],
    ja: ['電気', '電動', 'EV'],
    ko: ['전기', '전기차'],
    nl: ['elektrisch'],
    pl: ['elektryczny'],
    pt: ['elétrico'],
    ru: ['электрический', 'электро', 'электромобиль'],
    tr: ['elektrikli'],
    ua: ['електричний', 'електро'],
    zh: ['电动', '纯电']
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // VEHICLE TYPES
  // ═══════════════════════════════════════════════════════════════════════════
  car: {
    ar: ['سيارة', 'سيارت', 'عربية'],
    de: ['auto', 'pkw', 'wagen', 'fahrzeug'],
    es: ['coche', 'auto', 'carro', 'vehículo'],
    fr: ['voiture', 'auto', 'véhicule'],
    it: ['auto', 'macchina', 'veicolo'],
    ja: ['車', '自動車', 'クルマ'],
    ko: ['자동차', '차', '차량'],
    nl: ['auto', 'wagen', 'voertuig'],
    pl: ['samochód', 'auto', 'pojazd'],
    pt: ['carro', 'automóvel', 'veículo'],
    ru: ['автомобиль', 'машина', 'авто'],
    tr: ['araba', 'otomobil', 'araç'],
    ua: ['автомобіль', 'машина', 'авто'],
    zh: ['汽车', '车', '轿车']
  },
  truck: {
    ar: ['شاحنة', 'لوري', 'تريلا'],
    de: ['lkw', 'lastwagen', 'truck'],
    es: ['camión', 'truck'],
    fr: ['camion', 'poids lourd'],
    it: ['camion', 'autocarro'],
    ja: ['トラック', '貨物車'],
    ko: ['트럭', '화물차'],
    nl: ['vrachtwagen', 'truck'],
    pl: ['ciężarówka', 'truck'],
    pt: ['caminhão', 'camião'],
    ru: ['грузовик', 'грузовой'],
    tr: ['kamyon', 'tır'],
    ua: ['вантажівка', 'грузовик'],
    zh: ['卡车', '货车', '大卡']
  },
  suv: {
    ar: ['جيب', 'دفع رباعي'],
    de: ['suv', 'geländewagen'],
    es: ['suv', 'todoterreno', 'camioneta'],
    fr: ['suv', '4x4', 'tout-terrain'],
    it: ['suv', 'fuoristrada'],
    ja: ['SUV', 'クロスオーバー'],
    ko: ['SUV', '스포츠유틸리티'],
    nl: ['suv', 'terreinwagen'],
    pl: ['suv', 'terenowy'],
    pt: ['suv', 'utilitário'],
    ru: ['внедорожник', 'джип', 'кроссовер'],
    tr: ['suv', 'arazi aracı'],
    ua: ['позашляховик', 'джип'],
    zh: ['SUV', '越野', '城市越野']
  },
  motorcycle: {
    ar: ['دراجة نارية', 'موتوسيكل'],
    de: ['motorrad', 'bike'],
    es: ['moto', 'motocicleta'],
    fr: ['moto', 'motocyclette'],
    it: ['moto', 'motocicletta'],
    ja: ['バイク', 'オートバイ', '二輪'],
    ko: ['오토바이', '모터사이클'],
    nl: ['motorfiets', 'motor'],
    pl: ['motocykl', 'motor'],
    pt: ['moto', 'motocicleta'],
    ru: ['мотоцикл', 'мото'],
    tr: ['motosiklet', 'motor'],
    ua: ['мотоцикл', 'мото'],
    zh: ['摩托车', '机车']
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // MISCELLANEOUS
  // ═══════════════════════════════════════════════════════════════════════════
  part: {
    ar: ['قطعة', 'جزء', 'قطع غيار'],
    de: ['teil', 'ersatzteil', 'bauteil'],
    es: ['pieza', 'parte', 'repuesto'],
    fr: ['pièce', 'partie', 'rechange'],
    it: ['pezzo', 'parte', 'ricambio'],
    ja: ['部品', 'パーツ', '部分'],
    ko: ['부품', '파츠'],
    nl: ['onderdeel', 'stuk'],
    pl: ['część', 'element'],
    pt: ['peça', 'parte'],
    ru: ['деталь', 'запчасть', 'часть'],
    tr: ['parça', 'yedek parça'],
    ua: ['деталь', 'запчастина'],
    zh: ['零件', '配件', '部件']
  },
  supplier: {
    ar: ['مورد', 'موزع', 'تاجر'],
    de: ['lieferant', 'anbieter', 'händler'],
    es: ['proveedor', 'distribuidor'],
    fr: ['fournisseur', 'distributeur'],
    it: ['fornitore', 'distributore'],
    ja: ['サプライヤー', '供給者', '販売店'],
    ko: ['공급업체', '판매자'],
    nl: ['leverancier', 'distributeur'],
    pl: ['dostawca', 'dystrybutor'],
    pt: ['fornecedor', 'distribuidor'],
    ru: ['поставщик', 'дистрибьютор'],
    tr: ['tedarikçi', 'dağıtıcı'],
    ua: ['постачальник', 'дистриб\'ютор'],
    zh: ['供应商', '供货商', '经销商']
  },
  wholesale: {
    ar: ['جملة', 'بالجملة'],
    de: ['großhandel', 'grosshandel'],
    es: ['mayorista', 'al por mayor'],
    fr: ['grossiste', 'en gros'],
    it: ['ingrosso', 'all\'ingrosso'],
    ja: ['卸売', '卸', 'ホールセール'],
    ko: ['도매', '대량'],
    nl: ['groothandel'],
    pl: ['hurtowy', 'hurt'],
    pt: ['atacado', 'grossista'],
    ru: ['оптом', 'оптовый', 'опт'],
    tr: ['toptan', 'toptancı'],
    ua: ['оптом', 'оптовий'],
    zh: ['批发', '批量']
  },
  days: {
    ar: ['يوم', 'أيام'],
    de: ['tag', 'tage'],
    es: ['día', 'días'],
    fr: ['jour', 'jours'],
    it: ['giorno', 'giorni'],
    ja: ['日', '日間'],
    ko: ['일', '일간'],
    nl: ['dag', 'dagen'],
    pl: ['dzień', 'dni'],
    pt: ['dia', 'dias'],
    ru: ['день', 'дней', 'дня'],
    tr: ['gün'],
    ua: ['день', 'днів', 'дня'],
    zh: ['天', '日']
  }
};

/**
 * Language detection - identifies user's input language
 */
function detectLanguage(text) {
  if (!text) return 'en';
  const lowerText = text.toLowerCase();
  
  // Arabic detection (Arabic script)
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  
  // Japanese detection (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return 'ja';
  
  // Chinese detection (CJK without Japanese-specific characters)
  if (/[\u4E00-\u9FFF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'zh';
  
  // Korean detection (Hangul)
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'ko';
  
  // Russian detection (Cyrillic with Russian-specific chars)
  if (/[\u0400-\u04FF]/.test(text)) {
    // Ukrainian has specific chars: ї, і, є, ґ
    if (/[їієґ]/i.test(text)) return 'ua';
    return 'ru';
  }
  
  // Turkish detection (specific chars: ş, ğ, ı, ü, ö, ç)
  if (/[şğıüöç]/i.test(text) && /\b(ve|bu|için|ile|var|bir)\b/i.test(lowerText)) return 'tr';
  
  // Polish detection (specific chars: ą, ę, ł, ń, ó, ś, ź, ż)
  if (/[ąęłńśźż]/i.test(text)) return 'pl';
  
  // German detection (ß, umlauts in common German words)
  if (/ß/.test(text) || (/[äöü]/.test(text) && /\b(und|der|die|das|ist|für|auf|mit)\b/i.test(lowerText))) return 'de';
  
  // French detection (common French patterns)
  if (/[àâçéèêëîïôùûü]/.test(text) && /\b(le|la|les|de|du|des|et|pour|avec|dans|une|un)\b/i.test(lowerText)) return 'fr';
  
  // Spanish detection
  if (/[áéíóúñ¿¡]/.test(text) && /\b(el|la|los|las|de|en|que|es|para|con|del)\b/i.test(lowerText)) return 'es';
  
  // Portuguese detection 
  if (/[ãõç]/.test(text) && /\b(de|em|que|para|com|uma|um|não|mais|está)\b/i.test(lowerText)) return 'pt';
  
  // Italian detection
  if (/[àèìòù]/.test(text) && /\b(di|che|il|la|per|un|una|in|con|non)\b/i.test(lowerText)) return 'it';
  
  // Dutch detection
  if (/\b(de|het|een|van|en|is|op|te|naar|met)\b/i.test(lowerText) && /[ëïé]/.test(text)) return 'nl';
  
  // Default to English
  return 'en';
}

/**
 * Translate multilingual terms to English equivalents
 */
function translateToEnglish(text) {
  if (!text) return text;
  
  const detectedLang = detectLanguage(text);
  if (detectedLang === 'en') return text;
  
  let translatedText = text.toLowerCase();
  
  // Iterate through dictionary and replace terms
  for (const [englishTerm, translations] of Object.entries(MULTILINGUAL_DICTIONARY)) {
    if (translations[detectedLang]) {
      for (const foreignTerm of translations[detectedLang]) {
        const regex = new RegExp(foreignTerm, 'gi');
        if (regex.test(translatedText)) {
          // Replace with English equivalent
          translatedText = translatedText.replace(regex, englishTerm);
        }
      }
    }
  }
  
  console.log(`🌐 Translated [${detectedLang}]: "${text}" → "${translatedText}"`);
  return translatedText;
}

/**
 * Get all foreign terms for a concept (for regex matching)
 */
function getAllTermsForConcept(concept) {
  const terms = [concept]; // Start with English
  if (MULTILINGUAL_DICTIONARY[concept]) {
    for (const langTerms of Object.values(MULTILINGUAL_DICTIONARY[concept])) {
      terms.push(...langTerms);
    }
  }
  return terms;
}

/**
 * Build multilingual regex pattern for a concept
 */
function buildMultilingualRegex(concept, flags = 'gi') {
  const terms = getAllTermsForConcept(concept);
  const pattern = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\b(${pattern})\\b`, flags);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INTENT PARSER v2 - Clean, deterministic intent extraction
 * Uses Gemini ONLY for complex natural language understanding
 * Falls back to robust local parser for reliability
 * ═══════════════════════════════════════════════════════════════════════════
 */
const INTENT_PARSER_INSTRUCTION = `You are an expert automotive parts search query parser for a B2B parts marketplace. Your job is to extract structured filters from natural language queries so our multi-factor AI ranking engine can find the best results.

RESPOND WITH VALID JSON ONLY. No markdown, no explanation, no extra text.

═══════════════════════════════════════════════════════════════
🌍 MULTILINGUAL SUPPORT — 15 Languages Fully Supported
═══════════════════════════════════════════════════════════════
You MUST understand and parse queries in ALL these languages professionally:
• Arabic (ar): "أريد فلتر زيت رخيص بتوصيل سريع" → cheap oil filter, fast delivery
• German (de): "Günstige Bremsbeläge für BMW auf Lager" → cheap brake pads for BMW, in stock
• Spanish (es): "Buscar filtros de aceite baratos con envío rápido" → cheap oil filters, fast shipping
• French (fr): "Je cherche des plaquettes de frein pas cher livraison rapide" → cheap brake pads, fast delivery
• Italian (it): "Filtro olio economico disponibile veloce" → cheap oil filter, available fast
• Japanese (ja): "安いブレーキパッド在庫あり即日配送" → cheap brake pads, in stock, same day
• Korean (ko): "저렴한 브레이크 패드 재고 있음 빠른 배송" → cheap brake pads, in stock, fast delivery
• Dutch (nl): "Goedkope remblokken op voorraad snelle levering" → cheap brake pads, in stock, fast delivery
• Polish (pl): "Tanie klocki hamulcowe dostępne szybka dostawa" → cheap brake pads, available, fast delivery
• Portuguese (pt): "Filtro de óleo barato em estoque entrega rápida" → cheap oil filter, in stock, fast delivery
• Russian (ru): "Дешевые тормозные колодки в наличии быстрая доставка" → cheap brake pads, in stock, fast delivery
• Turkish (tr): "Ucuz fren balatası stokta hızlı teslimat" → cheap brake pads, in stock, fast delivery
• Ukrainian (ua): "Дешеві гальмівні колодки в наявності швидка доставка" → cheap brake pads, in stock, fast delivery
• Chinese (zh): "便宜的刹车片有货快速配送" → cheap brake pads, in stock, fast delivery
• English (en): Default language

CRITICAL: Parse ALL languages with same accuracy. Extract intent regardless of input language.
Convert all foreign concepts to standard English output fields.

═══════════════════════════════════════════════════════════════
SYSTEM CONTEXT — How results are ranked AFTER your parsing:
═══════════════════════════════════════════════════════════════
After you parse the query, results are scored using a MULTI-FACTOR COMPOSITE ALGORITHM:
  • Price Score (35% weight) — lower price = higher score
  • Delivery Score (30% weight) — fewer days = higher score
  • Quantity Score (20% weight) — more stock = higher score
  • Stock Bonus (15% weight) — in-stock items get a bonus

Results get AI BADGES: "Best Overall", "Lowest Price", "Fastest Delivery", "Highest Stock".
Close results get COMPARISON INSIGHTS (tie detection, price-vs-speed tradeoffs).
Your job is ONLY to parse intent correctly — the ranking engine handles the rest.

═══════════════════════════════════════════════════════════════
CRITICAL RULES — Follow these EXACTLY:
═══════════════════════════════════════════════════════════════

1. PART NUMBERS (highest priority):
   - Extract ANY alphanumeric code that looks like a part number: "RC0009", "CAF-000267-KH", "06A115561B"
   - Part numbers contain letters AND digits, often with dashes/dots: "find best 3 for RC0009" → partNumbers:["RC0009"]
   - Multiple: "compare RC0009 and RC0010" → partNumbers:["RC0009","RC0010"]
   - When a part number is found, searchKeywords should be EMPTY (the part number IS the search)

2. PRICE (currency is ALWAYS USD unless explicitly stated):
   - "under $500" / "below 500" / "less than $500" / "max $500" → maxPrice:500
   - "over $100" / "above 100" / "more than $100" / "min $100" → minPrice:100
   - "$50-$200" / "between 50 and 200" → minPrice:50, maxPrice:200
   - "cheap" / "budget" / "affordable" → maxPrice:100, sortPreference:"price_asc"
   - "expensive" / "premium" / "high-end" → minPrice:500
   - AED/dirham → priceCurrency:"AED". EUR/euro → priceCurrency:"EUR". GBP/pound → priceCurrency:"GBP"
   
   MULTILINGUAL PRICE TERMS:
   - Arabic: رخيص/اقتصادي (cheap), غالي (expensive), سعر (price), أقل من (under), أكثر من (over)
   - German: billig/günstig (cheap), teuer (expensive), preis (price), unter (under), über (over)
   - Spanish: barato/económico (cheap), caro (expensive), precio (price), menos de (under), más de (over)
   - French: pas cher/bon marché (cheap), cher (expensive), prix (price), moins de (under), plus de (over)
   - Russian: дешевый/недорогой (cheap), дорогой (expensive), цена (price), меньше (under), больше (over)
   - Chinese: 便宜 (cheap), 贵 (expensive), 价格 (price), 以下 (under), 以上 (over)
   - Japanese: 安い (cheap), 高い (expensive), 価格 (price), 以下 (under), 以上 (over)

3. BRANDS — Two types, NEVER confuse them:
   - VEHICLE brands (what the part fits): Toyota, BMW, Mercedes, Nissan, Hyundai, Kia, Ford, etc.
     "Toyota brake pads" → vehicleBrand:"TOYOTA", partsBrands:[]
   - PARTS/MANUFACTURER brands (who made the part): Bosch, SKF, Denso, Valeo, Brembo, Gates, etc.
     "Bosch brake pads" → vehicleBrand:null, partsBrands:["BOSCH"]
   - "Bosch brake pads for Toyota" → vehicleBrand:"TOYOTA", partsBrands:["BOSCH"]

4. CATEGORIES: Extract part types — brake, filter, engine, suspension, bearing, clutch, steering, exhaust, electrical, cooling, transmission, wheel, pump, sensor, gasket, belt, hose, turbo, fuel, seal, wiper, body, lighting, hub, axle, valve, ac, interior, ignition
   
   MULTILINGUAL CATEGORY TERMS:
   - brake: فرامل (ar), Bremse (de), freno (es), frein (fr), тормоз (ru), 刹车 (zh), ブレーキ (ja), 브레이크 (ko)
   - filter: فلتر (ar), Filter (de), filtro (es/it/pt), filtre (fr/tr), фильтр (ru), 滤清器 (zh), フィルター (ja), 필터 (ko)
   - engine: محرك (ar), Motor (de), motor (es/pt), moteur (fr), двигатель (ru), 发动机 (zh), エンジン (ja), 엔진 (ko)
   - suspension: تعليق (ar), Federung (de), suspensión (es), suspension (fr), подвеска (ru), 悬挂 (zh), サスペンション (ja)
   - bearing: محمل (ar), Lager (de), rodamiento (es), roulement (fr), подшипник (ru), 轴承 (zh), ベアリング (ja)
   - clutch: كلتش (ar), Kupplung (de), embrague (es), embrayage (fr), сцепление (ru), 离合器 (zh), クラッチ (ja)

5. STOCK REQUIREMENTS:
   - "in stock" / "available" / "have it" / "on hand" / "in warehouse" → requireInStock:true
   - "full stock" / "plenty" / "bulk" / "large qty" / "abundant" / "sufficient" → requireHighStock:true
   
   MULTILINGUAL STOCK TERMS:
   - in stock: متوفر (ar), auf Lager/verfügbar (de), en stock/disponible (es), en stock/disponible (fr), в наличии (ru), 有货/现货 (zh), 在庫あり (ja), 재고있음 (ko)

6. DELIVERY:
   - "fast delivery" / "express" / "urgent" / "rush" / "asap" / "same day" / "next day" / "overnight" → fastDelivery:true
   - "within 3 days" / "3-day delivery" → maxDeliveryDays:3
   - "same day" / "today" → maxDeliveryDays:0
   - "ready to ship" / "quick turnaround" → fastDelivery:true
   
   MULTILINGUAL DELIVERY TERMS:
   - fast delivery: توصيل سريع (ar), schnelle Lieferung (de), entrega rápida (es/pt), livraison rapide (fr), быстрая доставка (ru), 快速配送 (zh), 即日配送 (ja), 빠른 배송 (ko)
   - free shipping: شحن مجاني (ar), kostenloser Versand (de), envío gratis (es), livraison gratuite (fr), бесплатная доставка (ru), 免运费/包邮 (zh), 送料無料 (ja)

7. QUALITY:
   - "OEM" / "genuine" / "original" → oem:true
   - "aftermarket" / "non-oem" / "generic" → aftermarket:true
   - "premium" / "high quality" / "top quality" → premiumQuality:true
   - "with warranty" / "guaranteed" / "warrantied" → requireWarranty:true
   - "certified" / "verified" / "approved" → certifiedSupplier:true

8. EXCLUSIONS:
   - "not Bosch" / "no Bosch" / "without Bosch" / "exclude Bosch" → excludeBrands:["BOSCH"]
   - "no Chinese" / "exclude Turkish" / "non-Chinese" → excludeOrigins:["Chinese"]
   - "only OEM" → oem:true, aftermarket exclusion context
   - "only aftermarket" → aftermarket:true

9. ORIGIN PREFERENCES:
   - "German parts" / "made in Germany" → supplierOrigin:"German"
   - "Japanese" / "European" / "American" / "Italian" / "French" / "Korean" → supplierOrigin
   
   MULTILINGUAL ORIGIN TERMS:
   - German: ألماني (ar), deutsch (de), alemán (es), allemand (fr), немецкий (ru), 德国 (zh), ドイツ (ja)
   - Japanese: ياباني (ar), japanisch (de), japonés (es), japonais (fr), японский (ru), 日本 (zh), 日本 (ja)
   - American: أمريكي (ar), amerikanisch (de), americano (es), américain (fr), американский (ru), 美国 (zh)
   - Chinese: صيني (ar), chinesisch (de), chino (es), chinois (fr), китайский (ru), 中国 (zh)
   - European: أوروبي (ar), europäisch (de), europeo (es), européen (fr), европейский (ru), 欧洲 (zh)

10. VEHICLE CONTEXT:
    - Year: "2019 Toyota" → vehicleYear:2019. "2015-2020" → vehicleYearMin:2015, vehicleYearMax:2020
    - Fuel: "diesel" / "petrol" / "gasoline" / "hybrid" / "electric" → fuelType
    - Application: "passenger" / "commercial" / "heavy duty" / "performance" → applicationType
    
    MULTILINGUAL FUEL TERMS:
    - diesel: ديزل (ar), Diesel (de), diésel (es), diesel (fr/it), дизель (ru), 柴油 (zh), ディーゼル (ja)
    - petrol/gasoline: بنزين (ar), Benzin (de), gasolina (es/pt), essence (fr), бензин (ru), 汽油 (zh), ガソリン (ja)
    - hybrid: هايبرد (ar), Hybrid (de), híbrido (es/pt), hybride (fr), гибрид (ru), 混动 (zh), ハイブリッド (ja)
    - electric: كهربائي (ar), elektrisch (de), eléctrico (es), électrique (fr), электрический (ru), 电动 (zh), 電気 (ja)

11. CONDITION: "new" / "used" / "refurbished" / "remanufactured" / "reman" / "rebuilt" → condition
    
    MULTILINGUAL CONDITION TERMS:
    - new: جديد (ar), neu (de), nuevo (es), neuf (fr), новый (ru), 新/全新 (zh), 新品 (ja), 새것 (ko)
    - used: مستعمل (ar), gebraucht (de), usado (es), occasion (fr), б/у (ru), 二手 (zh), 中古 (ja), 중고 (ko)
    - refurbished: مجدد (ar), aufbereitet (de), reacondicionado (es), reconditionné (fr), восстановленный (ru), 翻新 (zh)

12. COMPARISON: "compare" / "versus" / "vs" → compareMode:true. "alternative" / "substitute" / "equivalent" → findAlternatives:true

13. SUPPLIER TYPE: "wholesale" / "distributor" → "wholesale". "manufacturer" / "factory direct" → "manufacturer". "local" / "nearby" → "local"

14. KEYWORDS: Extract words that should match part DESCRIPTIONS. Include synonyms.
   "brake pads" → ["brake","pad","pads","braking"]
   BUT if a part number is found, leave searchKeywords EMPTY.

═══════════════════════════════════════════════════════════════
CRITICAL: topN vs requestedQuantity — MUST distinguish correctly:
═══════════════════════════════════════════════════════════════

15. topN (RESULT LIMIT — how many different options/suppliers to show):
   - "best 3" / "top 5" / "show me 3 options" / "find 5 suppliers" → topN:3/5
   - "get 3 for this part" / "find best 3 for RC0009" → topN:3
   - "compare top 4" / "list 5" / "display 3" / "recommend 3" → topN:4/5/3/3
   - "first 5" / "limit to 3" / "only show 5" → topN:5/3/5
   - IMPORTANT: "best" / "best option" / "best price" WITHOUT a number → topN:null (just sort by best)
   - Only set topN when a NUMBER >= 2 is specified

16. requestedQuantity (STOCK MINIMUM — how many units the buyer needs):
   - "need 50 units" / "qty 100" / "order 200 pieces" → requestedQuantity:50/100/200
   - "x10" / "10 pcs" / "require 30" / "minimum 20" → requestedQuantity:10/10/30/20
   - "wholesale" / "bulk order" (no number) → requestedQuantity:100

17. SORT PREFERENCE (affects scoring weights — the mentioned factor gets highest priority):
   - "cheapest" / "lowest price" / "best price" / "based on price" / "by price" / "sort by price" / "order by cost" → sortPreference:"price_asc"
   - "most expensive" / "highest price" → sortPreference:"price_desc"
   - "most stock" / "highest quantity" / "based on QTY" / "by quantity" / "sort by quantity" / "with most stock" → sortPreference:"quantity_desc"
   - "based on stock" / "based on availability" / "by stock" / "by availability" / "prioritize availability" → sortPreference:"stock_priority"
   - "fastest delivery" / "quickest" / "based on delivery" / "by delivery" / "sort by delivery" / "soonest" → sortPreference:"delivery_asc"
   - "by quality" / "best quality" / "highest quality" / "sort by quality" → sortPreference:"quality_desc"
   - "lightest" / "by weight" / "sort by weight" → sortPreference:"weight_asc"
   - "best" (general, no specific factor) → sortPreference:null (composite scoring handles it)
   
   CRITICAL: When user says "best 2 based on QTY", extract BOTH topN:2 AND sortPreference:"quantity_desc"
             When user says "best 3 based on price", extract BOTH topN:3 AND sortPreference:"price_asc"

18. TYPO TOLERANCE: "bosh"=BOSCH, "toyta"=TOYOTA, "bremb"=BREMBO, "mersedes"=MERCEDES, "nisan"=NISSAN, "hynudai"=HYUNDAI

═══════════════════════════════════════════════════════════════

OUTPUT FORMAT (STRICT — return exactly this shape):
{
  "summary": "One-line description of what user wants",
  "searchKeywords": ["keyword1", "keyword2"],
  "partNumbers": ["RC0009"],
  "vehicleBrand": null,
  "partsBrands": [],
  "categories": [],
  "maxPrice": null,
  "minPrice": null,
  "priceCurrency": "USD",
  "requireInStock": false,
  "requireHighStock": false,
  "fastDelivery": false,
  "maxDeliveryDays": null,
  "oem": false,
  "aftermarket": false,
  "premiumQuality": false,
  "requireWarranty": false,
  "certifiedSupplier": false,
  "requestedQuantity": null,
  "topN": null,
  "sortPreference": null,
  "excludeBrands": [],
  "excludeOrigins": [],
  "supplierOrigin": null,
  "compareMode": false,
  "findAlternatives": false,
  "vehicleYear": null,
  "vehicleYearMin": null,
  "vehicleYearMax": null,
  "condition": "new",
  "fuelType": null,
  "applicationType": null,
  "heavyDuty": false,
  "supplierType": null,
  "freeShipping": false,
  "confidence": "HIGH",
  "suggestions": []
}

EXAMPLES:
- "find best 3 for RC0009" → partNumbers:["RC0009"], topN:3, searchKeywords:[], requestedQuantity:null
- "cheapest Bosch brake pads in stock" → partsBrands:["BOSCH"], categories:["brake"], sortPreference:"price_asc", requireInStock:true, searchKeywords:["brake","pad","pads"]
- "need 50 units of 06A115561B under $10 fast delivery" → partNumbers:["06A115561B"], requestedQuantity:50, maxPrice:10, fastDelivery:true, topN:null
- "top 5 Toyota filters" → vehicleBrand:"TOYOTA", categories:["filter"], topN:5, searchKeywords:["filter","filters"]
- "best option for this part ABC-123" → partNumbers:["ABC-123"], topN:null, sortPreference:null (composite scoring picks the best)
- "compare RC0009" → partNumbers:["RC0009"], topN:null (show all suppliers for comparison)`;

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
      return {
        success: false,
        ...buildLocalParsedIntent(query),
        confidence: 'LOW',
      };
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
      } catch (e) {
        /* ignore */
      }

      const learningPrompt =
        aiLearningService.generateLearningPrompt(learnedContext);

      const prompt = `${INTENT_PARSER_INSTRUCTION}\n${learningPrompt}\nUser query: "${query}"\n\nReturn ONLY valid JSON.`;

      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
          config: { temperature: 0.05, topP: 0.9, maxOutputTokens: 1024 },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), PARSE_TIMEOUT),
        ),
      ]);

      let text = response.text
        .trim()
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/gi, '')
        .trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) text = jsonMatch[0];
      geminiParsed = JSON.parse(text);
    } catch (aiError) {
      console.warn(`⚠️ Gemini parsing skipped: ${aiError.message}`);
    }

    // STEP 3: Merge - local parsed is the FOUNDATION, Gemini enhances it
    const merged = mergeIntents(localParsed, geminiParsed);
    const parseTime = Date.now() - startTime;

    console.log(
      `✅ Intent parsed in ${parseTime}ms:`,
      JSON.stringify(merged.summary),
    );

    return { success: true, ...merged, parseTime };
  } catch (error) {
    console.warn(`⚠️ Intent parsing failed: ${error.message}`);
    return {
      success: false,
      ...buildLocalParsedIntent(query),
      confidence: 'LOW',
    };
  }
}

/**
 * Build a complete parsed intent using LOCAL rules (no AI needed)
 * This is the reliable backbone - it NEVER fails
 */
function buildLocalParsedIntent(query) {
  if (!query)
    return {
      summary: '',
      searchKeywords: [],
      partNumbers: [],
      categories: [],
      confidence: 'LOW',
    };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 0: MULTILINGUAL TRANSLATION - Translate query to English first
  // ═══════════════════════════════════════════════════════════════════════════
  const detectedLanguage = detectLanguage(query);
  const originalQuery = query;
  
  // Translate foreign terms to English
  let q = translateToEnglish(query).toLowerCase().trim();
  
  // Also keep original query for mixed-language scenarios
  const originalLower = originalQuery.toLowerCase().trim();

  // ── Typo corrections (comprehensive B2B auto parts marketplace) ──
  const typoMap = {
    // Vehicle brands
    toyta: 'toyota', toyata: 'toyota', tayota: 'toyota', toyot: 'toyota',
    bosh: 'bosch', bosc: 'bosch',
    bremb: 'brembo', bremboo: 'brembo', bremo: 'brembo',
    nisaan: 'nissan', nisan: 'nissan', nisson: 'nissan', niss: 'nissan',
    mercedez: 'mercedes', mersedes: 'mercedes', merc: 'mercedes', mercdes: 'mercedes', mersedez: 'mercedes', benz: 'mercedes',
    hynudai: 'hyundai', hyundia: 'hyundai', hundai: 'hyundai', hyunadi: 'hyundai', hundayi: 'hyundai', huyndai: 'hyundai',
    volkswagon: 'volkswagen', vw: 'volkswagen', volkswagen: 'volkswagen', folkswagen: 'volkswagen',
    porshe: 'porsche', porche: 'porsche', porscha: 'porsche',
    chevrolete: 'chevrolet', chevy: 'chevrolet', chev: 'chevrolet', shevy: 'chevrolet',
    acdelko: 'acdelco', acdelc: 'acdelco',
    germn: 'german', grman: 'german',
    japnese: 'japanese', japanes: 'japanese', japanse: 'japanese',
    chines: 'chinese', chinse: 'chinese',
    suabru: 'subaru', subru: 'subaru',
    mitsibishi: 'mitsubishi', mitsibushi: 'mitsubishi', mitsubshi: 'mitsubishi', mitsubisi: 'mitsubishi',
    suzki: 'suzuki', suzuky: 'suzuki',
    volks: 'volkswagen', volksw: 'volkswagen',
    peugot: 'peugeot', peugeut: 'peugeot', pugeot: 'peugeot',
    reno: 'renault', renalt: 'renault',
    landrover: 'land rover', lndrover: 'land rover',
    jaquar: 'jaguar', jagaur: 'jaguar',
    masda: 'mazda', mazada: 'mazda',
    infinti: 'infiniti', infinty: 'infiniti',
    crysler: 'chrysler', chryslar: 'chrysler',
    // Parts brands
    delpih: 'delphi', delfi: 'delphi',
    contiental: 'continental', continetal: 'continental',
    lemmforder: 'lemforder', lemforder: 'lemforder', lemförder: 'lemforder',
    bistein: 'bilstein', billstein: 'bilstein',
    ferod: 'ferodo', ferrodo: 'ferodo',
    hela: 'hella', hela: 'hella',
    myle: 'meyle', meile: 'meyle',
    timkn: 'timken', timkin: 'timken',
    dayko: 'dayco', daico: 'dayco',
    champin: 'champion', champoin: 'champion',
    filtr: 'filter', fliter: 'filter', filer: 'filter',
    brak: 'brake', braek: 'brake', brek: 'brake',
    engin: 'engine', engien: 'engine',
    suspnsion: 'suspension', suspenion: 'suspension', suspention: 'suspension',
    stearing: 'steering', steerin: 'steering',
    exhuast: 'exhaust', exhust: 'exhaust', exhast: 'exhaust',
    trasmission: 'transmission', transmision: 'transmission', transmisson: 'transmission',
    alternatr: 'alternator', alternater: 'alternator',
    radaitor: 'radiator', readiator: 'radiator', raditor: 'radiator',
    genune: 'genuine', genuien: 'genuine',
    orignal: 'original', orignial: 'original',
    waranty: 'warranty', warrnty: 'warranty', garanty: 'warranty',
    avalible: 'available', avaliable: 'available', avalable: 'available', availble: 'available',
    avlaibelity: 'availability', availibility: 'availability', availabilty: 'availability',
    delevery: 'delivery', delivry: 'delivery', delivary: 'delivery', delievry: 'delivery',
    shiping: 'shipping', shippping: 'shipping',
    quntity: 'quantity', quanity: 'quantity', quantiy: 'quantity', qantity: 'quantity', quantty: 'quantity',
    proce: 'price', pirce: 'price', prise: 'price', prce: 'price',
    chepest: 'cheapest', cheapst: 'cheapest', cheepest: 'cheapest',
    fastes: 'fastest', fastet: 'fastest',
    replasment: 'replacement', replacemnt: 'replacement', replacment: 'replacement',
    compatble: 'compatible', compatable: 'compatible', compatibel: 'compatible',
    aftermarkt: 'aftermarket', aftarmarket: 'aftermarket', aftrmarket: 'aftermarket',
    accesory: 'accessory', acessory: 'accessory', accesories: 'accessories',
    maintanance: 'maintenance', maintenace: 'maintenance', maintainance: 'maintenance',
    disel: 'diesel', diesle: 'diesel',
    petrl: 'petrol', petrel: 'petrol',
    hybrd: 'hybrid', hibrid: 'hybrid',
    elctric: 'electric', electrc: 'electric',
    cmpare: 'compare', compre: 'compare',
    alternativ: 'alternative', alternatve: 'alternative',
    equivelant: 'equivalent', equvalent: 'equivalent', equivalnt: 'equivalent',
    interchageable: 'interchangeable', interchangable: 'interchangeable',
    suuplier: 'supplier', suplier: 'supplier', suppliar: 'supplier',
    distributer: 'distributor', distribtor: 'distributor',
    wholsale: 'wholesale', wholesle: 'wholesale',
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
    aftermarket: false,
    certifiedSupplier: false,
    premiumQuality: false,
    requireWarranty: false,
    requestedQuantity: null,
    topN: null,
    sortPreference: null,
    excludeBrands: [],
    excludeOrigins: [],
    supplierOrigin: null,
    compareMode: false,
    findAlternatives: false,
    vehicleYear: null,
    vehicleYearMin: null,
    vehicleYearMax: null,
    condition: null,
    minOrderValue: null,
    maxWeight: null,
    heavyDuty: false,
    applicationType: null,
    fuelType: null,
    supplierType: null,
    freeShipping: false,
    confidence: 'MEDIUM',
    suggestions: [],
    // Multilingual tracking
    detectedLanguage: detectedLanguage,
    originalQuery: originalQuery,
    translatedQuery: q !== originalLower ? q : null,
  };

  // ── Price extraction (comprehensive B2B patterns) ──
  // "under $500" / "below 500" / "less than $500" / "max $500" / "cheaper than 500" / "not more than $500"
  const maxPriceMatch = q.match(
    /(?:under|below|less\s+than|max|cheaper\s+than|up\s+to|no\s+more\s+than|budget|within|not\s+(?:more|over)\s+than|limit|ceiling|cap)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/,
  );
  if (maxPriceMatch)
    result.maxPrice = parseFloat(maxPriceMatch[1].replace(/,/g, ''));

  // "over $100" / "above 100" / "more than $100" / "min $100" / "at least $100"
  const minPriceMatch = q.match(
    /(?:over|above|more\s+than|min|at\s+least|starting\s+from|from|no\s+less\s+than|floor|minimum)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/,
  );
  if (minPriceMatch)
    result.minPrice = parseFloat(minPriceMatch[1].replace(/,/g, ''));

  // "$100-$500" / "between $100 and $500" / "$100 to $500"
  const rangeMatch = q.match(
    /\$?\s*(\d+(?:,\d{3})*)\s*[-–to]+\s*\$?\s*(\d+(?:,\d{3})*)/,
  );
  if (rangeMatch && !maxPriceMatch && !minPriceMatch) {
    result.minPrice = parseFloat(rangeMatch[1].replace(/,/g, ''));
    result.maxPrice = parseFloat(rangeMatch[2].replace(/,/g, ''));
  }

  // "between X and Y" pattern
  const betweenMatch = q.match(
    /between\s*\$?\s*(\d+(?:,\d{3})*)\s+and\s+\$?\s*(\d+(?:,\d{3})*)/,
  );
  if (betweenMatch && !result.minPrice && !result.maxPrice) {
    result.minPrice = parseFloat(betweenMatch[1].replace(/,/g, ''));
    result.maxPrice = parseFloat(betweenMatch[2].replace(/,/g, ''));
  }

  // "around $50" / "about $50" / "approximately $50" (±30% range)
  const approxPriceMatch = q.match(
    /(?:around|about|approximately|roughly|circa|~)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/,
  );
  if (approxPriceMatch && !result.minPrice && !result.maxPrice) {
    const price = parseFloat(approxPriceMatch[1].replace(/,/g, ''));
    result.minPrice = Math.round(price * 0.7);
    result.maxPrice = Math.round(price * 1.3);
  }

  // "cheap" / "budget" / "affordable"
  if (
    /\b(cheap|budget|affordable|economical|inexpensive|low[\s-]*cost|bargain|discount)\b/.test(q) &&
    !result.maxPrice
  ) {
    result.maxPrice = 100;
    if (!result.sortPreference) result.sortPreference = 'price_asc';
  }
  
  // MULTILINGUAL: cheap/affordable detection (also check original query for non-Latin scripts)
  const cheapMultiPattern = buildMultilingualRegex('cheap');
  if (cheapMultiPattern.test(originalLower) && !result.maxPrice) {
    result.maxPrice = 100;
    if (!result.sortPreference) result.sortPreference = 'price_asc';
  }
  
  // "expensive" / "premium" / "high-end"
  if (
    /\b(expensive|premium|high[\s-]?end|luxury|top[\s-]*tier|flagship)\b/.test(q) &&
    !result.minPrice
  ) {
    result.minPrice = 500;
  }
  
  // MULTILINGUAL: expensive/premium detection
  const expensiveMultiPattern = buildMultilingualRegex('expensive');
  const premiumMultiPattern = buildMultilingualRegex('premium');
  if ((expensiveMultiPattern.test(originalLower) || premiumMultiPattern.test(originalLower)) && !result.minPrice) {
    result.minPrice = 500;
  }

  // "free shipping" / "no shipping cost"
  if (/\b(free\s+shipping|no\s+shipping\s+cost|shipping\s+included|delivery\s+included)\b/.test(q))
    result.freeShipping = true;
  
  // MULTILINGUAL: free shipping detection
  const freeShippingMultiPattern = buildMultilingualRegex('freeShipping');
  if (freeShippingMultiPattern.test(originalLower)) result.freeShipping = true;

  // Currency detection (comprehensive)
  if (/\b(aed|dirham|dhs|drhm)\b/.test(q)) result.priceCurrency = 'AED';
  else if (/\b(eur|euro|€)\b/.test(q)) result.priceCurrency = 'EUR';
  else if (/\b(gbp|pound|£|sterling)\b/.test(q)) result.priceCurrency = 'GBP';
  else if (/\b(sar|riyal|sr)\b/.test(q)) result.priceCurrency = 'SAR';
  else if (/\b(kwd|kuwaiti\s+dinar)\b/.test(q)) result.priceCurrency = 'KWD';
  else if (/\b(qar|qatari\s+riyal)\b/.test(q)) result.priceCurrency = 'QAR';
  else if (/\b(bhd|bahraini\s+dinar)\b/.test(q)) result.priceCurrency = 'BHD';
  else if (/\b(omr|omani\s+riyal)\b/.test(q)) result.priceCurrency = 'OMR';
  else if (/\b(egp|egyptian\s+pound)\b/.test(q)) result.priceCurrency = 'EGP';
  else if (/\b(inr|rupee|₹)\b/.test(q)) result.priceCurrency = 'INR';
  else if (/\b(jpy|yen|¥)\b/.test(q)) result.priceCurrency = 'JPY';
  else if (/\b(cny|yuan|rmb)\b/.test(q)) result.priceCurrency = 'CNY';
  else if (/\b(aud|australian\s+dollar)\b/.test(q)) result.priceCurrency = 'AUD';
  else if (/\b(cad|canadian\s+dollar)\b/.test(q)) result.priceCurrency = 'CAD';
  else if (/\b(try|turkish\s+lira|tl)\b/.test(q)) result.priceCurrency = 'TRY';

  // ── Vehicle brands vs parts brands (comprehensive global coverage) ──
  const vehicleBrandMap = {
    // Japanese
    toyota: 'TOYOTA', honda: 'HONDA', nissan: 'NISSAN', mazda: 'MAZDA',
    subaru: 'SUBARU', suzuki: 'SUZUKI', mitsubishi: 'MITSUBISHI',
    lexus: 'LEXUS', infiniti: 'INFINITI', acura: 'ACURA', isuzu: 'ISUZU',
    daihatsu: 'DAIHATSU', hino: 'HINO',
    // German
    bmw: 'BMW', mercedes: 'MERCEDES-BENZ', audi: 'AUDI', volkswagen: 'VOLKSWAGEN',
    porsche: 'PORSCHE', opel: 'OPEL', 'mini cooper': 'MINI', mini: 'MINI',
    // American
    ford: 'FORD', chevrolet: 'CHEVROLET', dodge: 'DODGE', jeep: 'JEEP',
    chrysler: 'CHRYSLER', gmc: 'GMC', cadillac: 'CADILLAC', lincoln: 'LINCOLN',
    buick: 'BUICK', ram: 'RAM', tesla: 'TESLA',
    // Korean
    hyundai: 'HYUNDAI', kia: 'KIA', genesis: 'GENESIS', ssangyong: 'SSANGYONG',
    // Swedish
    volvo: 'VOLVO', saab: 'SAAB',
    // British
    jaguar: 'JAGUAR', 'land rover': 'LAND ROVER', 'range rover': 'LAND ROVER',
    bentley: 'BENTLEY', 'rolls royce': 'ROLLS ROYCE', 'aston martin': 'ASTON MARTIN',
    mclaren: 'MCLAREN', 'mg': 'MG',
    // French
    peugeot: 'PEUGEOT', renault: 'RENAULT', citroen: 'CITROEN', 'ds': 'DS',
    // Italian
    fiat: 'FIAT', 'alfa romeo': 'ALFA ROMEO', maserati: 'MASERATI',
    ferrari: 'FERRARI', lamborghini: 'LAMBORGHINI', lancia: 'LANCIA',
    // Chinese
    geely: 'GEELY', chery: 'CHERY', byd: 'BYD', haval: 'HAVAL',
    'great wall': 'GREAT WALL', changan: 'CHANGAN', mg: 'MG',
    // Indian
    tata: 'TATA', mahindra: 'MAHINDRA', maruti: 'MARUTI',
    // Other
    seat: 'SEAT', skoda: 'SKODA', dacia: 'DACIA',
    proton: 'PROTON', perodua: 'PERODUA',
  };

  const partsBrandMap = {
    // Major global parts manufacturers
    bosch: 'BOSCH', skf: 'SKF', denso: 'DENSO', valeo: 'VALEO',
    brembo: 'BREMBO', gates: 'GATES', continental: 'CONTINENTAL',
    mann: 'MANN', mahle: 'MAHLE', sachs: 'SACHS',
    bilstein: 'BILSTEIN', kyb: 'KYB', monroe: 'MONROE',
    acdelco: 'ACDELCO', mopar: 'MOPAR', ngk: 'NGK',
    delphi: 'DELPHI', aisin: 'AISIN', luk: 'LUK',
    trw: 'TRW', ate: 'ATE', ferodo: 'FERODO',
    hella: 'HELLA', febi: 'FEBI', lemforder: 'LEMFORDER',
    meyle: 'MEYLE', swag: 'SWAG', timken: 'TIMKEN',
    nsk: 'NSK', ntn: 'NTN', fag: 'FAG',
    motorcraft: 'MOTORCRAFT', osram: 'OSRAM', philips: 'PHILIPS',
    moog: 'MOOG', dayco: 'DAYCO', walker: 'WALKER',
    wix: 'WIX', champion: 'CHAMPION', exedy: 'EXEDY', ina: 'INA',
    // Additional important brands
    vernet: 'VERNET', beru: 'BERU', pierburg: 'PIERBURG',
    hengst: 'HENGST', knecht: 'KNECHT', purflux: 'PURFLUX',
    'mann-filter': 'MANN-FILTER', 'k&n': 'K&N', behr: 'BEHR',
    nissens: 'NISSENS', nrf: 'NRF', gkn: 'GKN',
    skf: 'SKF', snr: 'SNR', koyo: 'KOYO',
    borg: 'BORGWARNER', borgwarner: 'BORGWARNER',
    garrett: 'GARRETT', holset: 'HOLSET',
    sachs: 'SACHS', zf: 'ZF',
    corteco: 'CORTECO', elring: 'ELRING', victor: 'VICTOR REINZ',
    reinz: 'VICTOR REINZ', 'victor reinz': 'VICTOR REINZ',
    goetze: 'GOETZE', kolbenschmidt: 'KOLBENSCHMIDT',
    glyco: 'GLYCO', clevite: 'CLEVITE',
    textar: 'TEXTAR', jurid: 'JURID', pagid: 'PAGID',
    mintex: 'MINTEX', ebc: 'EBC', hawk: 'HAWK',
    kayaba: 'KYB', tokico: 'TOKICO', koni: 'KONI',
    eibach: 'EIBACH', 'h&r': 'H&R',
    ngk: 'NGK', 'champion': 'CHAMPION', 'denso': 'DENSO',
    optibelt: 'OPTIBELT', contitech: 'CONTITECH',
    delphi: 'DELPHI', lucas: 'LUCAS',
    schaeffler: 'SCHAEFFLER', fte: 'FTE',
    'blue print': 'BLUE PRINT', blueprint: 'BLUE PRINT',
    japanparts: 'JAPANPARTS', herth: 'HERTH+BUSS',
    'herth buss': 'HERTH+BUSS', 'herth+buss': 'HERTH+BUSS',
    siemens: 'SIEMENS', hitachi: 'HITACHI', mitsubishi: 'MITSUBISHI ELECTRIC',
    marelli: 'MAGNETI MARELLI', 'magneti marelli': 'MAGNETI MARELLI',
    remy: 'REMY', iskra: 'ISKRA',
    bosal: 'BOSAL', ernst: 'ERNST', klarius: 'KLARIUS',
    dorman: 'DORMAN', cardone: 'CARDONE', standard: 'STANDARD MOTOR',
    beck: 'BECK/ARNLEY', 'beck arnley': 'BECK/ARNLEY',
    'et engineteam': 'ET ENGINETEAM', engineteam: 'ET ENGINETEAM',
    facet: 'FACET', fae: 'FAE',
    sasic: 'SASIC', snr: 'SNR',
    ruville: 'RUVILLE', optimal: 'OPTIMAL',
    nipparts: 'NIPPARTS', ashika: 'ASHIKA',
    fenox: 'FENOX', kraft: 'KRAFT',
    febest: 'FEBEST', masuma: 'MASUMA',
    gmb: 'GMB', taiho: 'TAIHO',
    // Tire brands (buyers sometimes search)
    michelin: 'MICHELIN', bridgestone: 'BRIDGESTONE', goodyear: 'GOODYEAR',
    pirelli: 'PIRELLI', continental: 'CONTINENTAL', dunlop: 'DUNLOP',
    hankook: 'HANKOOK', yokohama: 'YOKOHAMA', toyo: 'TOYO',
    kumho: 'KUMHO', falken: 'FALKEN',
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

  // ── Categories (comprehensive automotive parts taxonomy) ──
  const categoryMap = {
    // BRAKES
    'brake pad': 'brake', 'brake pads': 'brake', 'brake disc': 'brake',
    'brake rotor': 'brake', 'brake caliper': 'brake', 'brake fluid': 'brake',
    'brake hose': 'brake', 'brake drum': 'brake', 'brake shoe': 'brake',
    'brake line': 'brake', 'brake light': 'brake', 'brake sensor': 'brake',
    'brake master cylinder': 'brake', 'brake booster': 'brake',
    'brake kit': 'brake', 'abs ring': 'brake', 'abs sensor': 'brake',
    'parking brake': 'brake', 'handbrake': 'brake', 'brake wear indicator': 'brake',
    brake: 'brake', braking: 'brake', brakes: 'brake',

    // FILTERS
    'oil filter': 'filter', 'air filter': 'filter', 'fuel filter': 'filter',
    'cabin filter': 'filter', 'pollen filter': 'filter', 'hydraulic filter': 'filter',
    'transmission filter': 'filter', 'particle filter': 'filter', 'dpf': 'filter',
    'diesel particulate filter': 'filter', 'egr filter': 'filter',
    filter: 'filter', filters: 'filter', filtration: 'filter',

    // ENGINE
    'engine mount': 'engine', 'engine oil': 'engine', 'motor oil': 'engine',
    'engine block': 'engine', 'cylinder head': 'engine', 'crankshaft': 'engine',
    'camshaft': 'engine', 'connecting rod': 'engine', 'piston ring': 'engine',
    'piston': 'engine', 'valve cover': 'engine', 'oil pan': 'engine',
    'oil pump': 'engine', 'oil cooler': 'engine', 'engine bearing': 'engine',
    'rocker arm': 'engine', 'lifter': 'engine', 'tappet': 'engine',
    'timing chain': 'engine', 'timing cover': 'engine', 'flywheel': 'engine',
    'engine sensor': 'engine', 'knock sensor': 'engine', 'crank sensor': 'engine',
    'cam sensor': 'engine', 'oil pressure sensor': 'engine',
    engine: 'engine', motor: 'engine',

    // SUSPENSION & STEERING
    suspension: 'suspension', 'shock absorber': 'suspension', 'shock': 'suspension',
    strut: 'suspension', spring: 'suspension', 'coil spring': 'suspension',
    'leaf spring': 'suspension', 'control arm': 'suspension', 'ball joint': 'suspension',
    'tie rod': 'suspension', 'tie rod end': 'suspension', 'sway bar': 'suspension',
    'stabilizer bar': 'suspension', 'stabilizer link': 'suspension',
    'anti roll bar': 'suspension', 'strut mount': 'suspension',
    'top mount': 'suspension', 'bump stop': 'suspension', 'dust boot': 'suspension',
    'bush': 'suspension', 'bushing': 'suspension', 'rubber bush': 'suspension',
    'wishbone': 'suspension', 'trailing arm': 'suspension', 'torsion bar': 'suspension',
    'air spring': 'suspension', 'air suspension': 'suspension',
    steering: 'steering', 'power steering': 'steering', 'steering rack': 'steering',
    'steering pump': 'steering', 'steering column': 'steering',
    'steering knuckle': 'steering', 'steering link': 'steering',
    'drag link': 'steering', 'pitman arm': 'steering', 'idler arm': 'steering',
    'steering box': 'steering', 'rack end': 'steering',

    // BEARINGS
    bearing: 'bearing', bearings: 'bearing', 'wheel bearing': 'bearing',
    'hub bearing': 'bearing', 'wheel hub': 'bearing', 'hub assembly': 'bearing',
    'tapered bearing': 'bearing', 'roller bearing': 'bearing',
    'thrust bearing': 'bearing', 'pilot bearing': 'bearing',
    'release bearing': 'bearing', 'clutch bearing': 'bearing',

    // CLUTCH & TRANSMISSION
    clutch: 'clutch', 'clutch kit': 'clutch', 'clutch plate': 'clutch',
    'clutch disc': 'clutch', 'pressure plate': 'clutch', 'clutch cover': 'clutch',
    'clutch master cylinder': 'clutch', 'clutch slave cylinder': 'clutch',
    'flywheel': 'clutch', 'dual mass flywheel': 'clutch', 'dmf': 'clutch',
    'clutch cable': 'clutch', 'concentric slave': 'clutch',
    transmission: 'transmission', gearbox: 'transmission',
    'automatic transmission': 'transmission', 'manual transmission': 'transmission',
    'cvt': 'transmission', 'transfer case': 'transmission',
    'shift cable': 'transmission', 'gear selector': 'transmission',
    'torque converter': 'transmission', 'transmission mount': 'transmission',

    // EXHAUST
    exhaust: 'exhaust', muffler: 'exhaust', 'silencer': 'exhaust',
    catalytic: 'exhaust', 'catalytic converter': 'exhaust', 'cat converter': 'exhaust',
    'exhaust pipe': 'exhaust', 'exhaust manifold': 'exhaust',
    'downpipe': 'exhaust', 'flex pipe': 'exhaust', 'resonator': 'exhaust',
    'exhaust gasket': 'exhaust', 'exhaust clamp': 'exhaust',
    'lambda sensor': 'exhaust', 'oxygen sensor': 'exhaust', 'o2 sensor': 'exhaust',
    'egr valve': 'exhaust', 'dpf': 'exhaust',

    // ELECTRICAL
    alternator: 'electrical', starter: 'electrical', 'starter motor': 'electrical',
    battery: 'electrical', 'spark plug': 'electrical', 'glow plug': 'electrical',
    ignition: 'electrical', 'ignition coil': 'electrical', 'coil pack': 'electrical',
    coil: 'electrical', 'ignition switch': 'electrical', 'ignition lock': 'electrical',
    'window motor': 'electrical', 'window regulator': 'electrical',
    'wiper motor': 'electrical', 'blower motor': 'electrical',
    'horn': 'electrical', 'relay': 'electrical', 'fuse': 'electrical',
    'fuse box': 'electrical', 'wiring harness': 'electrical',
    'central locking': 'electrical', 'door lock': 'electrical',
    'ecu': 'electrical', 'control unit': 'electrical', 'module': 'electrical',

    // COOLING
    radiator: 'cooling', thermostat: 'cooling', 'water pump': 'cooling',
    coolant: 'cooling', 'cooling fan': 'cooling', 'fan clutch': 'cooling',
    'radiator hose': 'cooling', 'expansion tank': 'cooling',
    'coolant tank': 'cooling', 'overflow tank': 'cooling',
    'heater core': 'cooling', 'heater matrix': 'cooling',
    'coolant sensor': 'cooling', 'temperature sensor': 'cooling',
    'intercooler': 'cooling', 'oil cooler': 'cooling',
    'radiator cap': 'cooling', 'thermostat housing': 'cooling',
    'water outlet': 'cooling', 'coolant pipe': 'cooling',

    // BELTS & CHAINS
    'timing belt': 'belt', 'serpentine belt': 'belt', 'drive belt': 'belt',
    'v belt': 'belt', 'v-belt': 'belt', 'ribbed belt': 'belt',
    'timing chain': 'belt', 'chain kit': 'belt', 'timing kit': 'belt',
    'belt tensioner': 'belt', 'tensioner pulley': 'belt', 'idler pulley': 'belt',
    'timing belt kit': 'belt', 'accessory belt': 'belt',
    belt: 'belt',

    // GASKETS & SEALS
    gasket: 'gasket', 'head gasket': 'gasket', 'valve cover gasket': 'gasket',
    'intake manifold gasket': 'gasket', 'exhaust manifold gasket': 'gasket',
    'oil pan gasket': 'gasket', 'sump gasket': 'gasket',
    'gasket set': 'gasket', 'gasket kit': 'gasket',
    seal: 'seal', 'oil seal': 'seal', 'crankshaft seal': 'seal',
    'camshaft seal': 'seal', 'valve stem seal': 'seal',
    'o-ring': 'seal', 'o ring': 'seal',

    // SENSORS
    sensor: 'sensor', sensors: 'sensor', 'speed sensor': 'sensor',
    'wheel speed sensor': 'sensor', 'abs sensor': 'sensor',
    'map sensor': 'sensor', 'maf sensor': 'sensor', 'mass air flow': 'sensor',
    'throttle position sensor': 'sensor', 'tps': 'sensor',
    'parking sensor': 'sensor', 'rain sensor': 'sensor',
    'pressure sensor': 'sensor', 'boost sensor': 'sensor',

    // FUEL SYSTEM
    injector: 'fuel', 'fuel injector': 'fuel', 'fuel pump': 'fuel',
    'fuel tank': 'fuel', 'fuel line': 'fuel', 'fuel rail': 'fuel',
    'fuel pressure regulator': 'fuel', 'fuel sender': 'fuel',
    'throttle body': 'fuel', 'carburetor': 'fuel',
    fuel: 'fuel',

    // BODY & EXTERIOR
    bumper: 'body', fender: 'body', 'wing mirror': 'body', mirror: 'body',
    'door handle': 'body', 'window glass': 'body', 'windshield': 'body',
    'windscreen': 'body', 'hood': 'body', 'bonnet': 'body',
    'trunk lid': 'body', 'boot lid': 'body', 'tailgate': 'body',
    'door panel': 'body', 'quarter panel': 'body', 'rocker panel': 'body',
    'splash guard': 'body', 'mud flap': 'body', 'trim': 'body',
    'grille': 'body', 'grill': 'body', 'emblem': 'body', 'badge': 'body',

    // LIGHTING
    headlight: 'lighting', 'head light': 'lighting', 'headlamp': 'lighting',
    'tail light': 'lighting', 'taillight': 'lighting', 'rear light': 'lighting',
    'fog light': 'lighting', 'fog lamp': 'lighting', 'bulb': 'lighting',
    'led bulb': 'lighting', 'xenon bulb': 'lighting', 'hid bulb': 'lighting',
    'turn signal': 'lighting', 'indicator': 'lighting', 'side marker': 'lighting',
    'daytime running light': 'lighting', 'drl': 'lighting',
    lamp: 'lighting',

    // WHEELS & TIRES
    tire: 'wheels', tyre: 'wheels', wheel: 'wheels', 'wheel nut': 'wheels',
    'wheel bolt': 'wheels', 'wheel stud': 'wheels', 'lug nut': 'wheels',
    rim: 'wheels', 'alloy wheel': 'wheels', 'hub cap': 'wheels',
    'wheel spacer': 'wheels', 'wheel adapter': 'wheels',
    'tire pressure sensor': 'wheels', 'tpms': 'wheels',

    // TURBO
    turbo: 'turbo', turbocharger: 'turbo', supercharger: 'turbo',
    'turbo actuator': 'turbo', 'turbo cartridge': 'turbo',
    'wastegate': 'turbo', 'blow off valve': 'turbo', 'bov': 'turbo',
    'boost controller': 'turbo', 'intercooler': 'turbo',

    // AXLE & DRIVETRAIN
    hub: 'hub', axle: 'axle', 'cv joint': 'axle', 'cv boot': 'axle',
    driveshaft: 'axle', 'drive shaft': 'axle', 'prop shaft': 'axle',
    'propeller shaft': 'axle', 'universal joint': 'axle', 'u joint': 'axle',
    'differential': 'axle', 'diff': 'axle', 'half shaft': 'axle',

    // PUMPS & VALVES
    pump: 'pump', 'vacuum pump': 'pump', 'power steering pump': 'pump',
    'brake vacuum pump': 'pump', 'windshield washer pump': 'pump',
    valve: 'valve', 'egr valve': 'valve', 'pcv valve': 'valve',
    'solenoid valve': 'valve', 'check valve': 'valve',
    'idle control valve': 'valve', 'iac valve': 'valve',

    // WIPERS
    wiper: 'wiper', 'wiper blade': 'wiper', 'wiper arm': 'wiper',
    'wiper linkage': 'wiper', 'washer jet': 'wiper', 'washer pump': 'wiper',

    // AC / HVAC
    'ac compressor': 'ac', 'air conditioning': 'ac', 'a/c': 'ac',
    'condenser': 'ac', 'evaporator': 'ac', 'receiver drier': 'ac',
    'expansion valve': 'ac', 'cabin air filter': 'ac', 'blower': 'ac',
    'heater valve': 'ac', 'ac hose': 'ac', 'refrigerant': 'ac',

    // INTERIOR
    'seat cover': 'interior', 'floor mat': 'interior', 'dashboard': 'interior',
    'steering wheel': 'interior', 'gear knob': 'interior', 'shift knob': 'interior',
    'pedal': 'interior', 'pedal pad': 'interior', 'door seal': 'interior',
    'window switch': 'interior', 'clock spring': 'interior',
  };

  const sortedCategoryKeys = Object.keys(categoryMap).sort(
    (a, b) => b.length - a.length,
  );
  const addedCategories = new Set();
  for (const key of sortedCategoryKeys) {
    if (q.includes(key) && !addedCategories.has(categoryMap[key])) {
      result.categories.push(categoryMap[key]);
      addedCategories.add(categoryMap[key]);
    }
  }
  
  // MULTILINGUAL: Category detection for non-Latin scripts
  const multilingualCategories = [
    'brake', 'filter', 'engine', 'suspension', 'bearing', 'clutch',
    'steering', 'exhaust', 'cooling', 'electrical', 'transmission',
    'turbo', 'spark', 'sensor', 'gasket', 'belt', 'pump'
  ];
  for (const category of multilingualCategories) {
    if (!addedCategories.has(category)) {
      const multiPattern = buildMultilingualRegex(category);
      if (multiPattern.test(originalLower)) {
        result.categories.push(category);
        addedCategories.add(category);
      }
    }
  }

  // ── Search keywords (for description matching) ──
  const stopWords = new Set([
    // ── Basic determiners & pronouns ──
    'find', 'me', 'show', 'get', 'give', 'looking', 'for', 'need', 'want',
    'the', 'a', 'an', 'some', 'with', 'from', 'i', 'am', 'please', 'can',
    'you', 'my', 'we', 'our', 'us', 'it', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'has', 'have', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'shall', 'may', 'might',
    'this', 'that', 'these', 'those', 'all', 'any', 'each', 'every',
    // ── Prepositions & conjunctions ──
    'under', 'below', 'above', 'over', 'less', 'more', 'than', 'and',
    'or', 'not', 'no', 'up', 'to', 'at', 'least', 'most', 'around',
    'about', 'in', 'of', 'on', 'by', 'as', 'into', 'between', 'within',
    // ── Price/commerce words ──
    'price', 'priced', 'pricing', 'cost', 'costing', 'costs', 'dollar',
    'dollars', 'usd', 'cheap', 'budget', 'affordable', 'expensive',
    'economical', 'inexpensive', 'bargain', 'discount',
    // ── Marketplace/search words ──
    'search', 'parts', 'part', 'suppliers', 'supplier', 'verified',
    'certified', 'available', 'availability', 'stock', 'stocked',
    'delivery', 'fast', 'quick', 'express', 'urgent', 'rush', 'asap',
    'immediate', 'priority', 'speedy', 'rapid',
    // ── Quality/brand words ──
    'best', 'good', 'high', 'quality', 'premium', 'professional',
    'genuine', 'original', 'oem', 'aftermarket',
    // ── Sort/order/compare words ──
    'sort', 'order', 'rank', 'prioritize', 'prefer', 'arrange',
    'compare', 'comparison', 'versus', 'vs',
    'alternative', 'alternatives', 'equivalent', 'equivalents',
    'substitute', 'substitutes', 'replacement',
    // ── Quantity/bulk words ──
    'wholesale', 'bulk', 'retail', 'units', 'pieces', 'pcs', 'qty',
    'quantity', 'minimum', 'maximum',
    // ── Display/result words ──
    'options', 'option', 'results', 'result', 'choices', 'choice',
    'list', 'display', 'recommend', 'recommendation', 'suggest',
    'suggestion', 'first', 'limit', 'only',
    // ── Condition/spec words ──
    'new', 'used', 'refurbished', 'remanufactured', 'condition',
    'warranty', 'guaranteed',
    // ── Vehicle context words ──
    'car', 'vehicle', 'auto', 'automobile', 'automotive', 'truck',
    'suv', 'van', 'sedan', 'coupe', 'hatchback', 'pickup',
    'model', 'year', 'make', 'type', 'fit', 'fits', 'compatible',
    // ── Misc ──
    'based', 'top', 'bottom', 'here', 'there', 'where', 'how',
    'what', 'which', 'who', 'when', 'why', 'just', 'also', 'too',
    'very', 'really', 'much', 'many', 'few', 'several',
    'such', 'like', 'same', 'other', 'another',
  ]);

  const words = q
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => {
      if (w.length < 2) return false;
      if (stopWords.has(w)) return false;
      if (/^\d+$/.test(w)) return false;
      // Don't include brand names as search keywords (they're already in brands)
      if (vehicleBrandMap[w] || partsBrandMap[w]) return false;
      return true;
    });

  // Also expand categories to related keywords
  const categoryKeywordMap = {
    brake: ['brake', 'brakes', 'braking', 'brake pad', 'brake disc', 'brake rotor',
      'brake fluid', 'brake drum', 'brake shoe', 'brake caliper', 'brake hose',
      'brake line', 'abs', 'handbrake', 'parking brake', 'master cylinder'],
    filter: ['filter', 'filters', 'filtration', 'air filter', 'oil filter',
      'fuel filter', 'cabin filter', 'pollen filter', 'transmission filter',
      'hydraulic filter', 'particle filter', 'dpf'],
    engine: ['engine', 'motor', 'piston', 'cylinder', 'crankshaft', 'camshaft',
      'connecting rod', 'valve cover', 'engine block', 'head gasket',
      'timing cover', 'oil pan', 'flywheel', 'lifter', 'rocker arm'],
    bearing: ['bearing', 'bearings', 'wheel bearing', 'hub bearing',
      'crankshaft bearing', 'camshaft bearing', 'pilot bearing', 'thrust bearing'],
    suspension: ['suspension', 'shock', 'strut', 'spring', 'coil spring',
      'leaf spring', 'shock absorber', 'damper', 'air suspension',
      'control arm', 'wishbone', 'sway bar', 'stabilizer', 'bushing',
      'ball joint', 'trailing arm', 'subframe'],
    steering: ['steering', 'steer', 'power steering', 'steering rack',
      'steering pump', 'tie rod', 'tie rod end', 'drag link',
      'steering column', 'steering gear', 'idler arm', 'pitman arm'],
    cooling: ['cooling', 'coolant', 'radiator', 'thermostat', 'water pump',
      'coolant hose', 'expansion tank', 'fan', 'cooling fan', 'intercooler',
      'heater core', 'radiator cap', 'overflow tank', 'antifreeze'],
    electrical: ['electrical', 'electric', 'alternator', 'starter', 'battery',
      'ignition', 'spark plug', 'ignition coil', 'glow plug',
      'wiring', 'fuse', 'relay', 'switch', 'solenoid', 'voltage regulator',
      'distributor', 'cdi', 'ecu', 'control module'],
    clutch: ['clutch', 'clutch kit', 'clutch disc', 'clutch plate',
      'pressure plate', 'release bearing', 'throwout bearing',
      'clutch master cylinder', 'slave cylinder', 'flywheel', 'dual mass flywheel'],
    exhaust: ['exhaust', 'muffler', 'catalytic', 'catalytic converter',
      'exhaust pipe', 'exhaust manifold', 'downpipe', 'resonator',
      'exhaust gasket', 'flex pipe', 'silencer', 'tailpipe',
      'lambda', 'oxygen sensor', 'egr', 'dpf', 'particulate filter'],
    transmission: ['transmission', 'gearbox', 'gear', 'shift', 'torque converter',
      'transmission fluid', 'atf', 'differential', 'transfer case',
      'cv joint', 'cv boot', 'driveshaft', 'propshaft', 'axle shaft'],
    belt: ['belt', 'timing', 'serpentine', 'timing belt', 'timing chain',
      'serpentine belt', 'drive belt', 'v-belt', 'ribbed belt',
      'tensioner', 'idler pulley', 'belt kit', 'timing kit'],
    fuel: ['fuel', 'injector', 'fuel pump', 'fuel injector', 'fuel line',
      'fuel rail', 'fuel tank', 'carburetor', 'throttle body',
      'fuel pressure regulator', 'fuel sender', 'fuel gauge'],
    sensor: ['sensor', 'sensors', 'abs sensor', 'speed sensor',
      'oxygen sensor', 'o2 sensor', 'temperature sensor', 'pressure sensor',
      'map sensor', 'maf sensor', 'mass air flow', 'throttle position',
      'crankshaft sensor', 'camshaft sensor', 'knock sensor', 'parking sensor'],
    seal: ['seal', 'sealing', 'o-ring', 'oil seal', 'crankshaft seal',
      'camshaft seal', 'valve stem seal', 'axle seal', 'hub seal',
      'lip seal', 'mechanical seal', 'shaft seal'],
    gasket: ['gasket', 'gaskets', 'head gasket', 'intake gasket',
      'exhaust gasket', 'valve cover gasket', 'oil pan gasket',
      'manifold gasket', 'thermostat gasket', 'water pump gasket',
      'gasket set', 'gasket kit'],
    ac: ['ac', 'air conditioning', 'a/c', 'hvac', 'compressor',
      'condenser', 'evaporator', 'expansion valve', 'receiver drier',
      'ac hose', 'blower motor', 'cabin blower', 'heater valve',
      'climate control', 'refrigerant'],
    interior: ['interior', 'seat', 'dashboard', 'dash', 'console',
      'door panel', 'door handle', 'window regulator', 'window motor',
      'mirror', 'sun visor', 'glove box', 'carpet', 'headliner',
      'seat belt', 'airbag', 'steering wheel'],
    body: ['body', 'bumper', 'fender', 'hood', 'bonnet', 'trunk', 'boot',
      'door', 'quarter panel', 'rocker panel', 'grille', 'spoiler',
      'side skirt', 'mud flap', 'splash guard', 'weatherstrip',
      'windshield', 'windscreen', 'rear window', 'side window'],
    lighting: ['light', 'lighting', 'headlight', 'headlamp', 'tail light',
      'taillight', 'brake light', 'fog light', 'turn signal', 'indicator',
      'led', 'xenon', 'hid', 'bulb', 'lamp', 'drl', 'daytime running',
      'reverse light', 'interior light', 'dome light'],
    wheel: ['wheel', 'wheels', 'rim', 'rims', 'tire', 'tyre', 'tires',
      'tyres', 'wheel nut', 'lug nut', 'wheel bolt', 'wheel cap',
      'center cap', 'hubcap', 'tpms', 'valve stem'],
    hub: ['hub', 'hubs', 'wheel hub', 'hub assembly', 'hub bearing',
      'hub cap', 'front hub', 'rear hub'],
    axle: ['axle', 'axles', 'drive shaft', 'half shaft', 'cv axle',
      'axle shaft', 'rear axle', 'front axle', 'axle nut', 'stub axle'],
    wiper: ['wiper', 'wipers', 'wiper blade', 'wiper arm', 'wiper motor',
      'wiper linkage', 'washer', 'washer pump', 'washer fluid',
      'windshield wiper', 'rear wiper'],
    turbo: ['turbo', 'turbocharger', 'supercharger', 'wastegate',
      'boost controller', 'turbo hose', 'turbo gasket', 'turbo bearing',
      'intercooler', 'charge pipe', 'blow off valve', 'bov', 'diverter valve'],
    pump: ['pump', 'pumps', 'water pump', 'oil pump', 'fuel pump',
      'power steering pump', 'vacuum pump', 'hydraulic pump',
      'washer pump', 'coolant pump', 'transmission pump'],
    valve: ['valve', 'valves', 'intake valve', 'exhaust valve',
      'egr valve', 'pcv valve', 'check valve', 'solenoid valve',
      'idle air control', 'iac', 'throttle valve', 'expansion valve',
      'pressure relief valve'],
    hose: ['hose', 'hoses', 'coolant hose', 'radiator hose', 'heater hose',
      'turbo hose', 'brake hose', 'fuel hose', 'vacuum hose',
      'power steering hose', 'ac hose', 'silicone hose'],
    ignition: ['ignition', 'spark plug', 'ignition coil', 'coil pack',
      'distributor', 'rotor', 'cap', 'ignition wire', 'plug wire',
      'ht lead', 'glow plug', 'ignition switch', 'ignition lock'],
  };

  const expandedKeywords = new Set(words);
  for (const cat of result.categories) {
    const related = categoryKeywordMap[cat] || [cat];
    related.forEach((k) => expandedKeywords.add(k));
  }

  result.searchKeywords = [...expandedKeywords].slice(0, 15);

  // ── Part numbers ──
  const tokens = query.replace(/[^\w\s-]/g, ' ').split(/\s+/);
  result.partNumbers = tokens.filter(
    (t) =>
      /\d/.test(t) && /^[A-Za-z0-9][-A-Za-z0-9_]{3,}$/.test(t) && t.length >= 4,
  );

  // ── Stock requirements (comprehensive) ──
  if (/\b(in\s*stock|available|have\s+it|ready|on\s+hand|in\s+warehouse|stocked)\b/.test(q))
    result.requireInStock = true;
  if (
    /\b(full\s*stock|high\s*stock|plenty|lots|well\s*stocked|large\s*qty|bulk|big\s*quantity|massive\s*stock|good\s*stock|enough\s*stock|sufficient|abundant)\b/.test(q)
  ) {
    result.requireHighStock = true;
    result.requireInStock = true;
  }
  // "availability" / "available" combined with "in stock" context
  if (/\b(availability|avail)\b/.test(q)) {
    result.requireInStock = true;
  }
  
  // MULTILINGUAL: in-stock detection
  const inStockMultiPattern = buildMultilingualRegex('inStock');
  if (inStockMultiPattern.test(originalLower)) {
    result.requireInStock = true;
  }

  // ── Delivery (comprehensive) ──
  if (/\b(fast|express|quick|urgent|rush|asap|immediate|next\s*day|same\s*day|overnight|priority|speedy|rapid)\b/.test(q))
    result.fastDelivery = true;
  // "within X days" / "max X days delivery" / "deliver in X days" / "X day delivery"
  const deliveryMatch = q.match(/(?:within|max|under|less\s+than|deliver(?:y|ed)?\s+in|in)\s+(\d+)\s*days?/);
  if (deliveryMatch) result.maxDeliveryDays = parseInt(deliveryMatch[1]);
  // "3-day delivery" / "3 day shipping" / "2d delivery"
  const deliveryMatch2 = q.match(/(\d+)\s*[-]?\s*days?\s*(?:delivery|shipping|ship)/);
  if (deliveryMatch2 && !result.maxDeliveryDays) result.maxDeliveryDays = parseInt(deliveryMatch2[1]);
  // "short lead time" / "quick turnaround"
  if (/\b(short\s*lead\s*time|quick\s*turnaround|no\s*wait|ready\s*to\s*ship)\b/.test(q))
    result.fastDelivery = true;
  
  // MULTILINGUAL: fast delivery detection
  const fastMultiPattern = buildMultilingualRegex('fast');
  const deliveryMultiPattern = buildMultilingualRegex('delivery');
  if (fastMultiPattern.test(originalLower) && deliveryMultiPattern.test(originalLower)) {
    result.fastDelivery = true;
  }

  // ── OEM / Genuine / Aftermarket / Quality ──
  if (/\b(oem|genuine|original|factory|authentic)\b/.test(q)) result.oem = true;
  if (/\b(aftermarket|after\s*market|non[\s-]*oem|replacement|compatible|pattern)\b/.test(q))
    result.aftermarket = true;
  if (/\b(certified|verified|trusted|authorized|approved|accredited|iso)\b/.test(q))
    result.certifiedSupplier = true;
  // Quality markers
  if (/\b(premium|high[\s-]*quality|top[\s-]*quality|grade\s*a|first[\s-]*class|pro[\s-]*grade|professional)\b/.test(q))
    result.premiumQuality = true;
  
  // MULTILINGUAL: OEM/Aftermarket/Warranty detection
  const oemMultiPattern = buildMultilingualRegex('oem');
  const aftermarketMultiPattern = buildMultilingualRegex('aftermarket');
  const warrantyMultiPattern = buildMultilingualRegex('warranty');
  if (oemMultiPattern.test(originalLower)) result.oem = true;
  if (aftermarketMultiPattern.test(originalLower)) result.aftermarket = true;
  if (warrantyMultiPattern.test(originalLower)) result.requireWarranty = true;
  
  // Warranty
  if (/\b(warranty|warrantied|guaranteed|guarantee)\b/.test(q))
    result.requireWarranty = true;

  // ── Top N results (comprehensive patterns) ──
  const topNMatch = q.match(
    /(?:best|top|show(?:\s+me)?|get|find|give(?:\s+me)?|list|display|compare|recommend)\s+(\d+)(?:\s+(?:options?|results?|suppliers?|choices?|for|of|parts?|items?|offers?|deals?|matches?|listings?))?/,
  );
  if (topNMatch) {
    const n = parseInt(topNMatch[1]);
    if (n >= 2 && n <= 50) result.topN = n;
  }
  // "first 5" / "limit to 3" / "only show 5"
  const topNMatch2 = q.match(
    /(?:first|limit(?:\s+to)?|only\s+show|just\s+show|show\s+only)\s+(\d+)/,
  );
  if (topNMatch2 && !result.topN) {
    const n = parseInt(topNMatch2[1]);
    if (n >= 2 && n <= 50) result.topN = n;
  }

  // ── Quantity (stock needed) — comprehensive ──
  const qtyMatch = q.match(
    /(?:qty|quantity|need|order|want|require|minimum)\s*:?\s*(\d+)|x\s*(\d+)\b|(\d+)\s*(?:units?|pcs?|pieces?|items?|nos?|ea|each)/,
  );
  if (qtyMatch)
    result.requestedQuantity = parseInt(
      qtyMatch[1] || qtyMatch[2] || qtyMatch[3],
    );
  // "bulk order" / "wholesale" 
  if (/\b(bulk\s*order|wholesale|large\s*order|volume\s*order|bulk\s*buy|bulk\s*purchase)\b/.test(q)) {
    if (!result.requestedQuantity) result.requestedQuantity = 100; // default bulk
    result.requireHighStock = true;
    result.requireInStock = true;
  }

  // ── Exclusions (comprehensive) ──
  const excludeBrandMatch = q.match(
    /(?:not|no|exclude|without|except|avoid|skip|don'?t\s+want|don'?t\s+include)\s+(\w+)/g,
  );
  if (excludeBrandMatch) {
    excludeBrandMatch.forEach((match) => {
      const brand = match
        .replace(/^(not|no|exclude|without|except|avoid|skip|don'?t\s+want|don'?t\s+include)\s+/i, '')
        .trim();
      if (partsBrandMap[brand]) result.excludeBrands.push(partsBrandMap[brand]);
      if (vehicleBrandMap[brand])
        result.excludeBrands.push(vehicleBrandMap[brand]);
    });
  }
  // Origin exclusions
  if (/\b(no|not|exclude|without|avoid)\s*(chinese|china|cn)\b/.test(q))
    result.excludeOrigins.push('CN');
  if (/\b(no|not|exclude|without|avoid)\s*(indian|india|in)\b/.test(q))
    result.excludeOrigins.push('IN');
  if (/\b(no|not|exclude|without|avoid)\s*(turkish|turkey|tr)\b/.test(q))
    result.excludeOrigins.push('TR');
  if (/\b(no|not|exclude|without|avoid)\s*(korean|korea|kr)\b/.test(q))
    result.excludeOrigins.push('KR');
  if (/\b(no|not|exclude|without|avoid)\s*(taiwanese|taiwan|tw)\b/.test(q))
    result.excludeOrigins.push('TW');
  // "only OEM" implies exclude aftermarket
  if (/\bonly\s+oem\b/.test(q)) result.oem = true;
  // "only aftermarket" implies exclude OEM
  if (/\bonly\s+aftermarket\b/.test(q)) result.aftermarket = true;

  // ── Origin preference (comprehensive) ──
  if (/\bgerman|germany|made\s+in\s+germany\b/.test(q)) {
    result.supplierOrigin = 'DE';
    result.certifiedSupplier = true;
  }
  if (/\bjapanese|japan|made\s+in\s+japan\b/.test(q)) {
    result.supplierOrigin = 'JP';
    result.certifiedSupplier = true;
  }
  if (/\bamerican|usa|us\s+made|made\s+in\s+(usa|us|america)\b/.test(q)) {
    result.supplierOrigin = 'US';
  }
  if (/\bitalian|italy|made\s+in\s+italy\b/.test(q)) {
    result.supplierOrigin = 'IT';
  }
  if (/\bfrench|france|made\s+in\s+france\b/.test(q)) {
    result.supplierOrigin = 'FR';
  }
  if (/\bkorean|korea|made\s+in\s+korea\b/.test(q)) {
    result.supplierOrigin = 'KR';
  }
  if (/\beuropean|europe|eu\s+made\b/.test(q)) {
    result.supplierOrigin = 'EU';
    result.certifiedSupplier = true;
  }

  // ── Sort preference (fully comprehensive) ──
  // Explicit sort words
  if (/\bcheapest|lowest\s+price|best\s+price|best\s+deal|best\s+value|affordable|low\s+cost|most\s+affordable|economical\b/.test(q))
    result.sortPreference = 'price_asc';
  if (/\bmost\s+expensive|highest\s+price|priciest|costliest|premium\s+price\b/.test(q))
    result.sortPreference = 'price_desc';
  if (/\bmost\s+stock|highest\s+quantity|highest\s+qty|most\s+available|largest\s+qty|largest\s+quantity|most\s+qty|biggest\s+stock|maximum\s+stock|max\s+qty\b/.test(q))
    result.sortPreference = 'quantity_desc';
  if (/\bfastest\s+delivery|quickest|soonest|earliest\s+delivery|shortest\s+delivery|fastest\s+shipping|quickest\s+delivery|minimum\s+delivery\b/.test(q))
    result.sortPreference = 'delivery_asc';

  // "based on" patterns — full coverage (allows filler words like "the", "a", "its", "their")
  // Added typo tolerance: delveir|delviery|delivry -> delivery, pric -> price, etc.
  const basedOnMatch = q.match(
    /based\s+on\s+(?:the\s+|a\s+|its\s+|their\s+|best\s+)?(qty|quantity|quantities|stock|availab\w*|price|prices|pric\w*|cost|costs|value|delivery|delivry|delveir|delivery\s*time|shipping|shipping\s*time|speed|lead\s*time|weight|brand|quality|rating)/i,
  );
  if (basedOnMatch) {
    const criterion = basedOnMatch[1].toLowerCase();
    if (/qty|quantit/.test(criterion)) {
      result.sortPreference = 'quantity_desc';
    } else if (/stock|availab/.test(criterion)) {
      result.sortPreference = 'stock_priority';
    } else if (/price|pric|cost|value/.test(criterion)) {
      result.sortPreference = 'price_asc';
    } else if (/deliv|delveir|shipping|speed|lead/.test(criterion)) {
      result.sortPreference = 'delivery_asc';
    } else if (/weight/.test(criterion)) {
      result.sortPreference = 'weight_asc';
    } else if (/quality|rating|brand/.test(criterion)) {
      result.sortPreference = 'quality_desc';
    }
  }

  // MULTIPLE PRIORITIES: detect "price and delivery", "price & delivery", "delivery and price"
  const multiPriorityMatch = q.match(
    /(price|pric\w*|cost|delivery|deliv\w*|delveir|shipping|speed|qty|quantity|stock)\s+(?:and|&|\+|,)\s+(price|pric\w*|cost|delivery|deliv\w*|delveir|shipping|speed|qty|quantity|stock)/i,
  );
  if (multiPriorityMatch) {
    const crit1 = multiPriorityMatch[1].toLowerCase();
    const crit2 = multiPriorityMatch[2].toLowerCase();
    const isPriceCrit1 = /price|pric|cost/.test(crit1);
    const isPriceCrit2 = /price|pric|cost/.test(crit2);
    const isDeliveryCrit1 = /deliv|delveir|shipping|speed/.test(crit1);
    const isDeliveryCrit2 = /deliv|delveir|shipping|speed/.test(crit2);
    const isQtyCrit1 = /qty|quantity/.test(crit1);
    const isQtyCrit2 = /qty|quantity/.test(crit2);
    const isStockCrit1 = /stock/.test(crit1);
    const isStockCrit2 = /stock/.test(crit2);

    // Price + Delivery combination
    if ((isPriceCrit1 && isDeliveryCrit2) || (isDeliveryCrit1 && isPriceCrit2)) {
      result.sortPreference = 'price_and_delivery';
    }
    // Price + Qty combination
    else if ((isPriceCrit1 && isQtyCrit2) || (isQtyCrit1 && isPriceCrit2)) {
      result.sortPreference = 'price_and_qty';
    }
    // Delivery + Qty combination
    else if ((isDeliveryCrit1 && isQtyCrit2) || (isQtyCrit1 && isDeliveryCrit2)) {
      result.sortPreference = 'delivery_and_qty';
    }
    // Price + Stock combination
    else if ((isPriceCrit1 && isStockCrit2) || (isStockCrit1 && isPriceCrit2)) {
      result.sortPreference = 'price_and_stock';
    }
  }

  // "by QTY", "by price", "by stock", "by delivery", "by delivery time" patterns with typo tolerance
  const byMatch = q.match(
    /\bby\s+(?:the\s+|a\s+)?(qty|quantity|stock|availab\w*|price|pric\w*|cost|delivery|delivry|delveir|delivery\s*time|shipping|shipping\s*time|lead\s*time|weight|quality)\b/i,
  );
  if (byMatch && !result.sortPreference) {
    const criterion = byMatch[1].toLowerCase();
    if (/qty|quantity/.test(criterion)) {
      result.sortPreference = 'quantity_desc';
    } else if (/stock|availab/.test(criterion)) {
      result.sortPreference = 'stock_priority';
    } else if (/price|pric|cost/.test(criterion)) {
      result.sortPreference = 'price_asc';
    } else if (/deliv|delveir|shipping|lead/.test(criterion)) {
      result.sortPreference = 'delivery_asc';
    } else if (/weight/.test(criterion)) {
      result.sortPreference = 'weight_asc';
    } else if (/quality/.test(criterion)) {
      result.sortPreference = 'quality_desc';
    }
  }

  // "sort by" / "sorted by" / "order by" / "rank by" / "prioritize" / "prefer" patterns with typo tolerance
  const sortByMatch = q.match(
    /(?:sort|sorted|sorte|order|ordered|rank|prioritize|prefer|arrange)\\s+(?:by|for)\\s+(qty|quantity|stock|availab\\w*|price|pric\\w*|cost|delivery|delivry|delveir|shipping|lead\\s*time|weight|quality|cheapest|fastest)/i,
  );
  if (sortByMatch && !result.sortPreference) {
    const criterion = sortByMatch[1].toLowerCase();
    if (/qty|quantity/.test(criterion)) result.sortPreference = 'quantity_desc';
    else if (/stock|availab/.test(criterion)) result.sortPreference = 'stock_priority';
    else if (/price|pric|cost|cheapest/.test(criterion)) result.sortPreference = 'price_asc';
    else if (/deliv|delveir|shipping|lead|fastest/.test(criterion)) result.sortPreference = 'delivery_asc';
    else if (/weight/.test(criterion)) result.sortPreference = 'weight_asc';
    else if (/quality/.test(criterion)) result.sortPreference = 'quality_desc';
  }

  // "fast in delivery" / "cheap in price" / "quick in shipping" patterns (typo: "fast in delveir")
  const fastInMatch = q.match(
    /(fast|quick|rapid|slow|cheap|expensive|high|low|best)\\s+(?:in|on|for)\\s+(delivery|delveir|delivry|shipping|price|pric\\w*|cost|stock|qty|quantity)/i,
  );
  if (fastInMatch && !result.sortPreference) {
    const modifier = fastInMatch[1].toLowerCase();
    const criterion = fastInMatch[2].toLowerCase();
    if (/deliv|delveir|shipping/.test(criterion)) {
      result.sortPreference = 'delivery_asc';
    } else if (/price|pric|cost/.test(criterion)) {
      result.sortPreference = /cheap|low|best/.test(modifier) ? 'price_asc' : 'price_desc';
    } else if (/stock|qty|quantity/.test(criterion)) {
      result.sortPreference = 'quantity_desc';
    }
  }

  // "with most" / "with highest" / "with lowest" / "with best" patterns with typo tolerance
  const withMostMatch = q.match(
    /with\\s+(most|highest|lowest|best|largest|biggest|shortest|fastest|cheapest|maximum|minimum)\\s+(qty|quantity|stock|availab\\w*|price|pric\\w*|cost|delivery|deliv\\w*|delveir|lead\\s*time)/i,
  );
  if (withMostMatch && !result.sortPreference) {
    const modifier = withMostMatch[1].toLowerCase();
    const criterion = withMostMatch[2].toLowerCase();
    if (/qty|quantity|stock|availab/.test(criterion)) {
      result.sortPreference = /lowest|minimum|least/.test(modifier) ? 'quantity_asc' : 'quantity_desc';
    } else if (/price|pric|cost/.test(criterion)) {
      result.sortPreference = /highest|most|maximum/.test(modifier) ? 'price_desc' : 'price_asc';
    } else if (/deliv|delveir|lead/.test(criterion)) {
      result.sortPreference = 'delivery_asc';
    }
  }

  // Implicit priority from context — "and QTY" / "and availability" / "and stock"
  if (!result.sortPreference) {
    if (/\band\s+(qty|quantity)\b/.test(q) && /\b(in\s*stock|available|availability)\b/.test(q)) {
      result.sortPreference = 'quantity_desc';
    } else if (/\band\s+(availab\w*|stock)\b/.test(q)) {
      result.sortPreference = 'stock_priority';
    }
  }

  // ── Comparison / Alternatives ──
  if (/\b(compare|comparison|versus|vs|side\s+by\s+side|head\s+to\s+head)\b/.test(q)) {
    result.compareMode = true;
    if (!result.topN) result.topN = 5; // default comparison count
  }
  if (/\b(alternative|alternatives|substitute|substitutes|equivalent|equivalents|interchangeable|cross[\s-]*reference|cross[\s-]*ref|replacement|replacements|compatible|compatible\s+with)\b/.test(q)) {
    result.findAlternatives = true;
  }
  if (/\b(similar|like|same\s+as|instead\s+of|swap|interchange)\b/.test(q)) {
    result.findAlternatives = true;
  }

  // ── Vehicle year / model detection ──
  const yearMatch = q.match(/\b(19|20)\d{2}\b/g);
  if (yearMatch) {
    const years = yearMatch.map(Number);
    if (years.length === 1) {
      result.vehicleYear = years[0];
    } else if (years.length >= 2) {
      result.vehicleYearMin = Math.min(...years);
      result.vehicleYearMax = Math.max(...years);
    }
  }

  // ── Condition ──
  if (/\b(new|brand\s*new|unused|sealed)\b/.test(q)) result.condition = 'new';
  if (/\b(used|second\s*hand|secondhand|refurbished|reconditioned|remanufactured|reman)\b/.test(q)) result.condition = 'used';

  // ── Minimum order value ──
  const movMatch = q.match(/\bminimum\s+order\s+(?:value|amount)?\s*\$?\s*(\d+)/);
  if (movMatch) result.minOrderValue = parseInt(movMatch[1]);

  // ── Weight ──
  const weightMatch = q.match(/(?:under|less\s+than|max|below)\s+(\d+(?:\.\d+)?)\s*kg/);
  if (weightMatch) result.maxWeight = parseFloat(weightMatch[1]);
  if (/\b(lightweight|light\s*weight|light)\b/.test(q) && !result.maxWeight) {
    result.maxWeight = 5; // default lightweight threshold
  }
  if (/\b(heavy\s*duty|heavy|industrial|commercial)\b/.test(q)) {
    result.heavyDuty = true;
  }

  // ── Application type ──
  if (/\b(passenger|sedan|hatchback|suv|crossover|coupe|convertible)\b/.test(q))
    result.applicationType = 'passenger';
  if (/\b(truck|pickup|lorry|commercial\s*vehicle|van|cargo)\b/.test(q))
    result.applicationType = 'commercial';
  if (/\b(racing|race|sport|performance|motorsport|track)\b/.test(q))
    result.applicationType = 'performance';
  if (/\b(diesel)\b/.test(q)) result.fuelType = 'diesel';
  if (/\b(petrol|gasoline|gas)\b/.test(q)) result.fuelType = 'petrol';
  if (/\b(hybrid)\b/.test(q)) result.fuelType = 'hybrid';
  if (/\b(electric|ev)\b/.test(q)) result.fuelType = 'electric';

  // ── Supplier type ──
  if (/\b(wholesale|wholesaler|bulk\s*supplier|distributor)\b/.test(q))
    result.supplierType = 'wholesale';
  if (/\b(manufacturer|direct\s+from\s+factory|factory\s+direct|maker)\b/.test(q))
    result.supplierType = 'manufacturer';
  if (/\b(local|nearby|close|domestic)\b/.test(q))
    result.supplierType = 'local';

  // ── Build summary ──
  const summaryParts = [];
  if (result.categories.length > 0)
    summaryParts.push(result.categories.join(', ') + ' parts');
  if (result.vehicleBrand) summaryParts.push(`for ${result.vehicleBrand}`);
  if (result.vehicleYear) summaryParts.push(`(${result.vehicleYear})`);
  else if (result.vehicleYearMin && result.vehicleYearMax)
    summaryParts.push(`(${result.vehicleYearMin}-${result.vehicleYearMax})`);
  else if (result.vehicleYearMin) summaryParts.push(`(from ${result.vehicleYearMin})`);
  if (result.partsBrands.length > 0)
    summaryParts.push(`by ${result.partsBrands.join(', ')}`);
  if (result.maxPrice && result.minPrice)
    summaryParts.push(`$${result.minPrice}-$${result.maxPrice}`);
  else if (result.maxPrice) summaryParts.push(`under $${result.maxPrice}`);
  else if (result.minPrice) summaryParts.push(`over $${result.minPrice}`);
  if (result.priceCurrency && result.priceCurrency !== 'USD')
    summaryParts.push(`(${result.priceCurrency})`);
  if (result.requireInStock) summaryParts.push('in stock');
  if (result.requireHighStock) summaryParts.push('with high availability');
  if (result.fastDelivery) summaryParts.push('with fast delivery');
  if (result.maxDeliveryDays) summaryParts.push(`within ${result.maxDeliveryDays} days`);
  if (result.oem) summaryParts.push('OEM/genuine');
  if (result.aftermarket) summaryParts.push('aftermarket');
  if (result.premiumQuality) summaryParts.push('premium quality');
  if (result.requireWarranty) summaryParts.push('with warranty');
  if (result.certifiedSupplier) summaryParts.push('from certified suppliers');
  if (result.condition && result.condition !== 'new')
    summaryParts.push(`(${result.condition})`);
  if (result.supplierOrigin) summaryParts.push(`${result.supplierOrigin} origin`);
  if (result.fuelType) summaryParts.push(`for ${result.fuelType}`);
  if (result.applicationType) summaryParts.push(`(${result.applicationType})`);
  if (result.heavyDuty) summaryParts.push('heavy duty');
  if (result.supplierType) summaryParts.push(`from ${result.supplierType} supplier`);
  if (result.compareMode) summaryParts.push('(comparison mode)');
  if (result.findAlternatives) summaryParts.push('(finding alternatives)');
  if (result.freeShipping) summaryParts.push('with free shipping');
  if (result.requestedQuantity)
    summaryParts.push(`qty ${result.requestedQuantity}`);
  if (result.excludeBrands.length > 0)
    summaryParts.push(`excl. ${result.excludeBrands.join(', ')}`);
  if (result.excludeOrigins.length > 0)
    summaryParts.push(`excl. ${result.excludeOrigins.join(', ')} origin`);

  // Add sort/priority context to summary
  const sortLabels = {
    'price_asc': 'prioritizing lowest price',
    'price_desc': 'prioritizing premium/highest price',
    'quantity_desc': 'prioritizing highest quantity and availability',
    'stock_priority': 'prioritizing stock availability',
    'delivery_asc': 'prioritizing fastest delivery',
    'weight_asc': 'prioritizing lightest weight',
    'quality_desc': 'prioritizing highest quality',
  };
  if (result.sortPreference && sortLabels[result.sortPreference]) {
    summaryParts.push(sortLabels[result.sortPreference]);
  }
  if (result.topN) {
    summaryParts.unshift(`best ${result.topN} options for`);
  }

  result.summary =
    summaryParts.length > 0
      ? `Find ${summaryParts.join(' ')}`
      : `Search for: ${query}`;

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
    merged.searchKeywords = [
      ...new Set([...local.searchKeywords, ...gemini.searchKeywords]),
    ].slice(0, 20);
  }

  // Gemini can find part numbers we missed
  if (gemini.partNumbers?.length > 0) {
    merged.partNumbers = [
      ...new Set([...local.partNumbers, ...gemini.partNumbers]),
    ];
  }

  // Gemini overrides vehicle brand only if local didn't find one
  if (!local.vehicleBrand && gemini.vehicleBrand) {
    merged.vehicleBrand = gemini.vehicleBrand.toUpperCase();
  }

  // Gemini can add parts brands
  if (gemini.partsBrands?.length > 0) {
    merged.partsBrands = [
      ...new Set([
        ...local.partsBrands,
        ...gemini.partsBrands.map((b) => b.toUpperCase()),
      ]),
    ];
  }

  // Gemini can add categories
  if (gemini.categories?.length > 0) {
    merged.categories = [
      ...new Set([
        ...local.categories,
        ...gemini.categories.map((c) => c.toLowerCase()),
      ]),
    ];
  }

  // CRITICAL: Price - use local parsing if found (it's reliable), only use Gemini if local missed it
  if (local.maxPrice === null && gemini.maxPrice != null)
    merged.maxPrice = Number(gemini.maxPrice);
  if (local.minPrice === null && gemini.minPrice != null)
    merged.minPrice = Number(gemini.minPrice);

  // Stock - OR them together (if either thinks user wants stock filter, apply it)
  if (gemini.requireInStock) merged.requireInStock = true;
  if (gemini.requireHighStock) merged.requireHighStock = true;

  // Delivery
  if (gemini.fastDelivery) merged.fastDelivery = true;
  if (gemini.maxDeliveryDays && !local.maxDeliveryDays)
    merged.maxDeliveryDays = gemini.maxDeliveryDays;

  // OEM / Certified
  if (gemini.oem) merged.oem = true;
  if (gemini.certifiedSupplier) merged.certifiedSupplier = true;

  // Quantity
  if (!local.requestedQuantity && gemini.requestedQuantity)
    merged.requestedQuantity = gemini.requestedQuantity;

  // Top N (number of results to show) - only meaningful when >= 2
  if (!local.topN && gemini.topN && gemini.topN >= 2) merged.topN = gemini.topN;
  // If Gemini put a small number in requestedQuantity but local detected topN, prefer topN
  if (merged.topN && merged.requestedQuantity && merged.requestedQuantity === merged.topN) {
    // AI confused topN with requestedQuantity — clear requestedQuantity
    merged.requestedQuantity = null;
  }

  // Exclusions
  if (gemini.excludeBrands?.length > 0) {
    merged.excludeBrands = [
      ...new Set([...local.excludeBrands, ...gemini.excludeBrands]),
    ];
  }
  if (gemini.excludeOrigins?.length > 0) {
    merged.excludeOrigins = [
      ...new Set([...local.excludeOrigins, ...gemini.excludeOrigins]),
    ];
  }

  // Summary - prefer Gemini's if it has one
  if (gemini.summary && gemini.summary.length > 10)
    merged.summary = gemini.summary;

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
    return {
      matchingParts: [],
      analysis: { totalReceived: 0, matching: 0, filtersApplied: {} },
    };
  }

  let filtered = [...parts];
  const totalBefore = filtered.length;
  const filtersApplied = {};

  // ── 1. KEYWORD / CATEGORY FILTERING (search descriptions) ──
  // SKIP keyword filtering when we have specific part numbers - the exact part number
  // search already found the right parts, keyword filtering only removes valid results
  const hasPartNumbers = parsedIntent.partNumbers && parsedIntent.partNumbers.length > 0;
  const keywords = parsedIntent.searchKeywords || [];
  const categories = parsedIntent.categories || [];
  const allSearchTerms = [...new Set([...keywords, ...categories])];

  if (allSearchTerms.length > 0 && !hasPartNumbers) {
    filtered = filtered.filter((p) => {
      const searchText = [
        p.description || '',
        p.category || '',
        p.subcategory || '',
        p.partNumber || '',
        ...(p.tags || []),
      ]
        .join(' ')
        .toLowerCase();

      // At least ONE search term must appear in the part's searchable text
      return allSearchTerms.some((term) =>
        searchText.includes(term.toLowerCase()),
      );
    });
    filtersApplied.keywords = `Matched: ${allSearchTerms.join(', ')} (${totalBefore} → ${filtered.length})`;
  } else if (hasPartNumbers) {
    filtersApplied.keywords = `Skipped keyword filter (exact part number search)`;
  }

  // ── 2. VEHICLE BRAND FILTERING ──
  if (parsedIntent.vehicleBrand) {
    const vBrand = parsedIntent.vehicleBrand.toLowerCase();
    const beforeCount = filtered.length;
    filtered = filtered.filter((p) => {
      const brandText = (p.brand || '').toLowerCase();
      const descText = (p.description || '').toLowerCase();
      const supplierText = (p.supplier || '').toLowerCase();
      return (
        brandText.includes(vBrand) ||
        descText.includes(vBrand) ||
        supplierText.includes(vBrand)
      );
    });
    filtersApplied.vehicleBrand = `${parsedIntent.vehicleBrand} (${beforeCount} → ${filtered.length})`;
  }

  // ── 3. PARTS BRAND FILTERING ──
  if (parsedIntent.partsBrands && parsedIntent.partsBrands.length > 0) {
    const brandsLower = parsedIntent.partsBrands.map((b) => b.toLowerCase());
    const beforeCount = filtered.length;
    filtered = filtered.filter((p) => {
      if (!p.brand) return false;
      const partBrand = p.brand.toLowerCase();
      return brandsLower.some(
        (b) => partBrand.includes(b) || b.includes(partBrand),
      );
    });
    filtersApplied.partsBrands = `${parsedIntent.partsBrands.join(', ')} (${beforeCount} → ${filtered.length})`;
  }

  // ── 4. PRICE FILTERING (CRITICAL - with proper currency conversion) ──
  // Database stores prices in AED. User typically specifies in USD.
  const CURRENCY_TO_AED = {
    USD: 3.67,
    EUR: 4.0,
    GBP: 4.65,
    AED: 1,
    SAR: 0.98,
    JPY: 0.025,
    CNY: 0.51,
  };

  const priceCurrency = (parsedIntent.priceCurrency || 'USD').toUpperCase();
  const conversionRate = CURRENCY_TO_AED[priceCurrency] || 3.67; // Default to USD→AED

  if (parsedIntent.maxPrice != null) {
    const maxPriceAED = parsedIntent.maxPrice * conversionRate;
    const beforeCount = filtered.length;
    filtered = filtered.filter((p) => {
      if (p.price == null || p.price === undefined) return true; // Include parts with no price listed
      return p.price <= maxPriceAED;
    });
    filtersApplied.maxPrice = `≤ $${parsedIntent.maxPrice} ${priceCurrency} (${maxPriceAED.toFixed(0)} AED) (${beforeCount} → ${filtered.length})`;
  }

  if (parsedIntent.minPrice != null) {
    const minPriceAED = parsedIntent.minPrice * conversionRate;
    const beforeCount = filtered.length;
    filtered = filtered.filter((p) => {
      if (p.price == null || p.price === undefined) return false; // Exclude parts with no price
      return p.price >= minPriceAED;
    });
    filtersApplied.minPrice = `≥ $${parsedIntent.minPrice} ${priceCurrency} (${minPriceAED.toFixed(0)} AED) (${beforeCount} → ${filtered.length})`;
  }

  // ── 5. STOCK FILTERING ──
  if (parsedIntent.requireHighStock) {
    const beforeCount = filtered.length;
    filtered = filtered.filter((p) => (p.quantity || 0) >= 10);
    filtersApplied.stock = `High stock qty≥10 (${beforeCount} → ${filtered.length})`;
  } else if (parsedIntent.requireInStock) {
    const beforeCount = filtered.length;
    filtered = filtered.filter((p) => (p.quantity || 0) > 0);
    filtersApplied.stock = `In stock qty>0 (${beforeCount} → ${filtered.length})`;
  }

  // ── 6. DELIVERY FILTERING ──
  if (parsedIntent.fastDelivery || parsedIntent.maxDeliveryDays) {
    const maxDays = parsedIntent.maxDeliveryDays || 5;
    const beforeCount = filtered.length;
    filtered = filtered.filter((p) => {
      if (!p.deliveryDays) return true; // Include if delivery not specified
      return p.deliveryDays <= maxDays;
    });
    filtersApplied.delivery = `≤ ${maxDays} days (${beforeCount} → ${filtered.length})`;
  }

  // ── 7. EXCLUSION FILTERING ──
  if (parsedIntent.excludeBrands && parsedIntent.excludeBrands.length > 0) {
    const excludeLower = parsedIntent.excludeBrands.map((b) => b.toLowerCase());
    const beforeCount = filtered.length;
    filtered = filtered.filter((p) => {
      if (!p.brand) return true;
      return !excludeLower.some((b) => p.brand.toLowerCase().includes(b));
    });
    filtersApplied.excludeBrands = `Excluded: ${parsedIntent.excludeBrands.join(', ')} (${beforeCount} → ${filtered.length})`;
  }

  // ── 8. QUANTITY REQUIREMENT (stock minimum, NOT result count) ──
  if (parsedIntent.requestedQuantity && parsedIntent.requestedQuantity > 1 && !parsedIntent.topN) {
    const beforeCount = filtered.length;
    filtered = filtered.filter(
      (p) => (p.quantity || 0) >= parsedIntent.requestedQuantity,
    );
    filtersApplied.quantity = `≥ ${parsedIntent.requestedQuantity} units (${beforeCount} → ${filtered.length})`;
  }

  // ── 9. TOP N — limit number of results returned ──
  if (parsedIntent.topN && parsedIntent.topN > 0) {
    filtersApplied.topN = `Top ${parsedIntent.topN} results requested`;
    // Actual slicing is done after sorting in the controller
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
      searchTerms: [
        ...(intent.partNumbers || []),
        ...(intent.searchKeywords || []),
      ],
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
      searchTerms: [
        ...(localParsed.partNumbers || []),
        ...(localParsed.searchKeywords || []),
      ],
      filters: {
        brand: localParsed.partsBrands || [],
        maxPrice: localParsed.maxPrice,
        minPrice: localParsed.minPrice,
        priceCurrency: 'USD',
        inStock: localParsed.requireInStock || false,
      },
      intent: `Searching for: "${query}"`,
      suggestions: [
        'Try being more specific',
        'Include brand names or part numbers',
      ],
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
   - IMPORTANT: ALWAYS strip leading single quotes ('), backticks (\`), or double quotes (") from part numbers. Excel often prefixes text cells with a single quote (e.g., "'6304NR" should be extracted as "6304NR"). Never include leading quotes in the extracted partNumber.

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
    // ── Step 1: Smart structure detection from first rows ──
    const headerRow = rawData[0];
    const structure = detectSpreadsheetStructure(rawData);

    // ── Step 2: Use AI on a small sample to understand the format ──
    const SAMPLE_SIZE = 30; // small sample for fast AI call
    const sampleData = rawData.slice(0, SAMPLE_SIZE);
    const dataPreview = formatRowsForPrompt(sampleData);

    const structurePrompt = `${EXCEL_ANALYSIS_INSTRUCTION}

Analyze this spreadsheet SAMPLE and extract all part numbers with their quantities.
This is a sample – the full file has ${rawData.length} rows. Extract every part from the sample.

File: ${options.filename || 'Unknown'}
Sheet: ${options.sheetName || 'Sheet1'}

Data (first ${sampleData.length} rows):
${dataPreview}

Remember: Respond with ONLY valid JSON, no markdown formatting, no code blocks.`;

    let aiResult = null;
    let aiPowered = false;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: structurePrompt,
        config: {
          temperature: 0.1,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 8192,
        },
      });

      const parsed = safeParseGeminiJSON(response.text);
      if (parsed && parsed.parts) {
        aiResult = parsed;
        aiPowered = true;
      }
    } catch (aiError) {
      console.warn('Excel AI sample analysis failed, using smart extraction:', aiError.message);
    }

    // ── Step 3: If AI gave us column mapping, apply it to ALL rows ──
    let allParts = [];
    let dataQuality;

    if (aiPowered && aiResult) {
      // AI understood the sample — now extract from all rows using detected columns
      const detectedCols = aiResult.detectedColumns || {};
      const aiSampleParts = normalizePartsArray(aiResult.parts);

      if (rawData.length <= SAMPLE_SIZE) {
        // Small file — AI already processed everything
        allParts = aiSampleParts;
      } else {
        // Large file — apply detected structure to remaining rows
        const partColIdx = resolveColumnIndex(headerRow, detectedCols.partNumber, structure.partNumberCol);
        const qtyColIdx = resolveColumnIndex(headerRow, detectedCols.quantity, structure.quantityCol);
        const brandColIdx = resolveColumnIndex(headerRow, detectedCols.brand, structure.brandCol);

        // Start with AI sample parts
        allParts = aiSampleParts;
        const existingPNs = new Set(allParts.map(p => p.partNumber));

        // Process remaining rows using column mapping
        const startRow = structure.hasHeaders ? 1 : 0;
        for (let i = Math.max(SAMPLE_SIZE, startRow); i < rawData.length; i++) {
          const row = rawData[i];
          const cells = Array.isArray(row) ? row : Object.values(row);

          const partNumber = cleanPartNumber(cells[partColIdx]);
          if (!partNumber || existingPNs.has(partNumber)) continue;

          const quantity = parseQuantity(cells[qtyColIdx]);
          const brand = cells[brandColIdx] ? String(cells[brandColIdx]).trim() : null;

          existingPNs.add(partNumber);
          allParts.push({
            partNumber,
            quantity,
            brand: brand || null,
            description: null,
            originalText: cells.slice(0, 5).join(' | ').substring(0, 100),
            confidence: 'high',
            selected: true,
          });
        }
      }

      dataQuality = aiResult.dataQuality || buildDataQuality(structure, true);
    } else {
      // AI failed — use smart pattern-based extraction
      allParts = smartExtractParts(rawData, structure);
      dataQuality = buildDataQuality(structure, false);
    }

    // Deduplicate: merge quantities for same part number
    const deduped = deduplicateExtractedParts(allParts);

    const suggestions = aiPowered && aiResult?.suggestions
      ? aiResult.suggestions
      : buildSuggestions(structure);

    return {
      success: true,
      summary: aiPowered
        ? `AI analyzed ${rawData.length} rows and found ${deduped.length} unique parts`
        : `Smart extraction found ${deduped.length} unique parts from ${rawData.length} rows`,
      totalPartsFound: deduped.length,
      parts: deduped,
      dataQuality,
      suggestions,
      detectedColumns: aiResult?.detectedColumns || structure.detectedColumns || {},
      originalRowCount: rawData.length,
      processedRowCount: rawData.length,
      aiPowered,
    };
  } catch (error) {
    console.error('Excel analysis error:', error);
    // Final fallback — pure regex
    return fallbackExcelExtraction(rawData, options);
  }
}

// ── Helper: format rows into a text prompt ──
function formatRowsForPrompt(rows) {
  return rows
    .map((row, idx) => {
      if (Array.isArray(row)) {
        return `Row ${idx + 1}: ${row.map((cell) => cell ?? '').join(' | ')}`;
      } else if (typeof row === 'object') {
        return `Row ${idx + 1}: ${Object.values(row).map((v) => v ?? '').join(' | ')}`;
      }
      return `Row ${idx + 1}: ${row}`;
    })
    .join('\n');
}

// ── Helper: safely parse Gemini JSON response ──
function safeParseGeminiJSON(rawText) {
  if (!rawText) return null;
  let text = rawText.trim();

  // Remove markdown code fences
  text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();

  // Extract outermost JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to fix truncated JSON by closing open structures
    try {
      // Remove trailing incomplete entries
      let fixed = text;
      // Remove last incomplete object in an array
      fixed = fixed.replace(/,\s*\{[^}]*$/s, '');
      // Close any open arrays and objects
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;
      fixed += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
      fixed += '}'.repeat(Math.max(0, openBraces - closeBraces));
      return JSON.parse(fixed);
    } catch (e2) {
      console.warn('Could not fix truncated Gemini JSON:', e2.message);
      return null;
    }
  }
}

// ── Helper: detect spreadsheet structure from headers and data patterns ──
function detectSpreadsheetStructure(rawData) {
  const structure = {
    hasHeaders: false,
    partNumberCol: -1,
    quantityCol: -1,
    brandCol: -1,
    descriptionCol: -1,
    detectedColumns: {},
  };

  if (!rawData || rawData.length === 0) return structure;

  const firstRow = Array.isArray(rawData[0]) ? rawData[0] : Object.values(rawData[0]);
  const firstRowStr = firstRow.map(c => String(c || '').toLowerCase().trim());

  // Detect headers
  const headerPatterns = {
    partNumber: /^(part\s*#?|part\s*num|part\s*no|p\/n|pn|sku|item\s*#?|item\s*num|item\s*code|article|catalog|reference|ref\s*#?|oem|code|material|product\s*code)/i,
    quantity: /^(qty|quantity|pcs|pieces|units|count|amount|order\s*qty|needed)/i,
    brand: /^(brand|make|manufacturer|mfr|vendor|supplier|oem\s*brand)/i,
    description: /^(desc|description|name|title|product|item\s*desc|part\s*desc|detail)/i,
  };

  for (let i = 0; i < firstRowStr.length; i++) {
    const cell = firstRowStr[i];
    if (!cell) continue;

    for (const [field, pattern] of Object.entries(headerPatterns)) {
      if (pattern.test(cell)) {
        structure.hasHeaders = true;
        if (field === 'partNumber') { structure.partNumberCol = i; structure.detectedColumns.partNumber = firstRow[i]; }
        if (field === 'quantity') { structure.quantityCol = i; structure.detectedColumns.quantity = firstRow[i]; }
        if (field === 'brand') { structure.brandCol = i; structure.detectedColumns.brand = firstRow[i]; }
        if (field === 'description') { structure.descriptionCol = i; structure.detectedColumns.description = firstRow[i]; }
      }
    }
  }

  // If no headers detected, scan data rows to guess columns
  if (structure.partNumberCol === -1) {
    structure.partNumberCol = guessPartNumberColumn(rawData);
  }

  return structure;
}

// ── Helper: guess which column contains part numbers ──
function guessPartNumberColumn(rawData) {
  const startRow = 0;
  const sampleRows = rawData.slice(startRow, Math.min(startRow + 20, rawData.length));
  if (sampleRows.length === 0) return 0;

  const maxCols = Math.max(...sampleRows.map(r => (Array.isArray(r) ? r.length : Object.values(r).length)));
  const colScores = new Array(maxCols).fill(0);
  const partLikePattern = /^[A-Z0-9][-A-Z0-9_./]{2,20}$/i;

  for (const row of sampleRows) {
    const cells = Array.isArray(row) ? row : Object.values(row);
    for (let c = 0; c < cells.length; c++) {
      const val = String(cells[c] || '').trim();
      if (partLikePattern.test(val) && val.length >= 4) {
        colScores[c]++;
      }
    }
  }

  const bestCol = colScores.indexOf(Math.max(...colScores));
  return bestCol >= 0 ? bestCol : 0;
}

// ── Helper: resolve column index from header name or detected index ──
function resolveColumnIndex(headerRow, detectedName, fallbackIdx) {
  if (detectedName && headerRow) {
    const headers = Array.isArray(headerRow) ? headerRow : Object.values(headerRow);
    for (let i = 0; i < headers.length; i++) {
      if (String(headers[i] || '').toLowerCase().trim() === String(detectedName).toLowerCase().trim()) {
        return i;
      }
      // Also match by column index string like "0", "1"
      if (String(detectedName).match(/^\d+$/) && parseInt(detectedName, 10) === i) {
        return i;
      }
    }
  }
  return fallbackIdx >= 0 ? fallbackIdx : 0;
}

// ── Helper: clean and validate a part number string ──
function cleanPartNumber(value) {
  if (value === null || value === undefined) return null;
  // Strip leading single quotes, backticks, double quotes (Excel text-prefix artifacts)
  let str = String(value).trim().replace(/^['‘’`"]+/, '').trim().toUpperCase();
  if (str.length < 3 || str.length > 30) return null;
  // Skip common non-part-number values
  if (/^(ROW|COL|SHEET|TABLE|TOTAL|SUM|COUNT|QTY|QUANTITY|PRICE|BRAND|NAME|DESC|N\/A|NULL|NONE|UNDEFINED|-|–)$/i.test(str)) return null;
  // Must contain at least one digit or be alphanumeric
  if (!/[0-9]/.test(str)) return null;
  // Skip tiny numbers that are likely row nums or quantities
  if (/^\d+$/.test(str) && parseInt(str, 10) < 1000) return null;
  return str;
}

// ── Helper: parse a quantity value ──
function parseQuantity(value) {
  if (value === null || value === undefined) return 1;
  const num = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
  return (num > 0 && num <= 99999) ? num : 1;
}

// ── Helper: normalize parts array from AI response ──
function normalizePartsArray(parts) {
  if (!Array.isArray(parts)) return [];
  return parts
    .filter(p => p && p.partNumber)
    .map(part => ({
      // Strip leading quotes (Excel text-prefix artifacts like 'ST1538)
      partNumber: String(part.partNumber || '').trim().replace(/^['‘’`"]+/, '').trim().toUpperCase(),
      quantity: parseInt(part.quantity, 10) || 1,
      brand: part.brand || null,
      description: part.description || null,
      originalText: part.originalText || null,
      confidence: part.confidence || 'medium',
      selected: true,
    }));
}

// ── Helper: deduplicate parts, merging quantities ──
function deduplicateExtractedParts(parts) {
  const map = new Map();
  for (const part of parts) {
    if (!part.partNumber) continue;
    if (map.has(part.partNumber)) {
      const existing = map.get(part.partNumber);
      existing.quantity += (part.quantity || 1);
      // Upgrade confidence level
      if (part.confidence === 'high') existing.confidence = 'high';
      else if (part.confidence === 'medium' && existing.confidence === 'low') existing.confidence = 'medium';
      // Fill in missing brand/description
      if (!existing.brand && part.brand) existing.brand = part.brand;
      if (!existing.description && part.description) existing.description = part.description;
    } else {
      map.set(part.partNumber, { ...part });
    }
  }
  return Array.from(map.values());
}

// ── Helper: build data quality summary ──
function buildDataQuality(structure, aiWorked) {
  const formatting = structure.hasHeaders ? (structure.partNumberCol >= 0 ? 'good' : 'fair') : 'fair';
  const issues = [];

  if (!structure.hasHeaders) issues.push('No header row detected — columns identified by patterns');
  if (structure.quantityCol === -1) issues.push('No quantity column detected — defaulting to 1');
  if (!aiWorked && structure.partNumberCol === -1) issues.push('Part number column guessed from data patterns');

  return {
    hasHeaders: structure.hasHeaders,
    hasPartNumberColumn: structure.partNumberCol >= 0,
    hasQuantityColumn: structure.quantityCol >= 0,
    hasBrandColumn: structure.brandCol >= 0,
    formatting,
    issues,
  };
}

// ── Helper: build suggestions ──
function buildSuggestions(structure) {
  const suggestions = [];
  if (!structure.hasHeaders) {
    suggestions.push('Add a header row with "Part Number" and "Quantity" labels for better accuracy');
  }
  if (structure.quantityCol === -1) {
    suggestions.push('Include a "Quantity" column so quantities are extracted automatically');
  }
  if (structure.brandCol === -1) {
    suggestions.push('Adding a "Brand" column helps identify exact part matches');
  }
  return suggestions;
}

// ── Smart extraction using detected structure ──
function smartExtractParts(rawData, structure) {
  const parts = [];
  const seenPNs = new Set();
  const startRow = structure.hasHeaders ? 1 : 0;
  const partCol = structure.partNumberCol >= 0 ? structure.partNumberCol : -1;
  const qtyCol = structure.quantityCol;
  const brandCol = structure.brandCol;

  for (let i = startRow; i < rawData.length; i++) {
    const row = rawData[i];
    const cells = Array.isArray(row) ? row : (typeof row === 'object' ? Object.values(row) : [row]);

    // If we know the part number column, use it directly
    if (partCol >= 0 && cells[partCol] !== undefined) {
      const pn = cleanPartNumber(cells[partCol]);
      if (pn && !seenPNs.has(pn)) {
        seenPNs.add(pn);
        parts.push({
          partNumber: pn,
          quantity: qtyCol >= 0 ? parseQuantity(cells[qtyCol]) : 1,
          brand: brandCol >= 0 ? (String(cells[brandCol] || '').trim() || null) : null,
          description: null,
          originalText: cells.slice(0, 5).join(' | ').substring(0, 100),
          confidence: structure.hasHeaders ? 'high' : 'medium',
          selected: true,
        });
      }
    } else {
      // No column detected — scan every cell
      for (const cell of cells) {
        const pn = cleanPartNumber(cell);
        if (pn && !seenPNs.has(pn)) {
          seenPNs.add(pn);
          parts.push({
            partNumber: pn,
            quantity: 1,
            brand: null,
            description: null,
            originalText: cells.slice(0, 5).join(' | ').substring(0, 100),
            confidence: 'medium',
            selected: true,
          });
        }
      }
    }
  }

  return parts;
}

/**
 * Fallback extraction when everything else fails
 */
function fallbackExcelExtraction(rawData, options = {}) {
  const structure = detectSpreadsheetStructure(rawData);
  const parts = smartExtractParts(rawData, structure);

  return {
    success: true,
    summary: `Found ${parts.length} parts using pattern detection`,
    totalPartsFound: parts.length,
    parts,
    dataQuality: buildDataQuality(structure, false),
    suggestions: buildSuggestions(structure),
    detectedColumns: structure.detectedColumns || {},
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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ANALYTICS CHAT - AI-powered analytics assistant
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ANALYTICS_CHAT_PROMPT = `You are an expert automotive parts sales analytics assistant. You help administrators understand their parts sales data, search trends, and make data-driven decisions.

Given the analytics data provided and the user's question, provide helpful, actionable insights.

RESPONSE FORMAT:
- Use HTML formatting for structure (p, ul, ol, strong, em tags)
- Be concise but comprehensive
- Include relevant numbers from the data
- Provide actionable recommendations when appropriate
- Use professional, friendly tone

AVAILABLE DATA CONTEXT:
- Dashboard stats (searches, views, purchases, conversion rates)
- Top searched parts (what customers are looking for)
- Top purchased parts (what's actually selling)
- Missed opportunities (searches that didn't convert)
- Trending parts (rising/falling demand)
- Excel import analytics (bulk search patterns)

When relevant data isn't available, acknowledge it and provide general guidance based on industry best practices.`;

async function analyticsChat(message, analyticsContext) {
  if (!ai) {
    throw new Error('Gemini API not initialized');
  }

  try {
    // Format the analytics data for the AI
    const contextString = formatAnalyticsContext(analyticsContext);
    
    const prompt = `${ANALYTICS_CHAT_PROMPT}\n\nCURRENT ANALYTICS DATA:\n${contextString}\n\nUSER QUESTION: ${message}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    const text = response?.text || '';
    
    if (!text) {
      throw new Error('No response from AI');
    }

    return text;
  } catch (error) {
    console.error('Analytics chat AI error:', error);
    throw error;
  }
}

function formatAnalyticsContext(context) {
  const sections = [];
  
  if (context.dashboardStats) {
    const d = context.dashboardStats;
    sections.push(`DASHBOARD OVERVIEW:
- Total Searches: ${d.totalSearches || 0} (${d.searchesChange >= 0 ? '+' : ''}${d.searchesChange || 0}% vs last period)
- Parts Viewed: ${d.partsViewed || 0}
- Purchases: ${d.purchases || 0} (${d.purchasesChange >= 0 ? '+' : ''}${d.purchasesChange || 0}% vs last period)
- Conversion Rate: ${d.conversionRate || 0}%
- Missed Opportunities: ${d.missedOpportunities || 0}
- Excel Searches: ${d.excelSearches || 0}
- Revenue: $${(d.revenue || 0).toLocaleString()}`);
  }
  
  if (context.topSearched?.length > 0) {
    const top = context.topSearched.slice(0, 5).map((p, i) => 
      `${i + 1}. ${p.partNumber}: ${p.searches} searches, ${p.conversion || 0}% conversion`
    ).join('\n');
    sections.push(`TOP SEARCHED PARTS:\n${top}`);
  }
  
  if (context.topPurchased?.length > 0) {
    const top = context.topPurchased.slice(0, 5).map((p, i) => 
      `${i + 1}. ${p.partNumber}: ${p.orders} orders, $${(p.revenue || 0).toLocaleString()} revenue`
    ).join('\n');
    sections.push(`TOP PURCHASED PARTS:\n${top}`);
  }
  
  if (context.missedOpportunities?.length > 0) {
    const missed = context.missedOpportunities.slice(0, 5).map((p, i) => 
      `${i + 1}. ${p.partNumber}: ${p.searches} searches - ${p.reason || 'Not converted'}`
    ).join('\n');
    sections.push(`MISSED OPPORTUNITIES:\n${missed}`);
  }
  
  if (context.trending?.length > 0) {
    const trend = context.trending.slice(0, 5).map((p, i) => 
      `${i + 1}. ${p.partNumber}: ${p.trend} (${p.trendPercentage > 0 ? '+' : ''}${p.trendPercentage}%)`
    ).join('\n');
    sections.push(`TRENDING PARTS:\n${trend}`);
  }
  
  if (context.excelAnalytics) {
    const e = context.excelAnalytics;
    sections.push(`EXCEL IMPORT ANALYTICS:
- Total Excel Searches: ${e.totalSearches || 0}
- Parts Found via Excel: ${e.partsFound || 0}
- Parts Not Found: ${e.partsNotFound || 0}`);
  }
  
  return sections.join('\n\n') || 'No analytics data available yet.';
}

module.exports = {
  parseSearchQuery,
  parseUserIntent,
  filterDataWithAI,
  generateSuggestions,
  analyzeResults,
  analyzeExcelData,
  recommendBestParts,
  analyticsChat,
};
