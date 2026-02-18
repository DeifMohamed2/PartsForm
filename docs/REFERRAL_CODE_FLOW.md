# Referral Code System - Complete Flow Documentation

## Overview

The PARTSFORM referral system allows partners to earn commissions when buyers they refer place orders. The key concept is that **referral codes are used at BUYER REGISTRATION, not at checkout**. Once a buyer signs up with a referral code, they are **permanently linked** to that partner, and all future orders generate commissions.

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           REFERRAL CODE FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  1. ADMIN CREATES   │     │  2. PARTNER SHARES  │     │  3. BUYER REGISTERS │
│     PARTNER         │────▶│     REFERRAL CODE   │────▶│     WITH CODE       │
│                     │     │                     │     │                     │
│  • Name/Email       │     │  "DEIMOH-52LEWU"    │     │  • Validates code   │
│  • Commission: 5%   │     │                     │     │  • Links to partner │
│  • Discount: 3%     │     │  Partner gets:      │     │  • Saves to account │
│                     │     │  • Unique code      │     │                     │
│  Auto-generates:    │     │  • Dashboard link   │     │  Buyer gets:        │
│  ReferralCode doc   │     │  • Share materials  │     │  • 3% discount on   │
└─────────────────────┘     └─────────────────────┘     │    ALL orders       │
                                                        └──────────┬──────────┘
                                                                   │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐│
│  │  6. PAYOUT          │     │  5. COMMISSION      │     │  4. BUYER PLACES    ││
│  │     PROCESSING      │◀────│     CREATED         │◀────│     ORDER           ││
│  │                     │     │                     │     │                     ││
│  │  Admin pays         │     │  • Status: pending  │     │  Order: AED 1,000   ││
│  │  approved           │     │  • Auto-approved on │     │                     ││
│  │  commissions        │     │    order complete   │     │  Subtotal: 1,000    ││
│  │                     │     │  • Rate: 5%         │     │  Discount: -30 (3%) ││
│  │  Partner receives:  │     │  • Amount: AED 50   │     │  Total: AED 970     ││
│  │  AED 50             │     │                     │     │                     ││
│  └─────────────────────┘     └─────────────────────┘     └─────────────────────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Step-by-Step Process

### Step 1: Admin Creates Referral Partner

**Location:** Admin Panel → Referrals → Partners → Create New

When admin creates a partner:

1. **Partner Details Saved:**
   - Name, Email, Phone
   - Commission Rate (default: 5%)
   - Buyer Discount Rate (default: 3%)
   - Payment details (bank/PayPal)

2. **Auto-Generated ReferralCode:**
   ```javascript
   // Example: Partner "Deif Mohamed" gets code "DEIMOH-52LEWU"
   {
     code: "DEIMOH-52LEWU",
     name: "Default",
     commissionRate: 5,        // Partner earns 5% of order subtotal
     buyerDiscountRate: 3,     // Buyers get 3% off
     validFrom: Date.now(),
     validUntil: +1 month,     // Default validity
     status: "active",
     maxUses: null             // Unlimited (null or 0 = unlimited)
   }
   ```

### Step 2: Partner Shares Code

Partner shares their referral code `DEIMOH-52LEWU` with potential buyers through:
- Social media
- Email marketing
- Website
- Direct sharing

### Step 3: Buyer Registers with Referral Code

**Location:** Registration Page (`/register`)

**UI Flow:**
```
┌─────────────────────────────────────────┐
│  REFERRAL CODE (Optional)               │
│  Have a referral code?                  │
│  ┌────────────────────────┬──────────┐  │
│  │ 🎫 DEIMOH-52LEWU       │ ✓ Verify │  │
│  └────────────────────────┴──────────┘  │
│  ┌──────────────────────────────────┐   │
│  │ ✅ Valid! You'll get 3% discount │   │
│  │    on all orders (referred by    │   │
│  │    Deif Mohamed)                 │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Backend Process:**
1. **Validation API** (`POST /api/referral/validate-registration`):
   ```javascript
   // Request
   { code: "DEIMOH-52LEWU" }
   
   // Response
   {
     success: true,
     valid: true,
     referral: {
       code: "DEIMOH-52LEWU",
       codeId: "69910d4e505a9b7ebe776036",
       partnerId: "69910d4e505a9b7ebe776034",
       partnerName: "Deif Mohamed",
       discountRate: 3,
       commissionRate: 5
     }
   }
   ```

2. **Registration Saves Referral to Buyer Account:**
   ```javascript
   // Buyer document in MongoDB
   {
     firstName: "John",
     lastName: "Smith",
     email: "john@example.com",
     // ... other fields
     
     // PERMANENT referral link
     registrationReferral: {
       code: "DEIMOH-52LEWU",
       codeId: ObjectId("69910d4e505a9b7ebe776036"),
       partnerId: ObjectId("69910d4e505a9b7ebe776034"),
       partnerName: "Deif Mohamed",
       discountRate: 3,        // Locked at registration time
       commissionRate: 5,      // Locked at registration time
       registeredAt: new Date()
     }
   }
   ```

3. **Code Stats Updated:**
   ```javascript
   referralCode.stats.totalUses += 1;
   referralCode.stats.uniqueBuyers += 1;
   ```

### Step 4: Buyer Places Order

**When buyer creates an order, the system automatically:**

1. **Checks for Registration Referral:**
   ```javascript
   if (buyer.registrationReferral && buyer.registrationReferral.code) {
     // Verify partner is still active
     const partner = await ReferralPartner.findById(buyer.registrationReferral.partnerId);
     
     if (partner && partner.status === 'active') {
       // Calculate discount
       const discountRate = buyer.registrationReferral.discountRate; // 3%
       const discountAmount = orderSubtotal * (discountRate / 100);
       // AED 1,000 × 3% = AED 30 discount
     }
   }
   ```

2. **Applies Discount to Order:**
   ```javascript
   // Order pricing calculation
   {
     subtotal: 1000,           // Sum of all items
     discount: 30,             // Referral discount (3%)
     processingFee: 0,
     total: 970                // subtotal - discount + fee
   }
   ```

3. **Saves Referral Info on Order:**
   ```javascript
   // Order document
   {
     orderNumber: "ORD-202602-0001",
     pricing: {
       subtotal: 1000,
       discount: 30,
       total: 970
     },
     referral: {
       referralCode: "DEIMOH-52LEWU",
       referralPartner: ObjectId("69910d4e505a9b7ebe776034"),
       discountRate: 3,
       discountAmount: 30,
       commissionRate: 5,
       commissionAmount: 50,    // 5% of 1000
       commissionStatus: "pending"
     }
   }
   ```

### Step 5: Commission Created

**Immediately after order creation:**

```javascript
// ReferralCommission document
{
  referralPartner: ObjectId("69910d4e505a9b7ebe776034"),
  order: ObjectId("order_id"),
  orderNumber: "ORD-202602-0001",
  buyer: ObjectId("buyer_id"),
  buyerEmail: "john@example.com",
  
  // Financial details
  orderSubtotal: 1000,
  orderTotal: 970,
  commissionRate: 5,
  commissionAmount: 50,        // AED 50 for partner
  buyerDiscountRate: 3,
  buyerDiscountAmount: 30,     // AED 30 saved by buyer
  
  // Status tracking
  status: "pending",           // pending → approved → paid
  orderStatus: "pending",
  
  // Period for reporting
  periodMonth: 2,              // February
  periodYear: 2026
}
```

**Commission Status Flow:**
```
pending ──▶ approved ──▶ paid
    │           
    └──▶ rejected (if fraud detected)
    │
    └──▶ cancelled (if order cancelled)
```

### Step 6: Commission Approval & Payout

1. **Auto-Approval:** When order status changes to `completed` or `delivered`:
   ```javascript
   commission.status = 'approved';
   ```

2. **Admin Creates Payout Batch:**
   - Groups all approved commissions for a partner
   - Creates payout record
   - Marks commissions as `paid` when payment sent

---

## 💰 Financial Summary Example

**Scenario:** Buyer registers with code `DEIMOH-52LEWU` and places AED 1,000 order

| Item | Amount | Notes |
|------|--------|-------|
| Order Subtotal | AED 1,000 | Sum of all parts |
| Buyer Discount (3%) | -AED 30 | Saved by buyer |
| **Buyer Pays** | **AED 970** | Final amount |
| Partner Commission (5%) | AED 50 | Earned by partner |
| **PARTSFORM Revenue** | **AED 920** | After discount & commission |

---

## 🔍 Validation Rules

A referral code is **VALID** when:
1. ✅ Code exists in database
2. ✅ Status is `active`
3. ✅ Current date is after `validFrom`
4. ✅ Current date is before `validUntil` (or `validUntil` is null)
5. ✅ Partner status is `active`
6. ✅ `maxUses` not reached (null or 0 = unlimited)

A code is **INVALID** when:
- ❌ Code doesn't exist
- ❌ Status is `inactive` or `expired`
- ❌ Code hasn't started yet (before `validFrom`)
- ❌ Code has expired (after `validUntil`)
- ❌ Partner is suspended/inactive
- ❌ Usage limit reached (only if `maxUses` > 0)

---

## 🗄️ Database Models Summary

### 1. ReferralPartner
Stores partner account information and overall stats.

### 2. ReferralCode
Individual codes with validity periods. Each partner can have multiple codes.

### 3. Buyer.registrationReferral
Embedded document linking buyer to their referral partner permanently.

### 4. Order.referral
Embedded document storing referral details for each order.

### 5. ReferralCommission
Tracks individual commissions for each referred order.

### 6. ReferralPayout
Batches approved commissions for payment processing.

---

## 🧪 Testing the Flow

Run the test script:
```bash
node scripts/testReferralCode.js DEIMOH-52LEWU
```

Expected output:
```
✅ Code is VALID and ready to use!
- isValid(): true
- hasReachedLimit(): false
- findValidCode(): FOUND
```

---

## ❓ Common Issues & Fixes

### Issue: "Invalid or expired referral code"
**Causes:**
1. `maxUses` was set to 0 (now fixed - 0 means unlimited)
2. Code has expired (`validUntil` passed)
3. Partner is inactive

**Fix:** Check code in database:
```javascript
// MongoDB query
db.referralcodes.findOne({ code: "DEIMOH-52LEWU" })
```

### Issue: Discount not applied
**Causes:**
1. Buyer not registered with code (code must be used at signup)
2. Partner became inactive after registration

**Fix:** Check buyer's `registrationReferral` field.

### Issue: Commission not created
**Causes:**
1. Partner inactive when order placed
2. Commission already exists for order

**Fix:** Check `referralcommissions` collection.
