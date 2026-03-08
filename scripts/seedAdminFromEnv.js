#!/usr/bin/env node

/**
 * Seed a default admin account from environment variables.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com \
 *   ADMIN_PASSWORD=SecurePass123! \
 *   ADMIN_FIRST_NAME=John \
 *   ADMIN_LAST_NAME=Doe \
 *   ADMIN_ROLE=super_admin \
 *   node scripts/seedAdminFromEnv.js
 *
 * Env vars (required):
 *   - ADMIN_EMAIL
 *   - ADMIN_PASSWORD
 *   - ADMIN_FIRST_NAME
 *   - ADMIN_LAST_NAME
 *
 * Env vars (optional):
 *   - ADMIN_ROLE: super_admin | admin | moderator (default: super_admin)
 *
 * Behaviour:
 *   - If an admin with ADMIN_EMAIL already exists, the script exits successfully without changes.
 *   - Otherwise, it creates the admin with sensible default permissions for the chosen role.
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  // dotenv not installed, continue; process.env may already be populated
}

const Admin = require('../models/Admin');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME;
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME;
const ADMIN_ROLE = process.env.ADMIN_ROLE || 'super_admin';

// Basic validators (mirrors logic from createAdmin.js)
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  const errors = [];

  if (!password || password.length < 8) {
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

function validateRole(role) {
  const validRoles = ['super_admin', 'admin', 'moderator'];
  return validRoles.includes(role);
}

function getDefaultPermissions(role) {
  const permissions = {
    super_admin: [
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
    ],
  };

  return permissions[role] || permissions.moderator;
}

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

async function seedAdmin() {
  // Validate required env vars
  const missing = [];
  if (!ADMIN_EMAIL) missing.push('ADMIN_EMAIL');
  if (!ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
  if (!ADMIN_FIRST_NAME) missing.push('ADMIN_FIRST_NAME');
  if (!ADMIN_LAST_NAME) missing.push('ADMIN_LAST_NAME');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error(
      '   Provide them as env vars or in your .env file before running this script.'
    );
    process.exit(1);
  }

  if (!validateEmail(ADMIN_EMAIL)) {
    console.error('❌ Invalid ADMIN_EMAIL format');
    process.exit(1);
  }

  const passwordErrors = validatePassword(ADMIN_PASSWORD);
  if (passwordErrors.length > 0) {
    console.error('❌ ADMIN_PASSWORD validation failed:');
    passwordErrors.forEach((err) => console.error(`   - ${err}`));
    process.exit(1);
  }

  if (!validateRole(ADMIN_ROLE)) {
    console.error('❌ Invalid ADMIN_ROLE. Choose: super_admin, admin, or moderator');
    process.exit(1);
  }

  await connectDB();

  try {
    const email = ADMIN_EMAIL.toLowerCase();

    const existing = await Admin.findOne({ email });
    if (existing) {
      console.log(
        `\nℹ️  Admin with email ${email} already exists (id: ${existing._id}). No changes made.`
      );
      process.exit(0);
    }

    console.log('\n⏳ Seeding admin account from environment variables...');

    const admin = new Admin({
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      email,
      password: ADMIN_PASSWORD,
      role: ADMIN_ROLE,
      permissions: getDefaultPermissions(ADMIN_ROLE),
      isActive: true,
    });

    await admin.save();

    console.log('\n✅ Admin account seeded successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ID:    ${admin._id}`);
    console.log(`   Name:  ${admin.firstName} ${admin.lastName}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role:  ${admin.role}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding admin:', error.message);
    process.exit(1);
  }
}

seedAdmin();

