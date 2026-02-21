const fs = require('fs');
const path = require('path');

// Read English file as template
const enPath = path.join(__dirname, '../locales/en/translation.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Languages to update (excluding en and ar which are already done)
const langs = ['de', 'es', 'fr', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'tr', 'ua', 'zh'];

langs.forEach(lang => {
    const langPath = path.join(__dirname, `../locales/${lang}/translation.json`);
    
    try {
        const langData = JSON.parse(fs.readFileSync(langPath, 'utf8'));
        
        // Common flat keys
        if (!langData.common.edit) langData.common.edit = langData.common.buttons?.edit || en.common.edit;
        if (!langData.common.manage) langData.common.manage = en.common.manage;
        if (!langData.common.save) langData.common.save = langData.common.buttons?.save || en.common.save;
        if (!langData.common.cancel) langData.common.cancel = langData.common.buttons?.cancel || en.common.cancel;
        if (!langData.common.delete) langData.common.delete = langData.common.buttons?.delete || en.common.delete;
        if (!langData.common.view) langData.common.view = langData.common.buttons?.view || en.common.view;
        if (!langData.common.close) langData.common.close = langData.common.buttons?.close || en.common.close;
        if (!langData.common.submit) langData.common.submit = langData.common.buttons?.submit || en.common.submit;
        if (!langData.common.saveChanges) langData.common.saveChanges = en.common.saveChanges;
        if (!langData.common.default) langData.common.default = en.common.default;
        
        // Profile flat keys
        if (langData.profile) {
            if (!langData.profile.totalOrders) langData.profile.totalOrders = langData.profile.stats?.totalOrders || en.profile.totalOrders;
            if (!langData.profile.memberSince) langData.profile.memberSince = langData.profile.stats?.memberSince || en.profile.memberSince;
            if (!langData.profile.personalInfo || typeof langData.profile.personalInfo === 'object') {
                const piTitle = langData.profile.personalInfo?.title || en.profile.personalInfo;
                langData.profile.personalInfoObj = langData.profile.personalInfo;
                langData.profile.personalInfo = piTitle;
            }
            if (!langData.profile.fullName) langData.profile.fullName = langData.profile.personalInfoObj?.fullName || en.profile.fullName;
            if (!langData.profile.emailAddress) langData.profile.emailAddress = langData.profile.personalInfoObj?.email || en.profile.emailAddress;
            if (!langData.profile.phoneNumber) langData.profile.phoneNumber = langData.profile.personalInfoObj?.phone || en.profile.phoneNumber;
            if (!langData.profile.company) langData.profile.company = en.profile.company;
            if (!langData.profile.myAddresses) langData.profile.myAddresses = en.profile.myAddresses;
            if (!langData.profile.loadingAddresses) langData.profile.loadingAddresses = en.profile.loadingAddresses;
            if (!langData.profile.accountSecurity) langData.profile.accountSecurity = langData.profile.security?.title || en.profile.accountSecurity;
            if (!langData.profile.password) langData.profile.password = langData.profile.security?.password || en.profile.password;
            if (!langData.profile.lastChanged) langData.profile.lastChanged = en.profile.lastChanged;
            if (!langData.profile.changePassword) langData.profile.changePassword = langData.profile.security?.changePassword || en.profile.changePassword;
            if (!langData.profile.changePasswordDesc) langData.profile.changePasswordDesc = en.profile.changePasswordDesc;
            if (!langData.profile.twoFA) langData.profile.twoFA = langData.profile.security?.twoFactor || en.profile.twoFA;
            if (!langData.profile.notEnabled) langData.profile.notEnabled = langData.profile.security?.notEnabled || en.profile.notEnabled;
            if (!langData.profile.inactive) langData.profile.inactive = en.profile.inactive;
            if (!langData.profile.newsletter) langData.profile.newsletter = en.profile.newsletter;
            if (!langData.profile.subscribed) langData.profile.subscribed = en.profile.subscribed;
            if (!langData.profile.notSubscribed) langData.profile.notSubscribed = en.profile.notSubscribed;
            if (!langData.profile.editPersonalInfo) langData.profile.editPersonalInfo = en.profile.editPersonalInfo;
            if (!langData.profile.updateDetails) langData.profile.updateDetails = en.profile.updateDetails;
            if (!langData.profile.updatePassword) langData.profile.updatePassword = en.profile.updatePassword;
            if (!langData.profile.uploadPhoto) langData.profile.uploadPhoto = en.profile.uploadPhoto;
            if (!langData.profile.uploadPhotoBtn) langData.profile.uploadPhotoBtn = en.profile.uploadPhotoBtn;
            if (!langData.profile.choosePhoto) langData.profile.choosePhoto = en.profile.choosePhoto;
            if (!langData.profile.dropImage) langData.profile.dropImage = en.profile.dropImage;
            if (!langData.profile.imageFormats) langData.profile.imageFormats = en.profile.imageFormats;
            if (!langData.profile.uploading) langData.profile.uploading = en.profile.uploading;
            if (!langData.profile.passwordRequirements) langData.profile.passwordRequirements = en.profile.passwordRequirements;
            if (!langData.profile.form) langData.profile.form = en.profile.form;
            if (!langData.profile.req) langData.profile.req = en.profile.req;
        }
        
        // Settings flat keys
        if (langData.settings) {
            if (!langData.settings.resetToDefault) langData.settings.resetToDefault = langData.settings.actions?.resetToDefault || en.settings.resetToDefault;
            
            // General flat keys
            if (langData.settings.general) {
                if (typeof langData.settings.general.language === 'object') {
                    const langTitle = langData.settings.general.language.title;
                    langData.settings.general.languageDesc = langData.settings.general.language.desc;
                    langData.settings.general.language = langTitle;
                }
                if (typeof langData.settings.general.timezone === 'object') {
                    const tzTitle = langData.settings.general.timezone.title;
                    langData.settings.general.timezoneDesc = langData.settings.general.timezone.desc;
                    langData.settings.general.timezone = tzTitle;
                }
                if (typeof langData.settings.general.dateFormat === 'object') {
                    const dfTitle = langData.settings.general.dateFormat.title;
                    langData.settings.general.dateFormatDesc = langData.settings.general.dateFormat.desc;
                    langData.settings.general.dateFormat = dfTitle;
                }
                if (!langData.settings.general.currency) langData.settings.general.currency = en.settings.general.currency;
                if (!langData.settings.general.currencyDesc) langData.settings.general.currencyDesc = en.settings.general.currencyDesc;
            }
            
            // Notifications flat keys
            if (langData.settings.notifications) {
                if (typeof langData.settings.notifications.email === 'object') {
                    langData.settings.notifications.emailDesc = langData.settings.notifications.email.desc;
                    langData.settings.notifications.email = langData.settings.notifications.email.title;
                }
                if (typeof langData.settings.notifications.orderUpdates === 'object') {
                    langData.settings.notifications.orderUpdatesDesc = langData.settings.notifications.orderUpdates.desc;
                    langData.settings.notifications.orderUpdates = langData.settings.notifications.orderUpdates.title;
                }
                if (typeof langData.settings.notifications.promotional === 'object') {
                    langData.settings.notifications.promotionalDesc = langData.settings.notifications.promotional.desc;
                    langData.settings.notifications.promotional = langData.settings.notifications.promotional.title;
                }
                if (typeof langData.settings.notifications.sms === 'object') {
                    langData.settings.notifications.smsDesc = langData.settings.notifications.sms.desc;
                    langData.settings.notifications.sms = langData.settings.notifications.sms.title;
                }
            }
            
            // Privacy flat keys
            if (langData.settings.privacy) {
                if (typeof langData.settings.privacy.profileVisibility === 'object') {
                    langData.settings.privacy.visibility = langData.settings.privacy.profileVisibility.title;
                    langData.settings.privacy.visibilityDesc = langData.settings.privacy.profileVisibility.desc;
                    langData.settings.privacy.public = langData.settings.privacy.profileVisibility.public;
                    langData.settings.privacy.private = langData.settings.privacy.profileVisibility.private;
                    langData.settings.privacy.friendsOnly = langData.settings.privacy.profileVisibility.friendsOnly;
                }
                if (typeof langData.settings.privacy.dataCollection === 'object') {
                    langData.settings.privacy.dataCollectionDesc = langData.settings.privacy.dataCollection.desc;
                    langData.settings.privacy.dataCollection = langData.settings.privacy.dataCollection.title;
                }
                if (typeof langData.settings.privacy.cookies === 'object') {
                    langData.settings.privacy.cookiesDesc = langData.settings.privacy.cookies.desc;
                    langData.settings.privacy.cookies = langData.settings.privacy.cookies.title;
                }
            }
            
            // Security flat keys
            if (langData.settings.security) {
                if (typeof langData.settings.security.twoFactor === 'object') {
                    langData.settings.security.twoFA = langData.settings.security.twoFactor.title;
                    langData.settings.security.twoFADesc = langData.settings.security.twoFactor.desc;
                }
                if (typeof langData.settings.security.changePassword === 'object') {
                    langData.settings.security.changePasswordDesc = langData.settings.security.changePassword.desc;
                    langData.settings.security.changePasswordBtn = langData.settings.security.changePassword.button;
                    langData.settings.security.changePassword = langData.settings.security.changePassword.title;
                }
                if (typeof langData.settings.security.sessions === 'object') {
                    langData.settings.security.activeSessions = langData.settings.security.sessions.title;
                    langData.settings.security.activeSessionsDesc = langData.settings.security.sessions.desc;
                    langData.settings.security.viewSessions = langData.settings.security.sessions.view;
                }
            }
            
            // Preferences flat keys
            if (langData.settings.preferences) {
                if (typeof langData.settings.preferences.theme === 'object') {
                    langData.settings.preferences.themeDesc = langData.settings.preferences.theme.desc;
                    langData.settings.preferences.light = langData.settings.preferences.theme.light;
                    langData.settings.preferences.dark = langData.settings.preferences.theme.dark;
                    langData.settings.preferences.auto = langData.settings.preferences.theme.auto;
                    langData.settings.preferences.theme = langData.settings.preferences.theme.title;
                }
                if (typeof langData.settings.preferences.itemsPerPage === 'object') {
                    langData.settings.preferences.itemsPerPageDesc = langData.settings.preferences.itemsPerPage.desc;
                    langData.settings.preferences.itemsPerPage = langData.settings.preferences.itemsPerPage.title;
                }
            }
            
            // Billing flat keys
            if (langData.settings.billing) {
                if (typeof langData.settings.billing.paymentMethods === 'object') {
                    langData.settings.billing.paymentMethodsDesc = langData.settings.billing.paymentMethods.desc;
                    langData.settings.billing.managePaymentMethods = langData.settings.billing.paymentMethods.manage;
                    langData.settings.billing.paymentMethods = langData.settings.billing.paymentMethods.title;
                }
                if (typeof langData.settings.billing.billingAddress === 'object') {
                    langData.settings.billing.billingAddressDesc = langData.settings.billing.billingAddress.desc;
                    langData.settings.billing.updateAddress = langData.settings.billing.billingAddress.update;
                    langData.settings.billing.billingAddress = langData.settings.billing.billingAddress.title;
                }
                if (typeof langData.settings.billing.invoices === 'object') {
                    langData.settings.billing.invoiceHistory = langData.settings.billing.invoices.title;
                    langData.settings.billing.invoiceHistoryDesc = langData.settings.billing.invoices.desc;
                    langData.settings.billing.viewInvoices = langData.settings.billing.invoices.view;
                }
            }
        }
        
        // Payment flat keys
        if (langData.payment) {
            if (!langData.payment.addFundsDesc) langData.payment.addFundsDesc = langData.payment.addFundsModal?.subtitle || en.payment.addFundsDesc;
            if (!langData.payment.accountBalance) langData.payment.accountBalance = langData.payment.balance?.title || en.payment.accountBalance;
            if (!langData.payment.totalSpent) langData.payment.totalSpent = langData.payment.balance?.totalSpent || en.payment.totalSpent;
            if (!langData.payment.allTime) langData.payment.allTime = langData.payment.balance?.allTime || en.payment.allTime;
            if (!langData.payment.pendingPayment) langData.payment.pendingPayment = langData.payment.balance?.pending || en.payment.pendingPayment;
            if (!langData.payment.processing) langData.payment.processing = langData.payment.balance?.processing || en.payment.processing;
            if (!langData.payment.availableBalance) langData.payment.availableBalance = langData.payment.balance?.available || en.payment.availableBalance;
            if (!langData.payment.readyToUse) langData.payment.readyToUse = langData.payment.balance?.readyToUse || en.payment.readyToUse;
            if (!langData.payment.paymentMethods) langData.payment.paymentMethods = langData.payment.methods?.title || en.payment.paymentMethods;
            if (!langData.payment.addMethod) langData.payment.addMethod = langData.payment.methods?.addMethod || en.payment.addMethod;
            if (!langData.payment.noPaymentMethods) langData.payment.noPaymentMethods = langData.payment.methods?.emptyTitle || en.payment.noPaymentMethods;
            if (!langData.payment.noPaymentMethodsDesc) langData.payment.noPaymentMethodsDesc = langData.payment.methods?.emptyText || en.payment.noPaymentMethodsDesc;
            if (!langData.payment.addPaymentMethod) langData.payment.addPaymentMethod = langData.payment.methods?.addPaymentMethod || en.payment.addPaymentMethod;
            if (!langData.payment.addPaymentMethodDesc) langData.payment.addPaymentMethodDesc = langData.payment.addMethodModal?.subtitle || en.payment.addPaymentMethodDesc;
            if (!langData.payment.transactionHistory) langData.payment.transactionHistory = langData.payment.transactions?.title || en.payment.transactionHistory;
            if (!langData.payment.noTransactions) langData.payment.noTransactions = langData.payment.transactions?.emptyTitle || en.payment.noTransactions;
            if (!langData.payment.noTransactionsDesc) langData.payment.noTransactionsDesc = langData.payment.transactions?.emptyText || en.payment.noTransactionsDesc;
            if (!langData.payment.amountUSD) langData.payment.amountUSD = langData.payment.addFundsModal?.amount || en.payment.amountUSD;
            if (!langData.payment.selectPaymentMethod) langData.payment.selectPaymentMethod = langData.payment.addFundsModal?.paymentMethod || en.payment.selectPaymentMethod;
            if (!langData.payment.selectPaymentMethodPlaceholder) langData.payment.selectPaymentMethodPlaceholder = langData.payment.addFundsModal?.selectPaymentMethod || en.payment.selectPaymentMethodPlaceholder;
            if (!langData.payment.creditDebitCard) langData.payment.creditDebitCard = langData.payment.addFundsModal?.creditCard || en.payment.creditDebitCard;
            if (!langData.payment.bankTransfer) langData.payment.bankTransfer = langData.payment.addFundsModal?.bankTransfer || en.payment.bankTransfer;
            if (!langData.payment.cardHolderName) langData.payment.cardHolderName = langData.payment.addMethodModal?.cardholderName || en.payment.cardHolderName;
            if (!langData.payment.cardNumber) langData.payment.cardNumber = langData.payment.addMethodModal?.cardNumber || en.payment.cardNumber;
            if (!langData.payment.expiryDate) langData.payment.expiryDate = langData.payment.addMethodModal?.expiryDate || en.payment.expiryDate;
            if (!langData.payment.setDefault) langData.payment.setDefault = langData.payment.addMethodModal?.setDefault || en.payment.setDefault;
            if (!langData.payment.saveMethod) langData.payment.saveMethod = langData.payment.addMethodModal?.saveMethod || en.payment.saveMethod;
            if (!langData.payment.filters) {
                langData.payment.filters = {
                    all: langData.payment.transactions?.all || en.payment.filters.all,
                    completed: langData.payment.transactions?.completed || en.payment.filters.completed,
                    pending: langData.payment.transactions?.pending || en.payment.filters.pending,
                    refunded: langData.payment.transactions?.refunded || en.payment.filters.refunded
                };
            }
            if (!langData.payment.table) {
                langData.payment.table = {
                    date: langData.payment.transactions?.date || en.payment.table.date,
                    description: langData.payment.transactions?.description || en.payment.table.description,
                    type: langData.payment.transactions?.type || en.payment.table.type,
                    amount: langData.payment.transactions?.amount || en.payment.table.amount,
                    status: langData.payment.transactions?.status || en.payment.table.status,
                    actions: langData.payment.transactions?.actions || en.payment.table.actions
                };
            }
        }
        
        // Delivery flat keys
        if (langData.delivery) {
            if (typeof langData.delivery.savedAddresses === 'object') {
                langData.delivery.savedAddressesObj = langData.delivery.savedAddresses;
                langData.delivery.savedAddresses = langData.delivery.savedAddresses.title;
            }
            if (!langData.delivery.manageLocations) langData.delivery.manageLocations = langData.delivery.savedAddressesObj?.subtitle || en.delivery.manageLocations;
            if (!langData.delivery.noAddresses) langData.delivery.noAddresses = langData.delivery.emptyState?.title || en.delivery.noAddresses;
            if (!langData.delivery.noAddressesDesc) langData.delivery.noAddressesDesc = langData.delivery.emptyState?.text || en.delivery.noAddressesDesc;
            if (!langData.delivery.addAddress) langData.delivery.addAddress = langData.delivery.emptyState?.addAddress || en.delivery.addAddress;
            if (typeof langData.delivery.trackOrder === 'object') {
                langData.delivery.trackOrderObj = langData.delivery.trackOrder;
                langData.delivery.trackOrder = langData.delivery.trackOrder.title;
            }
            if (!langData.delivery.trackOrderDesc) langData.delivery.trackOrderDesc = langData.delivery.trackOrderObj?.subtitle || en.delivery.trackOrderDesc;
            if (!langData.delivery.trackingPlaceholder) langData.delivery.trackingPlaceholder = langData.delivery.trackOrderObj?.placeholder || en.delivery.trackingPlaceholder;
            if (!langData.delivery.track) langData.delivery.track = langData.delivery.trackOrderObj?.track || en.delivery.track;
            if (!langData.delivery.viewAllOrders) langData.delivery.viewAllOrders = langData.delivery.trackOrderObj?.viewAllOrders || en.delivery.viewAllOrders;
            if (!langData.delivery.deleteAddress) langData.delivery.deleteAddress = langData.delivery.deleteModal?.title || en.delivery.deleteAddress;
            if (!langData.delivery.deleteAddressConfirm) langData.delivery.deleteAddressConfirm = langData.delivery.deleteModal?.message || en.delivery.deleteAddressConfirm;
            if (!langData.delivery.fillDetails) langData.delivery.fillDetails = langData.delivery.addAddressModal?.subtitle || en.delivery.fillDetails;
            if (!langData.delivery.saveAddress) langData.delivery.saveAddress = langData.delivery.addAddressModal?.saveAddress || en.delivery.saveAddress;
            if (!langData.delivery.form) {
                langData.delivery.form = {
                    label: langData.delivery.addAddressModal?.addressLabel || en.delivery.form.label,
                    labelPlaceholder: langData.delivery.addAddressModal?.addressLabelPlaceholder || en.delivery.form.labelPlaceholder,
                    fullName: langData.delivery.addAddressModal?.fullName || en.delivery.form.fullName,
                    fullNamePlaceholder: langData.delivery.addAddressModal?.fullNamePlaceholder || en.delivery.form.fullNamePlaceholder,
                    phone: langData.delivery.addAddressModal?.phone || en.delivery.form.phone,
                    street: langData.delivery.addAddressModal?.street || en.delivery.form.street,
                    streetPlaceholder: langData.delivery.addAddressModal?.streetPlaceholder || en.delivery.form.streetPlaceholder,
                    city: langData.delivery.addAddressModal?.city || en.delivery.form.city,
                    cityPlaceholder: langData.delivery.addAddressModal?.cityPlaceholder || en.delivery.form.cityPlaceholder,
                    state: langData.delivery.addAddressModal?.state || en.delivery.form.state,
                    statePlaceholder: langData.delivery.addAddressModal?.statePlaceholder || en.delivery.form.statePlaceholder,
                    country: langData.delivery.addAddressModal?.country || en.delivery.form.country,
                    countryPlaceholder: langData.delivery.addAddressModal?.countryPlaceholder || en.delivery.form.countryPlaceholder,
                    postalCode: langData.delivery.addAddressModal?.postalCode || en.delivery.form.postalCode,
                    notes: langData.delivery.addAddressModal?.notes || en.delivery.form.notes,
                    notesPlaceholder: langData.delivery.addAddressModal?.notesPlaceholder || en.delivery.form.notesPlaceholder,
                    setDefault: langData.delivery.addAddressModal?.setDefault || en.delivery.form.setDefault,
                    optional: en.delivery.form.optional
                };
            }
        }
        
        // Tickets flat keys
        if (langData.tickets) {
            if (!langData.tickets.badge) langData.tickets.badge = langData.tickets.create?.badge || en.tickets.badge;
            if (!langData.tickets.stats) {
                langData.tickets.stats = {
                    resolved: en.tickets.stats.resolved,
                    inProgress: en.tickets.stats.inProgress,
                    open: en.tickets.stats.open
                };
            }
            if (!langData.tickets.filters) {
                langData.tickets.filters = {
                    status: en.tickets.filters.status,
                    allStatuses: en.tickets.filters.allStatuses,
                    search: en.tickets.filters.search,
                    searchPlaceholder: en.tickets.filters.searchPlaceholder,
                    apply: en.tickets.filters.apply,
                    reset: en.tickets.filters.reset
                };
            }
            if (!langData.tickets.empty) {
                langData.tickets.empty = {
                    title: en.tickets.empty.title,
                    text: en.tickets.empty.text,
                    createFirst: en.tickets.empty.createFirst
                };
            }
            if (!langData.tickets.categories?.general) {
                langData.tickets.categories = langData.tickets.categories || {};
                langData.tickets.categories.general = en.tickets.categories.general;
            }
        }
        
        fs.writeFileSync(langPath, JSON.stringify(langData, null, 2), 'utf8');
        console.log(`${lang} updated successfully`);
    } catch (err) {
        console.log(`${lang} error:`, err.message);
    }
});

console.log('All translations updated!');
