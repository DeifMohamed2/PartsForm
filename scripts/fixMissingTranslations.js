const fs = require('fs');
const path = require('path');

// Common auth translations for ALL languages
const commonAuthTranslations = {
  ar: {
    welcomeBack: "مرحباً بعودتك",
    signIn: "تسجيل الدخول",
    signInDesc: "أدخل بياناتك للوصول إلى حسابك",
    email: "البريد الإلكتروني",
    emailPlaceholder: "أدخل بريدك الإلكتروني",
    password: "كلمة المرور",
    forgotPassword: "نسيت كلمة المرور؟",
    noAccount: "ليس لديك حساب؟",
    signUp: "إنشاء حساب",
    orContinueWith: "أو المتابعة مع"
  },
  de: {
    welcomeBack: "Willkommen zurück",
    signIn: "Anmelden",
    signInDesc: "Geben Sie Ihre Anmeldedaten ein",
    email: "E-Mail",
    emailPlaceholder: "E-Mail eingeben",
    password: "Passwort",
    forgotPassword: "Passwort vergessen?",
    noAccount: "Noch kein Konto?",
    signUp: "Registrieren",
    orContinueWith: "oder fortfahren mit"
  },
  es: {
    welcomeBack: "Bienvenido de nuevo",
    signIn: "Iniciar Sesión",
    signInDesc: "Ingrese sus credenciales para acceder a su cuenta",
    email: "Correo electrónico",
    emailPlaceholder: "Ingrese su correo electrónico",
    password: "Contraseña",
    forgotPassword: "¿Olvidó su contraseña?",
    noAccount: "¿No tiene cuenta?",
    signUp: "Registrarse",
    orContinueWith: "o continuar con"
  },
  fr: {
    welcomeBack: "Bienvenue",
    signIn: "Se connecter",
    signInDesc: "Entrez vos identifiants pour accéder à votre compte",
    email: "E-mail",
    emailPlaceholder: "Entrez votre e-mail",
    password: "Mot de passe",
    forgotPassword: "Mot de passe oublié?",
    noAccount: "Pas de compte?",
    signUp: "S'inscrire",
    orContinueWith: "ou continuer avec"
  },
  it: {
    welcomeBack: "Bentornato",
    signIn: "Accedi",
    signInDesc: "Inserisci le tue credenziali per accedere",
    email: "Email",
    emailPlaceholder: "Inserisci la tua email",
    password: "Password",
    forgotPassword: "Password dimenticata?",
    noAccount: "Non hai un account?",
    signUp: "Registrati",
    orContinueWith: "o continua con"
  },
  ja: {
    welcomeBack: "お帰りなさい",
    signIn: "ログイン",
    signInDesc: "アカウントにアクセスするには認証情報を入力してください",
    email: "メールアドレス",
    emailPlaceholder: "メールアドレスを入力",
    password: "パスワード",
    forgotPassword: "パスワードをお忘れですか?",
    noAccount: "アカウントをお持ちでないですか?",
    signUp: "新規登録",
    orContinueWith: "または以下で続行"
  },
  ko: {
    welcomeBack: "돌아오신 것을 환영합니다",
    signIn: "로그인",
    signInDesc: "계정에 접근하려면 자격 증명을 입력하세요",
    email: "이메일",
    emailPlaceholder: "이메일 입력",
    password: "비밀번호",
    forgotPassword: "비밀번호를 잊으셨나요?",
    noAccount: "계정이 없으신가요?",
    signUp: "회원가입",
    orContinueWith: "또는 계속"
  },
  nl: {
    welcomeBack: "Welkom terug",
    signIn: "Inloggen",
    signInDesc: "Voer uw gegevens in om toegang te krijgen",
    email: "E-mail",
    emailPlaceholder: "Voer uw e-mail in",
    password: "Wachtwoord",
    forgotPassword: "Wachtwoord vergeten?",
    noAccount: "Geen account?",
    signUp: "Registreren",
    orContinueWith: "of doorgaan met"
  },
  pl: {
    welcomeBack: "Witamy ponownie",
    signIn: "Zaloguj się",
    signInDesc: "Wprowadź dane logowania",
    email: "E-mail",
    emailPlaceholder: "Wprowadź e-mail",
    password: "Hasło",
    forgotPassword: "Zapomniałeś hasła?",
    noAccount: "Nie masz konta?",
    signUp: "Zarejestruj się",
    orContinueWith: "lub kontynuuj przez"
  },
  pt: {
    welcomeBack: "Bem-vindo de volta",
    signIn: "Entrar",
    signInDesc: "Digite suas credenciais para acessar sua conta",
    email: "E-mail",
    emailPlaceholder: "Digite seu e-mail",
    password: "Senha",
    forgotPassword: "Esqueceu a senha?",
    noAccount: "Não tem conta?",
    signUp: "Cadastrar",
    orContinueWith: "ou continue com"
  },
  ru: {
    welcomeBack: "С возвращением",
    signIn: "Войти",
    signInDesc: "Введите данные для входа в аккаунт",
    email: "Электронная почта",
    emailPlaceholder: "Введите email",
    password: "Пароль",
    forgotPassword: "Забыли пароль?",
    noAccount: "Нет аккаунта?",
    signUp: "Регистрация",
    orContinueWith: "или продолжить через"
  },
  tr: {
    welcomeBack: "Tekrar hoş geldiniz",
    signIn: "Giriş Yap",
    signInDesc: "Hesabınıza erişmek için bilgilerinizi girin",
    email: "E-posta",
    emailPlaceholder: "E-posta girin",
    password: "Şifre",
    forgotPassword: "Şifrenizi mi unuttunuz?",
    noAccount: "Hesabınız yok mu?",
    signUp: "Kayıt Ol",
    orContinueWith: "veya ile devam et"
  },
  ua: {
    welcomeBack: "З поверненням",
    signIn: "Увійти",
    signInDesc: "Введіть дані для входу в обліковий запис",
    email: "Електронна пошта",
    emailPlaceholder: "Введіть email",
    password: "Пароль",
    forgotPassword: "Забули пароль?",
    noAccount: "Немає облікового запису?",
    signUp: "Реєстрація",
    orContinueWith: "або продовжити через"
  },
  zh: {
    welcomeBack: "欢迎回来",
    signIn: "登录",
    signInDesc: "输入您的凭据以访问您的账户",
    email: "电子邮件",
    emailPlaceholder: "输入您的电子邮件",
    password: "密码",
    forgotPassword: "忘记密码?",
    noAccount: "没有账户?",
    signUp: "注册",
    orContinueWith: "或继续使用"
  }
};

// Orders details translations
const ordersDetailsTranslations = {
  ar: {
    title: "تفاصيل الطلب",
    backToOrders: "العودة للطلبات",
    loading: "جاري التحميل...",
    loadingText: "جاري تحميل تفاصيل الطلب...",
    print: "طباعة",
    downloadInvoice: "تحميل الفاتورة",
    orderItems: "عناصر الطلب",
    partDetails: "تفاصيل القطعة",
    weight: "الوزن",
    stock: "المخزون",
    price: "السعر",
    paymentInfo: "معلومات الدفع",
    orderTimeline: "جدول الطلب الزمني",
    orderSummary: "ملخص الطلب",
    shippingInfo: "معلومات الشحن",
    errorTitle: "الطلب غير موجود",
    errorText: "الطلب الذي تبحث عنه غير موجود أو تم حذفه."
  },
  de: {
    title: "Bestelldetails",
    backToOrders: "Zurück zu Bestellungen",
    loading: "Laden...",
    loadingText: "Bestelldetails werden geladen...",
    print: "Drucken",
    downloadInvoice: "Rechnung herunterladen",
    orderItems: "Bestellartikel",
    partDetails: "Teiledetails",
    weight: "Gewicht",
    stock: "Lagerbestand",
    price: "Preis",
    paymentInfo: "Zahlungsinformationen",
    orderTimeline: "Bestellzeitlinie",
    orderSummary: "Bestellübersicht",
    shippingInfo: "Versandinformationen",
    errorTitle: "Bestellung nicht gefunden",
    errorText: "Die Bestellung existiert nicht oder wurde entfernt."
  },
  it: {
    title: "Dettagli Ordine",
    backToOrders: "Torna agli Ordini",
    loading: "Caricamento...",
    loadingText: "Caricamento dettagli ordine...",
    print: "Stampa",
    downloadInvoice: "Scarica Fattura",
    orderItems: "Articoli Ordine",
    partDetails: "Dettagli Parte",
    weight: "Peso",
    stock: "Disponibilità",
    price: "Prezzo",
    paymentInfo: "Informazioni Pagamento",
    orderTimeline: "Cronologia Ordine",
    orderSummary: "Riepilogo Ordine",
    shippingInfo: "Informazioni Spedizione",
    errorTitle: "Ordine Non Trovato",
    errorText: "L'ordine che stai cercando non esiste o è stato rimosso."
  },
  ja: {
    title: "注文詳細",
    backToOrders: "注文一覧に戻る",
    loading: "読み込み中...",
    loadingText: "注文詳細を読み込んでいます...",
    print: "印刷",
    downloadInvoice: "請求書をダウンロード",
    orderItems: "注文品目",
    partDetails: "部品詳細",
    weight: "重量",
    stock: "在庫",
    price: "価格",
    paymentInfo: "支払い情報",
    orderTimeline: "注文タイムライン",
    orderSummary: "注文概要",
    shippingInfo: "配送情報",
    errorTitle: "注文が見つかりません",
    errorText: "お探しの注文は存在しないか、削除されました。"
  },
  ko: {
    title: "주문 상세",
    backToOrders: "주문 목록으로",
    loading: "로딩 중...",
    loadingText: "주문 상세를 불러오는 중...",
    print: "인쇄",
    downloadInvoice: "청구서 다운로드",
    orderItems: "주문 품목",
    partDetails: "부품 상세",
    weight: "무게",
    stock: "재고",
    price: "가격",
    paymentInfo: "결제 정보",
    orderTimeline: "주문 타임라인",
    orderSummary: "주문 요약",
    shippingInfo: "배송 정보",
    errorTitle: "주문을 찾을 수 없음",
    errorText: "찾으시는 주문이 존재하지 않거나 삭제되었습니다."
  },
  nl: {
    title: "Besteldetails",
    backToOrders: "Terug naar Bestellingen",
    loading: "Laden...",
    loadingText: "Besteldetails worden geladen...",
    print: "Afdrukken",
    downloadInvoice: "Factuur Downloaden",
    orderItems: "Bestelartikelen",
    partDetails: "Onderdeeldetails",
    weight: "Gewicht",
    stock: "Voorraad",
    price: "Prijs",
    paymentInfo: "Betalingsinformatie",
    orderTimeline: "Besteltijdlijn",
    orderSummary: "Besteloverzicht",
    shippingInfo: "Verzendinformatie",
    errorTitle: "Bestelling Niet Gevonden",
    errorText: "De bestelling die u zoekt bestaat niet of is verwijderd."
  },
  pl: {
    title: "Szczegóły Zamówienia",
    backToOrders: "Powrót do Zamówień",
    loading: "Ładowanie...",
    loadingText: "Ładowanie szczegółów zamówienia...",
    print: "Drukuj",
    downloadInvoice: "Pobierz Fakturę",
    orderItems: "Pozycje Zamówienia",
    partDetails: "Szczegóły Części",
    weight: "Waga",
    stock: "Magazyn",
    price: "Cena",
    paymentInfo: "Informacje o Płatności",
    orderTimeline: "Historia Zamówienia",
    orderSummary: "Podsumowanie Zamówienia",
    shippingInfo: "Informacje o Wysyłce",
    errorTitle: "Nie Znaleziono Zamówienia",
    errorText: "Zamówienie nie istnieje lub zostało usunięte."
  },
  pt: {
    title: "Detalhes do Pedido",
    backToOrders: "Voltar para Pedidos",
    loading: "Carregando...",
    loadingText: "Carregando detalhes do pedido...",
    print: "Imprimir",
    downloadInvoice: "Baixar Fatura",
    orderItems: "Itens do Pedido",
    partDetails: "Detalhes da Peça",
    weight: "Peso",
    stock: "Estoque",
    price: "Preço",
    paymentInfo: "Informações de Pagamento",
    orderTimeline: "Histórico do Pedido",
    orderSummary: "Resumo do Pedido",
    shippingInfo: "Informações de Envio",
    errorTitle: "Pedido Não Encontrado",
    errorText: "O pedido que você procura não existe ou foi removido."
  },
  tr: {
    title: "Sipariş Detayları",
    backToOrders: "Siparişlere Dön",
    loading: "Yükleniyor...",
    loadingText: "Sipariş detayları yükleniyor...",
    print: "Yazdır",
    downloadInvoice: "Faturayı İndir",
    orderItems: "Sipariş Kalemleri",
    partDetails: "Parça Detayları",
    weight: "Ağırlık",
    stock: "Stok",
    price: "Fiyat",
    paymentInfo: "Ödeme Bilgisi",
    orderTimeline: "Sipariş Zaman Çizelgesi",
    orderSummary: "Sipariş Özeti",
    shippingInfo: "Kargo Bilgisi",
    errorTitle: "Sipariş Bulunamadı",
    errorText: "Aradığınız sipariş mevcut değil veya kaldırılmış."
  },
  zh: {
    title: "订单详情",
    backToOrders: "返回订单",
    loading: "加载中...",
    loadingText: "正在加载订单详情...",
    print: "打印",
    downloadInvoice: "下载发票",
    orderItems: "订单项目",
    partDetails: "零件详情",
    weight: "重量",
    stock: "库存",
    price: "价格",
    paymentInfo: "支付信息",
    orderTimeline: "订单时间线",
    orderSummary: "订单摘要",
    shippingInfo: "配送信息",
    errorTitle: "订单未找到",
    errorText: "您查找的订单不存在或已被删除。"
  }
};

// Tickets details translations
const ticketsDetailsTranslations = {
  ar: {
    backToTickets: "العودة للتذاكر",
    loading: "جاري التحميل...",
    ticketInfo: "معلومات التذكرة",
    category: "الفئة",
    status: "الحالة",
    lastUpdated: "آخر تحديث",
    conversation: "المحادثة",
    chatWithSupport: "تحدث مع فريق الدعم",
    typePlaceholder: "اكتب رسالتك...",
    send: "إرسال"
  },
  de: {
    backToTickets: "Zurück zu Tickets",
    loading: "Laden...",
    ticketInfo: "Ticket-Informationen",
    category: "Kategorie",
    status: "Status",
    lastUpdated: "Zuletzt aktualisiert",
    conversation: "Konversation",
    chatWithSupport: "Mit Support chatten",
    typePlaceholder: "Nachricht eingeben...",
    send: "Senden"
  },
  es: {
    backToTickets: "Volver a Tickets",
    loading: "Cargando...",
    ticketInfo: "Información del Ticket",
    category: "Categoría",
    status: "Estado",
    lastUpdated: "Última Actualización",
    conversation: "Conversación",
    chatWithSupport: "Chatear con soporte",
    typePlaceholder: "Escribe tu mensaje...",
    send: "Enviar"
  },
  fr: {
    backToTickets: "Retour aux Tickets",
    loading: "Chargement...",
    ticketInfo: "Informations du Ticket",
    category: "Catégorie",
    status: "Statut",
    lastUpdated: "Dernière mise à jour",
    conversation: "Conversation",
    chatWithSupport: "Discuter avec le support",
    typePlaceholder: "Tapez votre message...",
    send: "Envoyer"
  },
  it: {
    backToTickets: "Torna ai Ticket",
    loading: "Caricamento...",
    ticketInfo: "Informazioni Ticket",
    category: "Categoria",
    status: "Stato",
    lastUpdated: "Ultimo Aggiornamento",
    conversation: "Conversazione",
    chatWithSupport: "Chatta con il supporto",
    typePlaceholder: "Scrivi il tuo messaggio...",
    send: "Invia"
  },
  ja: {
    backToTickets: "チケット一覧に戻る",
    loading: "読み込み中...",
    ticketInfo: "チケット情報",
    category: "カテゴリ",
    status: "ステータス",
    lastUpdated: "最終更新",
    conversation: "会話",
    chatWithSupport: "サポートとチャット",
    typePlaceholder: "メッセージを入力...",
    send: "送信"
  },
  ko: {
    backToTickets: "티켓으로 돌아가기",
    loading: "로딩 중...",
    ticketInfo: "티켓 정보",
    category: "카테고리",
    status: "상태",
    lastUpdated: "마지막 업데이트",
    conversation: "대화",
    chatWithSupport: "지원팀과 채팅",
    typePlaceholder: "메시지를 입력하세요...",
    send: "보내기"
  },
  nl: {
    backToTickets: "Terug naar Tickets",
    loading: "Laden...",
    ticketInfo: "Ticketinformatie",
    category: "Categorie",
    status: "Status",
    lastUpdated: "Laatst bijgewerkt",
    conversation: "Gesprek",
    chatWithSupport: "Chat met support",
    typePlaceholder: "Typ uw bericht...",
    send: "Verzenden"
  },
  pl: {
    backToTickets: "Powrót do Zgłoszeń",
    loading: "Ładowanie...",
    ticketInfo: "Informacje o Zgłoszeniu",
    category: "Kategoria",
    status: "Status",
    lastUpdated: "Ostatnia Aktualizacja",
    conversation: "Konwersacja",
    chatWithSupport: "Czat z pomocą",
    typePlaceholder: "Wpisz wiadomość...",
    send: "Wyślij"
  },
  pt: {
    backToTickets: "Voltar para Tickets",
    loading: "Carregando...",
    ticketInfo: "Informações do Ticket",
    category: "Categoria",
    status: "Status",
    lastUpdated: "Última Atualização",
    conversation: "Conversa",
    chatWithSupport: "Conversar com suporte",
    typePlaceholder: "Digite sua mensagem...",
    send: "Enviar"
  },
  ru: {
    backToTickets: "Назад к заявкам",
    loading: "Загрузка...",
    ticketInfo: "Информация о заявке",
    category: "Категория",
    status: "Статус",
    lastUpdated: "Последнее обновление",
    conversation: "Переписка",
    chatWithSupport: "Чат с поддержкой",
    typePlaceholder: "Введите сообщение...",
    send: "Отправить"
  },
  tr: {
    backToTickets: "Biletlere Dön",
    loading: "Yükleniyor...",
    ticketInfo: "Bilet Bilgisi",
    category: "Kategori",
    status: "Durum",
    lastUpdated: "Son Güncelleme",
    conversation: "Sohbet",
    chatWithSupport: "Destekle konuş",
    typePlaceholder: "Mesajınızı yazın...",
    send: "Gönder"
  },
  ua: {
    backToTickets: "Назад до заявок",
    loading: "Завантаження...",
    ticketInfo: "Інформація про заявку",
    category: "Категорія",
    status: "Статус",
    lastUpdated: "Останнє оновлення",
    conversation: "Листування",
    chatWithSupport: "Чат з підтримкою",
    typePlaceholder: "Введіть повідомлення...",
    send: "Надіслати"
  },
  zh: {
    backToTickets: "返回工单",
    loading: "加载中...",
    ticketInfo: "工单信息",
    category: "类别",
    status: "状态",
    lastUpdated: "最后更新",
    conversation: "对话",
    chatWithSupport: "与支持团队聊天",
    typePlaceholder: "输入您的消息...",
    send: "发送"
  }
};

// Technical category translation
const technicalCategoryTranslations = {
  ar: "مشكلة تقنية",
  de: "Technisches Problem",
  es: "Problema Técnico",
  fr: "Problème Technique",
  it: "Problema Tecnico",
  ja: "技術的な問題",
  ko: "기술 문제",
  nl: "Technisch Probleem",
  pl: "Problem Techniczny",
  pt: "Problema Técnico",
  ru: "Техническая проблема",
  tr: "Teknik Sorun",
  ua: "Технічна проблема",
  zh: "技术问题"
};

// Settings language names translations
const settingsLanguageTranslations = {
  ar: { english: "الإنجليزية", arabic: "العربية", russian: "الروسية", ukrainian: "الأوكرانية", french: "الفرنسية", spanish: "الإسبانية" },
  de: { english: "Englisch", arabic: "Arabisch", russian: "Russisch", ukrainian: "Ukrainisch", french: "Französisch", spanish: "Spanisch" },
  it: { english: "Inglese", arabic: "Arabo", russian: "Russo", ukrainian: "Ucraino", french: "Francese", spanish: "Spagnolo" },
  ja: { english: "英語", arabic: "アラビア語", russian: "ロシア語", ukrainian: "ウクライナ語", french: "フランス語", spanish: "スペイン語" },
  ko: { english: "영어", arabic: "아랍어", russian: "러시아어", ukrainian: "우크라이나어", french: "프랑스어", spanish: "스페인어" },
  nl: { english: "Engels", arabic: "Arabisch", russian: "Russisch", ukrainian: "Oekraïens", french: "Frans", spanish: "Spaans" },
  pl: { english: "Angielski", arabic: "Arabski", russian: "Rosyjski", ukrainian: "Ukraiński", french: "Francuski", spanish: "Hiszpański" },
  pt: { english: "Inglês", arabic: "Árabe", russian: "Russo", ukrainian: "Ucraniano", french: "Francês", spanish: "Espanhol" },
  tr: { english: "İngilizce", arabic: "Arapça", russian: "Rusça", ukrainian: "Ukraynaca", french: "Fransızca", spanish: "İspanyolca" },
  zh: { english: "英语", arabic: "阿拉伯语", russian: "俄语", ukrainian: "乌克兰语", french: "法语", spanish: "西班牙语" }
};

// Nav currency translations
const navCurrencyTranslations = {
  ar: { preferredCurrencyTitle: "العملة المفضلة", searchCurrency: "بحث عن العملة..." },
  es: { preferredCurrencyTitle: "Moneda Preferida", searchCurrency: "Buscar moneda..." },
  fr: { preferredCurrencyTitle: "Devise Préférée", searchCurrency: "Rechercher une devise..." },
  ru: { preferredCurrencyTitle: "Предпочтительная Валюта", searchCurrency: "Поиск валюты..." },
  ua: { preferredCurrencyTitle: "Бажана Валюта", searchCurrency: "Пошук валюти..." }
};

// Extended profile translations for es, fr, ru, ua
const extendedProfileTranslations = {
  es: {
    activeAccount: "Cuenta Activa",
    stats: { totalOrders: "Total de Pedidos", memberSince: "Miembro Desde" },
    personalInfo: { title: "Información Personal", edit: "Editar", fullName: "Nombre Completo", email: "Correo Electrónico", phone: "Teléfono", dateOfBirth: "Fecha de Nacimiento" },
    addressInfo: { title: "Información de Dirección", edit: "Editar", street: "Calle", city: "Ciudad", state: "Estado/Provincia", country: "País", postalCode: "Código Postal" },
    security: { password: "Contraseña", lastChanged: "Última vez cambiada hace 30 días", notEnabled: "No habilitado" }
  },
  fr: {
    activeAccount: "Compte Actif",
    stats: { totalOrders: "Total des Commandes", memberSince: "Membre Depuis" },
    personalInfo: { title: "Informations Personnelles", edit: "Modifier", fullName: "Nom Complet", email: "E-mail", phone: "Téléphone", dateOfBirth: "Date de Naissance" },
    addressInfo: { title: "Informations d'Adresse", edit: "Modifier", street: "Rue", city: "Ville", state: "État/Province", country: "Pays", postalCode: "Code Postal" },
    security: { password: "Mot de passe", lastChanged: "Dernière modification il y a 30 jours", notEnabled: "Non activé" }
  },
  ru: {
    activeAccount: "Активный Аккаунт",
    stats: { totalOrders: "Всего Заказов", memberSince: "Участник С" },
    personalInfo: { title: "Личная Информация", edit: "Редактировать", fullName: "Полное Имя", email: "Email", phone: "Телефон", dateOfBirth: "Дата Рождения" },
    addressInfo: { title: "Адресная Информация", edit: "Редактировать", street: "Улица", city: "Город", state: "Область", country: "Страна", postalCode: "Почтовый Индекс" },
    security: { password: "Пароль", lastChanged: "Последнее изменение 30 дней назад", notEnabled: "Не включено" }
  },
  ua: {
    activeAccount: "Активний Акаунт",
    stats: { totalOrders: "Всього Замовлень", memberSince: "Учасник З" },
    personalInfo: { title: "Особиста Інформація", edit: "Редагувати", fullName: "Повне Ім'я", email: "Email", phone: "Телефон", dateOfBirth: "Дата Народження" },
    addressInfo: { title: "Адресна Інформація", edit: "Редагувати", street: "Вулиця", city: "Місто", state: "Область", country: "Країна", postalCode: "Поштовий Індекс" },
    security: { password: "Пароль", lastChanged: "Останнє оновлення 30 днів тому", notEnabled: "Не ввімкнено" }
  }
};

// Extended settings translations for es, fr, ru, ua
const extendedSettingsTranslations = {
  es: {
    nav: { general: "General", notifications: "Notificaciones", privacy: "Privacidad", security: "Seguridad", preferences: "Preferencias", billing: "Facturación" },
    general: {
      title: "Configuración General",
      subtitle: "Administrar preferencias generales de la cuenta",
      language: { title: "Idioma", desc: "Elige tu idioma preferido", english: "Inglés", arabic: "Árabe", russian: "Ruso", ukrainian: "Ucraniano", french: "Francés", spanish: "Español" },
      timezone: { title: "Zona Horaria", desc: "Establece tu zona horaria" },
      dateFormat: { title: "Formato de Fecha", desc: "Elige cómo se muestran las fechas" },
      currency: { title: "Moneda", desc: "Selecciona tu moneda preferida" }
    },
    notifications: {
      title: "Configuración de Notificaciones",
      subtitle: "Controla cómo y cuándo recibes notificaciones",
      email: { title: "Notificaciones por Email", desc: "Recibir notificaciones por email" },
      orderUpdates: { title: "Actualizaciones de Pedidos", desc: "Notificación cuando cambia el estado" },
      promotional: { title: "Emails Promocionales", desc: "Recibir ofertas especiales" },
      sms: { title: "Notificaciones SMS", desc: "Recibir SMS para actualizaciones urgentes" }
    },
    privacy: {
      title: "Configuración de Privacidad",
      subtitle: "Administrar preferencias de privacidad",
      profileVisibility: { title: "Visibilidad del Perfil", desc: "Quién puede ver tu perfil", public: "Público", private: "Privado", friendsOnly: "Solo Amigos" },
      dataCollection: { title: "Recopilación de Datos", desc: "Permitir análisis para mejorar el servicio" },
      cookies: { title: "Cookies", desc: "Aceptar cookies para mejor experiencia" }
    },
    security: {
      title: "Configuración de Seguridad",
      subtitle: "Administrar seguridad de la cuenta",
      twoFactor: { title: "Autenticación de Dos Factores", desc: "Añadir capa extra de seguridad", setup: "Configurar 2FA" },
      changePassword: { title: "Cambiar Contraseña", desc: "Actualizar contraseña regularmente", button: "Cambiar Contraseña" },
      sessions: { title: "Sesiones Activas", desc: "Ver dispositivos conectados", view: "Ver Sesiones" }
    },
    preferences: {
      title: "Preferencias",
      subtitle: "Personalizar tu experiencia",
      theme: { title: "Tema", desc: "Elegir tema de color", light: "Claro", dark: "Oscuro", auto: "Auto (Sistema)" },
      itemsPerPage: { title: "Elementos por Página", desc: "Número de elementos a mostrar" }
    },
    billing: {
      title: "Configuración de Facturación",
      subtitle: "Administrar métodos de pago",
      paymentMethods: { title: "Métodos de Pago", desc: "Administrar métodos guardados", manage: "Administrar Métodos" },
      billingAddress: { title: "Dirección de Facturación", desc: "Actualizar dirección", update: "Actualizar Dirección" },
      invoices: { title: "Historial de Facturas", desc: "Ver y descargar facturas", view: "Ver Facturas" }
    },
    actions: { saveChanges: "Guardar Cambios", resetToDefault: "Restablecer Valores" }
  },
  fr: {
    nav: { general: "Général", notifications: "Notifications", privacy: "Confidentialité", security: "Sécurité", preferences: "Préférences", billing: "Facturation" },
    general: {
      title: "Paramètres Généraux",
      subtitle: "Gérer les préférences générales du compte",
      language: { title: "Langue", desc: "Choisissez votre langue préférée", english: "Anglais", arabic: "Arabe", russian: "Russe", ukrainian: "Ukrainien", french: "Français", spanish: "Espagnol" },
      timezone: { title: "Fuseau Horaire", desc: "Définissez votre fuseau horaire" },
      dateFormat: { title: "Format de Date", desc: "Choisissez l'affichage des dates" },
      currency: { title: "Devise", desc: "Sélectionnez votre devise préférée" }
    },
    notifications: {
      title: "Paramètres de Notifications",
      subtitle: "Contrôlez quand vous recevez des notifications",
      email: { title: "Notifications Email", desc: "Recevoir des notifications par email" },
      orderUpdates: { title: "Mises à jour Commandes", desc: "Notification des changements de statut" },
      promotional: { title: "Emails Promotionnels", desc: "Recevoir des offres spéciales" },
      sms: { title: "Notifications SMS", desc: "Recevoir des SMS pour les urgences" }
    },
    privacy: {
      title: "Paramètres de Confidentialité",
      subtitle: "Gérer vos préférences de confidentialité",
      profileVisibility: { title: "Visibilité du Profil", desc: "Qui peut voir votre profil", public: "Public", private: "Privé", friendsOnly: "Amis Seulement" },
      dataCollection: { title: "Collecte de Données", desc: "Autoriser l'analyse pour améliorer le service" },
      cookies: { title: "Cookies", desc: "Accepter les cookies pour une meilleure expérience" }
    },
    security: {
      title: "Paramètres de Sécurité",
      subtitle: "Gérer la sécurité du compte",
      twoFactor: { title: "Authentification à Deux Facteurs", desc: "Ajouter une couche de sécurité", setup: "Configurer 2FA" },
      changePassword: { title: "Changer le Mot de Passe", desc: "Mettre à jour régulièrement", button: "Changer le Mot de Passe" },
      sessions: { title: "Sessions Actives", desc: "Voir les appareils connectés", view: "Voir les Sessions" }
    },
    preferences: {
      title: "Préférences",
      subtitle: "Personnaliser votre expérience",
      theme: { title: "Thème", desc: "Choisir le thème de couleur", light: "Clair", dark: "Sombre", auto: "Auto (Système)" },
      itemsPerPage: { title: "Éléments par Page", desc: "Nombre d'éléments à afficher" }
    },
    billing: {
      title: "Paramètres de Facturation",
      subtitle: "Gérer les méthodes de paiement",
      paymentMethods: { title: "Méthodes de Paiement", desc: "Gérer les méthodes enregistrées", manage: "Gérer les Méthodes" },
      billingAddress: { title: "Adresse de Facturation", desc: "Mettre à jour l'adresse", update: "Mettre à Jour" },
      invoices: { title: "Historique des Factures", desc: "Voir et télécharger les factures", view: "Voir les Factures" }
    },
    actions: { saveChanges: "Enregistrer", resetToDefault: "Réinitialiser" }
  },
  ru: {
    nav: { general: "Общие", notifications: "Уведомления", privacy: "Конфиденциальность", security: "Безопасность", preferences: "Предпочтения", billing: "Счета" },
    general: {
      title: "Общие Настройки",
      subtitle: "Управление общими настройками аккаунта",
      language: { title: "Язык", desc: "Выберите предпочитаемый язык", english: "Английский", arabic: "Арабский", russian: "Русский", ukrainian: "Украинский", french: "Французский", spanish: "Испанский" },
      timezone: { title: "Часовой Пояс", desc: "Установите ваш часовой пояс" },
      dateFormat: { title: "Формат Даты", desc: "Выберите формат отображения дат" },
      currency: { title: "Валюта", desc: "Выберите предпочитаемую валюту" }
    },
    notifications: {
      title: "Настройки Уведомлений",
      subtitle: "Управление уведомлениями",
      email: { title: "Email Уведомления", desc: "Получать уведомления по email" },
      orderUpdates: { title: "Обновления Заказов", desc: "Уведомления об изменении статуса" },
      promotional: { title: "Рекламные Письма", desc: "Получать специальные предложения" },
      sms: { title: "SMS Уведомления", desc: "Получать SMS для срочных обновлений" }
    },
    privacy: {
      title: "Настройки Конфиденциальности",
      subtitle: "Управление настройками приватности",
      profileVisibility: { title: "Видимость Профиля", desc: "Кто может видеть ваш профиль", public: "Публичный", private: "Приватный", friendsOnly: "Только Друзья" },
      dataCollection: { title: "Сбор Данных", desc: "Разрешить аналитику для улучшения сервиса" },
      cookies: { title: "Cookies", desc: "Принять cookies для лучшего опыта" }
    },
    security: {
      title: "Настройки Безопасности",
      subtitle: "Управление безопасностью аккаунта",
      twoFactor: { title: "Двухфакторная Аутентификация", desc: "Добавить дополнительный уровень безопасности", setup: "Настроить 2FA" },
      changePassword: { title: "Изменить Пароль", desc: "Регулярно обновляйте пароль", button: "Изменить Пароль" },
      sessions: { title: "Активные Сессии", desc: "Просмотр подключенных устройств", view: "Просмотреть Сессии" }
    },
    preferences: {
      title: "Предпочтения",
      subtitle: "Настройте ваш опыт",
      theme: { title: "Тема", desc: "Выберите цветовую тему", light: "Светлая", dark: "Темная", auto: "Авто (Система)" },
      itemsPerPage: { title: "Элементов на Странице", desc: "Количество отображаемых элементов" }
    },
    billing: {
      title: "Настройки Счетов",
      subtitle: "Управление способами оплаты",
      paymentMethods: { title: "Способы Оплаты", desc: "Управление сохраненными методами", manage: "Управление Методами" },
      billingAddress: { title: "Адрес Выставления Счетов", desc: "Обновить адрес", update: "Обновить Адрес" },
      invoices: { title: "История Счетов", desc: "Просмотр и скачивание счетов", view: "Просмотр Счетов" }
    },
    actions: { saveChanges: "Сохранить Изменения", resetToDefault: "Сбросить Настройки" }
  },
  ua: {
    nav: { general: "Загальні", notifications: "Сповіщення", privacy: "Конфіденційність", security: "Безпека", preferences: "Налаштування", billing: "Рахунки" },
    general: {
      title: "Загальні Налаштування",
      subtitle: "Керування загальними налаштуваннями облікового запису",
      language: { title: "Мова", desc: "Виберіть бажану мову", english: "Англійська", arabic: "Арабська", russian: "Російська", ukrainian: "Українська", french: "Французька", spanish: "Іспанська" },
      timezone: { title: "Часовий Пояс", desc: "Встановіть ваш часовий пояс" },
      dateFormat: { title: "Формат Дати", desc: "Виберіть формат відображення дат" },
      currency: { title: "Валюта", desc: "Виберіть бажану валюту" }
    },
    notifications: {
      title: "Налаштування Сповіщень",
      subtitle: "Керування сповіщеннями",
      email: { title: "Email Сповіщення", desc: "Отримувати сповіщення по email" },
      orderUpdates: { title: "Оновлення Замовлень", desc: "Сповіщення про зміну статусу" },
      promotional: { title: "Рекламні Листи", desc: "Отримувати спеціальні пропозиції" },
      sms: { title: "SMS Сповіщення", desc: "Отримувати SMS для термінових оновлень" }
    },
    privacy: {
      title: "Налаштування Конфіденційності",
      subtitle: "Керування налаштуваннями приватності",
      profileVisibility: { title: "Видимість Профілю", desc: "Хто може бачити ваш профіль", public: "Публічний", private: "Приватний", friendsOnly: "Тільки Друзі" },
      dataCollection: { title: "Збір Даних", desc: "Дозволити аналітику для покращення сервісу" },
      cookies: { title: "Cookies", desc: "Прийняти cookies для кращого досвіду" }
    },
    security: {
      title: "Налаштування Безпеки",
      subtitle: "Керування безпекою облікового запису",
      twoFactor: { title: "Двофакторна Автентифікація", desc: "Додати додатковий рівень безпеки", setup: "Налаштувати 2FA" },
      changePassword: { title: "Змінити Пароль", desc: "Регулярно оновлюйте пароль", button: "Змінити Пароль" },
      sessions: { title: "Активні Сесії", desc: "Перегляд підключених пристроїв", view: "Переглянути Сесії" }
    },
    preferences: {
      title: "Налаштування",
      subtitle: "Налаштуйте ваш досвід",
      theme: { title: "Тема", desc: "Виберіть кольорову тему", light: "Світла", dark: "Темна", auto: "Авто (Система)" },
      itemsPerPage: { title: "Елементів на Сторінці", desc: "Кількість елементів для відображення" }
    },
    billing: {
      title: "Налаштування Рахунків",
      subtitle: "Керування способами оплати",
      paymentMethods: { title: "Способи Оплати", desc: "Керування збереженими методами", manage: "Керування Методами" },
      billingAddress: { title: "Адреса Виставлення Рахунків", desc: "Оновити адресу", update: "Оновити Адресу" },
      invoices: { title: "Історія Рахунків", desc: "Перегляд і завантаження рахунків", view: "Перегляд Рахунків" }
    },
    actions: { saveChanges: "Зберегти Зміни", resetToDefault: "Скинути Налаштування" }
  }
};

// Delivery delete modal message translations
const deliveryDeleteMessageTranslations = {
  es: "¿Está seguro de que desea eliminar esta dirección?",
  fr: "Êtes-vous sûr de vouloir supprimer cette adresse?",
  ru: "Вы уверены, что хотите удалить этот адрес?",
  ua: "Ви впевнені, що хочете видалити цю адресу?"
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
    
    // 1. Add common auth section
    if (commonAuthTranslations[lang]) {
      if (!data.common) data.common = {};
      for (const [key, value] of Object.entries(commonAuthTranslations[lang])) {
        if (!data.common[key]) {
          data.common[key] = value;
          modified = true;
        }
      }
    }
    
    // 2. Add orders.details for languages missing it
    if (ordersDetailsTranslations[lang] && (!data.orders?.details || !data.orders?.details?.title)) {
      if (!data.orders) data.orders = {};
      data.orders.details = ordersDetailsTranslations[lang];
      modified = true;
    }
    
    // 3. Add tickets.details for all languages
    if (ticketsDetailsTranslations[lang]) {
      if (!data.tickets) data.tickets = {};
      if (!data.tickets.details) data.tickets.details = {};
      for (const [key, value] of Object.entries(ticketsDetailsTranslations[lang])) {
        if (!data.tickets.details[key]) {
          data.tickets.details[key] = value;
          modified = true;
        }
      }
    }
    
    // 4. Add tickets.categories.technical
    if (technicalCategoryTranslations[lang]) {
      if (!data.tickets) data.tickets = {};
      if (!data.tickets.categories) data.tickets.categories = {};
      if (!data.tickets.categories.technical) {
        data.tickets.categories.technical = technicalCategoryTranslations[lang];
        modified = true;
      }
    }
    
    // 5. Add settings.general.language names for languages that need it
    if (settingsLanguageTranslations[lang]) {
      if (!data.settings) data.settings = {};
      if (!data.settings.general) data.settings.general = {};
      if (!data.settings.general.language) data.settings.general.language = {};
      for (const [key, value] of Object.entries(settingsLanguageTranslations[lang])) {
        if (!data.settings.general.language[key]) {
          data.settings.general.language[key] = value;
          modified = true;
        }
      }
    }
    
    // 6. Add nav currency keys for languages that need them
    if (navCurrencyTranslations[lang]) {
      if (!data.nav) data.nav = {};
      for (const [key, value] of Object.entries(navCurrencyTranslations[lang])) {
        if (!data.nav[key]) {
          data.nav[key] = value;
          modified = true;
        }
      }
    }
    
    // 7. Add extended profile section for es, fr, ru, ua
    if (extendedProfileTranslations[lang]) {
      if (!data.profile) data.profile = {};
      deepMerge(data.profile, extendedProfileTranslations[lang]);
      modified = true;
    }
    
    // 8. Add extended settings section for es, fr, ru, ua
    if (extendedSettingsTranslations[lang]) {
      if (!data.settings) data.settings = {};
      deepMerge(data.settings, extendedSettingsTranslations[lang]);
      modified = true;
    }
    
    // 9. Add delivery.deleteModal.message for es, fr, ru, ua
    if (deliveryDeleteMessageTranslations[lang]) {
      if (!data.delivery) data.delivery = {};
      if (!data.delivery.deleteModal) data.delivery.deleteModal = {};
      if (!data.delivery.deleteModal.message) {
        data.delivery.deleteModal.message = deliveryDeleteMessageTranslations[lang];
        modified = true;
      }
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
