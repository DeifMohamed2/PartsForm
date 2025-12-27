const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const i18next = require('./config/i18n');
const middleware = require('i18next-http-middleware');

const app = express();
const PORT = process.env.PORT || 3300;

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// i18n Middleware
app.use(middleware.handle(i18next));

// Make translation function and language info available to all views
app.use((req, res, next) => {
  res.locals.t = req.t;
  res.locals.i18n = req.i18n;
  res.locals.currentLang = req.language || 'en';
  res.locals.isRTL = req.language === 'ar';
  res.locals.dir = req.language === 'ar' ? 'rtl' : 'ltr';
  next();
});

// Sectors data
const sectors = [
  {
    id: 'automotive',
    name: 'Automotive',
  },
  {
    id: 'aviation',
    name: 'Aviation',
  },
  {
    id: 'heavy-machinery',
    name: 'Heavy Machinery',
  },
];

// Mock database for parts
const partsDatabase = {
  8471474: [
    {
      id: 1,
      brand: 'Bosch',
      vendorCode: '8471474',
      description:
        'HYDRAULIC PUMP ASSEMBLY - HIGH PRESSURE SYSTEM (Primary Unit)',
      supplier: 'Premier Automotive Systems',
      origin: 'Germany',
      stock: 15,
      delivery: 7,
      weight: 12.5,
      unitPrice: 2450.0,
    },
    {
      id: 2,
      brand: 'Bosch',
      vendorCode: '8471474',
      description: 'HYDRAULIC PUMP ASSEMBLY - PREMIUM GRADE (Enhanced Model)',
      supplier: 'Gulf Parts Distribution',
      origin: 'Germany',
      stock: 8,
      delivery: 7,
      weight: 13.2,
      unitPrice: 2850.0,
    },
    {
      id: 3,
      brand: 'Continental',
      vendorCode: '8471474',
      description: 'HYDRAULIC PUMP ASSEMBLY - STANDARD GRADE',
      supplier: 'Advanced Industrial Supply',
      origin: 'France',
      stock: 20,
      delivery: 7,
      weight: 11.8,
      unitPrice: 1950.0,
    },
    {
      id: 4,
      brand: 'SKF',
      vendorCode: '8471474',
      description: 'HYDRAULIC PUMP ASSEMBLY - HEAVY DUTY INDUSTRIAL',
      supplier: 'Emirates Parts Trading',
      origin: 'Sweden',
      stock: 5,
      delivery: 7,
      weight: 14.5,
      unitPrice: 3250.0,
    },
  ],
  7825934: [
    {
      id: 5,
      brand: 'Honeywell',
      vendorCode: '7825934',
      description: 'TURBINE BLADE SET - AEROSPACE GRADE TITANIUM',
      supplier: 'Skyline Aviation Parts',
      origin: 'USA',
      stock: 12,
      delivery: 14,
      weight: 8.3,
      unitPrice: 4850.0,
    },
    {
      id: 6,
      brand: 'Pratt & Whitney',
      vendorCode: '7825934',
      description: 'TURBINE BLADE SET - COMMERCIAL AVIATION',
      supplier: 'Premier Aviation Supply',
      origin: 'USA',
      stock: 6,
      delivery: 10,
      weight: 8.7,
      unitPrice: 5200.0,
    },
    {
      id: 7,
      brand: 'Rolls-Royce',
      vendorCode: '7825934',
      description: 'TURBINE BLADE SET - PREMIUM PERFORMANCE',
      supplier: 'Global Aerospace Trading',
      origin: 'UK',
      stock: 4,
      delivery: 21,
      weight: 9.1,
      unitPrice: 6500.0,
    },
  ],
  9523847: [
    {
      id: 8,
      brand: 'Caterpillar',
      vendorCode: '9523847',
      description: 'EXCAVATOR ARM ASSEMBLY - HEAVY DUTY MODEL',
      supplier: 'Heavy Equipment Solutions',
      origin: 'USA',
      stock: 3,
      delivery: 14,
      weight: 285.0,
      unitPrice: 18500.0,
    },
    {
      id: 9,
      brand: 'Komatsu',
      vendorCode: '9523847',
      description: 'EXCAVATOR ARM ASSEMBLY - INDUSTRIAL GRADE',
      supplier: 'Machinery Parts Global',
      origin: 'Japan',
      stock: 5,
      delivery: 21,
      weight: 278.5,
      unitPrice: 16800.0,
    },
    {
      id: 10,
      brand: 'Volvo',
      vendorCode: '9523847',
      description: 'EXCAVATOR ARM ASSEMBLY - PREMIUM CONSTRUCTION',
      supplier: 'Nordic Heavy Parts',
      origin: 'Sweden',
      stock: 2,
      delivery: 28,
      weight: 292.0,
      unitPrice: 19500.0,
    },
  ],
  3461928: [
    {
      id: 11,
      brand: 'Denso',
      vendorCode: '3461928',
      description: 'FUEL INJECTION SYSTEM - DIRECT INJECTION MODULE',
      supplier: 'Automotive Systems International',
      origin: 'Japan',
      stock: 25,
      delivery: 5,
      weight: 4.2,
      unitPrice: 875.0,
    },
    {
      id: 12,
      brand: 'Bosch',
      vendorCode: '3461928',
      description: 'FUEL INJECTION SYSTEM - COMMON RAIL DIESEL',
      supplier: 'Premier Automotive Systems',
      origin: 'Germany',
      stock: 18,
      delivery: 7,
      weight: 4.5,
      unitPrice: 920.0,
    },
    {
      id: 13,
      brand: 'Continental',
      vendorCode: '3461928',
      description: 'FUEL INJECTION SYSTEM - GASOLINE DIRECT INJECTION',
      supplier: 'Advanced Industrial Supply',
      origin: 'Germany',
      stock: 22,
      delivery: 7,
      weight: 4.0,
      unitPrice: 850.0,
    },
    {
      id: 14,
      brand: 'Delphi',
      vendorCode: '3461928',
      description: 'FUEL INJECTION SYSTEM - MULTI-POINT INJECTION',
      supplier: 'Global Auto Parts Network',
      origin: 'UK',
      stock: 30,
      delivery: 5,
      weight: 3.8,
      unitPrice: 780.0,
    },
  ],
  5628194: [
    {
      id: 15,
      brand: 'Airbus',
      vendorCode: '5628194',
      description: 'LANDING GEAR ACTUATOR - MAIN GEAR ASSEMBLY',
      supplier: 'Aerospace Components Ltd',
      origin: 'France',
      stock: 8,
      delivery: 30,
      weight: 45.2,
      unitPrice: 12800.0,
    },
    {
      id: 16,
      brand: 'Boeing',
      vendorCode: '5628194',
      description: 'LANDING GEAR ACTUATOR - HYDRAULIC CONTROL UNIT',
      supplier: 'Aviation Parts Worldwide',
      origin: 'USA',
      stock: 5,
      delivery: 35,
      weight: 47.5,
      unitPrice: 13500.0,
    },
    {
      id: 17,
      brand: 'Safran',
      vendorCode: '5628194',
      description: 'LANDING GEAR ACTUATOR - PREMIUM AVIATION GRADE',
      supplier: 'European Aviation Supply',
      origin: 'France',
      stock: 3,
      delivery: 42,
      weight: 46.8,
      unitPrice: 14200.0,
    },
  ],
  1847265: [
    {
      id: 18,
      brand: 'John Deere',
      vendorCode: '1847265',
      description: 'TRANSMISSION GEARBOX - AGRICULTURAL MACHINERY',
      supplier: 'Farm Equipment Distributors',
      origin: 'USA',
      stock: 10,
      delivery: 10,
      weight: 156.0,
      unitPrice: 8950.0,
    },
    {
      id: 19,
      brand: 'ZF',
      vendorCode: '1847265',
      description: 'TRANSMISSION GEARBOX - INDUSTRIAL HEAVY DUTY',
      supplier: 'Industrial Power Systems',
      origin: 'Germany',
      stock: 7,
      delivery: 14,
      weight: 168.5,
      unitPrice: 9800.0,
    },
    {
      id: 20,
      brand: 'Allison',
      vendorCode: '1847265',
      description: 'TRANSMISSION GEARBOX - AUTOMATIC CONSTRUCTION',
      supplier: 'Heavy Machinery Solutions',
      origin: 'USA',
      stock: 6,
      delivery: 12,
      weight: 172.0,
      unitPrice: 10500.0,
    },
  ],
  4729183: [
    {
      id: 21,
      brand: 'Brembo',
      vendorCode: '4729183',
      description: 'BRAKE CALIPER ASSEMBLY - PERFORMANCE RACING',
      supplier: 'High Performance Auto Parts',
      origin: 'Italy',
      stock: 35,
      delivery: 5,
      weight: 6.8,
      unitPrice: 1450.0,
    },
    {
      id: 22,
      brand: 'Akebono',
      vendorCode: '4729183',
      description: 'BRAKE CALIPER ASSEMBLY - HEAVY DUTY COMMERCIAL',
      supplier: 'Commercial Vehicle Parts',
      origin: 'Japan',
      stock: 28,
      delivery: 7,
      weight: 7.2,
      unitPrice: 1280.0,
    },
    {
      id: 23,
      brand: 'Continental',
      vendorCode: '4729183',
      description: 'BRAKE CALIPER ASSEMBLY - ELECTRONIC PARKING BRAKE',
      supplier: 'Advanced Automotive Technology',
      origin: 'Germany',
      stock: 40,
      delivery: 5,
      weight: 6.5,
      unitPrice: 1320.0,
    },
    {
      id: 24,
      brand: 'Bosch',
      vendorCode: '4729183',
      description: 'BRAKE CALIPER ASSEMBLY - STANDARD PASSENGER VEHICLE',
      supplier: 'Premier Automotive Systems',
      origin: 'Germany',
      stock: 50,
      delivery: 3,
      weight: 6.2,
      unitPrice: 1180.0,
    },
  ],
  6293741: [
    {
      id: 25,
      brand: 'GE Aviation',
      vendorCode: '6293741',
      description: 'ENGINE CONTROL MODULE - JET PROPULSION SYSTEM',
      supplier: 'Aviation Electronics Systems',
      origin: 'USA',
      stock: 4,
      delivery: 45,
      weight: 18.5,
      unitPrice: 22500.0,
    },
    {
      id: 26,
      brand: 'Honeywell',
      vendorCode: '6293741',
      description: 'ENGINE CONTROL MODULE - TURBOFAN ENGINE',
      supplier: 'Aerospace Avionics Supply',
      origin: 'USA',
      stock: 6,
      delivery: 40,
      weight: 19.2,
      unitPrice: 21800.0,
    },
    {
      id: 27,
      brand: 'Rolls-Royce',
      vendorCode: '6293741',
      description: 'ENGINE CONTROL MODULE - WIDE BODY AIRCRAFT',
      supplier: 'International Aviation Parts',
      origin: 'UK',
      stock: 2,
      delivery: 60,
      weight: 20.1,
      unitPrice: 24500.0,
    },
  ],
};

// Mock database for support tickets
const ticketsDatabase = [
  {
    id: 'TKT-001',
    orderNumber: 'ORD-2025-001',
    subject: 'Delayed Shipment - Hydraulic Pump',
    category: 'Shipping Issue',
    priority: 'high',
    status: 'open',
    createdAt: '2025-12-20T10:30:00Z',
    updatedAt: '2025-12-23T14:20:00Z',
    messages: [
      {
        id: 1,
        sender: 'buyer',
        senderName: 'John Smith',
        message: 'My order ORD-2025-001 was supposed to arrive yesterday but I haven\'t received any tracking updates. Can you please check the status?',
        timestamp: '2025-12-20T10:30:00Z',
        attachments: []
      },
      {
        id: 2,
        sender: 'support',
        senderName: 'Sarah Johnson',
        message: 'Thank you for contacting us. I\'m looking into your order now. Let me check with our shipping department.',
        timestamp: '2025-12-20T11:15:00Z',
        attachments: []
      },
      {
        id: 3,
        sender: 'support',
        senderName: 'Sarah Johnson',
        message: 'I\'ve confirmed that your order is currently in transit. There was a slight delay at customs, but it should arrive within 2 business days. Here\'s your tracking number: TRK123456789',
        timestamp: '2025-12-20T14:30:00Z',
        attachments: []
      },
      {
        id: 4,
        sender: 'buyer',
        senderName: 'John Smith',
        message: 'Thank you for the update! I appreciate your help.',
        timestamp: '2025-12-23T14:20:00Z',
        attachments: []
      }
    ]
  },
  {
    id: 'TKT-002',
    orderNumber: 'ORD-2025-015',
    subject: 'Wrong Part Received',
    category: 'Order Issue',
    priority: 'urgent',
    status: 'in-progress',
    createdAt: '2025-12-22T09:15:00Z',
    updatedAt: '2025-12-23T16:45:00Z',
    messages: [
      {
        id: 1,
        sender: 'buyer',
        senderName: 'Michael Chen',
        message: 'I received my order today, but the part number doesn\'t match what I ordered. I ordered part #8471474 but received #8471475.',
        timestamp: '2025-12-22T09:15:00Z',
        attachments: ['photo1.jpg', 'photo2.jpg']
      },
      {
        id: 2,
        sender: 'support',
        senderName: 'David Martinez',
        message: 'I sincerely apologize for this error. We\'ll arrange for a replacement to be shipped immediately and provide a return label for the incorrect part.',
        timestamp: '2025-12-22T10:30:00Z',
        attachments: []
      },
      {
        id: 3,
        sender: 'support',
        senderName: 'David Martinez',
        message: 'Your replacement has been shipped with expedited delivery. Tracking number: EXP987654321. You should receive it tomorrow.',
        timestamp: '2025-12-23T16:45:00Z',
        attachments: ['return_label.pdf']
      }
    ]
  },
  {
    id: 'TKT-003',
    orderNumber: 'ORD-2025-008',
    subject: 'Request for Technical Specifications',
    category: 'Product Inquiry',
    priority: 'medium',
    status: 'resolved',
    createdAt: '2025-12-18T13:20:00Z',
    updatedAt: '2025-12-19T11:30:00Z',
    messages: [
      {
        id: 1,
        sender: 'buyer',
        senderName: 'Emma Wilson',
        message: 'Could you please provide the detailed technical specifications for the turbine blade set I ordered? I need the exact material composition and tolerances.',
        timestamp: '2025-12-18T13:20:00Z',
        attachments: []
      },
      {
        id: 2,
        sender: 'support',
        senderName: 'Sarah Johnson',
        message: 'Absolutely! I\'ve attached the complete technical specification sheet for your turbine blade set. It includes material composition, tolerances, and certification documents.',
        timestamp: '2025-12-19T09:00:00Z',
        attachments: ['tech_specs.pdf', 'certification.pdf']
      },
      {
        id: 3,
        sender: 'buyer',
        senderName: 'Emma Wilson',
        message: 'Perfect! This is exactly what I needed. Thank you so much for the quick response.',
        timestamp: '2025-12-19T11:30:00Z',
        attachments: []
      }
    ]
  },
  {
    id: 'TKT-004',
    orderNumber: 'ORD-2025-022',
    subject: 'Payment Processing Issue',
    category: 'Payment',
    priority: 'high',
    status: 'open',
    createdAt: '2025-12-23T08:00:00Z',
    updatedAt: '2025-12-23T08:00:00Z',
    messages: [
      {
        id: 1,
        sender: 'buyer',
        senderName: 'Robert Taylor',
        message: 'My payment was declined but the amount was charged to my card. Can you please investigate this issue?',
        timestamp: '2025-12-23T08:00:00Z',
        attachments: ['bank_statement.pdf']
      }
    ]
  },
  {
    id: 'TKT-005',
    orderNumber: 'ORD-2025-019',
    subject: 'Request for Invoice Copy',
    category: 'Documentation',
    priority: 'low',
    status: 'resolved',
    createdAt: '2025-12-21T15:45:00Z',
    updatedAt: '2025-12-21T16:30:00Z',
    messages: [
      {
        id: 1,
        sender: 'buyer',
        senderName: 'Lisa Anderson',
        message: 'I need a copy of the invoice for my recent order for accounting purposes.',
        timestamp: '2025-12-21T15:45:00Z',
        attachments: []
      },
      {
        id: 2,
        sender: 'support',
        senderName: 'David Martinez',
        message: 'I\'ve attached a copy of your invoice. Let me know if you need anything else!',
        timestamp: '2025-12-21T16:30:00Z',
        attachments: ['invoice_ORD-2025-019.pdf']
      }
    ]
  }
];

// Set app locals for global access
app.locals.sectors = sectors;
app.locals.partsDatabase = partsDatabase;
app.locals.ticketsDatabase = ticketsDatabase;

// Routes
const landingRoutes = require('./routes/landing');
const buyerRoutes = require('./routes/buyer');
const adminRoutes = require('./routes/admin');

// Use routes
app.use('/', landingRoutes);
app.use('/buyer', buyerRoutes);
app.use('/admin', adminRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 PARTSFORM Server Running!\n`);
  console.log(`   ➜ Local:    http://localhost:${PORT}`);
  console.log(`   ➜ Views:    ${path.join(__dirname, 'views')}`);
});
