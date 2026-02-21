const fs = require('fs');
const path = require('path');

// Tickets create translations for ALL languages
const ticketsCreateTranslations = {
  ar: {
    badge: "مركز الدعم",
    backToTickets: "العودة إلى التذاكر",
    cardTitle: "معلومات التذكرة",
    cardSubtitle: "يرجى تقديم تفاصيل حول مشكلتك",
    category: "الفئة",
    required: "*",
    optional: "(اختياري)",
    selectCategoryPlaceholder: "اختر فئة",
    categoryHint: "اختر الفئة التي تصف مشكلتك بشكل أفضل",
    relatedOrder: "الطلب المتعلق",
    noSpecificOrder: "لا يوجد طلب محدد",
    orderHint: "اختر طلباً إذا كانت هذه المشكلة متعلقة بطلب معين",
    orderHintRecommended: "موصى به: اختر الطلب ذا الصلة لحل أسرع",
    subject: "الموضوع",
    subjectPlaceholder: "وصف موجز لمشكلتك",
    subjectHint: "قدم ملخصاً واضحاً وموجزاً لمشكلتك",
    description: "الوصف",
    descriptionPlaceholder: "يرجى تقديم معلومات مفصلة عن مشكلتك...",
    descriptionHint: "قم بتضمين أكبر قدر ممكن من التفاصيل لمساعدتنا في حل مشكلتك بسرعة",
    attachmentsLabel: "المرفقات",
    clickToUpload: "انقر للتحميل",
    orDragDrop: "أو اسحب وأفلت",
    fileTypes: "PNG, JPG, PDF حتى 10 ميجابايت لكل ملف",
    cancel: "إلغاء",
    submit: "إرسال التذكرة",
    helpTitle: "هل تحتاج مساعدة فورية؟",
    helpText: "للأمور العاجلة، يمكنك أيضاً التواصل معنا مباشرة:",
    describeIssue: "صف مشكلتك"
  },
  de: {
    badge: "Support-Center",
    backToTickets: "Zurück zu Tickets",
    cardTitle: "Ticket-Informationen",
    cardSubtitle: "Bitte geben Sie Details zu Ihrem Problem an",
    category: "Kategorie",
    required: "*",
    optional: "(Optional)",
    selectCategoryPlaceholder: "Kategorie auswählen",
    categoryHint: "Wählen Sie die Kategorie, die Ihr Problem am besten beschreibt",
    relatedOrder: "Zugehörige Bestellung",
    noSpecificOrder: "Keine spezifische Bestellung",
    orderHint: "Wählen Sie eine Bestellung, wenn dieses Problem mit einer bestimmten Bestellung zusammenhängt",
    orderHintRecommended: "Empfohlen: Wählen Sie die zugehörige Bestellung für schnellere Lösung",
    subject: "Betreff",
    subjectPlaceholder: "Kurze Beschreibung Ihres Problems",
    subjectHint: "Geben Sie eine klare, prägnante Zusammenfassung Ihres Problems an",
    description: "Beschreibung",
    descriptionPlaceholder: "Bitte geben Sie detaillierte Informationen zu Ihrem Problem an...",
    descriptionHint: "Fügen Sie so viele Details wie möglich hinzu, um uns bei der schnellen Lösung zu helfen",
    attachmentsLabel: "Anhänge",
    clickToUpload: "Klicken zum Hochladen",
    orDragDrop: "oder Drag & Drop",
    fileTypes: "PNG, JPG, PDF bis zu 10MB pro Datei",
    cancel: "Abbrechen",
    submit: "Ticket einreichen",
    helpTitle: "Sofortige Hilfe benötigt?",
    helpText: "Für dringende Angelegenheiten erreichen Sie uns auch direkt:",
    describeIssue: "Beschreiben Sie Ihr Problem"
  },
  es: {
    badge: "Centro de Soporte",
    backToTickets: "Volver a Tickets",
    cardTitle: "Información del Ticket",
    cardSubtitle: "Por favor proporcione detalles sobre su problema",
    category: "Categoría",
    required: "*",
    optional: "(Opcional)",
    selectCategoryPlaceholder: "Seleccionar categoría",
    categoryHint: "Elija la categoría que mejor describa su problema",
    relatedOrder: "Pedido Relacionado",
    noSpecificOrder: "Sin pedido específico",
    orderHint: "Seleccione un pedido si este problema está relacionado con un pedido específico",
    orderHintRecommended: "Recomendado: Seleccione el pedido relacionado para una resolución más rápida",
    subject: "Asunto",
    subjectPlaceholder: "Breve descripción de su problema",
    subjectHint: "Proporcione un resumen claro y conciso de su problema",
    description: "Descripción",
    descriptionPlaceholder: "Por favor proporcione información detallada sobre su problema...",
    descriptionHint: "Incluya tantos detalles como sea posible para ayudarnos a resolver su problema rápidamente",
    attachmentsLabel: "Archivos Adjuntos",
    clickToUpload: "Haga clic para cargar",
    orDragDrop: "o arrastre y suelte",
    fileTypes: "PNG, JPG, PDF hasta 10MB cada uno",
    cancel: "Cancelar",
    submit: "Enviar Ticket",
    helpTitle: "¿Necesita Asistencia Inmediata?",
    helpText: "Para asuntos urgentes, también puede contactarnos directamente:",
    describeIssue: "Describa su problema"
  },
  fr: {
    badge: "Centre de Support",
    backToTickets: "Retour aux Tickets",
    cardTitle: "Informations du Ticket",
    cardSubtitle: "Veuillez fournir des détails sur votre problème",
    category: "Catégorie",
    required: "*",
    optional: "(Optionnel)",
    selectCategoryPlaceholder: "Sélectionner une catégorie",
    categoryHint: "Choisissez la catégorie qui décrit le mieux votre problème",
    relatedOrder: "Commande Associée",
    noSpecificOrder: "Pas de commande spécifique",
    orderHint: "Sélectionnez une commande si ce problème concerne une commande spécifique",
    orderHintRecommended: "Recommandé: Sélectionnez la commande associée pour une résolution plus rapide",
    subject: "Sujet",
    subjectPlaceholder: "Brève description de votre problème",
    subjectHint: "Fournissez un résumé clair et concis de votre problème",
    description: "Description",
    descriptionPlaceholder: "Veuillez fournir des informations détaillées sur votre problème...",
    descriptionHint: "Incluez autant de détails que possible pour nous aider à résoudre rapidement",
    attachmentsLabel: "Pièces Jointes",
    clickToUpload: "Cliquez pour télécharger",
    orDragDrop: "ou glisser-déposer",
    fileTypes: "PNG, JPG, PDF jusqu'à 10Mo chacun",
    cancel: "Annuler",
    submit: "Soumettre le Ticket",
    helpTitle: "Besoin d'une Assistance Immédiate?",
    helpText: "Pour les urgences, vous pouvez aussi nous contacter directement:",
    describeIssue: "Décrivez votre problème"
  },
  it: {
    badge: "Centro Supporto",
    backToTickets: "Torna ai Ticket",
    cardTitle: "Informazioni Ticket",
    cardSubtitle: "Fornisci dettagli sul tuo problema",
    category: "Categoria",
    required: "*",
    optional: "(Opzionale)",
    selectCategoryPlaceholder: "Seleziona categoria",
    categoryHint: "Scegli la categoria che descrive meglio il tuo problema",
    relatedOrder: "Ordine Correlato",
    noSpecificOrder: "Nessun ordine specifico",
    orderHint: "Seleziona un ordine se questo problema è relativo a un ordine specifico",
    orderHintRecommended: "Consigliato: Seleziona l'ordine correlato per una risoluzione più rapida",
    subject: "Oggetto",
    subjectPlaceholder: "Breve descrizione del problema",
    subjectHint: "Fornisci un riepilogo chiaro e conciso del tuo problema",
    description: "Descrizione",
    descriptionPlaceholder: "Fornisci informazioni dettagliate sul tuo problema...",
    descriptionHint: "Includi quanti più dettagli possibile per aiutarci a risolvere rapidamente",
    attachmentsLabel: "Allegati",
    clickToUpload: "Clicca per caricare",
    orDragDrop: "o trascina e rilascia",
    fileTypes: "PNG, JPG, PDF fino a 10MB ciascuno",
    cancel: "Annulla",
    submit: "Invia Ticket",
    helpTitle: "Hai Bisogno di Assistenza Immediata?",
    helpText: "Per questioni urgenti, puoi contattarci direttamente:",
    describeIssue: "Descrivi il tuo problema"
  },
  ja: {
    badge: "サポートセンター",
    backToTickets: "チケット一覧に戻る",
    cardTitle: "チケット情報",
    cardSubtitle: "問題の詳細をお知らせください",
    category: "カテゴリ",
    required: "*",
    optional: "(任意)",
    selectCategoryPlaceholder: "カテゴリを選択",
    categoryHint: "問題を最もよく説明するカテゴリを選択してください",
    relatedOrder: "関連注文",
    noSpecificOrder: "特定の注文なし",
    orderHint: "この問題が特定の注文に関連する場合は注文を選択してください",
    orderHintRecommended: "推奨：迅速な解決のために関連する注文を選択してください",
    subject: "件名",
    subjectPlaceholder: "問題の簡単な説明",
    subjectHint: "問題の明確で簡潔な要約を入力してください",
    description: "説明",
    descriptionPlaceholder: "問題の詳細情報を入力してください...",
    descriptionHint: "迅速な解決のためできるだけ詳しく記載してください",
    attachmentsLabel: "添付ファイル",
    clickToUpload: "クリックしてアップロード",
    orDragDrop: "またはドラッグ＆ドロップ",
    fileTypes: "PNG, JPG, PDF 各10MBまで",
    cancel: "キャンセル",
    submit: "チケット送信",
    helpTitle: "すぐにサポートが必要ですか？",
    helpText: "緊急の場合は直接お問い合わせください：",
    describeIssue: "問題を説明してください"
  },
  ko: {
    badge: "지원 센터",
    backToTickets: "티켓 목록으로",
    cardTitle: "티켓 정보",
    cardSubtitle: "문제에 대한 세부 정보를 제공해 주세요",
    category: "카테고리",
    required: "*",
    optional: "(선택사항)",
    selectCategoryPlaceholder: "카테고리 선택",
    categoryHint: "문제를 가장 잘 설명하는 카테고리를 선택하세요",
    relatedOrder: "관련 주문",
    noSpecificOrder: "특정 주문 없음",
    orderHint: "이 문제가 특정 주문과 관련된 경우 주문을 선택하세요",
    orderHintRecommended: "권장: 빠른 해결을 위해 관련 주문을 선택하세요",
    subject: "제목",
    subjectPlaceholder: "문제에 대한 간단한 설명",
    subjectHint: "문제에 대한 명확하고 간결한 요약을 제공하세요",
    description: "설명",
    descriptionPlaceholder: "문제에 대한 자세한 정보를 제공해 주세요...",
    descriptionHint: "빠른 해결을 위해 가능한 많은 세부 정보를 포함하세요",
    attachmentsLabel: "첨부 파일",
    clickToUpload: "클릭하여 업로드",
    orDragDrop: "또는 드래그 앤 드롭",
    fileTypes: "PNG, JPG, PDF 각각 최대 10MB",
    cancel: "취소",
    submit: "티켓 제출",
    helpTitle: "즉각적인 도움이 필요하신가요?",
    helpText: "긴급한 문제의 경우 직접 연락하실 수 있습니다:",
    describeIssue: "문제를 설명해 주세요"
  },
  nl: {
    badge: "Ondersteuningscentrum",
    backToTickets: "Terug naar Tickets",
    cardTitle: "Ticketinformatie",
    cardSubtitle: "Geef details over uw probleem",
    category: "Categorie",
    required: "*",
    optional: "(Optioneel)",
    selectCategoryPlaceholder: "Selecteer categorie",
    categoryHint: "Kies de categorie die uw probleem het beste beschrijft",
    relatedOrder: "Gerelateerde Bestelling",
    noSpecificOrder: "Geen specifieke bestelling",
    orderHint: "Selecteer een bestelling als dit probleem gerelateerd is aan een specifieke bestelling",
    orderHintRecommended: "Aanbevolen: Selecteer de gerelateerde bestelling voor snellere oplossing",
    subject: "Onderwerp",
    subjectPlaceholder: "Korte beschrijving van uw probleem",
    subjectHint: "Geef een duidelijke, beknopte samenvatting van uw probleem",
    description: "Beschrijving",
    descriptionPlaceholder: "Geef gedetailleerde informatie over uw probleem...",
    descriptionHint: "Voeg zoveel mogelijk details toe om ons te helpen snel op te lossen",
    attachmentsLabel: "Bijlagen",
    clickToUpload: "Klik om te uploaden",
    orDragDrop: "of sleep en zet neer",
    fileTypes: "PNG, JPG, PDF tot 10MB elk",
    cancel: "Annuleren",
    submit: "Ticket Indienen",
    helpTitle: "Direct Hulp Nodig?",
    helpText: "Voor dringende zaken kunt u ons ook rechtstreeks bereiken:",
    describeIssue: "Beschrijf uw probleem"
  },
  pl: {
    badge: "Centrum Wsparcia",
    backToTickets: "Powrót do Zgłoszeń",
    cardTitle: "Informacje o Zgłoszeniu",
    cardSubtitle: "Podaj szczegóły dotyczące problemu",
    category: "Kategoria",
    required: "*",
    optional: "(Opcjonalnie)",
    selectCategoryPlaceholder: "Wybierz kategorię",
    categoryHint: "Wybierz kategorię najlepiej opisującą problem",
    relatedOrder: "Powiązane Zamówienie",
    noSpecificOrder: "Brak konkretnego zamówienia",
    orderHint: "Wybierz zamówienie, jeśli problem dotyczy konkretnego zamówienia",
    orderHintRecommended: "Zalecane: Wybierz powiązane zamówienie dla szybszego rozwiązania",
    subject: "Temat",
    subjectPlaceholder: "Krótki opis problemu",
    subjectHint: "Podaj jasne i zwięzłe podsumowanie problemu",
    description: "Opis",
    descriptionPlaceholder: "Podaj szczegółowe informacje o problemie...",
    descriptionHint: "Dołącz jak najwięcej szczegółów, aby pomóc nam szybko rozwiązać problem",
    attachmentsLabel: "Załączniki",
    clickToUpload: "Kliknij, aby przesłać",
    orDragDrop: "lub przeciągnij i upuść",
    fileTypes: "PNG, JPG, PDF do 10MB każdy",
    cancel: "Anuluj",
    submit: "Wyślij Zgłoszenie",
    helpTitle: "Potrzebujesz Natychmiastowej Pomocy?",
    helpText: "W pilnych sprawach możesz się z nami skontaktować bezpośrednio:",
    describeIssue: "Opisz swój problem"
  },
  pt: {
    badge: "Central de Suporte",
    backToTickets: "Voltar para Tickets",
    cardTitle: "Informações do Ticket",
    cardSubtitle: "Forneça detalhes sobre seu problema",
    category: "Categoria",
    required: "*",
    optional: "(Opcional)",
    selectCategoryPlaceholder: "Selecionar categoria",
    categoryHint: "Escolha a categoria que melhor descreve seu problema",
    relatedOrder: "Pedido Relacionado",
    noSpecificOrder: "Sem pedido específico",
    orderHint: "Selecione um pedido se este problema estiver relacionado a um pedido específico",
    orderHintRecommended: "Recomendado: Selecione o pedido relacionado para resolução mais rápida",
    subject: "Assunto",
    subjectPlaceholder: "Breve descrição do seu problema",
    subjectHint: "Forneça um resumo claro e conciso do seu problema",
    description: "Descrição",
    descriptionPlaceholder: "Forneça informações detalhadas sobre seu problema...",
    descriptionHint: "Inclua o máximo de detalhes possível para nos ajudar a resolver rapidamente",
    attachmentsLabel: "Anexos",
    clickToUpload: "Clique para enviar",
    orDragDrop: "ou arraste e solte",
    fileTypes: "PNG, JPG, PDF até 10MB cada",
    cancel: "Cancelar",
    submit: "Enviar Ticket",
    helpTitle: "Precisa de Assistência Imediata?",
    helpText: "Para assuntos urgentes, você também pode nos contatar diretamente:",
    describeIssue: "Descreva seu problema"
  },
  ru: {
    badge: "Центр Поддержки",
    backToTickets: "Назад к Заявкам",
    cardTitle: "Информация о Заявке",
    cardSubtitle: "Пожалуйста, укажите детали вашей проблемы",
    category: "Категория",
    required: "*",
    optional: "(Необязательно)",
    selectCategoryPlaceholder: "Выберите категорию",
    categoryHint: "Выберите категорию, которая лучше всего описывает вашу проблему",
    relatedOrder: "Связанный заказ",
    noSpecificOrder: "Нет конкретного заказа",
    orderHint: "Выберите заказ, если эта проблема связана с конкретным заказом",
    orderHintRecommended: "Рекомендуется: Выберите связанный заказ для более быстрого решения",
    subject: "Тема",
    subjectPlaceholder: "Краткое описание проблемы",
    subjectHint: "Предоставьте четкое и краткое описание вашей проблемы",
    description: "Описание",
    descriptionPlaceholder: "Пожалуйста, предоставьте подробную информацию о вашей проблеме...",
    descriptionHint: "Включите как можно больше деталей, чтобы помочь нам быстро решить проблему",
    attachmentsLabel: "Вложения",
    clickToUpload: "Нажмите для загрузки",
    orDragDrop: "или перетащите",
    fileTypes: "PNG, JPG, PDF до 10МБ каждый",
    cancel: "Отмена",
    submit: "Отправить Заявку",
    helpTitle: "Нужна Срочная Помощь?",
    helpText: "Для срочных вопросов вы также можете связаться с нами напрямую:",
    describeIssue: "Опишите вашу проблему"
  },
  tr: {
    badge: "Destek Merkezi",
    backToTickets: "Biletlere Dön",
    cardTitle: "Bilet Bilgileri",
    cardSubtitle: "Lütfen sorununuz hakkında detay verin",
    category: "Kategori",
    required: "*",
    optional: "(İsteğe bağlı)",
    selectCategoryPlaceholder: "Kategori seçin",
    categoryHint: "Sorununuzu en iyi tanımlayan kategoriyi seçin",
    relatedOrder: "İlgili Sipariş",
    noSpecificOrder: "Belirli bir sipariş yok",
    orderHint: "Bu sorun belirli bir siparişle ilgiliyse sipariş seçin",
    orderHintRecommended: "Önerilir: Daha hızlı çözüm için ilgili siparişi seçin",
    subject: "Konu",
    subjectPlaceholder: "Sorununuzun kısa açıklaması",
    subjectHint: "Sorununuzun net ve kısa bir özetini verin",
    description: "Açıklama",
    descriptionPlaceholder: "Lütfen sorununuz hakkında detaylı bilgi verin...",
    descriptionHint: "Hızlı çözüm için mümkün olduğunca fazla detay ekleyin",
    attachmentsLabel: "Ekler",
    clickToUpload: "Yüklemek için tıklayın",
    orDragDrop: "veya sürükle bırak",
    fileTypes: "PNG, JPG, PDF her biri 10MB'a kadar",
    cancel: "İptal",
    submit: "Bileti Gönder",
    helpTitle: "Hemen Yardım Gerekiyor mu?",
    helpText: "Acil durumlar için bize doğrudan ulaşabilirsiniz:",
    describeIssue: "Sorununuzu açıklayın"
  },
  ua: {
    badge: "Центр Підтримки",
    backToTickets: "Назад до Заявок",
    cardTitle: "Інформація про Заявку",
    cardSubtitle: "Будь ласка, вкажіть деталі вашої проблеми",
    category: "Категорія",
    required: "*",
    optional: "(Необов'язково)",
    selectCategoryPlaceholder: "Оберіть категорію",
    categoryHint: "Оберіть категорію, яка найкраще описує вашу проблему",
    relatedOrder: "Пов'язане замовлення",
    noSpecificOrder: "Немає конкретного замовлення",
    orderHint: "Оберіть замовлення, якщо ця проблема пов'язана з конкретним замовленням",
    orderHintRecommended: "Рекомендовано: Оберіть пов'язане замовлення для швидшого вирішення",
    subject: "Тема",
    subjectPlaceholder: "Короткий опис проблеми",
    subjectHint: "Надайте чіткий і короткий опис вашої проблеми",
    description: "Опис",
    descriptionPlaceholder: "Будь ласка, надайте детальну інформацію про вашу проблему...",
    descriptionHint: "Включіть якомога більше деталей, щоб допомогти нам швидко вирішити проблему",
    attachmentsLabel: "Вкладення",
    clickToUpload: "Натисніть для завантаження",
    orDragDrop: "або перетягніть",
    fileTypes: "PNG, JPG, PDF до 10МБ кожен",
    cancel: "Скасувати",
    submit: "Надіслати Заявку",
    helpTitle: "Потрібна Термінова Допомога?",
    helpText: "Для термінових питань ви також можете зв'язатися з нами напряму:",
    describeIssue: "Опишіть вашу проблему"
  },
  zh: {
    badge: "支持中心",
    backToTickets: "返回工单",
    cardTitle: "工单信息",
    cardSubtitle: "请提供您问题的详细信息",
    category: "类别",
    required: "*",
    optional: "(可选)",
    selectCategoryPlaceholder: "选择类别",
    categoryHint: "选择最能描述您问题的类别",
    relatedOrder: "相关订单",
    noSpecificOrder: "无特定订单",
    orderHint: "如果此问题与特定订单相关，请选择订单",
    orderHintRecommended: "建议：选择相关订单以更快解决",
    subject: "主题",
    subjectPlaceholder: "问题的简短描述",
    subjectHint: "提供清晰简洁的问题摘要",
    description: "描述",
    descriptionPlaceholder: "请提供有关您问题的详细信息...",
    descriptionHint: "包含尽可能多的细节以帮助我们快速解决问题",
    attachmentsLabel: "附件",
    clickToUpload: "点击上传",
    orDragDrop: "或拖放",
    fileTypes: "PNG, JPG, PDF 每个最大10MB",
    cancel: "取消",
    submit: "提交工单",
    helpTitle: "需要即时帮助？",
    helpText: "对于紧急事项，您也可以直接联系我们：",
    describeIssue: "描述您的问题"
  }
};

// Missing tickets base keys for es, fr, ru, ua
const ticketsBaseTranslations = {
  es: {
    ticketNumber: "Número de Ticket",
    subject: "Asunto",
    category: "Categoría",
    priority: "Prioridad",
    status: "Estado",
    created: "Creado",
    updated: "Actualizado",
    noTickets: "No se encontraron tickets"
  },
  fr: {
    ticketNumber: "Numéro de Ticket",
    subject: "Sujet",
    category: "Catégorie",
    priority: "Priorité",
    status: "Statut",
    created: "Créé",
    updated: "Mis à jour",
    noTickets: "Aucun ticket trouvé"
  },
  ru: {
    ticketNumber: "Номер Заявки",
    subject: "Тема",
    category: "Категория",
    priority: "Приоритет",
    status: "Статус",
    created: "Создано",
    updated: "Обновлено",
    noTickets: "Заявки не найдены"
  },
  ua: {
    ticketNumber: "Номер Заявки",
    subject: "Тема",
    category: "Категорія",
    priority: "Пріоритет",
    status: "Статус",
    created: "Створено",
    updated: "Оновлено",
    noTickets: "Заявки не знайдено"
  }
};

// Missing tickets.details keys for es, fr, ru, ua
const ticketsDetailsExtraTranslations = {
  es: { messages: "Mensajes", attachments: "Archivos Adjuntos", addAttachment: "Agregar Adjunto" },
  fr: { messages: "Messages", attachments: "Pièces Jointes", addAttachment: "Ajouter Pièce Jointe" },
  ru: { messages: "Сообщения", attachments: "Вложения", addAttachment: "Добавить Вложение" },
  ua: { messages: "Повідомлення", attachments: "Вкладення", addAttachment: "Додати Вкладення" }
};

// Contacts badge and website for es, fr, ru, ua
const contactsExtraTranslations = {
  es: { badge: "Soporte 24/7", website: "Sitio Web" },
  fr: { badge: "Support 24/7", website: "Site Web" },
  ru: { badge: "Поддержка 24/7", website: "Сайт" },
  ua: { badge: "Підтримка 24/7", website: "Сайт" }
};

// Footer translations for ALL languages
const footerTranslations = {
  ar: {
    tagline: "منصة التوريد العالمية",
    description: "ربط المصنعين مع الموردين المعتمدين في أكثر من 40 دولة. مصممة للمؤسسات الكبيرة ومهندسة للدقة.",
    platform: "المنصة",
    main: "الرئيسية",
    sectors: "القطاعات",
    allSectors: "جميع القطاعات",
    oemParts: "قطع OEM",
    aftermarketParts: "قطع ما بعد البيع",
    performanceParts: "قطع الأداء",
    company: "الشركة",
    support: "الدعم",
    aboutUs: "من نحن",
    helpCenter: "مركز المساعدة",
    resources: "الموارد",
    documentation: "التوثيق",
    apiReference: "مرجع API",
    blog: "المدونة",
    faq: "الأسئلة الشائعة",
    copyright: "جميع الحقوق محفوظة",
    privacyPolicy: "سياسة الخصوصية",
    termsOfService: "شروط الخدمة",
    cookiePolicy: "سياسة ملفات تعريف الارتباط"
  },
  de: {
    oemParts: "OEM-Teile",
    aftermarketParts: "Aftermarket-Teile",
    performanceParts: "Leistungsteile"
  },
  es: {
    tagline: "Plataforma de Abastecimiento Global",
    description: "Conectando fabricantes con proveedores verificados en más de 40 países. Construida para escala empresarial, diseñada para precisión.",
    platform: "Plataforma",
    main: "Principal",
    sectors: "Sectores",
    allSectors: "Todos los Sectores",
    oemParts: "Piezas OEM",
    aftermarketParts: "Piezas de Repuesto",
    performanceParts: "Piezas de Rendimiento",
    company: "Empresa",
    support: "Soporte",
    aboutUs: "Sobre Nosotros",
    helpCenter: "Centro de Ayuda",
    resources: "Recursos",
    documentation: "Documentación",
    apiReference: "Referencia API",
    blog: "Blog",
    faq: "Preguntas Frecuentes",
    copyright: "Todos los derechos reservados",
    privacyPolicy: "Política de Privacidad",
    termsOfService: "Términos de Servicio",
    cookiePolicy: "Política de Cookies"
  },
  fr: {
    tagline: "Plateforme d'Approvisionnement Mondiale",
    description: "Connecter les fabricants avec des fournisseurs vérifiés dans plus de 40 pays. Conçue pour l'échelle entreprise, conçue pour la précision.",
    platform: "Plateforme",
    main: "Principal",
    sectors: "Secteurs",
    allSectors: "Tous les Secteurs",
    oemParts: "Pièces OEM",
    aftermarketParts: "Pièces de Rechange",
    performanceParts: "Pièces de Performance",
    company: "Entreprise",
    support: "Support",
    aboutUs: "À Propos",
    helpCenter: "Centre d'Aide",
    resources: "Ressources",
    documentation: "Documentation",
    apiReference: "Référence API",
    blog: "Blog",
    faq: "FAQ",
    copyright: "Tous droits réservés",
    privacyPolicy: "Politique de Confidentialité",
    termsOfService: "Conditions d'Utilisation",
    cookiePolicy: "Politique de Cookies"
  },
  it: {
    oemParts: "Parti OEM",
    aftermarketParts: "Parti Aftermarket",
    performanceParts: "Parti Performance"
  },
  ja: {
    oemParts: "OEM部品",
    aftermarketParts: "アフターマーケット部品",
    performanceParts: "パフォーマンス部品"
  },
  ko: {
    oemParts: "OEM 부품",
    aftermarketParts: "애프터마켓 부품",
    performanceParts: "성능 부품"
  },
  nl: {
    oemParts: "OEM Onderdelen",
    aftermarketParts: "Aftermarket Onderdelen",
    performanceParts: "Prestatie Onderdelen"
  },
  pl: {
    oemParts: "Części OEM",
    aftermarketParts: "Części Aftermarket",
    performanceParts: "Części Wydajnościowe"
  },
  pt: {
    oemParts: "Peças OEM",
    aftermarketParts: "Peças Aftermarket",
    performanceParts: "Peças de Performance"
  },
  ru: {
    tagline: "Глобальная Платформа Снабжения",
    description: "Связываем производителей с проверенными поставщиками в более чем 40 странах. Создана для масштаба предприятия, спроектирована для точности.",
    platform: "Платформа",
    main: "Главная",
    sectors: "Секторы",
    allSectors: "Все Секторы",
    oemParts: "OEM Запчасти",
    aftermarketParts: "Запчасти Aftermarket",
    performanceParts: "Тюнинг Запчасти",
    company: "Компания",
    support: "Поддержка",
    aboutUs: "О Нас",
    helpCenter: "Центр Помощи",
    resources: "Ресурсы",
    documentation: "Документация",
    apiReference: "API Справка",
    blog: "Блог",
    faq: "ЧаВо",
    copyright: "Все права защищены",
    privacyPolicy: "Политика Конфиденциальности",
    termsOfService: "Условия Использования",
    cookiePolicy: "Политика Cookies"
  },
  tr: {
    oemParts: "OEM Parçalar",
    aftermarketParts: "Yedek Parçalar",
    performanceParts: "Performans Parçaları"
  },
  ua: {
    tagline: "Глобальна Платформа Постачання",
    description: "Зв'язуємо виробників з перевіреними постачальниками в понад 40 країнах. Створена для масштабу підприємства, спроектована для точності.",
    platform: "Платформа",
    main: "Головна",
    sectors: "Сектори",
    allSectors: "Всі Сектори",
    oemParts: "OEM Запчастини",
    aftermarketParts: "Запчастини Aftermarket",
    performanceParts: "Тюнінг Запчастини",
    company: "Компанія",
    support: "Підтримка",
    aboutUs: "Про Нас",
    helpCenter: "Центр Допомоги",
    resources: "Ресурси",
    documentation: "Документація",
    apiReference: "API Довідка",
    blog: "Блог",
    faq: "ЧаПи",
    copyright: "Всі права захищені",
    privacyPolicy: "Політика Конфіденційності",
    termsOfService: "Умови Використання",
    cookiePolicy: "Політика Cookies"
  },
  zh: {
    oemParts: "OEM零件",
    aftermarketParts: "售后零件",
    performanceParts: "性能零件"
  }
};

// SearchResults translations
const searchResultsTranslations = {
  it: {
    filters: {
      title: "Filtri",
      subtitle: "Affina i risultati della ricerca",
      clearAll: "Cancella Tutto",
      filterByResults: "Filtra per Risultati",
      partsFound: "parti trovate",
      priceRange: "Fascia di Prezzo",
      min: "Min",
      max: "Max",
      stockCode: "Codice Stock",
      allStockCodes: "Tutti i Codici",
      brand: "Marca",
      searchBrands: "Cerca marche...",
      allBrands: "Tutte le Marche",
      showMore: "Mostra di più",
      deliveryTime: "Tempo di Consegna",
      days: "giorni",
      express: "Express (1-2 giorni)",
      fast: "Veloce (3-5 giorni)",
      standard: "Standard (7-14 giorni)",
      availableQty: "Quantità Disponibile",
      units: "unità",
      minAvailable: "Minimo Disponibile",
      weight: "Peso",
      matching: "Corrispondenti:",
      parts: "parti",
      reset: "Reimposta",
      applyFilters: "Applica Filtri"
    },
    header: {
      found: "Trovati",
      partsMatching: "parti corrispondenti alla tua ricerca",
      selectItems: "Seleziona articoli da aggiungere al carrello",
      selected: "Selezionati",
      selectedTotal: "Totale Selezionato",
      addToCart: "Aggiungi al Carrello",
      filters: "Filtri"
    },
    sort: {
      sortBy: "Ordina per:",
      relevance: "Rilevanza",
      cheapest: "Più Economico",
      expensive: "Più Costoso",
      fastestDelivery: "Consegna Più Veloce",
      mostStock: "Più Disponibile",
      inStockOnly: "Solo Disponibili",
      lowStock: "Basso Stock"
    },
    table: {
      select: "SELEZIONA",
      brand: "MARCA",
      vendorCode: "CODICE FORNITORE",
      description: "DESCRIZIONE",
      qty: "QTÀ",
      stockCode: "CODICE",
      volume: "VOLUME",
      weight: "PESO",
      delivery: "CONSEGNA",
      orderQty: "QTÀ ORDINE",
      total: "TOTALE"
    },
    footer: {
      addSelectedToCart: "Aggiungi Selezionati al Carrello",
      selectedTotal: "TOTALE SELEZIONATO:"
    },
    emptyState: {
      title: "Inizia la Ricerca",
      description: "Inserisci numero parte, marca o descrizione per trovare parti dai fornitori verificati.",
      popularSearches: "Ricerche Popolari",
      brakePads: "Pastiglie Freno",
      oilFilter: "Filtro Olio",
      alternator: "Alternatore",
      waterPump: "Pompa Acqua",
      verifiedSuppliers: "Fornitori Verificati",
      globalNetwork: "Rete Globale",
      fastDelivery: "Consegna Veloce",
      qualityGuaranteed: "Qualità Garantita"
    },
    noResults: {
      title: "Nessuna Parte Trovata",
      noPartsFound: "Non abbiamo trovato parti corrispondenti",
      tryDifferent: "Prova un numero parte diverso o contatta il nostro team.",
      tryAgain: "Riprova",
      contactSupport: "Contatta Supporto",
      suggestions: "Suggerimenti:",
      checkSpelling: "Controlla l'ortografia",
      tryDifferentFormat: "Prova un formato diverso",
      useFewerKeywords: "Usa meno parole chiave",
      clearFilters: "Cancella i filtri"
    },
    excel: {
      title: "Importa Excel",
      aiBadge: "IA",
      subtitle: "L'IA analizza il tuo foglio di calcolo per estrarre le parti automaticamente",
      dragDrop: "Trascina e rilascia il tuo file Excel",
      browseFiles: "Sfoglia File",
      supportedFormats: "Supporta .xlsx, .xls, .csv • Max 10MB • Max 5.000 righe",
      analyzing: "L'IA sta analizzando il foglio...",
      analysisComplete: "Analisi Completata!",
      selectAll: "Seleziona Tutto",
      searchParts: "Cerca Parti",
      addToCartBtn: "Aggiungi al Carrello"
    },
    recentSearches: {
      title: "Ricerche Recenti",
      empty: "Nessuna ricerca recente",
      clearHistory: "Cancella Cronologia"
    }
  },
  ja: {
    filters: {
      title: "フィルター",
      subtitle: "検索結果を絞り込む",
      clearAll: "すべてクリア",
      filterByResults: "結果でフィルター",
      partsFound: "件見つかりました",
      priceRange: "価格帯",
      min: "最小",
      max: "最大",
      stockCode: "在庫コード",
      allStockCodes: "すべてのコード",
      brand: "ブランド",
      searchBrands: "ブランド検索...",
      allBrands: "すべてのブランド",
      showMore: "もっと見る",
      deliveryTime: "配送時間",
      days: "日",
      express: "急行 (1-2日)",
      fast: "高速 (3-5日)",
      standard: "標準 (7-14日)",
      availableQty: "利用可能数量",
      units: "単位",
      minAvailable: "最小利用可能",
      weight: "重量",
      matching: "一致:",
      parts: "部品",
      reset: "リセット",
      applyFilters: "フィルターを適用"
    },
    header: {
      found: "見つかりました",
      partsMatching: "検索に一致する部品",
      selectItems: "カートに追加するアイテムを選択",
      selected: "選択済み",
      selectedTotal: "選択合計",
      addToCart: "カートに追加",
      filters: "フィルター"
    },
    sort: {
      sortBy: "並び替え:",
      relevance: "関連性",
      cheapest: "安い順",
      expensive: "高い順",
      fastestDelivery: "最速配送",
      mostStock: "在庫多い順",
      inStockOnly: "在庫ありのみ",
      lowStock: "在庫少"
    },
    table: {
      select: "選択",
      brand: "ブランド",
      vendorCode: "ベンダーコード",
      description: "説明",
      qty: "数量",
      stockCode: "在庫コード",
      volume: "容積",
      weight: "重量",
      delivery: "配送",
      orderQty: "注文数量",
      total: "合計"
    },
    footer: {
      addSelectedToCart: "選択をカートに追加",
      selectedTotal: "選択合計:"
    },
    emptyState: {
      title: "検索を開始",
      description: "部品番号、ブランド名、または説明を入力して世界中の認定サプライヤーから部品を見つけます。",
      popularSearches: "人気の検索",
      brakePads: "ブレーキパッド",
      oilFilter: "オイルフィルター",
      alternator: "オルタネーター",
      waterPump: "ウォーターポンプ",
      verifiedSuppliers: "認定サプライヤー",
      globalNetwork: "グローバルネットワーク",
      fastDelivery: "迅速配送",
      qualityGuaranteed: "品質保証"
    },
    noResults: {
      title: "部品が見つかりません",
      noPartsFound: "一致する部品が見つかりません",
      tryDifferent: "別の部品番号を試すか、チームにお問い合わせください。",
      tryAgain: "再試行",
      contactSupport: "サポートに連絡",
      suggestions: "提案:",
      checkSpelling: "スペルを確認",
      tryDifferentFormat: "別の形式を試す",
      useFewerKeywords: "キーワードを減らす",
      clearFilters: "フィルターをクリア"
    },
    excel: {
      title: "Excelインポート",
      aiBadge: "AI",
      subtitle: "AIがスプレッドシートを分析して部品を自動的に抽出します",
      dragDrop: "Excelファイルをドラッグ＆ドロップ",
      browseFiles: "ファイルを参照",
      supportedFormats: ".xlsx, .xls, .csv対応 • 最大10MB • 最大5,000行",
      analyzing: "AIがシートを分析中...",
      analysisComplete: "分析完了！",
      selectAll: "すべて選択",
      searchParts: "部品を検索",
      addToCartBtn: "カートに追加"
    },
    recentSearches: {
      title: "最近の検索",
      empty: "最近の検索はありません",
      clearHistory: "履歴をクリア"
    }
  },
  ko: {
    filters: {
      title: "필터",
      subtitle: "검색 결과 상세화",
      clearAll: "모두 지우기",
      filterByResults: "결과별 필터",
      partsFound: "개 부품 발견",
      priceRange: "가격 범위",
      min: "최소",
      max: "최대",
      stockCode: "재고 코드",
      allStockCodes: "모든 코드",
      brand: "브랜드",
      searchBrands: "브랜드 검색...",
      allBrands: "모든 브랜드",
      showMore: "더 보기",
      deliveryTime: "배송 시간",
      days: "일",
      express: "익스프레스 (1-2일)",
      fast: "빠른 (3-5일)",
      standard: "표준 (7-14일)",
      availableQty: "가용 수량",
      units: "단위",
      minAvailable: "최소 가용",
      weight: "무게",
      matching: "일치:",
      parts: "부품",
      reset: "초기화",
      applyFilters: "필터 적용"
    },
    header: {
      found: "발견됨",
      partsMatching: "검색과 일치하는 부품",
      selectItems: "장바구니에 추가할 항목 선택",
      selected: "선택됨",
      selectedTotal: "선택 합계",
      addToCart: "장바구니에 추가",
      filters: "필터"
    },
    sort: {
      sortBy: "정렬:",
      relevance: "관련성",
      cheapest: "가장 저렴한",
      expensive: "가장 비싼",
      fastestDelivery: "가장 빠른 배송",
      mostStock: "재고 가장 많은",
      inStockOnly: "재고 있는 것만",
      lowStock: "재고 부족"
    },
    table: {
      select: "선택",
      brand: "브랜드",
      vendorCode: "공급업체 코드",
      description: "설명",
      qty: "수량",
      stockCode: "재고 코드",
      volume: "부피",
      weight: "무게",
      delivery: "배송",
      orderQty: "주문 수량",
      total: "합계"
    },
    footer: {
      addSelectedToCart: "선택 항목 장바구니에 추가",
      selectedTotal: "선택 합계:"
    },
    emptyState: {
      title: "검색 시작",
      description: "부품 번호, 브랜드명 또는 설명을 입력하여 전 세계 검증된 공급업체에서 부품을 찾으세요.",
      popularSearches: "인기 검색어",
      brakePads: "브레이크 패드",
      oilFilter: "오일 필터",
      alternator: "발전기",
      waterPump: "워터 펌프",
      verifiedSuppliers: "검증된 공급업체",
      globalNetwork: "글로벌 네트워크",
      fastDelivery: "빠른 배송",
      qualityGuaranteed: "품질 보증"
    },
    noResults: {
      title: "부품을 찾을 수 없음",
      noPartsFound: "일치하는 부품을 찾을 수 없습니다",
      tryDifferent: "다른 부품 번호를 시도하거나 팀에 문의하세요.",
      tryAgain: "다시 시도",
      contactSupport: "지원 문의",
      suggestions: "제안:",
      checkSpelling: "철자 확인",
      tryDifferentFormat: "다른 형식 시도",
      useFewerKeywords: "키워드 줄이기",
      clearFilters: "필터 지우기"
    },
    excel: {
      title: "엑셀 가져오기",
      aiBadge: "AI",
      subtitle: "AI가 스프레드시트를 분석하여 자동으로 부품을 추출합니다",
      dragDrop: "엑셀 파일을 드래그 앤 드롭",
      browseFiles: "파일 찾아보기",
      supportedFormats: ".xlsx, .xls, .csv 지원 • 최대 10MB • 최대 5,000행",
      analyzing: "AI가 시트를 분석 중...",
      analysisComplete: "분석 완료!",
      selectAll: "모두 선택",
      searchParts: "부품 검색",
      addToCartBtn: "장바구니에 추가"
    },
    recentSearches: {
      title: "최근 검색",
      empty: "최근 검색 없음",
      clearHistory: "기록 지우기"
    }
  },
  nl: {
    filters: {
      title: "Filters",
      subtitle: "Verfijn uw zoekresultaten",
      clearAll: "Alles Wissen",
      filterByResults: "Filteren op Resultaten",
      partsFound: "onderdelen gevonden",
      priceRange: "Prijsklasse",
      min: "Min",
      max: "Max",
      stockCode: "Voorraadcode",
      allStockCodes: "Alle Codes",
      brand: "Merk",
      searchBrands: "Merken zoeken...",
      allBrands: "Alle Merken",
      showMore: "Meer tonen",
      deliveryTime: "Levertijd",
      days: "dagen",
      express: "Express (1-2 dagen)",
      fast: "Snel (3-5 dagen)",
      standard: "Standaard (7-14 dagen)",
      availableQty: "Beschikbare Hoeveelheid",
      units: "eenheden",
      minAvailable: "Minimaal Beschikbaar",
      weight: "Gewicht",
      matching: "Overeenkomend:",
      parts: "onderdelen",
      reset: "Resetten",
      applyFilters: "Filters Toepassen"
    },
    header: {
      found: "Gevonden",
      partsMatching: "onderdelen die overeenkomen met uw zoekopdracht",
      selectItems: "Selecteer items om toe te voegen aan winkelwagen",
      selected: "Geselecteerd",
      selectedTotal: "Geselecteerd Totaal",
      addToCart: "Toevoegen aan Winkelwagen",
      filters: "Filters"
    },
    sort: {
      sortBy: "Sorteren op:",
      relevance: "Relevantie",
      cheapest: "Goedkoopste",
      expensive: "Duurste",
      fastestDelivery: "Snelste Levering",
      mostStock: "Meeste Voorraad",
      inStockOnly: "Alleen Op Voorraad",
      lowStock: "Lage Voorraad"
    },
    table: {
      select: "SELECTEER",
      brand: "MERK",
      vendorCode: "LEVERANCIERSCODE",
      description: "BESCHRIJVING",
      qty: "AANTAL",
      stockCode: "VOORRAADCODE",
      volume: "VOLUME",
      weight: "GEWICHT",
      delivery: "LEVERING",
      orderQty: "BESTEL AANTAL",
      total: "TOTAAL"
    },
    footer: {
      addSelectedToCart: "Geselecteerde Toevoegen aan Winkelwagen",
      selectedTotal: "GESELECTEERD TOTAAL:"
    },
    emptyState: {
      title: "Start Uw Zoekopdracht",
      description: "Voer onderdeelnummer, merknaam of beschrijving in om onderdelen te vinden van geverifieerde leveranciers.",
      popularSearches: "Populaire Zoekopdrachten",
      brakePads: "Remblokken",
      oilFilter: "Oliefilter",
      alternator: "Dynamo",
      waterPump: "Waterpomp",
      verifiedSuppliers: "Geverifieerde Leveranciers",
      globalNetwork: "Wereldwijd Netwerk",
      fastDelivery: "Snelle Levering",
      qualityGuaranteed: "Kwaliteit Gegarandeerd"
    },
    noResults: {
      title: "Geen Onderdelen Gevonden",
      noPartsFound: "We konden geen overeenkomende onderdelen vinden",
      tryDifferent: "Probeer een ander onderdeelnummer of neem contact op met ons team.",
      tryAgain: "Opnieuw Proberen",
      contactSupport: "Contact Ondersteuning",
      suggestions: "Suggesties:",
      checkSpelling: "Controleer de spelling",
      tryDifferentFormat: "Probeer een ander formaat",
      useFewerKeywords: "Gebruik minder trefwoorden",
      clearFilters: "Filters wissen"
    },
    excel: {
      title: "Excel Import",
      aiBadge: "AI",
      subtitle: "AI analyseert uw spreadsheet om onderdelen automatisch te extraheren",
      dragDrop: "Sleep uw Excel-bestand",
      browseFiles: "Bestanden Bladeren",
      supportedFormats: "Ondersteunt .xlsx, .xls, .csv • Max 10MB • Max 5.000 rijen",
      analyzing: "AI analyseert uw sheet...",
      analysisComplete: "Analyse Voltooid!",
      selectAll: "Alles Selecteren",
      searchParts: "Onderdelen Zoeken",
      addToCartBtn: "Toevoegen aan Winkelwagen"
    },
    recentSearches: {
      title: "Recente Zoekopdrachten",
      empty: "Geen recente zoekopdrachten",
      clearHistory: "Geschiedenis Wissen"
    }
  },
  pl: {
    filters: {
      title: "Filtry",
      subtitle: "Zawęź wyniki wyszukiwania",
      clearAll: "Wyczyść Wszystko",
      filterByResults: "Filtruj według Wyników",
      partsFound: "części znalezionych",
      priceRange: "Zakres Cen",
      min: "Min",
      max: "Max",
      stockCode: "Kod Magazynowy",
      allStockCodes: "Wszystkie Kody",
      brand: "Marka",
      searchBrands: "Szukaj marek...",
      allBrands: "Wszystkie Marki",
      showMore: "Pokaż więcej",
      deliveryTime: "Czas Dostawy",
      days: "dni",
      express: "Ekspres (1-2 dni)",
      fast: "Szybka (3-5 dni)",
      standard: "Standardowa (7-14 dni)",
      availableQty: "Dostępna Ilość",
      units: "jednostek",
      minAvailable: "Minimum Dostępne",
      weight: "Waga",
      matching: "Pasujących:",
      parts: "części",
      reset: "Resetuj",
      applyFilters: "Zastosuj Filtry"
    },
    header: {
      found: "Znaleziono",
      partsMatching: "części pasujących do wyszukiwania",
      selectItems: "Wybierz pozycje do dodania do koszyka",
      selected: "Wybrano",
      selectedTotal: "Suma Wybranych",
      addToCart: "Dodaj do Koszyka",
      filters: "Filtry"
    },
    sort: {
      sortBy: "Sortuj wg:",
      relevance: "Trafność",
      cheapest: "Najtańsze",
      expensive: "Najdroższe",
      fastestDelivery: "Najszybsza Dostawa",
      mostStock: "Największy Zapas",
      inStockOnly: "Tylko Dostępne",
      lowStock: "Niski Zapas"
    },
    table: {
      select: "WYBIERZ",
      brand: "MARKA",
      vendorCode: "KOD DOSTAWCY",
      description: "OPIS",
      qty: "ILOŚĆ",
      stockCode: "KOD MAGAZYNOWY",
      volume: "OBJĘTOŚĆ",
      weight: "WAGA",
      delivery: "DOSTAWA",
      orderQty: "ILOŚĆ ZAMÓWIENIA",
      total: "RAZEM"
    },
    footer: {
      addSelectedToCart: "Dodaj Wybrane do Koszyka",
      selectedTotal: "SUMA WYBRANYCH:"
    },
    emptyState: {
      title: "Rozpocznij Wyszukiwanie",
      description: "Wprowadź numer części, markę lub opis, aby znaleźć części od zweryfikowanych dostawców.",
      popularSearches: "Popularne Wyszukiwania",
      brakePads: "Klocki Hamulcowe",
      oilFilter: "Filtr Oleju",
      alternator: "Alternator",
      waterPump: "Pompa Wody",
      verifiedSuppliers: "Zweryfikowani Dostawcy",
      globalNetwork: "Globalna Sieć",
      fastDelivery: "Szybka Dostawa",
      qualityGuaranteed: "Gwarancja Jakości"
    },
    noResults: {
      title: "Nie Znaleziono Części",
      noPartsFound: "Nie znaleźliśmy pasujących części",
      tryDifferent: "Wypróbuj inny numer części lub skontaktuj się z naszym zespołem.",
      tryAgain: "Spróbuj Ponownie",
      contactSupport: "Skontaktuj się z Pomocą",
      suggestions: "Sugestie:",
      checkSpelling: "Sprawdź pisownię",
      tryDifferentFormat: "Wypróbuj inny format",
      useFewerKeywords: "Użyj mniej słów kluczowych",
      clearFilters: "Wyczyść filtry"
    },
    excel: {
      title: "Import Excel",
      aiBadge: "AI",
      subtitle: "AI analizuje arkusz kalkulacyjny i automatycznie wyodrębnia części",
      dragDrop: "Przeciągnij i upuść plik Excel",
      browseFiles: "Przeglądaj Pliki",
      supportedFormats: "Obsługuje .xlsx, .xls, .csv • Max 10MB • Max 5000 wierszy",
      analyzing: "AI analizuje arkusz...",
      analysisComplete: "Analiza Zakończona!",
      selectAll: "Wybierz Wszystko",
      searchParts: "Szukaj Części",
      addToCartBtn: "Dodaj do Koszyka"
    },
    recentSearches: {
      title: "Ostatnie Wyszukiwania",
      empty: "Brak ostatnich wyszukiwań",
      clearHistory: "Wyczyść Historię"
    }
  },
  pt: {
    filters: {
      title: "Filtros",
      subtitle: "Refine seus resultados de pesquisa",
      clearAll: "Limpar Tudo",
      filterByResults: "Filtrar por Resultados",
      partsFound: "peças encontradas",
      priceRange: "Faixa de Preço",
      min: "Mín",
      max: "Máx",
      stockCode: "Código de Estoque",
      allStockCodes: "Todos os Códigos",
      brand: "Marca",
      searchBrands: "Buscar marcas...",
      allBrands: "Todas as Marcas",
      showMore: "Mostrar mais",
      deliveryTime: "Tempo de Entrega",
      days: "dias",
      express: "Expresso (1-2 dias)",
      fast: "Rápido (3-5 dias)",
      standard: "Padrão (7-14 dias)",
      availableQty: "Quantidade Disponível",
      units: "unidades",
      minAvailable: "Mínimo Disponível",
      weight: "Peso",
      matching: "Correspondentes:",
      parts: "peças",
      reset: "Redefinir",
      applyFilters: "Aplicar Filtros"
    },
    header: {
      found: "Encontrados",
      partsMatching: "peças correspondentes à sua busca",
      selectItems: "Selecione itens para adicionar ao carrinho",
      selected: "Selecionados",
      selectedTotal: "Total Selecionado",
      addToCart: "Adicionar ao Carrinho",
      filters: "Filtros"
    },
    sort: {
      sortBy: "Ordenar por:",
      relevance: "Relevância",
      cheapest: "Mais Barato",
      expensive: "Mais Caro",
      fastestDelivery: "Entrega Mais Rápida",
      mostStock: "Mais Estoque",
      inStockOnly: "Apenas em Estoque",
      lowStock: "Baixo Estoque"
    },
    table: {
      select: "SELECIONAR",
      brand: "MARCA",
      vendorCode: "CÓDIGO DO FORNECEDOR",
      description: "DESCRIÇÃO",
      qty: "QTD",
      stockCode: "CÓDIGO",
      volume: "VOLUME",
      weight: "PESO",
      delivery: "ENTREGA",
      orderQty: "QTD PEDIDO",
      total: "TOTAL"
    },
    footer: {
      addSelectedToCart: "Adicionar Selecionados ao Carrinho",
      selectedTotal: "TOTAL SELECIONADO:"
    },
    emptyState: {
      title: "Iniciar Pesquisa",
      description: "Digite número da peça, marca ou descrição para encontrar peças de fornecedores verificados.",
      popularSearches: "Pesquisas Populares",
      brakePads: "Pastilhas de Freio",
      oilFilter: "Filtro de Óleo",
      alternator: "Alternador",
      waterPump: "Bomba d'Água",
      verifiedSuppliers: "Fornecedores Verificados",
      globalNetwork: "Rede Global",
      fastDelivery: "Entrega Rápida",
      qualityGuaranteed: "Qualidade Garantida"
    },
    noResults: {
      title: "Nenhuma Peça Encontrada",
      noPartsFound: "Não encontramos peças correspondentes",
      tryDifferent: "Tente um número de peça diferente ou entre em contato com nossa equipe.",
      tryAgain: "Tentar Novamente",
      contactSupport: "Contatar Suporte",
      suggestions: "Sugestões:",
      checkSpelling: "Verifique a ortografia",
      tryDifferentFormat: "Tente um formato diferente",
      useFewerKeywords: "Use menos palavras-chave",
      clearFilters: "Limpar filtros"
    },
    excel: {
      title: "Importar Excel",
      aiBadge: "IA",
      subtitle: "A IA analisa sua planilha para extrair peças automaticamente",
      dragDrop: "Arraste e solte seu arquivo Excel",
      browseFiles: "Procurar Arquivos",
      supportedFormats: "Suporta .xlsx, .xls, .csv • Máx 10MB • Máx 5.000 linhas",
      analyzing: "IA está analisando sua planilha...",
      analysisComplete: "Análise Concluída!",
      selectAll: "Selecionar Tudo",
      searchParts: "Pesquisar Peças",
      addToCartBtn: "Adicionar ao Carrinho"
    },
    recentSearches: {
      title: "Pesquisas Recentes",
      empty: "Nenhuma pesquisa recente",
      clearHistory: "Limpar Histórico"
    }
  },
  tr: {
    filters: {
      title: "Filtreler",
      subtitle: "Arama sonuçlarını daraltın",
      clearAll: "Tümünü Temizle",
      filterByResults: "Sonuçlara Göre Filtrele",
      partsFound: "parça bulundu",
      priceRange: "Fiyat Aralığı",
      min: "Min",
      max: "Maks",
      stockCode: "Stok Kodu",
      allStockCodes: "Tüm Kodlar",
      brand: "Marka",
      searchBrands: "Marka ara...",
      allBrands: "Tüm Markalar",
      showMore: "Daha fazla göster",
      deliveryTime: "Teslimat Süresi",
      days: "gün",
      express: "Ekspres (1-2 gün)",
      fast: "Hızlı (3-5 gün)",
      standard: "Standart (7-14 gün)",
      availableQty: "Mevcut Miktar",
      units: "birim",
      minAvailable: "Minimum Mevcut",
      weight: "Ağırlık",
      matching: "Eşleşen:",
      parts: "parça",
      reset: "Sıfırla",
      applyFilters: "Filtreleri Uygula"
    },
    header: {
      found: "Bulundu",
      partsMatching: "aramanızla eşleşen parça",
      selectItems: "Sepete eklemek için öğe seçin",
      selected: "Seçildi",
      selectedTotal: "Seçilen Toplam",
      addToCart: "Sepete Ekle",
      filters: "Filtreler"
    },
    sort: {
      sortBy: "Sırala:",
      relevance: "Alaka",
      cheapest: "En Ucuz",
      expensive: "En Pahalı",
      fastestDelivery: "En Hızlı Teslimat",
      mostStock: "En Çok Stok",
      inStockOnly: "Sadece Stokta",
      lowStock: "Düşük Stok"
    },
    table: {
      select: "SEÇ",
      brand: "MARKA",
      vendorCode: "TEDARİKÇİ KODU",
      description: "AÇIKLAMA",
      qty: "MİKTAR",
      stockCode: "STOK KODU",
      volume: "HACİM",
      weight: "AĞIRLIK",
      delivery: "TESLİMAT",
      orderQty: "SİPARİŞ MİKTARI",
      total: "TOPLAM"
    },
    footer: {
      addSelectedToCart: "Seçilenleri Sepete Ekle",
      selectedTotal: "SEÇİLEN TOPLAM:"
    },
    emptyState: {
      title: "Aramaya Başla",
      description: "Doğrulanmış tedarikçilerden parça bulmak için parça numarası, marka veya açıklama girin.",
      popularSearches: "Popüler Aramalar",
      brakePads: "Fren Balataları",
      oilFilter: "Yağ Filtresi",
      alternator: "Alternatör",
      waterPump: "Su Pompası",
      verifiedSuppliers: "Doğrulanmış Tedarikçiler",
      globalNetwork: "Küresel Ağ",
      fastDelivery: "Hızlı Teslimat",
      qualityGuaranteed: "Kalite Garantili"
    },
    noResults: {
      title: "Parça Bulunamadı",
      noPartsFound: "Eşleşen parça bulamadık",
      tryDifferent: "Farklı bir parça numarası deneyin veya ekibimizle iletişime geçin.",
      tryAgain: "Tekrar Dene",
      contactSupport: "Desteğe Başvur",
      suggestions: "Öneriler:",
      checkSpelling: "Yazımı kontrol edin",
      tryDifferentFormat: "Farklı bir format deneyin",
      useFewerKeywords: "Daha az anahtar kelime kullanın",
      clearFilters: "Filtreleri temizle"
    },
    excel: {
      title: "Excel İçe Aktar",
      aiBadge: "YZ",
      subtitle: "YZ, parçaları otomatik olarak çıkarmak için elektronik tablonuzu analiz eder",
      dragDrop: "Excel dosyanızı sürükle bırak",
      browseFiles: "Dosyalara Göz At",
      supportedFormats: ".xlsx, .xls, .csv destekler • Maks 10MB • Maks 5.000 satır",
      analyzing: "YZ sayfanızı analiz ediyor...",
      analysisComplete: "Analiz Tamamlandı!",
      selectAll: "Tümünü Seç",
      searchParts: "Parça Ara",
      addToCartBtn: "Sepete Ekle"
    },
    recentSearches: {
      title: "Son Aramalar",
      empty: "Henüz arama yok",
      clearHistory: "Geçmişi Temizle"
    }
  },
  zh: {
    filters: {
      title: "筛选",
      subtitle: "细化搜索结果",
      clearAll: "清除全部",
      filterByResults: "按结果筛选",
      partsFound: "个零件找到",
      priceRange: "价格范围",
      min: "最低",
      max: "最高",
      stockCode: "库存代码",
      allStockCodes: "所有代码",
      brand: "品牌",
      searchBrands: "搜索品牌...",
      allBrands: "所有品牌",
      showMore: "显示更多",
      deliveryTime: "配送时间",
      days: "天",
      express: "加急 (1-2天)",
      fast: "快速 (3-5天)",
      standard: "标准 (7-14天)",
      availableQty: "可用数量",
      units: "单位",
      minAvailable: "最小可用",
      weight: "重量",
      matching: "匹配:",
      parts: "零件",
      reset: "重置",
      applyFilters: "应用筛选"
    },
    header: {
      found: "找到",
      partsMatching: "个与搜索匹配的零件",
      selectItems: "选择项目添加到购物车",
      selected: "已选择",
      selectedTotal: "选择总计",
      addToCart: "添加到购物车",
      filters: "筛选"
    },
    sort: {
      sortBy: "排序:",
      relevance: "相关性",
      cheapest: "最便宜",
      expensive: "最贵",
      fastestDelivery: "最快配送",
      mostStock: "库存最多",
      inStockOnly: "仅有库存",
      lowStock: "低库存"
    },
    table: {
      select: "选择",
      brand: "品牌",
      vendorCode: "供应商代码",
      description: "描述",
      qty: "数量",
      stockCode: "库存代码",
      volume: "体积",
      weight: "重量",
      delivery: "配送",
      orderQty: "订购数量",
      total: "合计"
    },
    footer: {
      addSelectedToCart: "将选中项添加到购物车",
      selectedTotal: "选择总计:"
    },
    emptyState: {
      title: "开始搜索",
      description: "输入零件编号、品牌名称或描述，从全球验证供应商处查找零件。",
      popularSearches: "热门搜索",
      brakePads: "刹车片",
      oilFilter: "机油滤芯",
      alternator: "发电机",
      waterPump: "水泵",
      verifiedSuppliers: "验证供应商",
      globalNetwork: "全球网络",
      fastDelivery: "快速配送",
      qualityGuaranteed: "品质保证"
    },
    noResults: {
      title: "未找到零件",
      noPartsFound: "我们找不到匹配的零件",
      tryDifferent: "尝试不同的零件编号或联系我们的团队。",
      tryAgain: "重试",
      contactSupport: "联系支持",
      suggestions: "建议:",
      checkSpelling: "检查拼写",
      tryDifferentFormat: "尝试不同格式",
      useFewerKeywords: "使用更少关键词",
      clearFilters: "清除筛选"
    },
    excel: {
      title: "Excel导入",
      aiBadge: "AI",
      subtitle: "AI分析您的电子表格自动提取零件",
      dragDrop: "拖放您的Excel文件",
      browseFiles: "浏览文件",
      supportedFormats: "支持.xlsx, .xls, .csv • 最大10MB • 最多5,000行",
      analyzing: "AI正在分析您的表格...",
      analysisComplete: "分析完成！",
      selectAll: "全选",
      searchParts: "搜索零件",
      addToCartBtn: "添加到购物车"
    },
    recentSearches: {
      title: "最近搜索",
      empty: "暂无最近搜索",
      clearHistory: "清除历史"
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
    
    // 1. Add tickets.create section for ALL languages
    if (ticketsCreateTranslations[lang]) {
      if (!data.tickets) data.tickets = {};
      if (!data.tickets.create) data.tickets.create = {};
      deepMerge(data.tickets.create, ticketsCreateTranslations[lang]);
      modified = true;
    }
    
    // 2. Add tickets base keys for es, fr, ru, ua
    if (ticketsBaseTranslations[lang]) {
      if (!data.tickets) data.tickets = {};
      for (const [key, value] of Object.entries(ticketsBaseTranslations[lang])) {
        if (!data.tickets[key]) {
          data.tickets[key] = value;
          modified = true;
        }
      }
    }
    
    // 3. Add tickets.details extra keys for es, fr, ru, ua
    if (ticketsDetailsExtraTranslations[lang]) {
      if (!data.tickets) data.tickets = {};
      if (!data.tickets.details) data.tickets.details = {};
      for (const [key, value] of Object.entries(ticketsDetailsExtraTranslations[lang])) {
        if (!data.tickets.details[key]) {
          data.tickets.details[key] = value;
          modified = true;
        }
      }
    }
    
    // 4. Add contacts badge and website for es, fr, ru, ua
    if (contactsExtraTranslations[lang]) {
      if (!data.contacts) data.contacts = {};
      for (const [key, value] of Object.entries(contactsExtraTranslations[lang])) {
        if (!data.contacts[key]) {
          data.contacts[key] = value;
          modified = true;
        }
      }
    }
    
    // 5. Add footer translations
    if (footerTranslations[lang]) {
      if (!data.footer) data.footer = {};
      for (const [key, value] of Object.entries(footerTranslations[lang])) {
        if (!data.footer[key]) {
          data.footer[key] = value;
          modified = true;
        }
      }
    }
    
    // 6. Add searchResults translations for it, ja, ko, nl, pl, pt, tr, zh
    if (searchResultsTranslations[lang]) {
      if (!data.searchResults) data.searchResults = {};
      deepMerge(data.searchResults, searchResultsTranslations[lang]);
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
