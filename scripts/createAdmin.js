#!/usr/bin/env node

/**
 * Admin Account Creation Script
 * 
 * Usage:
 *   Interactive mode:  node scripts/createAdmin.js
 *   CLI mode:          node scripts/createAdmin.js --email admin@example.com --password SecurePass123! --firstName John --lastName Doe --role super_admin
 * 
 * Options:
 *   --email       Required. Admin email address
 *   --password    Required. Password (min 8 chars, must include uppercase, lowercase, number, special char)
 *   --firstName   Required. Admin's first name
 *   --lastName    Required. Admin's last name
 *   --role        Optional. Admin role: super_admin, admin, or moderator (default: admin)
 */

const mongoose = require('mongoose');
const readline = require('readline');
const path = require('path');

// Try to load environment variables if dotenv is available
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  // dotenv not installed, continue without it
}

// Import Admin model
const Admin = require('../models/Admin');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        parsed[key] = value;
        i++;
      }
    }
  }
  
  return parsed;
}

// Create readline interface for interactive mode
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

// Prompt user for input
function prompt(rl, question, isPassword = false) {
  return new Promise((resolve) => {
    if (isPassword) {
      // For password, we'll still show it (readline doesn't support hidden input natively)
      // In production, consider using a package like 'readline-sync' for hidden input
      console.log('⚠️  Note: Password will be visible while typing');
    }
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Validate email format
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
function validatePassword(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
  }
  
  return errors;
}

// Validate role
function validateRole(role) {
  const validRoles = ['super_admin', 'admin', 'moderator'];
  return validRoles.includes(role);
}

// Connect to MongoDB
async function connectDB() {
  try {
    console.log('\n🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

// Check if admin already exists
async function checkExistingAdmin(email) {
  const existing = await Admin.findOne({ email: email.toLowerCase() });
  return existing;
}

// Create admin account
async function createAdmin(adminData) {
  try {
    // Check if email already exists
    const existing = await checkExistingAdmin(adminData.email);
    if (existing) {
      throw new Error(`Admin with email ${adminData.email} already exists`);
    }
    
    // Create new admin
    const admin = new Admin({
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      email: adminData.email.toLowerCase(),
      password: adminData.password,
      role: adminData.role || 'admin',
      permissions: getDefaultPermissions(adminData.role || 'admin'),
      isActive: true
    });
    
    await admin.save();
    
    return admin;
  } catch (error) {
    throw error;
  }
}

// Get default permissions based on role
function getDefaultPermissions(role) {
  const permissions = {
    super_admin: [
      // Full access within the permission enum defined on Admin model
      'read',
      'write',
      'delete',
      'manage_users',
      'manage_admins',
      'manage_orders',
      'manage_settings',
      'manage_integrations',
    ],
    admin: [
      'read',
      'write',
      'manage_users',
      'manage_orders',
      'manage_settings',
      'manage_integrations',
    ],
    moderator: [
      'read',
    ]
  };
  
  return permissions[role] || permissions.moderator;
}

// Interactive mode
async function runInteractiveMode() {
  const rl = createInterface();
  
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║           PARTSFORM ADMIN ACCOUNT CREATOR              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  try {
    // First Name
    let firstName = '';
    while (!firstName) {
      firstName = await prompt(rl, '👤 Enter first name: ');
      if (!firstName) {
        console.log('❌ First name is required');
      }
    }
    
    // Last Name
    let lastName = '';
    while (!lastName) {
      lastName = await prompt(rl, '👤 Enter last name: ');
      if (!lastName) {
        console.log('❌ Last name is required');
      }
    }
    
    // Email
    let email = '';
    while (!email || !validateEmail(email)) {
      email = await prompt(rl, '📧 Enter email address: ');
      if (!validateEmail(email)) {
        console.log('❌ Invalid email format');
      } else {
        // Check if email already exists
        const existing = await checkExistingAdmin(email);
        if (existing) {
          console.log('❌ An admin with this email already exists');
          email = '';
        }
      }
    }
    
    // Password
    let password = '';
    while (!password) {
      password = await prompt(rl, '🔐 Enter password: ', true);
      const passwordErrors = validatePassword(password);
      if (passwordErrors.length > 0) {
        console.log('❌ Password validation failed:');
        passwordErrors.forEach(err => console.log(`   - ${err}`));
        password = '';
      }
    }
    
    // Confirm password
    let confirmPassword = '';
    while (confirmPassword !== password) {
      confirmPassword = await prompt(rl, '🔐 Confirm password: ', true);
      if (confirmPassword !== password) {
        console.log('❌ Passwords do not match');
      }
    }
    
    // Role
    console.log('\n📋 Available roles:');
    console.log('   1. super_admin - Full access to all features');
    console.log('   2. admin       - Standard admin access');
    console.log('   3. moderator   - Limited access (tickets, analytics)');
    
    let role = '';
    while (!validateRole(role)) {
      role = await prompt(rl, '\n🎭 Enter role (super_admin/admin/moderator) [default: admin]: ');
      role = role || 'admin';
      if (!validateRole(role)) {
        console.log('❌ Invalid role. Choose: super_admin, admin, or moderator');
      }
    }
    
    rl.close();
    
    // Confirm creation
    console.log('\n📝 Admin account summary:');
    console.log(`   Name:  ${firstName} ${lastName}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role:  ${role}`);
    
    const confirmRl = createInterface();
    const confirm = await prompt(confirmRl, '\n✅ Create this admin account? (yes/no): ');
    confirmRl.close();
    
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('\n❌ Admin creation cancelled');
      process.exit(0);
    }
    
    // Create admin
    console.log('\n⏳ Creating admin account...');
    const admin = await createAdmin({ firstName, lastName, email, password, role });
    
    console.log('\n✅ Admin account created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ID:    ${admin._id}`);
    console.log(`   Name:  ${admin.firstName} ${admin.lastName}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role:  ${admin.role}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔐 You can now login at the homepage with these credentials\n');
    
  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    process.exit(1);
  }
}

// CLI mode
async function runCLIMode(args) {
  console.log('\n🚀 Running in CLI mode...\n');
  
  // Validate required arguments
  const required = ['email', 'password', 'firstName', 'lastName'];
  const missing = required.filter(field => !args[field]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required arguments:', missing.join(', '));
    console.log('\nUsage:');
    console.log('  node scripts/createAdmin.js --email admin@example.com --password SecurePass123! --firstName John --lastName Doe [--role admin]');
    process.exit(1);
  }
  
  // Validate email
  if (!validateEmail(args.email)) {
    console.error('❌ Invalid email format');
    process.exit(1);
  }
  
  // Validate password
  const passwordErrors = validatePassword(args.password);
  if (passwordErrors.length > 0) {
    console.error('❌ Password validation failed:');
    passwordErrors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }
  
  // Validate role if provided
  if (args.role && !validateRole(args.role)) {
    console.error('❌ Invalid role. Choose: super_admin, admin, or moderator');
    process.exit(1);
  }
  
  try {
    // Create admin
    console.log('⏳ Creating admin account...');
    const admin = await createAdmin({
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      password: args.password,
      role: args.role || 'admin'
    });
    
    console.log('\n✅ Admin account created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ID:    ${admin._id}`);
    console.log(`   Name:  ${admin.firstName} ${admin.lastName}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role:  ${admin.role}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    process.exit(1);
  }
}

// Main function
async function main() {
  try {
    await connectDB();
    
    const args = parseArgs();
    const hasArgs = Object.keys(args).length > 0;
    
    if (hasArgs) {
      await runCLIMode(args);
    } else {
      await runInteractiveMode();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
