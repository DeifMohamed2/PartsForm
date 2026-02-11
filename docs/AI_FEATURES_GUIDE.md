# 🤖 PartsForm AI — Complete Features Guide

> **Your Intelligent Parts Sourcing Assistant**
> Powered by Google Gemini AI · Built for Speed, Accuracy & Smart Decisions

---

## Table of Contents

1. [What is PartsForm AI?](#1-what-is-partsform-ai)
2. [AI Smart Search — Talk to It Like a Human](#2-ai-smart-search)
3. [How AI Picks the Best Option for You](#3-how-ai-picks-the-best-option)
4. [AI Badges — Know What's Best at a Glance](#4-ai-badges)
5. [AI Comparison Insights — When Options Are Close](#5-ai-comparison-insights)
6. [AI Excel Import — Upload a Spreadsheet, Get Results](#6-ai-excel-import)
7. [AI Email Processing — Send an Email, Get a Quote](#7-ai-email-processing)
8. [AI Quotation Generator](#8-ai-quotation-generator)
9. [AI Learning — It Gets Smarter Over Time](#9-ai-learning)
10. [Supported Languages & Currencies](#10-supported-languages--currencies)
11. [What the AI Understands (Filter Reference)](#11-what-the-ai-understands)
12. [Frequently Asked Questions](#12-frequently-asked-questions)

---

<br>

## 1. What is PartsForm AI?

PartsForm AI is an intelligent assistant built into every part of the platform. It helps you **find parts faster**, **compare options smarter**, and **make better purchasing decisions** — all using plain, everyday language.

Instead of manually filling out filters, dropdowns, and checkboxes, you simply **tell the AI what you need** in your own words, and it does the rest.

### Key Capabilities

| Capability                 | What It Does                                                 |
| :------------------------- | :----------------------------------------------------------- |
| 🔍 **Smart Search**        | Understands natural language queries like a human would      |
| 📊 **Intelligent Ranking** | Scores every result on price, delivery, stock & availability |
| 🏅 **AI Badges**           | Labels the best, cheapest, fastest & highest-stock options   |
| 💡 **Comparison Insights** | Explains tradeoffs when options are close                    |
| 📋 **Excel Import**        | Reads your spreadsheet and searches all parts at once        |
| 📧 **Email Processing**    | Processes inquiry emails and auto-generates quotations       |
| 🧠 **Continuous Learning** | Gets smarter with every search across all users              |

### Technology

PartsForm AI is powered by **Google Gemini 2.0 Flash** — one of the most advanced AI models available — combined with a custom-built deterministic engine that ensures **reliable, consistent, and fast** results every time.

---

<br>

## 2. AI Smart Search

### How to Use It

1. Click the **AI Smart Filter** button (✨) on the search page
2. Type what you're looking for **in plain English** (or Arabic, French, Spanish, Russian, Ukrainian)
3. Press Enter or click the search icon
4. View your results — ranked, scored, and badged by AI

### Example Queries

| What You Type                               | What the AI Understands                                             |
| :------------------------------------------ | :------------------------------------------------------------------ |
| `find the best one for R000000195 only one` | Search for part number R000000195, quantity = 1, rank by best value |
| `cheap Toyota brake pads under $50`         | Vehicle: Toyota · Category: Brake Pads · Max Price: $50             |
| `SKF bearings with fast delivery`           | Brand: SKF · Category: Bearings · Delivery: Express                 |
| `Bosch oil filter in stock`                 | Brand: Bosch · Category: Oil Filters · Stock: Available             |
| `German suppliers, not Chinese, over $100`  | Origin: Germany · Exclude: China · Min Price: $100                  |
| `need 50 units of spark plugs`              | Category: Spark Plugs · Quantity: 50 units                          |
| `OEM brake discs between $30 and $80`       | Quality: OEM · Category: Brake Discs · Price: $30–$80               |

### What Happens Behind the Scenes

```
Your Query → AI Understands Intent → Searches Database → Filters Results → Scores & Ranks → Shows Badges & Insights
```

1. **Intent Parsing** — The AI reads your query and extracts structured information (part numbers, brands, price limits, delivery preferences, etc.)
2. **Database Search** — It searches across all available parts using the fastest method available (Elasticsearch or MongoDB)
3. **Smart Filtering** — Price ranges, stock levels, delivery times, brands, and exclusions are applied automatically
4. **AI Scoring** — Every result gets a score based on multiple factors (see Section 3)
5. **Badge Assignment** — The best options get labeled so you can spot them instantly

### Typo Tolerance

The AI automatically corrects common typos:

| You Type   | AI Understands |
| :--------- | :------------- |
| `bosh`     | **BOSCH**      |
| `toyta`    | **TOYOTA**     |
| `mersedes` | **MERCEDES**   |
| `bremb`    | **BREMBO**     |

---

<br>

## 3. How AI Picks the Best Option

### The Old Way (Before)

Previously, the system only looked at **quantity** (stock level) to decide which option is "best." A part with 10,000 units in stock would rank #1 even if it was expensive and had slow delivery.

### The New Way — Multi-Factor AI Scoring

Now, the AI evaluates every result on **four weighted factors** and calculates a composite score from 0 to 100:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   AI Score = Price (35%) + Delivery (30%)       │
│            + Quantity (20%) + Stock (15%)        │
│                                                 │
└─────────────────────────────────────────────────┘
```

| Factor                    | Weight  | Why It Matters                                                    |
| :------------------------ | :-----: | :---------------------------------------------------------------- |
| 💰 **Price**              | **35%** | Lower price = higher score. Your budget matters most.             |
| 🚚 **Delivery Time**      | **30%** | Faster delivery = higher score. Time is money.                    |
| 📦 **Quantity Available** | **20%** | More stock = higher score. Ensures you can get what you need.     |
| ✅ **In Stock**           | **15%** | Available items get a bonus. No point ranking out-of-stock parts. |

### How Scoring Works — An Example

Imagine you search for part **R000000195** and get two results:

|              | Option A | Option B |
| :----------- | :------: | :------: |
| **Price**    |  $18.82  |  $21.89  |
| **Delivery** | 60 days  | 30 days  |
| **Quantity** |  10,000  |  10,000  |
| **In Stock** |  ✅ Yes  |  ✅ Yes  |

**Old system:** Both would tie (same quantity).

**New AI system:**

- Option A: Cheaper price (higher price score) but slower delivery (lower delivery score)
- Option B: More expensive but **much faster delivery**
- AI might score Option B higher because the 30-day faster delivery (30% weight) outweighs the $3 price difference (35% weight)

The AI doesn't just pick blindly — it **balances all factors** and explains why.

---

<br>

## 4. AI Badges

When results appear, you'll see colored badges next to the top options. Each badge tells you something specific:

| Badge                   |   Icon    | Meaning                                      |
| :---------------------- | :-------: | :------------------------------------------- |
| 🏆 **Best Overall**     |   Crown   | Highest combined AI score across all factors |
| 💰 **Cheapest**         |    Tag    | Lowest price among the results               |
| ⚡ **Fastest Delivery** | Lightning | Fewest delivery days                         |
| 📦 **Highest Stock**    | Warehouse | Most units available                         |
| ✅ **Only Option**      | Checkmark | The only matching result found               |

### Visual Example

```
┌───────────────────────────────────────────────────────────────────┐
│ 🏆  SUZUKI  R000000195  Horloge  10000  $18.82  60d  In Stock   │
│     ⭐ Best overall value — balanced price, stock & delivery     │
├───────────────────────────────────────────────────────────────────┤
│ ⚡  SUZUKI  R000000195  No desc  10000  $21.89  30d  In Stock   │
│     ⚡ Fastest delivery (30 days)                                │
└───────────────────────────────────────────────────────────────────┘
```

A single result can have **multiple badges**. For example, one option could be both the cheapest AND the fastest.

---

<br>

## 5. AI Comparison Insights

When the top options are very close in score, the AI doesn't just pick one — it **explains the tradeoffs** so you can make an informed decision.

### Tie Detection

When the top 2 results score within 5 points of each other, the AI shows:

```
┌──────────────────────────────────────────────────────┐
│  ⚖️  Top 2 options are very close in overall score   │
│                                                      │
│  ┌─────────────┐         ┌─────────────┐            │
│  │  Supplier A  │   VS   │  Supplier B  │            │
│  │  ✓ lower     │         │  ✓ faster    │            │
│  │    price     │         │    delivery  │            │
│  └─────────────┘         └─────────────┘            │
└──────────────────────────────────────────────────────┘
```

### Tradeoff Analysis

When the cheapest option and the fastest option are different, the AI calculates exactly what you'd save vs. how much time you'd gain:

> _"Save ~15% choosing the cheapest, or get it 30 days sooner with the faster option"_

This helps you decide: **Do I prioritize saving money or saving time?**

---

<br>

## 6. AI Excel Import

### Perfect For

- Buyers with **lists of 10–500+ parts** in a spreadsheet
- **Fleet maintenance teams** ordering from a parts list
- **Procurement departments** processing purchase requisitions

### How to Use It

1. Click the **Excel Import** button on the search page
2. **Drag and drop** your file (or click to browse)
3. The AI **automatically detects** part numbers, quantities, and brands from your columns
4. **Review** the extracted parts — edit quantities, remove items, or filter by confidence level
5. Click **Search All** — the AI searches every part simultaneously
6. **Compare results** and add the best options to your cart in bulk

### Supported Formats

| Format                | Extension       |
| :-------------------- | :-------------- |
| Microsoft Excel       | `.xlsx`, `.xls` |
| CSV (Comma-Separated) | `.csv`          |
| Maximum File Size     | **10 MB**       |

### What the AI Detects

The AI reads your spreadsheet and intelligently identifies:

- ✅ **Part number columns** (even if named differently: "P/N", "Article", "Code", "SKU")
- ✅ **Quantity columns** ("Qty", "Amount", "Pcs", "Units")
- ✅ **Brand columns** ("Brand", "Manufacturer", "Make")
- ✅ **Duplicate parts** (automatically merged with combined quantities)
- ✅ **Data quality issues** (missing values, formatting problems)

Each extracted part gets a **confidence level**:

| Level         | Meaning                                          |
| :------------ | :----------------------------------------------- |
| 🟢 **High**   | AI is very confident this is a valid part number |
| 🟡 **Medium** | Likely a part number but may need verification   |
| 🔴 **Low**    | Uncertain — please review manually               |

---

<br>

## 7. AI Email Processing

### How It Works

Send an email with your parts inquiry to the designated inbox, and the AI will:

1. **Read and understand** your email content
2. **Extract part numbers** from both the email body and any Excel/CSV attachments
3. **Detect urgency** (keywords like "urgent", "ASAP", "immediately" trigger priority processing)
4. **Detect language** (Arabic, Russian, Chinese, English, and more)
5. **Search inventory** for all extracted parts
6. **Select the best match** for each part (considering price, stock, and delivery)
7. **Generate a professional quotation** (see Section 8)
8. **Email the quotation back** to you automatically

### What You Send

```
To: parts@yourcompany.com
Subject: Need quotation for brake parts

Hi, I need the following parts urgently:
- R000000195 × 2
- CAF-000267 × 5
- 8471474 × 1

Also attached is our full parts list (see Excel file).

Thanks,
Ahmed
```

### What You Receive

A professionally formatted quotation email with:

- ✅ All parts listed with prices, availability, and delivery estimates
- ✅ Parts not in stock listed separately as "being sourced"
- ✅ Urgency badge (if applicable)
- ✅ Total pricing with VAT
- ✅ Quotation number and validity date (7 days)
- ✅ One-click "Place Order" button

---

<br>

## 8. AI Quotation Generator

Every quotation generated — whether from email processing or manual creation — includes:

### Quotation Format

```
┌──────────────────────────────────────────────────────┐
│                   QUOTATION                          │
│              QT-260211-0001                          │
│           Valid until: Feb 18, 2026                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  #  Part Number  Brand   Qty  Price   Total  Status  │
│  ─  ──────────  ─────   ───  ─────   ─────  ──────  │
│  1  R000000195  SUZUKI   2   $18.82  $37.64  ✅      │
│  2  CAF-000267  BOSCH    5   $12.50  $62.50  ✅      │
│  3  8471474     DENSO    1   $45.00  $45.00  ⚠️      │
│                                                      │
│                          Subtotal:  $145.14          │
│                          VAT (5%):    $7.26          │
│                          ─────────────────           │
│                          Total:     $152.40          │
│                                                      │
│              [ 📧 Place Order ]                      │
└──────────────────────────────────────────────────────┘
```

### Features

| Feature                 | Description                                                  |
| :---------------------- | :----------------------------------------------------------- |
| **Auto-numbered**       | Format: `QT-YYMMDD-XXXX`                                     |
| **7-day validity**      | Configurable expiration date                                 |
| **Itemized pricing**    | Unit price, quantity, line total per part                    |
| **Availability status** | In Stock ✅ · Low Stock ⚠️ · Out of Stock ❌ · On Request 📋 |
| **Delivery estimates**  | ETA in days for each item                                    |
| **Not-found section**   | Parts being sourced listed separately                        |
| **Priority badge**      | Red "PRIORITY" label for urgent requests                     |
| **Responsive design**   | Looks great on desktop, tablet, and mobile email clients     |
| **Plain text fallback** | Text-only version for basic email clients                    |

---

<br>

## 9. AI Learning

### What Is It?

PartsForm AI has a built-in learning system that **gets smarter with every search** performed on the platform — by any user.

### How It Works

```
You Search → AI Learns from Outcome → Future Searches Improve
```

The system tracks:

| Signal                    | What It Learns                                                          |
| :------------------------ | :---------------------------------------------------------------------- |
| 🔍 **Search refinements** | If you change "brak pads" to "brake pads", the AI learns the correction |
| 👆 **Part clicks**        | Which results users actually click on (= relevant)                      |
| 🛒 **Add to cart**        | Which parts users buy (= best matches)                                  |
| ⏱️ **Time on results**    | How long you look at results (longer = more useful)                     |
| 📊 **Scroll depth**       | How far you scroll (helps understand if results were relevant)          |
| 👍👎 **Feedback**         | Optional thumbs-up/down if shown                                        |

### What It Improves

| Area                      | Before Learning                          | After Learning                             |
| :------------------------ | :--------------------------------------- | :----------------------------------------- |
| **Synonyms**              | Doesn't know "braking pad" = "brake pad" | Learns equivalents from user behavior      |
| **Failed searches**       | Doesn't know why a search failed         | Suggests better alternatives               |
| **Keyword effectiveness** | Treats all words equally                 | Prioritizes keywords that led to purchases |
| **Typo corrections**      | Only handles known typos                 | Learns new misspellings over time          |

### Privacy

- Learning data is **aggregated and anonymized**
- No personal data is stored in the learning database
- The system learns **patterns**, not individual behaviors

---

<br>

## 10. Supported Languages & Currencies

### Languages

The AI can understand queries in:

| Language     | Example Query               |
| :----------- | :-------------------------- |
| 🇬🇧 English   | "brake pads under $50"      |
| 🇸🇦 Arabic    | "قطع فرامل تويوتا"          |
| 🇫🇷 French    | "plaquettes de frein Bosch" |
| 🇪🇸 Spanish   | "filtro de aceite barato"   |
| 🇷🇺 Russian   | "тормозные колодки Bosch"   |
| 🇺🇦 Ukrainian | "фільтр масляний"           |

### Currencies

Prices in the database are stored in **AED** (UAE Dirhams). You can search in any of these currencies, and the AI converts automatically:

| Currency      | Symbol  | Conversion             |
| :------------ | :-----: | :--------------------- |
| US Dollar     |  $ USD  | Automatic              |
| Euro          |  € EUR  | Automatic              |
| British Pound |  £ GBP  | Automatic              |
| UAE Dirham    | د.إ AED | Native (no conversion) |
| Saudi Riyal   |  ﷼ SAR  | Automatic              |
| Japanese Yen  |  ¥ JPY  | Automatic              |
| Chinese Yuan  |  ¥ CNY  | Automatic              |

**Example:** If you search _"under $50"_, the AI filters for parts priced under 183.50 AED.

---

<br>

## 11. What the AI Understands

Here is the complete list of everything the AI can detect from your natural language queries:

### Part Identification

| Filter        | How to Use             | Example                                   |
| :------------ | :--------------------- | :---------------------------------------- |
| Part Number   | Type any part number   | `R000000195`, `CAF-000267`                |
| Part Category | Name the type of part  | `brake pads`, `oil filter`, `spark plugs` |
| Keywords      | Describe what you need | `cooling system for truck`                |

### Brands

| Filter        | How to Use             | Example                           |
| :------------ | :--------------------- | :-------------------------------- |
| Vehicle Brand | Name the vehicle make  | `Toyota`, `BMW`, `Mercedes`       |
| Parts Brand   | Name the manufacturer  | `Bosch`, `SKF`, `Denso`, `Brembo` |
| Exclude Brand | Say "not" or "exclude" | `not Bosch`, `exclude Chinese`    |

### Pricing

| Filter      | How to Use                    | Example                             |
| :---------- | :---------------------------- | :---------------------------------- |
| Max Price   | "under", "below", "less than" | `under $500`, `below $100`          |
| Min Price   | "over", "above", "more than"  | `over $100`, `above $50`            |
| Price Range | Use dash or "between"         | `$50-$200`, `between $100 and $500` |
| Budget      | Use descriptive words         | `cheap`, `budget`, `affordable`     |

### Availability

| Filter     | How to Use              | Example                    |
| :--------- | :---------------------- | :------------------------- |
| In Stock   | "in stock", "available" | `available brake pads`     |
| High Stock | "full stock", "plenty"  | `plenty of stock`          |
| Quantity   | "need X units", "qty X" | `need 50 units`, `qty 100` |

### Delivery

| Filter        | How to Use                  | Example                                   |
| :------------ | :-------------------------- | :---------------------------------------- |
| Fast Delivery | "fast", "express", "urgent" | `express delivery`                        |
| Max Days      | "within X days"             | `within 3 days`, `delivered by next week` |

### Quality & Supplier

| Filter          | How to Use                   | Example                              |
| :-------------- | :--------------------------- | :----------------------------------- |
| OEM/Genuine     | "OEM", "genuine", "original" | `OEM parts only`                     |
| Certified       | "certified", "verified"      | `certified suppliers`                |
| Supplier Origin | Name the country             | `German suppliers`, `Japanese parts` |

### Part Categories Recognized

The AI recognizes **20+ part categories** automatically:

> Brake Pads · Brake Discs · Engine Parts · Suspension · Shock Absorbers · Struts · Electrical · Battery · Alternator · Transmission · Gearbox · Cooling System · Radiator · Steering · Exhaust · Filters (Oil, Air, Fuel) · Bearings · Pumps · Clutch · Tires · Wheels · Sensors · Gaskets · Belts · Hoses

### Vehicle Brands Recognized

> Toyota · Honda · Nissan · BMW · Mercedes · Audi · Volkswagen · Ford · Chevrolet · Hyundai · Kia · Lexus · Porsche · Land Rover · Jeep · Suzuki · Mitsubishi · Mazda · Subaru · Volvo · Peugeot · Renault · Citroën · Fiat · Alfa Romeo · Jaguar · Bentley · Rolls Royce · Maserati · Ferrari · Lamborghini

### Parts Brands Recognized

> Bosch · SKF · Denso · Valeo · Delphi · Brembo · Continental · Gates · NGK · Mann · Hella · Sachs · LuK · INA · FAG · TRW · ATE · Febi Bilstein · Lemförder · Meyle · Monroe · KYB · Mahle · Wix · ACDelco · Motorcraft · Genuine Parts

---

<br>

## 12. Frequently Asked Questions

### General

**Q: Do I need to learn special commands or syntax?**

> No! Just type what you need in plain language. The AI understands everyday words.

**Q: What if the AI doesn't understand my query?**

> The system will still search using standard methods. You can also try rephrasing your query or using the manual filters available in the sidebar.

**Q: Is the AI available 24/7?**

> Yes. The AI processes all searches instantly, around the clock.

---

### Search & Results

**Q: Why does the AI rank one option over another?**

> The AI uses a balanced scoring system: **35% price** + **30% delivery time** + **20% stock quantity** + **15% availability**. The option with the best combined score ranks first. You can see badges that explain why each top result was selected.

**Q: What do the colored badges mean?**

> 🏆 Gold Crown = Best overall value · 💰 Green Tag = Cheapest price · ⚡ Blue Lightning = Fastest delivery · 📦 Purple Box = Most stock available

**Q: Can the AI handle multiple part numbers at once?**

> Yes! You can type multiple part numbers in one query, or use the Excel Import feature for bulk searches of 100+ parts.

**Q: What if two options are equally good?**

> The AI detects ties and shows a comparison: "Option A has lower price, Option B has faster delivery" — so you can choose what matters more to you.

---

### Excel Import

**Q: What file formats are supported?**

> Excel (.xlsx, .xls) and CSV files up to 10 MB.

**Q: Does my spreadsheet need specific column names?**

> No! The AI automatically detects which columns contain part numbers, quantities, and brands — regardless of what you named them.

**Q: What happens with duplicate parts in my spreadsheet?**

> Duplicates are automatically merged, and quantities are combined.

---

### Email Inquiries

**Q: How quickly will I receive a quotation?**

> Typically within **1–5 minutes** of sending your email, depending on the number of parts and server load.

**Q: Can I attach a spreadsheet to my email?**

> Yes! Attach Excel or CSV files, and the AI will extract parts from both your email text and the attachment.

**Q: What if some parts aren't found?**

> The quotation will list available parts with prices and separately list unfound parts as "being sourced" — so you know exactly what's covered.

---

### Privacy & Data

**Q: Does the AI store my searches?**

> Search patterns are stored anonymously to improve results for all users. No personal data is linked to learning records.

**Q: Is my pricing information shared?**

> Never. Your quotes, prices, and cart data are private to your account.

---

<br>

---

<div align="center">

**PartsForm AI** — Smarter Parts Sourcing

_Powered by Google Gemini 2.0 Flash_

© 2026 PartsForm. All rights reserved.

</div>
