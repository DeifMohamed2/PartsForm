#!/usr/bin/env node

/**
 * Seed a default referral partner account from environment variables.
 *
 * Usage example:
 *   REFERRAL_PARTNER_EMAIL=partner@example.com \
 *   REFERRAL_PARTNER_PASSWORD=SecurePass123! \
 *   REFERRAL_PARTNER_FIRST_NAME=John \
 *   REFERRAL_PARTNER_LAST_NAME=Doe \
 *   REFERRAL_PARTNER_PHONE="+1234567890" \
 *   node scripts/seedReferralPartnerFromEnv.js
 *
 * Required env vars:
 *   - REFERRAL_PARTNER_EMAIL
 *   - REFERRAL_PARTNER_PASSWORD
 *   - REFERRAL_PARTNER_FIRST_NAME
 *   - REFERRAL_PARTNER_LAST_NAME
 *   - REFERRAL_PARTNER_PHONE
 *
 * Optional env vars:
 *   - REFERRAL_PARTNER_COMMISSION_RATE   (default: 5)
 *   - REFERRAL_PARTNER_BUYER_DISCOUNT    (default: 3)
 *
 * Behaviour:
 *   - If a partner with REFERRAL_PARTNER_EMAIL already exists, the script exits successfully.
 *   - Otherwise, it creates an active partner who can log in at `/partner/login`.
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  // dotenv not installed; ignore
}

const Admin = require('../models/Admin');
const ReferralPartner = require('../models/ReferralPartner');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/partsform';

const EMAIL = process.env.REFERRAL_PARTNER_EMAIL;
const PASSWORD = process.env.REFERRAL_PARTNER_PASSWORD;
const FIRST_NAME = process.env.REFERRAL_PARTNER_FIRST_NAME;
const LAST_NAME = process.env.REFERRAL_PARTNER_LAST_NAME;
const PHONE = process.env.REFERRAL_PARTNER_PHONE;
const COMMISSION_RATE = Number(process.env.REFERRAL_PARTNER_COMMISSION_RATE || 5);
const BUYER_DISCOUNT = Number(process.env.REFERRAL_PARTNER_BUYER_DISCOUNT || 3);

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

async function seedReferralPartner() {
  const missing = [];
  if (!EMAIL) missing.push('REFERRAL_PARTNER_EMAIL');
  if (!PASSWORD) missing.push('REFERRAL_PARTNER_PASSWORD');
  if (!FIRST_NAME) missing.push('REFERRAL_PARTNER_FIRST_NAME');
  if (!LAST_NAME) missing.push('REFERRAL_PARTNER_LAST_NAME');
  if (!PHONE) missing.push('REFERRAL_PARTNER_PHONE');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  if (!validateEmail(EMAIL)) {
    console.error('❌ Invalid REFERRAL_PARTNER_EMAIL format');
    process.exit(1);
  }

  const passwordErrors = validatePassword(PASSWORD);
  if (passwordErrors.length > 0) {
    console.error('❌ REFERRAL_PARTNER_PASSWORD validation failed:');
    passwordErrors.forEach((err) => console.error(`   - ${err}`));
    process.exit(1);
  }

  if (Number.isNaN(COMMISSION_RATE) || COMMISSION_RATE < 0 || COMMISSION_RATE > 50) {
    console.error('❌ REFERRAL_PARTNER_COMMISSION_RATE must be a number between 0 and 50');
    process.exit(1);
  }

  if (Number.isNaN(BUYER_DISCOUNT) || BUYER_DISCOUNT < 0 || BUYER_DISCOUNT > 30) {
    console.error('❌ REFERRAL_PARTNER_BUYER_DISCOUNT must be a number between 0 and 30');
    process.exit(1);
  }

  try {
    console.log('\n🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const email = EMAIL.toLowerCase();

    const existing = await ReferralPartner.findOne({ email });
    if (existing) {
      console.log(
        `\nℹ️  Referral partner with email ${email} already exists (id: ${existing._id}). No changes made.`
      );
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('\n⏳ Seeding referral partner account from environment variables...');

    let createdBy = undefined;
    try {
      const superAdmin = await Admin.findOne({ role: 'super_admin' }).select('_id');
      if (superAdmin) {
        createdBy = superAdmin._id;
      }
    } catch (e) {
      // Optional field; ignore errors
    }

    // Use ReferralPartner model so pre-save hook hashes the password
    const partner = new ReferralPartner({
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
      email,
      phone: PHONE,
      password: PASSWORD,
      commissionRate: COMMISSION_RATE,
      buyerDiscountRate: BUYER_DISCOUNT,
      status: 'active',
      stats: {
        totalReferrals: 0,
        successfulReferrals: 0,
        pendingCommission: 0,
        paidCommission: 0,
        rejectedCommission: 0,
        totalOrderValue: 0,
      },
      createdBy,
    });

    await partner.save();

    console.log('\n✅ Referral partner account seeded successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ID:    ${partner._id}`);
    console.log(`   Name:  ${FIRST_NAME} ${LAST_NAME}`);
    console.log(`   Email: ${email}`);
    console.log(`   Phone: ${PHONE}`);
    console.log(`   Status: active`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding referral partner:', error.message);
    process.exit(1);
  }
}

seedReferralPartner();

