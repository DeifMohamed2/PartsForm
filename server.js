const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Mock database for parts
const partsDatabase = {
    '8471474': [
        {
            id: 1,
            brand: 'Bosch',
            vendorCode: '8471474',
            description: 'HYDRAULIC PUMP ASSEMBLY - HIGH PRESSURE SYSTEM (Primary Unit)',
            supplier: 'Premier Automotive Systems',
            origin: 'Germany',
            stock: 15,
            delivery: 7,
            weight: 12.5,
            unitPrice: 2450.00
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
            unitPrice: 2850.00
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
            unitPrice: 1950.00
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
            unitPrice: 3250.00
        }
    ]
};

// Sectors data
const sectors = [
    {
        id: 'automotive',
        name: 'Automotive',
        description: 'Precision parts for automotive manufacturing. From engine components to electrical systems, connect with certified suppliers meeting OEM standards.',
        image: 'https://images.unsplash.com/photo-1758873263428-f4b2edb45fe1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
        suppliers: '800+',
        growth: '+24%'
    },
    {
        id: 'aviation',
        name: 'Aviation',
        description: 'Aerospace-grade components with full traceability. Access suppliers with AS9100 certification and proven track records in commercial and defense aviation.',
        image: 'https://images.unsplash.com/photo-1711920090140-cd5894c37fc8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
        suppliers: '650+',
        growth: '+31%'
    },
    {
        id: 'heavy-machinery',
        name: 'Heavy Machinery',
        description: 'Industrial-strength parts for construction and mining equipment. Partner with suppliers specializing in high-load, extreme-condition components.',
        image: 'https://images.unsplash.com/photo-1621470777049-006c9b58119a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
        suppliers: '950+',
        growth: '+18%'
    }
];

// Routes
const landingRoutes = require('./routes/landing');
const buyerRoutes = require('./routes/buyer');

// API endpoint for search
app.post('/api/search', (req, res) => {
    const { partNumber } = req.body;
    const results = partsDatabase[partNumber] || [];
    
    res.json({
        success: results.length > 0,
        count: results.length,
        partNumber: partNumber,
        results: results
    });
});

// API endpoint to get sectors data
app.get('/api/sectors', (req, res) => {
    res.json(sectors);
});

// Use routes
app.use('/', landingRoutes);
app.use('/buyer', buyerRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 PARTSFORM Server Running!\n`);
    console.log(`   ➜ Local:    http://localhost:${PORT}`);
    console.log(`   ➜ Views:    ${path.join(__dirname, 'views')}`);
    console.log(`\n✨ Features:`);
    console.log(`   • Hero slider with 5 industrial images`);
    console.log(`   • Professional header with sign-in modal`);
    console.log(`   • All sections: Hero, Sectors, Advantages, Contact`);
    console.log(`\n📊 API Endpoints:`);
    console.log(`   • POST /api/search - Search for parts`);
    console.log(`   • GET /api/sectors - Get sectors data`);
    console.log(`\n🎨 Tech Stack:`);
    console.log(`   • EJS Templates`);
    console.log(`   • Custom CSS`);
    console.log(`   • Lucide Icons`);
    console.log(`   • Express.js backend\n`);
});
