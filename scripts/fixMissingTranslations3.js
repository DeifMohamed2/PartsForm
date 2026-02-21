const fs = require('fs');
const path = require('path');

// QuickSearch translations
const quickSearchTranslations = {
  ar: {
    badge: "بحث سريع",
    title: "البحث عن قطع صناعية",
    subtitle: "أدخل رقم القطعة أو الوصف للبحث في جميع القطاعات",
    placeholder: "أدخل رقم القطعة أو الوصف...",
    selectCategory: "اختر الفئة:",
    searchNow: "ابحث الآن",
    recentSearches: "عمليات البحث الأخيرة"
  },
  es: {
    badge: "BÚSQUEDA RÁPIDA",
    title: "Buscar Piezas Industriales",
    subtitle: "Ingrese número de pieza o descripción para buscar en todos los sectores",
    placeholder: "Ingrese número de pieza o descripción...",
    selectCategory: "Seleccionar Categoría:",
    searchNow: "Buscar Ahora",
    recentSearches: "Búsquedas Recientes"
  },
  fr: {
    badge: "RECHERCHE RAPIDE",
    title: "Trouver des Pièces Industrielles",
    subtitle: "Entrez le numéro de pièce ou la description pour rechercher dans tous les secteurs",
    placeholder: "Entrez le numéro de pièce ou la description...",
    selectCategory: "Sélectionner la Catégorie:",
    searchNow: "Rechercher Maintenant",
    recentSearches: "Recherches Récentes"
  },
  ru: {
    badge: "БЫСТРЫЙ ПОИСК",
    title: "Найти Промышленные Детали",
    subtitle: "Введите номер детали или описание для поиска по всем секторам",
    placeholder: "Введите номер детали или описание...",
    selectCategory: "Выберите Категорию:",
    searchNow: "Искать Сейчас",
    recentSearches: "Недавние Поиски"
  },
  ua: {
    badge: "ШВИДКИЙ ПОШУК",
    title: "Знайти Промислові Деталі",
    subtitle: "Введіть номер деталі або опис для пошуку в усіх секторах",
    placeholder: "Введіть номер деталі або опис...",
    selectCategory: "Оберіть Категорію:",
    searchNow: "Шукати Зараз",
    recentSearches: "Нещодавні Пошуки"
  }
};

// Additional searchResults nested keys for it, ja, ko, nl, pl, pt, tr, zh
const searchResultsExtraKeys = {
  header: { addToCartCount: "Add to Cart" },
  emptyState: {
    features: {
      verifiedSuppliers: "Verified Suppliers",
      globalNetwork: "Global Network",
      fastDelivery: "Fast Delivery",
      qualityGuaranteed: "Quality Guaranteed"
    }
  },
  noResults: {
    description: "We couldn't find any parts matching",
    suggestion1: "Check the spelling of your search term",
    suggestion2: "Try using a different part number format",
    suggestion3: "Use fewer or more general keywords",
    suggestion4: "Clear filters to broaden your search"
  },
  excel: {
    aiExtract: "AI will intelligently extract parts from any format",
    fileHint: "Supports .xlsx, .xls, .csv • Max 10MB • Max 5,000 rows • Max 1,000 parts per search",
    formatHint: "Works with any format, but structured data gives better results",
    sampleHint: "Works with any format, but structured data gives better results",
    downloadSample: "Download Sample Template",
    fileTooLarge: "File Too Large",
    readingData: "Reading spreadsheet data",
    detectingParts: "Detecting part numbers",
    extractingData: "Extracting quantities & brands",
    extractingQty: "Extracting quantities & brands",
    validating: "Validating & organizing",
    partsReady: "Found 25 parts ready for search",
    foundParts: "Found {count} parts ready for search",
    aiPowered: "AI Powered",
    dataQuality: "Data Quality:",
    qualityGood: "Good",
    selectFirst1000: "Select First 1,000",
    partsSelected: "0 parts selected",
    all: "All",
    highConfidence: "High Confidence",
    medium: "Medium",
    low: "Low",
    importAnalytics: "Import Analytics",
    totalParts: "Total Parts",
    found: "Found",
    notFound: "Not Found",
    duplicates: "Duplicates",
    notCounted: "Not counted",
    successRate: "Success Rate",
    partsNotFound: "Parts Not Found",
    duplicatesDetected: "Duplicate parts detected and merged",
    searchResultsTitle: "Search Results & AI Recommendations",
    foundOptions: "Found options for 25 parts",
    backToParts: "Back to Parts",
    uploadNewFile: "Upload New File"
  }
};

// Translated versions
const searchResultsExtraTranslations = {
  it: {
    header: { addToCartCount: "Aggiungi al Carrello" },
    emptyState: {
      features: {
        verifiedSuppliers: "Fornitori Verificati",
        globalNetwork: "Rete Globale",
        fastDelivery: "Consegna Veloce",
        qualityGuaranteed: "Qualità Garantita"
      }
    },
    noResults: {
      description: "Non abbiamo trovato parti corrispondenti a",
      suggestion1: "Controlla l'ortografia del termine di ricerca",
      suggestion2: "Prova a usare un formato di numero parte diverso",
      suggestion3: "Usa meno parole chiave o più generiche",
      suggestion4: "Cancella i filtri per ampliare la ricerca"
    },
    excel: {
      aiExtract: "L'IA estrarrà intelligentemente le parti da qualsiasi formato",
      fileHint: "Supporta .xlsx, .xls, .csv • Max 10MB • Max 5.000 righe • Max 1.000 parti per ricerca",
      formatHint: "Funziona con qualsiasi formato, ma dati strutturati danno risultati migliori",
      sampleHint: "Funziona con qualsiasi formato, ma dati strutturati danno risultati migliori",
      downloadSample: "Scarica Template di Esempio",
      fileTooLarge: "File Troppo Grande",
      readingData: "Lettura dati foglio di calcolo",
      detectingParts: "Rilevamento numeri parte",
      extractingData: "Estrazione quantità e marche",
      extractingQty: "Estrazione quantità e marche",
      validating: "Validazione e organizzazione",
      partsReady: "Trovate 25 parti pronte per la ricerca",
      foundParts: "Trovate {count} parti pronte per la ricerca",
      aiPowered: "Basato su IA",
      dataQuality: "Qualità Dati:",
      qualityGood: "Buona",
      selectFirst1000: "Seleziona Prime 1.000",
      partsSelected: "0 parti selezionate",
      all: "Tutti",
      highConfidence: "Alta Affidabilità",
      medium: "Media",
      low: "Bassa",
      importAnalytics: "Analisi Importazione",
      totalParts: "Parti Totali",
      found: "Trovate",
      notFound: "Non Trovate",
      duplicates: "Duplicati",
      notCounted: "Non contati",
      successRate: "Tasso di Successo",
      partsNotFound: "Parti Non Trovate",
      duplicatesDetected: "Parti duplicate rilevate e unite",
      searchResultsTitle: "Risultati Ricerca e Raccomandazioni IA",
      foundOptions: "Trovate opzioni per 25 parti",
      backToParts: "Torna alle Parti",
      uploadNewFile: "Carica Nuovo File"
    }
  },
  ja: {
    header: { addToCartCount: "カートに追加" },
    emptyState: {
      features: {
        verifiedSuppliers: "認定サプライヤー",
        globalNetwork: "グローバルネットワーク",
        fastDelivery: "迅速配送",
        qualityGuaranteed: "品質保証"
      }
    },
    noResults: {
      description: "一致する部品が見つかりませんでした",
      suggestion1: "検索語のスペルを確認してください",
      suggestion2: "別の部品番号形式を試してください",
      suggestion3: "より少ないまたはより一般的なキーワードを使用してください",
      suggestion4: "フィルターをクリアして検索を広げてください"
    },
    excel: {
      aiExtract: "AIがあらゆる形式から部品を賢く抽出します",
      fileHint: ".xlsx, .xls, .csv対応 • 最大10MB • 最大5,000行 • 検索あたり最大1,000部品",
      formatHint: "どの形式でも動作しますが、構造化データの方が良い結果が得られます",
      sampleHint: "どの形式でも動作しますが、構造化データの方が良い結果が得られます",
      downloadSample: "サンプルテンプレートをダウンロード",
      fileTooLarge: "ファイルが大きすぎます",
      readingData: "スプレッドシートデータを読み込み中",
      detectingParts: "部品番号を検出中",
      extractingData: "数量とブランドを抽出中",
      extractingQty: "数量とブランドを抽出中",
      validating: "検証と整理中",
      partsReady: "25個の部品が検索準備完了",
      foundParts: "{count}個の部品が検索準備完了",
      aiPowered: "AI搭載",
      dataQuality: "データ品質:",
      qualityGood: "良好",
      selectFirst1000: "最初の1,000件を選択",
      partsSelected: "0件選択済み",
      all: "すべて",
      highConfidence: "高信頼性",
      medium: "中",
      low: "低",
      importAnalytics: "インポート分析",
      totalParts: "総部品数",
      found: "見つかった",
      notFound: "見つからない",
      duplicates: "重複",
      notCounted: "カウントされない",
      successRate: "成功率",
      partsNotFound: "部品が見つかりません",
      duplicatesDetected: "重複部品が検出され統合されました",
      searchResultsTitle: "検索結果とAI推奨",
      foundOptions: "25件の部品のオプションが見つかりました",
      backToParts: "部品に戻る",
      uploadNewFile: "新しいファイルをアップロード"
    }
  },
  ko: {
    header: { addToCartCount: "장바구니에 추가" },
    emptyState: {
      features: {
        verifiedSuppliers: "검증된 공급업체",
        globalNetwork: "글로벌 네트워크",
        fastDelivery: "빠른 배송",
        qualityGuaranteed: "품질 보증"
      }
    },
    noResults: {
      description: "일치하는 부품을 찾을 수 없습니다",
      suggestion1: "검색어 철자를 확인하세요",
      suggestion2: "다른 부품 번호 형식을 시도하세요",
      suggestion3: "더 적거나 일반적인 키워드를 사용하세요",
      suggestion4: "필터를 지워 검색을 확대하세요"
    },
    excel: {
      aiExtract: "AI가 모든 형식에서 부품을 지능적으로 추출합니다",
      fileHint: ".xlsx, .xls, .csv 지원 • 최대 10MB • 최대 5,000행 • 검색당 최대 1,000부품",
      formatHint: "모든 형식에서 작동하지만 구조화된 데이터가 더 나은 결과를 제공합니다",
      sampleHint: "모든 형식에서 작동하지만 구조화된 데이터가 더 나은 결과를 제공합니다",
      downloadSample: "샘플 템플릿 다운로드",
      fileTooLarge: "파일이 너무 큽니다",
      readingData: "스프레드시트 데이터 읽는 중",
      detectingParts: "부품 번호 감지 중",
      extractingData: "수량 및 브랜드 추출 중",
      extractingQty: "수량 및 브랜드 추출 중",
      validating: "검증 및 정리 중",
      partsReady: "검색 준비된 25개 부품 발견",
      foundParts: "검색 준비된 {count}개 부품 발견",
      aiPowered: "AI 기반",
      dataQuality: "데이터 품질:",
      qualityGood: "양호",
      selectFirst1000: "처음 1,000개 선택",
      partsSelected: "0개 부품 선택됨",
      all: "전체",
      highConfidence: "높은 신뢰도",
      medium: "중간",
      low: "낮음",
      importAnalytics: "가져오기 분석",
      totalParts: "총 부품",
      found: "찾음",
      notFound: "찾을 수 없음",
      duplicates: "중복",
      notCounted: "카운트 안 됨",
      successRate: "성공률",
      partsNotFound: "부품을 찾을 수 없음",
      duplicatesDetected: "중복 부품이 감지되어 병합됨",
      searchResultsTitle: "검색 결과 및 AI 추천",
      foundOptions: "25개 부품에 대한 옵션 발견",
      backToParts: "부품으로 돌아가기",
      uploadNewFile: "새 파일 업로드"
    }
  },
  nl: {
    header: { addToCartCount: "Toevoegen aan Winkelwagen" },
    emptyState: {
      features: {
        verifiedSuppliers: "Geverifieerde Leveranciers",
        globalNetwork: "Wereldwijd Netwerk",
        fastDelivery: "Snelle Levering",
        qualityGuaranteed: "Kwaliteit Gegarandeerd"
      }
    },
    noResults: {
      description: "We konden geen onderdelen vinden die overeenkomen met",
      suggestion1: "Controleer de spelling van uw zoekterm",
      suggestion2: "Probeer een ander onderdeelnummerformaat",
      suggestion3: "Gebruik minder of algemenere trefwoorden",
      suggestion4: "Wis filters om uw zoekopdracht te verbreden"
    },
    excel: {
      aiExtract: "AI zal intelligent onderdelen uit elk formaat extraheren",
      fileHint: "Ondersteunt .xlsx, .xls, .csv • Max 10MB • Max 5.000 rijen • Max 1.000 onderdelen per zoekopdracht",
      formatHint: "Werkt met elk formaat, maar gestructureerde data geeft betere resultaten",
      sampleHint: "Werkt met elk formaat, maar gestructureerde data geeft betere resultaten",
      downloadSample: "Download Voorbeeldsjabloon",
      fileTooLarge: "Bestand Te Groot",
      readingData: "Spreadsheetgegevens lezen",
      detectingParts: "Onderdeelnummers detecteren",
      extractingData: "Hoeveelheden en merken extraheren",
      extractingQty: "Hoeveelheden en merken extraheren",
      validating: "Valideren en organiseren",
      partsReady: "25 onderdelen klaar voor zoekopdracht gevonden",
      foundParts: "{count} onderdelen klaar voor zoekopdracht gevonden",
      aiPowered: "AI Aangedreven",
      dataQuality: "Gegevenskwaliteit:",
      qualityGood: "Goed",
      selectFirst1000: "Selecteer Eerste 1.000",
      partsSelected: "0 onderdelen geselecteerd",
      all: "Alle",
      highConfidence: "Hoge Betrouwbaarheid",
      medium: "Gemiddeld",
      low: "Laag",
      importAnalytics: "Import Analyse",
      totalParts: "Totaal Onderdelen",
      found: "Gevonden",
      notFound: "Niet Gevonden",
      duplicates: "Duplicaten",
      notCounted: "Niet geteld",
      successRate: "Succespercentage",
      partsNotFound: "Onderdelen Niet Gevonden",
      duplicatesDetected: "Dubbele onderdelen gedetecteerd en samengevoegd",
      searchResultsTitle: "Zoekresultaten en AI Aanbevelingen",
      foundOptions: "Opties gevonden voor 25 onderdelen",
      backToParts: "Terug naar Onderdelen",
      uploadNewFile: "Upload Nieuw Bestand"
    }
  },
  pl: {
    header: { addToCartCount: "Dodaj do Koszyka" },
    emptyState: {
      features: {
        verifiedSuppliers: "Zweryfikowani Dostawcy",
        globalNetwork: "Globalna Sieć",
        fastDelivery: "Szybka Dostawa",
        qualityGuaranteed: "Gwarancja Jakości"
      }
    },
    noResults: {
      description: "Nie znaleźliśmy części pasujących do",
      suggestion1: "Sprawdź pisownię wyszukiwanego terminu",
      suggestion2: "Spróbuj użyć innego formatu numeru części",
      suggestion3: "Użyj mniej lub bardziej ogólnych słów kluczowych",
      suggestion4: "Wyczyść filtry, aby rozszerzyć wyszukiwanie"
    },
    excel: {
      aiExtract: "AI inteligentnie wyodrębni części z dowolnego formatu",
      fileHint: "Obsługuje .xlsx, .xls, .csv • Max 10MB • Max 5000 wierszy • Max 1000 części na wyszukiwanie",
      formatHint: "Działa z każdym formatem, ale ustrukturyzowane dane dają lepsze wyniki",
      sampleHint: "Działa z każdym formatem, ale ustrukturyzowane dane dają lepsze wyniki",
      downloadSample: "Pobierz Przykładowy Szablon",
      fileTooLarge: "Plik Za Duży",
      readingData: "Odczytywanie danych arkusza",
      detectingParts: "Wykrywanie numerów części",
      extractingData: "Wyodrębnianie ilości i marek",
      extractingQty: "Wyodrębnianie ilości i marek",
      validating: "Walidacja i organizacja",
      partsReady: "Znaleziono 25 części gotowych do wyszukania",
      foundParts: "Znaleziono {count} części gotowych do wyszukania",
      aiPowered: "Napędzane przez AI",
      dataQuality: "Jakość Danych:",
      qualityGood: "Dobra",
      selectFirst1000: "Wybierz Pierwsze 1000",
      partsSelected: "0 części wybranych",
      all: "Wszystkie",
      highConfidence: "Wysoka Pewność",
      medium: "Średnia",
      low: "Niska",
      importAnalytics: "Analiza Importu",
      totalParts: "Łączna Liczba Części",
      found: "Znalezione",
      notFound: "Nie Znalezione",
      duplicates: "Duplikaty",
      notCounted: "Nie liczone",
      successRate: "Wskaźnik Sukcesu",
      partsNotFound: "Części Nie Znalezione",
      duplicatesDetected: "Wykryto i połączono zduplikowane części",
      searchResultsTitle: "Wyniki Wyszukiwania i Rekomendacje AI",
      foundOptions: "Znaleziono opcje dla 25 części",
      backToParts: "Powrót do Części",
      uploadNewFile: "Prześlij Nowy Plik"
    }
  },
  pt: {
    header: { addToCartCount: "Adicionar ao Carrinho" },
    emptyState: {
      features: {
        verifiedSuppliers: "Fornecedores Verificados",
        globalNetwork: "Rede Global",
        fastDelivery: "Entrega Rápida",
        qualityGuaranteed: "Qualidade Garantida"
      }
    },
    noResults: {
      description: "Não encontramos peças correspondentes a",
      suggestion1: "Verifique a ortografia do termo de busca",
      suggestion2: "Tente usar um formato de número de peça diferente",
      suggestion3: "Use menos palavras-chave ou mais gerais",
      suggestion4: "Limpe os filtros para ampliar a busca"
    },
    excel: {
      aiExtract: "A IA extrairá peças de qualquer formato de forma inteligente",
      fileHint: "Suporta .xlsx, .xls, .csv • Máx 10MB • Máx 5.000 linhas • Máx 1.000 peças por busca",
      formatHint: "Funciona com qualquer formato, mas dados estruturados dão melhores resultados",
      sampleHint: "Funciona com qualquer formato, mas dados estruturados dão melhores resultados",
      downloadSample: "Baixar Template de Exemplo",
      fileTooLarge: "Arquivo Muito Grande",
      readingData: "Lendo dados da planilha",
      detectingParts: "Detectando números de peças",
      extractingData: "Extraindo quantidades e marcas",
      extractingQty: "Extraindo quantidades e marcas",
      validating: "Validando e organizando",
      partsReady: "25 peças prontas para busca encontradas",
      foundParts: "{count} peças prontas para busca encontradas",
      aiPowered: "Baseado em IA",
      dataQuality: "Qualidade dos Dados:",
      qualityGood: "Boa",
      selectFirst1000: "Selecionar Primeiras 1.000",
      partsSelected: "0 peças selecionadas",
      all: "Todos",
      highConfidence: "Alta Confiança",
      medium: "Média",
      low: "Baixa",
      importAnalytics: "Análise de Importação",
      totalParts: "Total de Peças",
      found: "Encontradas",
      notFound: "Não Encontradas",
      duplicates: "Duplicatas",
      notCounted: "Não contadas",
      successRate: "Taxa de Sucesso",
      partsNotFound: "Peças Não Encontradas",
      duplicatesDetected: "Peças duplicadas detectadas e mescladas",
      searchResultsTitle: "Resultados de Busca e Recomendações IA",
      foundOptions: "Opções encontradas para 25 peças",
      backToParts: "Voltar para Peças",
      uploadNewFile: "Enviar Novo Arquivo"
    }
  },
  tr: {
    header: { addToCartCount: "Sepete Ekle" },
    emptyState: {
      features: {
        verifiedSuppliers: "Doğrulanmış Tedarikçiler",
        globalNetwork: "Küresel Ağ",
        fastDelivery: "Hızlı Teslimat",
        qualityGuaranteed: "Kalite Garantili"
      }
    },
    noResults: {
      description: "Eşleşen parça bulamadık",
      suggestion1: "Arama teriminizin yazımını kontrol edin",
      suggestion2: "Farklı bir parça numarası formatı deneyin",
      suggestion3: "Daha az veya daha genel anahtar kelimeler kullanın",
      suggestion4: "Aramayı genişletmek için filtreleri temizleyin"
    },
    excel: {
      aiExtract: "YZ herhangi bir formattan parçaları akıllıca çıkaracaktır",
      fileHint: ".xlsx, .xls, .csv destekler • Maks 10MB • Maks 5.000 satır • Arama başına maks 1.000 parça",
      formatHint: "Herhangi bir formatla çalışır, ancak yapılandırılmış veriler daha iyi sonuçlar verir",
      sampleHint: "Herhangi bir formatla çalışır, ancak yapılandırılmış veriler daha iyi sonuçlar verir",
      downloadSample: "Örnek Şablon İndir",
      fileTooLarge: "Dosya Çok Büyük",
      readingData: "Elektronik tablo verileri okunuyor",
      detectingParts: "Parça numaraları algılanıyor",
      extractingData: "Miktarlar ve markalar çıkarılıyor",
      extractingQty: "Miktarlar ve markalar çıkarılıyor",
      validating: "Doğrulama ve düzenleme",
      partsReady: "Aramaya hazır 25 parça bulundu",
      foundParts: "Aramaya hazır {count} parça bulundu",
      aiPowered: "YZ Destekli",
      dataQuality: "Veri Kalitesi:",
      qualityGood: "İyi",
      selectFirst1000: "İlk 1.000'i Seç",
      partsSelected: "0 parça seçildi",
      all: "Tümü",
      highConfidence: "Yüksek Güven",
      medium: "Orta",
      low: "Düşük",
      importAnalytics: "İçe Aktarma Analizi",
      totalParts: "Toplam Parça",
      found: "Bulundu",
      notFound: "Bulunamadı",
      duplicates: "Yinelemeler",
      notCounted: "Sayılmadı",
      successRate: "Başarı Oranı",
      partsNotFound: "Parça Bulunamadı",
      duplicatesDetected: "Yinelenen parçalar algılandı ve birleştirildi",
      searchResultsTitle: "Arama Sonuçları ve YZ Önerileri",
      foundOptions: "25 parça için seçenekler bulundu",
      backToParts: "Parçalara Dön",
      uploadNewFile: "Yeni Dosya Yükle"
    }
  },
  zh: {
    header: { addToCartCount: "添加到购物车" },
    emptyState: {
      features: {
        verifiedSuppliers: "验证供应商",
        globalNetwork: "全球网络",
        fastDelivery: "快速配送",
        qualityGuaranteed: "品质保证"
      }
    },
    noResults: {
      description: "我们找不到匹配的零件",
      suggestion1: "检查搜索词的拼写",
      suggestion2: "尝试使用不同的零件号格式",
      suggestion3: "使用更少或更通用的关键词",
      suggestion4: "清除筛选以扩大搜索范围"
    },
    excel: {
      aiExtract: "AI将智能地从任何格式中提取零件",
      fileHint: "支持.xlsx, .xls, .csv • 最大10MB • 最多5,000行 • 每次搜索最多1,000个零件",
      formatHint: "适用于任何格式，但结构化数据可提供更好的结果",
      sampleHint: "适用于任何格式，但结构化数据可提供更好的结果",
      downloadSample: "下载示例模板",
      fileTooLarge: "文件太大",
      readingData: "正在读取电子表格数据",
      detectingParts: "正在检测零件号",
      extractingData: "正在提取数量和品牌",
      extractingQty: "正在提取数量和品牌",
      validating: "正在验证和整理",
      partsReady: "找到25个零件可供搜索",
      foundParts: "找到{count}个零件可供搜索",
      aiPowered: "AI驱动",
      dataQuality: "数据质量:",
      qualityGood: "良好",
      selectFirst1000: "选择前1,000个",
      partsSelected: "已选择0个零件",
      all: "全部",
      highConfidence: "高可信度",
      medium: "中等",
      low: "低",
      importAnalytics: "导入分析",
      totalParts: "零件总数",
      found: "已找到",
      notFound: "未找到",
      duplicates: "重复项",
      notCounted: "未计数",
      successRate: "成功率",
      partsNotFound: "未找到零件",
      duplicatesDetected: "检测到重复零件并已合并",
      searchResultsTitle: "搜索结果和AI推荐",
      foundOptions: "找到25个零件的选项",
      backToParts: "返回零件",
      uploadNewFile: "上传新文件"
    }
  }
};

// Deep merge function
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Main function
function fixTranslations() {
  const localesDir = './locales';
  const languages = ['ar', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'tr', 'ua', 'zh'];
  
  for (const lang of languages) {
    const filePath = path.join(localesDir, lang, 'translation.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let modified = false;
    
    // 1. Add quickSearch section
    if (quickSearchTranslations[lang]) {
      if (!data.quickSearch) data.quickSearch = {};
      for (const [key, value] of Object.entries(quickSearchTranslations[lang])) {
        if (!data.quickSearch[key]) {
          data.quickSearch[key] = value;
          modified = true;
        }
      }
    }
    
    // 2. Add searchResults extra keys for it, ja, ko, nl, pl, pt, tr, zh
    if (searchResultsExtraTranslations[lang]) {
      if (!data.searchResults) data.searchResults = {};
      deepMerge(data.searchResults, searchResultsExtraTranslations[lang]);
      modified = true;
    }
    
    // Save if modified
    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✓ Updated ${lang}`);
    } else {
      console.log(`○ ${lang} - no changes needed`);
    }
  }
  
  console.log('\n✓ All translations fixed!');
}

fixTranslations();
