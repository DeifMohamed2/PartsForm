/**
 * Automotive Parts Seed Script (Advanced)
 * Generates 1,000,000 parts with shared part numbers across multiple suppliers
 *
 * Design:
 * - ~25,000 unique base part numbers
 * - Each part listed by 25–55 different suppliers (same part#, different stock, price, supplier)
 * - Supplier-tier pricing (premium / standard / budget)
 * - Stock: in-stock, low-stock, out-of-stock, on-order
 * - Batched inserts, progress + ETA
 *
 * Usage: node scripts/seedAutomotiveParts.js
 * Env:   SEED_TOTAL=1000000 (default) | SEED_BATCH=5000 | SEED_CLEAR=1 (drop Parts first)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Part = require('../models/Part');
const connectDB = require('../config/database');

// ============================================================================
// CONFIG
// ============================================================================

const TOTAL_PARTS = parseInt(process.env.SEED_TOTAL || '1000000', 10);
const BATCH_SIZE = parseInt(process.env.SEED_BATCH || '5000', 10);
const CLEAR_FIRST = process.env.SEED_CLEAR === '1' || process.env.SEED_CLEAR === 'true';

/** Unique base part count - increased to support 10M+ parts */
const UNIQUE_BASE_PARTS = 250_000;
/** Min/max supplier listings per base part (same part#, different supplier/stock) */
const LISTINGS_PER_PART_MIN = 25;
const LISTINGS_PER_PART_MAX = 55;

// ============================================================================
// AUTOMOTIVE DATA LIBRARIES
// ============================================================================

const MANUFACTURERS = {
  engine: ['Bosch', 'Denso', 'ACDelco', 'Delphi', 'Motorcraft', 'NGK', 'Champion', 'Mahle', 'Federal-Mogul', 'Aisin', 'Continental', 'BorgWarner', 'Gates', 'Holley', 'Edelbrock', 'MSD Ignition', 'K&N', 'Spectre Performance'],
  brakes: ['Brembo', 'Akebono', 'EBC Brakes', 'Wagner', 'Raybestos', 'Centric Parts', 'StopTech', 'Power Stop', 'Hawk Performance', 'Wilwood', 'Baer Brakes', 'DBA', 'R1 Concepts', 'Bendix', 'TRW', 'ATE'],
  suspension: ['Monroe', 'Bilstein', 'KYB', 'Gabriel', 'Rancho', 'Fox Racing Shox', 'Eibach', 'H&R', 'Tein', 'Koni', 'Skyjacker', 'Rough Country', 'Moog', 'ACDelco', 'Energy Suspension', 'Whiteline'],
  electrical: ['Bosch', 'Denso', 'ACDelco', 'Delphi', 'Standard Motor Products', 'Dorman', 'Optima Batteries', 'Interstate Batteries', 'Odyssey Battery', 'VARTA', 'Exide', 'DieHard', 'Duralast', 'Philips', 'Sylvania', 'OSRAM'],
  transmission: ['BorgWarner', 'Aisin', 'ZF Friedrichshafen', 'Tremec', 'Getrag', 'Eaton', 'Allison Transmission', 'JATCO', 'ACDelco', 'ATP', 'Hayden', 'B&M Racing'],
  cooling: ['Mishimoto', 'Spectra Premium', 'Denso', 'TYC', 'Modine', 'Valeo', 'CSF', 'Gates', 'ACDelco', 'Dorman', 'Four Seasons', 'Behr'],
  exhaust: ['MagnaFlow', 'Flowmaster', 'Borla', 'Gibson', 'Walker', 'AP Exhaust', 'Banks Power', 'Corsa Performance', 'MBRP', 'Dynomax', 'Cherry Bomb', 'Thrush'],
  steering: ['Moog', 'TRW', 'ZF Friedrichshafen', 'JTEKT', 'NSK', 'ACDelco', 'Cardone', 'Dorman', 'Raybestos', 'Detroit Axle', 'SPC Performance'],
  filters: ['K&N', 'Wix', 'Mann-Filter', 'Bosch', 'Fram', 'Purolator', 'Baldwin', 'ACDelco', 'Motorcraft', 'Denso', 'Hastings', 'Mobil 1', 'Royal Purple'],
  lighting: ['Philips', 'Sylvania', 'OSRAM', 'Hella', 'KC HiLiTES', 'Rigid Industries', 'Baja Designs', 'Morimoto', 'Depo', 'TYC', 'Spyder Auto', 'AnzoUSA'],
  fuel: ['Bosch', 'Denso', 'Delphi', 'ACDelco', 'Carter', 'Airtex', 'Holley', 'Aeromotive', 'Walbro', 'DeatschWerks', 'Injector Dynamics', 'FIC'],
  body: ['Dorman', 'Replace', 'Sherman', 'Keystone', 'LKQ', 'OE Replacement', 'Goodmark', 'AMD', 'Dynacorn', 'Auto Metal Direct', 'Golden Star']
};

/** Supplier name -> tier. Affects price multiplier and delivery. */
const SUPPLIER_TIERS = {
  premium: { priceMult: [1.05, 1.18], deliveryBonus: -1 },
  standard: { priceMult: [0.96, 1.06], deliveryBonus: 0 },
  budget: { priceMult: [0.82, 0.95], deliveryBonus: 2 }
};

const SUPPLIER_BASE = [
  { name: "AutoZone Distribution", tier: 'budget' },
  { name: "O'Reilly Auto Parts", tier: 'standard' },
  { name: 'NAPA Auto Parts', tier: 'premium' },
  { name: 'Advance Auto Parts', tier: 'standard' },
  { name: 'RockAuto', tier: 'budget' },
  { name: 'Summit Racing', tier: 'premium' },
  { name: 'JEGS', tier: 'standard' },
  { name: 'PartsGeek', tier: 'budget' },
  { name: 'CarParts.com', tier: 'standard' },
  { name: 'AutoPartsWarehouse', tier: 'budget' },
  { name: 'Pep Boys', tier: 'standard' },
  { name: 'Genuine Parts Company', tier: 'premium' },
  { name: 'LKQ Corporation', tier: 'standard' },
  { name: 'Dorman Products', tier: 'budget' },
  { name: 'Standard Motor Products', tier: 'standard' },
  { name: 'Federal-Mogul Motorparts', tier: 'premium' },
  { name: 'Tenneco', tier: 'standard' },
  { name: 'Continental Automotive', tier: 'premium' },
  { name: 'Delphi Technologies', tier: 'premium' },
  { name: 'ZF Aftermarket', tier: 'premium' },
  { name: 'Hella Aftermarket', tier: 'standard' },
  { name: 'Valeo Service', tier: 'standard' },
  { name: 'Dayco Products', tier: 'budget' }
];

/** Expand with regional branches so we have 60+ unique suppliers for 40+ listings/part */
const REGIONS = ['North', 'South', 'East', 'West', 'Central', 'Midwest', 'Northeast', 'Southeast', 'Southwest', 'Northwest'];
const SUPPLIERS = (() => {
  const out = [...SUPPLIER_BASE];
  SUPPLIER_BASE.forEach((s, i) => {
    if (i >= 10) return;
    REGIONS.slice(0, 4).forEach(r => {
      out.push({ name: `${s.name} · ${r}`, tier: s.tier });
    });
  });
  return out;
})();

const CATEGORIES = {
  'Engine': {
    subcategories: ['Engine Block', 'Cylinder Head', 'Pistons', 'Crankshaft', 'Camshaft', 'Timing', 'Gaskets'], brandCategory: 'engine', parts: [
      { name: 'Piston Ring Set', prefix: 'PRS', priceRange: [45, 250] }, { name: 'Cylinder Head Gasket', prefix: 'CHG', priceRange: [35, 180] }, { name: 'Timing Belt', prefix: 'TBK', priceRange: [25, 150] }, { name: 'Timing Chain Kit', prefix: 'TCK', priceRange: [80, 350] }, { name: 'Camshaft', prefix: 'CAM', priceRange: [150, 800] }, { name: 'Crankshaft Pulley', prefix: 'CRP', priceRange: [45, 200] }, { name: 'Valve Cover Gasket', prefix: 'VCG', priceRange: [15, 85] }, { name: 'Oil Pan Gasket', prefix: 'OPG', priceRange: [20, 95] }, { name: 'Engine Mount', prefix: 'EMT', priceRange: [35, 180] }, { name: 'Rocker Arm', prefix: 'RKA', priceRange: [25, 120] }, { name: 'Push Rod Set', prefix: 'PRS2', priceRange: [30, 150] }, { name: 'Lifter Set', prefix: 'LFS', priceRange: [45, 220] }
    ]
  },
  'Ignition System': {
    subcategories: ['Spark Plugs', 'Ignition Coils', 'Distributors', 'Wires'], brandCategory: 'engine', parts: [
      { name: 'Spark Plug', prefix: 'SPK', priceRange: [4, 35] }, { name: 'Ignition Coil', prefix: 'ICL', priceRange: [25, 180] }, { name: 'Ignition Coil Pack', prefix: 'ICP', priceRange: [65, 280] }, { name: 'Spark Plug Wire Set', prefix: 'SPW', priceRange: [25, 150] }, { name: 'Distributor Cap', prefix: 'DCP', priceRange: [15, 65] }, { name: 'Distributor Rotor', prefix: 'DRT', priceRange: [8, 35] }, { name: 'Ignition Control Module', prefix: 'ICM', priceRange: [45, 250] }, { name: 'Crank Position Sensor', prefix: 'CPS', priceRange: [25, 120] }, { name: 'Cam Position Sensor', prefix: 'CMS', priceRange: [25, 130] }
    ]
  },
  'Brake System': {
    subcategories: ['Pads', 'Rotors', 'Calipers', 'Lines', 'Master Cylinder'], brandCategory: 'brakes', parts: [
      { name: 'Brake Pad Set Front', prefix: 'BPF', priceRange: [25, 180] }, { name: 'Brake Pad Set Rear', prefix: 'BPR', priceRange: [22, 160] }, { name: 'Brake Rotor Front', prefix: 'BRF', priceRange: [35, 250] }, { name: 'Brake Rotor Rear', prefix: 'BRR', priceRange: [30, 220] }, { name: 'Brake Caliper', prefix: 'BCL', priceRange: [65, 350] }, { name: 'Brake Master Cylinder', prefix: 'BMC', priceRange: [55, 280] }, { name: 'Brake Drum', prefix: 'BDM', priceRange: [45, 180] }, { name: 'Brake Shoe Set', prefix: 'BSS', priceRange: [25, 120] }, { name: 'Brake Line Kit', prefix: 'BLK', priceRange: [35, 180] }, { name: 'Brake Booster', prefix: 'BBT', priceRange: [120, 450] }, { name: 'ABS Sensor', prefix: 'ABS', priceRange: [25, 95] }, { name: 'Wheel Cylinder', prefix: 'WCY', priceRange: [18, 65] }
    ]
  },
  'Suspension': {
    subcategories: ['Shocks', 'Struts', 'Control Arms', 'Ball Joints', 'Springs'], brandCategory: 'suspension', parts: [
      { name: 'Shock Absorber Front', prefix: 'SAF', priceRange: [45, 250] }, { name: 'Shock Absorber Rear', prefix: 'SAR', priceRange: [40, 220] }, { name: 'Strut Assembly Front', prefix: 'STF', priceRange: [85, 380] }, { name: 'Strut Assembly Rear', prefix: 'STR', priceRange: [75, 350] }, { name: 'Control Arm Upper', prefix: 'CAU', priceRange: [55, 220] }, { name: 'Control Arm Lower', prefix: 'CAL', priceRange: [60, 250] }, { name: 'Ball Joint', prefix: 'BJT', priceRange: [25, 120] }, { name: 'Tie Rod End', prefix: 'TRE', priceRange: [18, 85] }, { name: 'Sway Bar Link', prefix: 'SBL', priceRange: [15, 75] }, { name: 'Coil Spring', prefix: 'CSP', priceRange: [45, 200] }, { name: 'Leaf Spring', prefix: 'LSP', priceRange: [120, 450] }, { name: 'Strut Mount', prefix: 'SMT', priceRange: [25, 95] }, { name: 'Wheel Bearing Hub', prefix: 'WBH', priceRange: [55, 280] }
    ]
  },
  'Steering': {
    subcategories: ['Power Steering', 'Rack and Pinion', 'Steering Column'], brandCategory: 'steering', parts: [
      { name: 'Power Steering Pump', prefix: 'PSP', priceRange: [75, 320] }, { name: 'Steering Rack', prefix: 'SRK', priceRange: [180, 650] }, { name: 'Steering Gear Box', prefix: 'SGB', priceRange: [220, 780] }, { name: 'Tie Rod Assembly', prefix: 'TRA', priceRange: [45, 180] }, { name: 'Idler Arm', prefix: 'IDA', priceRange: [35, 150] }, { name: 'Pitman Arm', prefix: 'PTA', priceRange: [40, 160] }, { name: 'Steering Shaft', prefix: 'SSH', priceRange: [85, 280] }, { name: 'Power Steering Hose', prefix: 'PSH', priceRange: [25, 95] }
    ]
  },
  'Cooling System': {
    subcategories: ['Radiator', 'Water Pump', 'Thermostat', 'Hoses', 'Fans'], brandCategory: 'cooling', parts: [
      { name: 'Radiator', prefix: 'RAD', priceRange: [120, 450] }, { name: 'Water Pump', prefix: 'WPM', priceRange: [45, 220] }, { name: 'Thermostat', prefix: 'THM', priceRange: [12, 65] }, { name: 'Thermostat Housing', prefix: 'THH', priceRange: [25, 95] }, { name: 'Radiator Hose Upper', prefix: 'RHU', priceRange: [15, 55] }, { name: 'Radiator Hose Lower', prefix: 'RHL', priceRange: [15, 55] }, { name: 'Heater Core', prefix: 'HTC', priceRange: [65, 280] }, { name: 'Cooling Fan Assembly', prefix: 'CFA', priceRange: [120, 380] }, { name: 'Coolant Reservoir', prefix: 'CRV', priceRange: [25, 95] }, { name: 'Radiator Cap', prefix: 'RCP', priceRange: [8, 25] }, { name: 'Fan Clutch', prefix: 'FCL', priceRange: [45, 180] }
    ]
  },
  'Exhaust System': {
    subcategories: ['Manifold', 'Catalytic Converter', 'Muffler', 'Pipes'], brandCategory: 'exhaust', parts: [
      { name: 'Exhaust Manifold', prefix: 'EXM', priceRange: [120, 450] }, { name: 'Catalytic Converter', prefix: 'CAT', priceRange: [180, 850] }, { name: 'Muffler', prefix: 'MUF', priceRange: [65, 350] }, { name: 'Exhaust Pipe', prefix: 'EXP', priceRange: [45, 180] }, { name: 'Flex Pipe', prefix: 'FXP', priceRange: [35, 120] }, { name: 'Resonator', prefix: 'RES', priceRange: [55, 220] }, { name: 'Exhaust Tip', prefix: 'EXT', priceRange: [25, 150] }, { name: 'Exhaust Gasket', prefix: 'EXG', priceRange: [8, 35] }, { name: 'O2 Sensor', prefix: 'O2S', priceRange: [35, 180] }, { name: 'EGR Valve', prefix: 'EGR', priceRange: [55, 220] }
    ]
  },
  'Transmission': {
    subcategories: ['Clutch', 'Flywheel', 'Torque Converter', 'Gears'], brandCategory: 'transmission', parts: [
      { name: 'Clutch Kit', prefix: 'CLK', priceRange: [150, 550] }, { name: 'Clutch Disc', prefix: 'CLD', priceRange: [65, 250] }, { name: 'Pressure Plate', prefix: 'PPL', priceRange: [85, 320] }, { name: 'Flywheel', prefix: 'FLW', priceRange: [180, 650] }, { name: 'Torque Converter', prefix: 'TQC', priceRange: [220, 780] }, { name: 'Transmission Mount', prefix: 'TMT', priceRange: [35, 120] }, { name: 'Shift Cable', prefix: 'SHC', priceRange: [45, 150] }, { name: 'CV Axle', prefix: 'CVA', priceRange: [65, 280] }, { name: 'CV Joint', prefix: 'CVJ', priceRange: [35, 150] }, { name: 'Axle Shaft', prefix: 'AXS', priceRange: [85, 350] }, { name: 'Differential', prefix: 'DIF', priceRange: [350, 1200] }
    ]
  },
  'Fuel System': {
    subcategories: ['Fuel Pump', 'Injectors', 'Fuel Tank', 'Fuel Lines'], brandCategory: 'fuel', parts: [
      { name: 'Fuel Pump', prefix: 'FPM', priceRange: [85, 380] }, { name: 'Fuel Pump Module', prefix: 'FPU', priceRange: [120, 450] }, { name: 'Fuel Injector', prefix: 'FIJ', priceRange: [45, 220] }, { name: 'Fuel Injector Set', prefix: 'FIS', priceRange: [180, 750] }, { name: 'Fuel Filter', prefix: 'FFL', priceRange: [12, 65] }, { name: 'Fuel Pressure Regulator', prefix: 'FPR', priceRange: [35, 150] }, { name: 'Fuel Rail', prefix: 'FRL', priceRange: [65, 280] }, { name: 'Throttle Body', prefix: 'THB', priceRange: [120, 450] }, { name: 'Fuel Tank', prefix: 'FTK', priceRange: [180, 650] }, { name: 'Fuel Sending Unit', prefix: 'FSU', priceRange: [45, 180] }
    ]
  },
  'Electrical': {
    subcategories: ['Battery', 'Alternator', 'Starter', 'Sensors'], brandCategory: 'electrical', parts: [
      { name: 'Alternator', prefix: 'ALT', priceRange: [120, 450] }, { name: 'Starter Motor', prefix: 'STM', priceRange: [95, 380] }, { name: 'Battery', prefix: 'BAT', priceRange: [85, 350] }, { name: 'Mass Air Flow Sensor', prefix: 'MAF', priceRange: [45, 220] }, { name: 'Throttle Position Sensor', prefix: 'TPS', priceRange: [25, 120] }, { name: 'Coolant Temperature Sensor', prefix: 'CTS', priceRange: [15, 65] }, { name: 'Oil Pressure Sensor', prefix: 'OPS', priceRange: [18, 75] }, { name: 'MAP Sensor', prefix: 'MAP', priceRange: [35, 150] }, { name: 'Knock Sensor', prefix: 'KNS', priceRange: [25, 120] }, { name: 'Speed Sensor', prefix: 'VSS', priceRange: [25, 95] }, { name: 'Voltage Regulator', prefix: 'VRG', priceRange: [35, 150] }, { name: 'Ignition Switch', prefix: 'IGS', priceRange: [35, 150] }
    ]
  },
  'Filters': {
    subcategories: ['Air Filter', 'Oil Filter', 'Fuel Filter', 'Cabin Filter'], brandCategory: 'filters', parts: [
      { name: 'Air Filter', prefix: 'AFR', priceRange: [12, 65] }, { name: 'Oil Filter', prefix: 'OFR', priceRange: [8, 35] }, { name: 'Fuel Filter', prefix: 'FFR', priceRange: [15, 75] }, { name: 'Cabin Air Filter', prefix: 'CAF', priceRange: [15, 55] }, { name: 'Transmission Filter Kit', prefix: 'TFK', priceRange: [25, 120] }, { name: 'PCV Valve', prefix: 'PCV', priceRange: [8, 35] }, { name: 'Air Filter Box', prefix: 'AFB', priceRange: [45, 180] }, { name: 'Cold Air Intake', prefix: 'CAI', priceRange: [150, 450] }
    ]
  },
  'Lighting': {
    subcategories: ['Headlights', 'Taillights', 'Fog Lights', 'Bulbs'], brandCategory: 'lighting', parts: [
      { name: 'Headlight Assembly', prefix: 'HLA', priceRange: [85, 450] }, { name: 'Taillight Assembly', prefix: 'TLA', priceRange: [65, 320] }, { name: 'Fog Light Assembly', prefix: 'FLA', priceRange: [45, 220] }, { name: 'Headlight Bulb', prefix: 'HLB', priceRange: [15, 120] }, { name: 'LED Headlight Kit', prefix: 'LED', priceRange: [65, 350] }, { name: 'HID Conversion Kit', prefix: 'HID', priceRange: [85, 380] }, { name: 'Turn Signal Bulb', prefix: 'TSB', priceRange: [8, 35] }, { name: 'Brake Light Bulb', prefix: 'BLB', priceRange: [8, 35] }, { name: 'Third Brake Light', prefix: 'TBL', priceRange: [35, 150] }, { name: 'Side Mirror Light', prefix: 'SML', priceRange: [25, 95] }
    ]
  },
  'Body Parts': {
    subcategories: ['Bumpers', 'Fenders', 'Hoods', 'Doors', 'Mirrors'], brandCategory: 'body', parts: [
      { name: 'Front Bumper Cover', prefix: 'FBC', priceRange: [120, 550] }, { name: 'Rear Bumper Cover', prefix: 'RBC', priceRange: [120, 520] }, { name: 'Fender', prefix: 'FND', priceRange: [85, 380] }, { name: 'Hood', prefix: 'HOD', priceRange: [180, 750] }, { name: 'Grille', prefix: 'GRL', priceRange: [65, 350] }, { name: 'Side Mirror', prefix: 'SMR', priceRange: [55, 280] }, { name: 'Door Handle', prefix: 'DHD', priceRange: [25, 120] }, { name: 'Window Regulator', prefix: 'WRG', priceRange: [45, 180] }, { name: 'Door Lock Actuator', prefix: 'DLA', priceRange: [35, 150] }, { name: 'Rocker Panel', prefix: 'RKP', priceRange: [85, 350] }, { name: 'Trunk Lid', prefix: 'TRL', priceRange: [250, 850] }, { name: 'Tailgate', prefix: 'TLG', priceRange: [350, 1200] }
    ]
  },
  'HVAC': {
    subcategories: ['AC Compressor', 'Condenser', 'Evaporator', 'Blower'], brandCategory: 'cooling', parts: [
      { name: 'AC Compressor', prefix: 'ACC', priceRange: [180, 650] }, { name: 'AC Condenser', prefix: 'ACD', priceRange: [120, 380] }, { name: 'AC Evaporator', prefix: 'ACE', priceRange: [150, 450] }, { name: 'Blower Motor', prefix: 'BLM', priceRange: [55, 220] }, { name: 'Blower Motor Resistor', prefix: 'BMR', priceRange: [25, 95] }, { name: 'AC Receiver Drier', prefix: 'ARD', priceRange: [35, 120] }, { name: 'AC Expansion Valve', prefix: 'AEV', priceRange: [35, 150] }, { name: 'AC Hose', prefix: 'ACH', priceRange: [45, 180] }, { name: 'Heater Valve', prefix: 'HTV', priceRange: [25, 95] }
    ]
  },
  'Belts & Hoses': {
    subcategories: ['Serpentine Belt', 'V-Belt', 'Timing Belt', 'Hoses'], brandCategory: 'engine', parts: [
      { name: 'Serpentine Belt', prefix: 'SBT', priceRange: [18, 65] }, { name: 'V-Belt', prefix: 'VBT', priceRange: [12, 45] }, { name: 'Timing Belt', prefix: 'TMB', priceRange: [25, 120] }, { name: 'Belt Tensioner', prefix: 'BTN', priceRange: [45, 180] }, { name: 'Idler Pulley', prefix: 'IDP', priceRange: [25, 95] }, { name: 'Radiator Hose', prefix: 'RDH', priceRange: [18, 65] }, { name: 'Heater Hose', prefix: 'HTH', priceRange: [12, 45] }, { name: 'Brake Hose', prefix: 'BRH', priceRange: [18, 75] }, { name: 'Power Steering Hose', prefix: 'PSH2', priceRange: [35, 120] }
    ]
  }
};

const VEHICLE_COMPATIBILITY = {
  'Ford': ['F-150', 'Mustang', 'Explorer', 'Escape', 'Focus', 'Fusion', 'Ranger', 'Edge', 'Bronco', 'Expedition'],
  'Chevrolet': ['Silverado', 'Camaro', 'Corvette', 'Equinox', 'Traverse', 'Malibu', 'Colorado', 'Tahoe', 'Suburban', 'Blazer'],
  'GMC': ['Sierra', 'Canyon', 'Yukon', 'Acadia', 'Terrain', 'Savana'],
  'Dodge': ['Ram 1500', 'Challenger', 'Charger', 'Durango', 'Journey', 'Grand Caravan'],
  'Jeep': ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Gladiator', 'Renegade'],
  'Toyota': ['Camry', 'Corolla', 'RAV4', 'Tacoma', 'Tundra', 'Highlander', '4Runner', 'Prius', 'Supra', 'Sienna'],
  'Honda': ['Civic', 'Accord', 'CR-V', 'Pilot', 'Odyssey', 'Ridgeline', 'HR-V', 'Passport'],
  'Nissan': ['Altima', 'Maxima', 'Rogue', 'Pathfinder', 'Frontier', 'Titan', 'Sentra', '370Z', 'Murano'],
  'BMW': ['3 Series', '5 Series', '7 Series', 'X3', 'X5', 'X7', 'M3', 'M5'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'S-Class', 'GLC', 'GLE', 'GLS', 'AMG GT'],
  'Audi': ['A4', 'A6', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'RS6', 'R8'],
  'Hyundai': ['Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Palisade', 'Kona', 'Ioniq'],
  'Kia': ['Forte', 'K5', 'Sportage', 'Sorento', 'Telluride', 'Stinger', 'EV6']
};

const ORIGINS = ['USA', 'Germany', 'Japan', 'South Korea', 'China', 'Mexico', 'Canada', 'Italy', 'UK', 'France', 'Taiwan', 'Poland', 'Spain', 'Czech Republic', 'Hungary', 'Brazil', 'Turkey'];
const CONDITIONS = ['New', 'OEM', 'Aftermarket', 'Remanufactured', 'OE Replacement'];

// -----------------------------------------------------------------------------
// Flatten (category, partType) for deterministic base-part assignment
// -----------------------------------------------------------------------------
const CATEGORY_PART_FLAT = [];
for (const [catName, cat] of Object.entries(CATEGORIES)) {
  for (const pt of cat.parts) {
    CATEGORY_PART_FLAT.push({ categoryName: catName, category: cat, partType: pt, subcategory: cat.subcategories[0] });
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function randomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomPrice(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }

function toAlpha2(n) {
  const a = Math.floor(n / 26) % 26;
  const b = n % 26;
  return String.fromCharCode(65 + a) + String.fromCharCode(65 + b);
}

/** Deterministic unique part number for base part index. */
function basePartNumber(prefix, baseIndex) {
  const pad = String(baseIndex).padStart(6, '0');
  return `${prefix}-${pad}-${toAlpha2(baseIndex % 676)}`;
}

function randomQuantity() {
  const r = Math.random();
  if (r < 0.06) return 0;
  if (r < 0.22) return randomInt(1, 5);
  if (r < 0.58) return randomInt(6, 25);
  if (r < 0.88) return randomInt(26, 100);
  return randomInt(101, 500);
}

function weightForCategory(categoryName) {
  const ranges = { 'Engine': [0.5, 25], 'Ignition System': [0.05, 2], 'Brake System': [0.3, 15], 'Suspension': [1, 20], 'Steering': [2, 25], 'Cooling System': [0.5, 15], 'Exhaust System': [2, 30], 'Transmission': [1, 50], 'Fuel System': [0.2, 10], 'Electrical': [0.1, 15], 'Filters': [0.1, 2], 'Lighting': [0.2, 5], 'Body Parts': [1, 30], 'HVAC': [1, 15], 'Belts & Hoses': [0.1, 1.5] };
  const [min, max] = ranges[categoryName] || [0.5, 10];
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function deliveryDaysForQty(quantity, deliveryBonus = 0) {
  let base;
  if (quantity > 50) base = randomInt(1, 3);
  else if (quantity > 10) base = randomInt(2, 6);
  else if (quantity > 0) base = randomInt(5, 11);
  else base = randomInt(14, 27);
  return Math.max(1, base + deliveryBonus);
}

/** Pick n distinct suppliers. */
function pickDistinctSuppliers(n) {
  const pool = [...SUPPLIERS];
  const out = [];
  while (out.length < n && pool.length > 0) {
    const i = randomInt(0, pool.length - 1);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** Price multiplier for supplier tier + small variance. */
function supplierPriceMultiplier(supplier) {
  const t = SUPPLIER_TIERS[supplier.tier] || SUPPLIER_TIERS.standard;
  const [lo, hi] = t.priceMult;
  return Math.random() * (hi - lo) + lo;
}

function stockStatus(quantity, useOnOrder) {
  if (quantity > 10) return 'in-stock';
  if (quantity > 0) return 'low-stock';
  return useOnOrder ? 'on-order' : 'out-of-stock';
}

// ============================================================================
// BASE PART DEFINITIONS (unique part numbers)
// ============================================================================

function buildBasePartDefinitions() {
  const out = [];
  for (let i = 0; i < UNIQUE_BASE_PARTS; i++) {
    const flat = CATEGORY_PART_FLAT[i % CATEGORY_PART_FLAT.length];
    const { categoryName, category, partType, subcategory } = flat;
    const brand = randomElement(MANUFACTURERS[category.brandCategory]);
    const [pMin, pMax] = partType.priceRange;
    const basePrice = randomPrice(pMin, pMax);
    const partNumber = basePartNumber(partType.prefix, i);
    const make = randomElement(Object.keys(VEHICLE_COMPATIBILITY));
    const model = randomElement(VEHICLE_COMPATIBILITY[make]);
    const y1 = 2015 + randomInt(0, 8);
    const y2 = Math.min(y1 + randomInt(1, 5), 2026);
    const compat = `${y1}-${y2} ${make} ${model}`;
    const condition = randomElement(CONDITIONS);
    const desc = `${condition} ${brand} ${partType.name} - Compatible with ${compat}`;
    const tags = [
      categoryName.toLowerCase(),
      partType.name.toLowerCase().replace(/\s+/g, '-'),
      brand.toLowerCase(),
      'automotive', 'auto-parts', 'car-parts',
      subcategory.toLowerCase().replace(/\s+/g, '-')
    ];
    out.push({
      partNumber,
      description: desc,
      brand,
      category: categoryName,
      subcategory: randomElement(category.subcategories),
      partTypeName: partType.name,
      basePrice,
      weight: weightForCategory(categoryName),
      origin: randomElement(ORIGINS),
      tags: [...new Set(tags)],
      rawData: { generated: true, generatedAt: new Date().toISOString(), version: '2.0.0', partType: partType.name }
    });
  }
  return out;
}

// ============================================================================
// SUPPLIER LISTINGS (same part#, different supplier, stock, price)
// ============================================================================

function createListingsForBasePart(base, targetCount) {
  const suppliers = pickDistinctSuppliers(Math.min(targetCount, SUPPLIERS.length));
  const listings = [];

  for (const sup of suppliers) {
    const qty = randomQuantity();
    const useOnOrder = qty === 0 && Math.random() < 0.12;
    const mult = supplierPriceMultiplier(sup);
    const price = parseFloat((base.basePrice * mult).toFixed(2));
    const tierConfig = SUPPLIER_TIERS[sup.tier] || SUPPLIER_TIERS.standard;
    const deliveryDays = deliveryDaysForQty(qty, tierConfig.deliveryBonus);
    const stock = stockStatus(qty, useOnOrder);

    const searchText = [base.partNumber, base.description, base.brand, sup.name, base.origin].filter(Boolean).join(' ').toLowerCase();
    listings.push({
      partNumber: base.partNumber,
      description: base.description,
      brand: base.brand,
      supplier: sup.name,
      price,
      currency: 'USD',
      quantity: qty,
      stock,
      origin: base.origin,
      weight: base.weight,
      weightUnit: 'kg',
      deliveryDays,
      category: base.category,
      subcategory: base.subcategory,
      tags: base.tags,
      integrationName: 'Automotive Parts Simulation',
      fileName: 'seed_automotive_parts.csv',
      rawData: {
        ...base.rawData,
        supplierTier: sup.tier,
        condition: randomElement(CONDITIONS)
      },
      searchText,
      lastUpdated: new Date(),
      importedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      isIndexed: false
    });
  }

  return listings;
}

// ============================================================================
// SEED RUNNER (batched, progress, ETA)
// ============================================================================

async function runSeed() {
  const startMs = Date.now();
  console.log(`\n📦 Target: ${TOTAL_PARTS.toLocaleString()} parts (${UNIQUE_BASE_PARTS.toLocaleString()} unique part numbers, ~${LISTINGS_PER_PART_MIN}-${LISTINGS_PER_PART_MAX} suppliers each)\n`);

  const baseParts = buildBasePartDefinitions();
  let inserted = 0;
  let totalGenerated = 0;
  let batch = [];
  const listMin = LISTINGS_PER_PART_MIN;
  const listMax = LISTINGS_PER_PART_MAX;

  for (let i = 0; i < baseParts.length && totalGenerated < TOTAL_PARTS; i++) {
    const remain = TOTAL_PARTS - totalGenerated;
    const partsLeft = baseParts.length - i;
    const avgPerPart = Math.max(listMin, Math.min(listMax, Math.ceil(remain / Math.max(1, partsLeft))));
    const n = Math.min(avgPerPart, listMax, remain, SUPPLIERS.length);
    if (n <= 0) break;

    const listings = createListingsForBasePart(baseParts[i], n);
    for (const doc of listings) {
      if (totalGenerated >= TOTAL_PARTS) break;
      totalGenerated++;
      batch.push(doc);
      if (batch.length >= BATCH_SIZE) {
        const result = await Part.insertMany(batch, { ordered: false });
        inserted += result.length;
        batch = [];

        const elapsed = (Date.now() - startMs) / 1000;
        const rate = totalGenerated / elapsed;
        const eta = rate > 0 ? (TOTAL_PARTS - totalGenerated) / rate : 0;
        const pct = ((totalGenerated / TOTAL_PARTS) * 100).toFixed(2);
        process.stdout.write(`\r   ✅ ${totalGenerated.toLocaleString()} / ${TOTAL_PARTS.toLocaleString()} (${pct}%) · ${rate.toFixed(0)}/s · ETA ${(eta / 60).toFixed(1)} min`);
      }
    }
  }

  if (batch.length > 0) {
    const result = await Part.insertMany(batch, { ordered: false });
    inserted += result.length;
  }

  const totalSec = ((Date.now() - startMs) / 1000).toFixed(2);
  console.log(`\n\n✅ Seed complete: ${inserted.toLocaleString()} parts in ${totalSec}s (${(inserted / totalSec).toFixed(0)}/s)\n`);
  return inserted;
}

// ============================================================================
// STATS
// ============================================================================

async function displayStats() {
  const total = await Part.countDocuments();
  console.log('📊 Database stats:');
  console.log(`   Total parts: ${total.toLocaleString()}`);

  const byPartNumber = await Part.aggregate([
    { $group: { _id: '$partNumber', count: { $sum: 1 } } },
    { $group: { _id: null, avg: { $avg: '$count' }, min: { $min: '$count' }, max: { $max: '$count' } } }
  ]);
  if (byPartNumber.length) {
    const { avg, min, max } = byPartNumber[0];
    console.log(`   Listings per part#: avg ${avg.toFixed(1)}, min ${min}, max ${max}`);
  }

  const byStock = await Part.aggregate([{ $group: { _id: '$stock', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
  console.log('   By stock:');
  byStock.forEach(({ _id, count }) => console.log(`      ${_id}: ${count.toLocaleString()}`));

  const bySupplier = await Part.aggregate([
    { $group: { _id: '$supplier', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 }
  ]);
  console.log('   Top suppliers by listing count:');
  bySupplier.forEach(({ _id, count }) => console.log(`      ${_id}: ${count.toLocaleString()}`));

  const priceAgg = await Part.aggregate([
    { $group: { _id: '$partNumber', prices: { $push: '$price' }, suppliers: { $push: '$supplier' } } },
    { $project: { spread: { $subtract: [{ $max: '$prices' }, { $min: '$prices' }] }, count: { $size: '$suppliers' } } },
    { $match: { count: { $gte: 2 } } },
    { $group: { _id: null, avgSpread: { $avg: '$spread' } } }
  ]);
  if (priceAgg.length) {
    console.log(`   Avg price spread per part# (multi-supplier): $${priceAgg[0].avgSpread.toFixed(2)}`);
  }
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   🚗 Automotive Parts Seed (Advanced)');
  console.log('   Same part numbers · Multiple suppliers · 1M parts');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await connectDB();

    const existing = await Part.countDocuments();
    console.log(`   Existing parts: ${existing.toLocaleString()}`);

    if (CLEAR_FIRST && existing > 0) {
      console.log('   Dropping Parts collection (SEED_CLEAR=1)...');
      await Part.deleteMany({});
      console.log('   Done.\n');
    } else if (existing > 0) {
      console.log('   New parts will be added. Set SEED_CLEAR=1 to drop first.\n');
    }

    await runSeed();
    await displayStats();

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   ✅ Seed complete');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } catch (e) {
    console.error('\n❌ Seed failed:', e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(process.exitCode || 0);
  }
}

main();
