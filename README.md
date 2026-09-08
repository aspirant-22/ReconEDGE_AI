# ReconEDGE AI

## AI Finance Controller

> **Reconcile. Detect. Explain. Resolve.**

ReconEDGE AI is a deterministic-first **AI Finance Controller** that automates financial reconciliation across **payments, bank transactions, and invoices**.

It combines a reliable rule-based reconciliation engine with **Gemini-powered exception intelligence** and a **human-in-the-loop resolution workflow** to help finance teams identify discrepancies, understand why they occurred, and resolve them with a complete audit trail.

---

## 🎥 Product Demo

See ReconEDGE AI in action — from financial data upload and deterministic reconciliation to AI-powered exception explanation and human-controlled resolution.

[![ReconEDGE AI Demo](https://img.youtube.com/vi/AhdULPXFoh8/maxresdefault.jpg)](https://youtu.be/AhdULPXFoh8)

> 🎬 Click the preview above to watch the complete demo.
---

## 🚀 The Problem

Financial reconciliation is still heavily dependent on manual comparison of data from multiple systems.

A finance team may need to compare:

- Payment records
- Bank transactions
- Customer invoices
- Transaction references
- Amounts
- Dates
- Duplicate transactions
- Missing records

The challenge is not only determining whether two records match.

The real questions are:

> **What happened? Why did it fail? How severe is the issue? What should the finance team investigate?**

Traditional rule-based systems can detect discrepancies but often provide little context.

LLM-only systems can provide explanations but introduce the risk of hallucination and unreliable financial decisions.

### ReconEDGE combines both approaches.

```text
                 ┌──────────────────────┐
                 │     Financial Data   │
                 │ Payments / Bank /    │
                 │ Invoices             │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Schema Detection &   │
                 │ Column Mapping       │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Normalization &      │
                 │ Validation           │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Deterministic        │
                 │ Reconciliation       │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Exception Detection  │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Gemini AI            │
                 │ Explain & Recommend  │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Human Resolution     │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Audit Trail          │
                 └──────────────────────┘
```

---

# 💡 Our Solution

ReconEDGE follows a simple principle:

> ## **Deterministic code determines financial truth. AI explains it. Humans resolve it.**

The system separates financial computation from generative AI.

### Deterministic Engine

Responsible for:

- Record normalization
- Identifier matching
- Reference matching
- Amount comparison
- Date comparison
- Duplicate detection
- Missing record detection
- Exception classification
- Reconciliation metrics

### Gemini AI

Responsible for:

- Explaining detected exceptions
- Identifying possible causes
- Suggesting investigation steps
- Answering finance-related questions

### Human

Responsible for:

- Reviewing exceptions
- Approving/rejecting resolutions
- Escalating uncertain cases
- Making the final financial decision

This creates a safer architecture for financial workflows.

---

# ✨ Key Features

## 1. Multi-File Financial Reconciliation

Upload:

```text
payments.csv
bank-transactions.csv
invoices.csv
```

ReconEDGE processes them through a unified canonical data model.

```text
CSV / XLSX
    ↓
Parser
    ↓
Column Mapper
    ↓
Data Normalizer
    ↓
Canonical Records
    ↓
Reconciliation Engine
```

The system does not depend on the original ordering of rows.

---

# 2. Flexible Column Mapping

Different organizations use different names for the same financial fields.

For example:

```text
payment_id
Payment ID
PaymentID
payment-id
```

can be normalized into the same canonical field.

ReconEDGE uses:

- Header normalization
- Column aliases
- Schema detection
- Required-field validation
- Ambiguity detection

This allows financial files from different sources to be processed without requiring identical column names.

---

# 3. Deterministic-First Matching

ReconEDGE intentionally avoids using an LLM for core financial matching.

The reconciliation engine uses deterministic logic for:

```text
Identity
   ↓
Reference
   ↓
Relationship
   ↓
Amount
   ↓
Date
   ↓
Exception
```

This makes the reconciliation process:

- Reproducible
- Testable
- Explainable
- Auditable
- Predictable

The same input produces the same reconciliation result.

---

# 4. Reference-First Reconciliation

ReconEDGE prioritizes strong transaction references before weaker signals.

For Payment → Bank reconciliation:

```text
Payment Reference
       │
       ▼
Bank Reference
       │
       ▼
Unique Counterpart
       │
       ▼
Amount Validation
       │
       ▼
Date Validation
       │
       ▼
Exception Classification
```

This is important because an amount mismatch does **not** necessarily mean the bank transaction is missing.

### Example

Payment:

```text
Reference: REF10009
Amount:    ₹10,000
```

Bank:

```text
Reference: REF10009
Amount:    ₹10,500
```

A naive matcher may conclude:

```text
No Match
```

ReconEDGE instead determines:

```text
Reference matches
       ↓
Same transaction candidate
       ↓
Amount differs
       ↓
AMOUNT_MISMATCH
```

The finance team can now investigate the discrepancy rather than searching for a transaction that actually exists.

---

# 5. Match First → Validate → Classify

ReconEDGE separates three important stages.

### Step 1 — Match

Identify the most reliable counterpart.

```text
Payment → Bank
Payment → Invoice
```

### Step 2 — Validate

Check:

```text
Amount
Date
Reference
Relationship
```

### Step 3 — Classify

Determine the exception:

```text
MATCHED
AMOUNT_MISMATCH
DATE_MISMATCH
MISSING_BANK_TRANSACTION
MISSING_INVOICE
DUPLICATE_BANK_TRANSACTION
DUPLICATE_PAYMENT
UNMATCHED_BANK_TRANSACTION
```

This prevents mismatches from being incorrectly classified as missing transactions.

---

# 6. Empty Identity Protection

Empty fields are never treated as meaningful evidence.

For example:

```text
Payment.customerId = ""
Invoice.customerId = ""
```

does **not** mean the customer identity matches.

Similarly:

```text
"" === ""
```

is never considered valid matching evidence.

If both order and customer information are unavailable:

```text
orderId = ""
customerId = ""
```

the fallback matching path is disabled instead of selecting an arbitrary invoice.

This prevents accidental cross-wiring between unrelated records.

---

# 7. Ambiguity Protection

ReconEDGE follows another important financial principle:

> **If the evidence is insufficient, do not guess.**

If multiple candidates are equally plausible, the system avoids blindly selecting the first available record.

Example:

```text
                 Payment
                    │
             ┌──────┴──────┐
             ▼             ▼
         Invoice A      Invoice B
             │             │
             └──────┬──────┘
                    │
             No unique evidence
                    │
                    ▼
              Human Review
```

This reduces false-positive reconciliation.

---

# 8. Duplicate Detection

ReconEDGE detects duplicate financial activity instead of silently discarding records.

Example:

```text
Payment A ─────────┐
                   ├── REF10014
Payment B ─────────┘
                      │
                ┌─────┴─────┐
                ▼           ▼
             Bank 1       Bank 2
```

The system can distinguish between:

```text
DUPLICATE_BANK_TRANSACTION
```

and:

```text
DUPLICATE_PAYMENT
```

Duplicate selection also prevents an already-consumed bank transaction from being reused by another duplicate match.

---

# 9. Exception Classification

ReconEDGE currently supports the following exception categories:

| Exception | Description |
|---|---|
| `MISSING_BANK_TRANSACTION` | Payment has no corresponding bank transaction |
| `MISSING_INVOICE` | Payment has no corresponding invoice |
| `AMOUNT_MISMATCH` | Counterpart exists but amount differs |
| `DATE_MISMATCH` | Counterpart exists but date differs |
| `DUPLICATE_BANK_TRANSACTION` | Multiple bank transactions correspond to the same payment reference |
| `DUPLICATE_PAYMENT` | Multiple payments represent the same underlying payment relationship |
| `UNMATCHED_BANK_TRANSACTION` | Bank transaction has no corresponding payment |
| `AMBIGUOUS` | Multiple plausible candidates exist without sufficient evidence |

---

# 10. Gemini-Powered Exception Intelligence

Once deterministic reconciliation identifies an exception, Gemini analyzes it.

```text
Deterministic Reconciliation
            ↓
      Exception Found
            ↓
       Gemini AI
            ↓
 ┌─────────────────────────┐
 │ Why did it happen?      │
 │ What could cause it?    │
 │ What should be checked? │
 └─────────────────────────┘
```

For example:

```text
The payment and bank transaction share the same
reference number, indicating that they likely represent
the same transaction.

However, the bank amount differs from the payment amount.

Recommended investigation:
1. Verify bank charges or fees.
2. Check whether the payment was partially settled.
3. Verify the original payment entry.
```

The AI explains the evidence already discovered by the reconciliation engine.

It does not create the underlying financial result.

---

# 11. AI Safety Boundary

ReconEDGE intentionally restricts what AI can do.

### Gemini CAN:

- Explain exceptions
- Summarize reconciliation results
- Suggest possible causes
- Recommend investigation steps
- Answer finance questions

### Gemini CANNOT:

- Modify financial records
- Delete transactions
- Approve transactions
- Resolve exceptions automatically
- Invent reconciliation results
- Access ground-truth evaluation labels

The financial decision remains deterministic and human-controlled.

---

# 12. Ground-Truth Isolation

Ground truth is completely separated from production reconciliation logic.

The matcher does not receive:

```text
ground-truth.json
expectedScenario
expectedBankTransactionId
expectedInvoiceId
```

This prevents test data leakage.

The reconciliation engine must derive its result from:

```text
Uploaded Payment Data
+
Uploaded Bank Data
+
Uploaded Invoice Data
```

rather than from expected answers.

---

# 13. Human-in-the-Loop Resolution

ReconEDGE provides a controlled exception-resolution workflow.

```text
OPEN
  │
  ▼
IN_REVIEW
  │
  ├───────────────┐
  ▼               ▼
RESOLVED       REJECTED
  │
  └───────────────┐
                  ▼
              ESCALATED
```

Finance users can review an exception and take a controlled action.

AI recommendations do not automatically resolve financial exceptions.

---

# 14. Immutable Audit Trail

Every important exception workflow action can be recorded.

Examples:

```text
Exception Created
Exception Viewed
Status Changed
Resolution Added
Exception Resolved
Exception Rejected
Exception Escalated
```

The audit trail provides:

- Who performed an action
- What action was performed
- When it happened
- Which exception was affected

This provides accountability for financial operations.

---

# 15. Reconciliation Runs

ReconEDGE supports isolated reconciliation runs.

Each run maintains its own:

- Uploaded files
- Payment records
- Bank transactions
- Invoice records
- Reconciliation results
- Exceptions
- Analytics
- AI context
- Resolution history

This prevents data from one run from contaminating another.

---

# 📊 Analytics Dashboard

ReconEDGE provides financial reconciliation analytics including:

- Total payment amount
- Total bank amount
- Total invoice amount
- Matched amount
- Exception amount
- Exception count
- Exception rate
- Amount mismatch impact
- Exception distribution

Example baseline:

```text
Total Payment Amount       ₹25,079,405.23
Total Bank Amount          ₹23,432,239.40
Total Invoice Amount       ₹25,073,030.79

Matched Payment Amount     ₹17,486,654.13
Exception Payment Amount   ₹7,592,751.10
Amount Mismatch Impact     ₹12,012.70

Exception Rate             35%
```

The dashboard gives finance teams a high-level view before they investigate individual transactions.

---

# 🧠 Finance Q&A

ReconEDGE provides a finance-focused Q&A interface.

Users can ask:

```text
What is the total unmatched amount?

Which exceptions have the highest financial impact?

Why did this payment fail reconciliation?

Which transactions have duplicate bank entries?

How many payments are unresolved?

What should I investigate first?
```

The Q&A system is scoped to the selected reconciliation run.

---

# 🏗️ System Architecture

```text
                         ┌─────────────────────┐
                         │      React UI       │
                         │ React + Vite        │
                         │ Tailwind CSS        │
                         └──────────┬──────────┘
                                    │
                                    │ REST API
                                    ▼
                         ┌─────────────────────┐
                         │   Express Backend   │
                         │      Node.js        │
                         └──────────┬──────────┘
                                    │
             ┌──────────────────────┼─────────────────────┐
             │                      │                     │
             ▼                      ▼                     ▼
     ┌───────────────┐    ┌─────────────────┐    ┌──────────────┐
     │ File          │    │ Reconciliation  │    │ Analytics    │
     │ Processing    │    │ Engine          │    │ Services     │
     └───────┬───────┘    └────────┬────────┘    └──────────────┘
             │                     │
             ▼                     ▼
     ┌───────────────┐    ┌─────────────────┐
     │ CSV / XLSX    │    │ Deterministic   │
     │ Parser        │    │ Matching         │
     └───────────────┘    └────────┬────────┘
                                   │
                      ┌────────────┼─────────────┐
                      │            │             │
                      ▼            ▼             ▼
                 Duplicate     Exception      Metrics
                 Detection     Classifier
                      │            │
                      └──────┬─────┘
                             ▼
                     ┌──────────────┐
                     │ Gemini AI    │
                     │ Intelligence │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Human Review │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Audit Trail  │
                     └──────────────┘
```

---

# 🧩 Technology Stack

## Frontend

- React
- Vite
- JavaScript
- Tailwind CSS
- React Router
- Axios
- Lucide React
- Recharts

## Backend

- Node.js
- Express.js
- JavaScript
- REST APIs

## Database

- MongoDB
- Mongoose

## AI

- Google Gemini API

## Authentication

- JWT
- bcryptjs

## Data Processing

- CSV Parser
- XLSX Processing
- Schema Mapping
- Data Normalization
- Deterministic Reconciliation

## Testing

- Node.js Test Runner
- Frontend Test Suite
- Integration Tests
- Regression Tests
- Production-Path Validation

---

# 📁 Project Structure

```text
ReconEDGE/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── ...
│   │
│   └── ...
│
├── server/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   │
│   ├── services/
│   │   ├── ai/
│   │   ├── analytics/
│   │   ├── reconciliation/
│   │   ├── reconciliationAdapter/
│   │   └── ...
│   │
│   ├── tests/
│   └── ...
│
├── data/
│   └── generated/
│
├── README.md
└── package.json
```

---

# 🔄 End-to-End Workflow

```text
1. Upload
   ↓
2. Detect Schema
   ↓
3. Map Columns
   ↓
4. Normalize Data
   ↓
5. Validate Records
   ↓
6. Create Canonical Records
   ↓
7. Detect Duplicates
   ↓
8. Match Payments → Bank
   ↓
9. Match Payments → Invoice
   ↓
10. Validate Relationships
   ↓
11. Classify Exceptions
   ↓
12. Calculate Analytics
   ↓
13. Gemini Explains Exceptions
   ↓
14. Human Reviews
   ↓
15. Resolve / Reject / Escalate
   ↓
16. Audit Trail
```

---

# 🎯 Reconciliation Strategy

## Payment → Bank

Primary evidence:

```text
payment.referenceId
        ↕
bank.referenceId
```

If a unique counterpart is found, the system retains it even when:

```text
Amount differs
Date differs
```

The discrepancy is then classified separately.

---

## Payment → Invoice

The system prioritizes explicit relationship information where available, followed by reliable invoice references and safe identity-based fallbacks.

Empty fields are never considered evidence.

Multiple plausible candidates are not blindly resolved.

---

# 🧪 Testing & Validation

ReconEDGE uses multiple levels of testing.

## Backend

```text
264 / 264 tests passing
56 test suites
```

Full-tree verification:

```text
265 / 265 tests passing
```

Coverage includes:

- Reconciliation
- Reference-first matching
- Duplicate detection
- Exception classification
- AI behavior
- Reconciliation runs
- Human resolution
- June regression
- Analytics

---

## Frontend

```text
60 / 60 tests passing
9 test files
```

---

## Production Build

```bash
npm run build
```

Result:

```text
SUCCESS
```

Only the pre-existing bundle chunk-size warning remains.

---

# 🧪 Real-Data Validation

ReconEDGE was validated against a June financial dataset containing:

```text
51 Payments
53 Bank Transactions
50 Invoices
```

The production processing path was exercised:

```text
CSV
 ↓
csvParser
 ↓
columnMapper
 ↓
dataNormalizer
 ↓
mongoDataAdapter
 ↓
reconciliationEngine
```

This validated the same core processing path used by the upload workflow.

---

# ✅ Section-8 Acceptance Results

All nine critical acceptance cases pass.

| Payment | Bank | Invoice | Expected Result |
|---|---|---|---|
| PMT-50009 | TXN-900009 | INV-10009 | `AMOUNT_MISMATCH` |
| PMT-50012 | TXN-900012 | INV-10012 | `AMOUNT_MISMATCH` |
| PMT-50030 | TXN-900030 | INV-10030 | `AMOUNT_MISMATCH` |
| PMT-50042 | TXN-900041 | INV-10042 | `AMOUNT_MISMATCH` |
| PMT-50015 | TXN-900015 | INV-10015 | `DUPLICATE_BANK_TRANSACTION` |
| PMT-50016 | TXN-900016 | INV-10015 | `DUPLICATE_PAYMENT` |
| PMT-50045 | TXN-900044 | INV-10045 | `MATCHED` |
| PMT-50047 | TXN-900046 | INV-10047 | `DUPLICATE_BANK_TRANSACTION` |
| PMT-50048 | TXN-900047 | INV-10047 | `DUPLICATE_PAYMENT` |

### June Dataset Consistency

```text
Payments:             51
Matched Payments:     40
Payment Exceptions:   11

Bank Transactions:    53
Consumed Banks:       49
Unmatched Banks:       4

Invoices:              50
```

Unmatched bank transactions are explicitly preserved instead of being silently discarded.

---

# 🔬 Demo Regression

The reference-first improvements were regression-tested against the existing demo dataset.

Result:

```text
525 reconciliation rows
0 output differences
Byte-identical reconciliation output
```

Metrics remained identical apart from execution timing.

This ensures that the new reconciliation behavior does not break the existing demo flow.

---

# 🔐 Security & Production Hardening

ReconEDGE includes multiple backend hardening measures:

- JWT authentication
- bcrypt password hashing
- Strong JWT secret validation
- Rate limiting
- Security headers
- Input validation
- Centralized error handling
- Structured logging
- Health checks
- Graceful shutdown
- Run-level data isolation

---

# 🧠 Why Deterministic + AI?

There are two extremes when applying AI to financial reconciliation.

### Pure Rules

```text
✓ Deterministic
✓ Reproducible
✓ Auditable

✗ Limited explanations
✗ Harder investigation
✗ Poor natural-language interaction
```

### Pure LLM

```text
✓ Natural language
✓ Strong explanations
✓ Flexible reasoning

✗ Potential hallucination
✗ Non-deterministic
✗ Difficult to audit
✗ Unsafe for financial decisions
```

### ReconEDGE

```text
             RECONEDGE
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
 Deterministic           Gemini
 Financial Engine        AI Layer
       │                   │
       ▼                   ▼
Financial Truth       Explanation
       │                   │
       └─────────┬─────────┘
                 ▼
           Human Decision
```

This provides the reliability of deterministic systems with the usability of generative AI.

---

# 🏆 What Makes ReconEDGE Different?

Most AI finance prototypes follow:

```text
CSV
 ↓
LLM
 ↓
Answer
```

ReconEDGE follows:

```text
CSV
 ↓
Schema Detection
 ↓
Normalization
 ↓
Validation
 ↓
Deterministic Reconciliation
 ↓
Exception Classification
 ↓
AI Explanation
 ↓
Human Resolution
 ↓
Audit Trail
```

The difference is fundamental.

ReconEDGE does not ask an LLM:

> "Which transactions match?"

It first determines the financial relationship through deterministic evidence.

Then it asks AI:

> "Help the finance team understand what happened."

---

# 💼 Business Impact

ReconEDGE is designed to reduce the operational burden of financial reconciliation.

Potential benefits include:

```text
↓ Manual reconciliation effort
↓ Exception investigation time
↓ Duplicate payment risk
↓ Missed discrepancies

↑ Financial visibility
↑ Resolution speed
↑ Auditability
↑ Operational scalability
```

The goal is not simply to automate reconciliation.

The goal is to transform reconciliation into an:

> **Intelligent, explainable, auditable financial control system.**

---

# 👥 Target Users

ReconEDGE can support:

- Finance teams
- Financial controllers
- Accounts receivable teams
- Accounts payable teams
- Reconciliation analysts
- Fintech operations teams
- Accounting operations
- Internal audit teams

---

# 🚀 Getting Started

## Prerequisites

Install:

- Node.js
- npm
- MongoDB
- Git

For AI functionality, configure a Gemini API key.

---

## 1. Clone the Repository

```bash
git clone <repository-url>
cd ReconEDGE
```

---

## 2. Install Backend Dependencies

```bash
cd server
npm install
```

---

## 3. Install Frontend Dependencies

```bash
cd ../client
npm install
```

---

## 4. Configure Environment Variables

Create:

```text
server/.env
```

Example:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/reconedge
JWT_SECRET=your-strong-secret-key
GEMINI_API_KEY=your-gemini-api-key
```

Use a strong JWT secret in production.

---

## 5. Start the Backend

```bash
cd server
npm run dev
```

---

## 6. Start the Frontend

In another terminal:

```bash
cd client
npm run dev
```

Open the Vite development URL shown in the terminal.

---

# 🧪 Running Tests

## Backend

```bash
cd server
npm test
```

Full Node test tree:

```bash
node --test
```

## Frontend

```bash
cd client
npm test
```

## Production Build

```bash
npm run build
```

---

# 📌 API Capabilities

ReconEDGE provides REST APIs for:

```text
Authentication
Reconciliation Runs
File Uploads
Reconciliation Results
Exceptions
Exception Resolution
Analytics
AI Exception Analysis
Finance Q&A
Health Checks
```

Run-specific operations are isolated to the selected reconciliation run.

---

# 🔮 Future Roadmap

ReconEDGE's architecture can be extended with:

## Advanced Financial Identifiers

Support for:

```text
UTR
RRN
Cheque Number
Voucher Number
Challan Number
Transaction Number
```

## Advanced Reconciliation Relationships

Future support for:

```text
1 Payment → N Bank Transactions
N Payments → 1 Invoice
Partial Payments
Split Settlements
Bank Fees
Taxes
Chargebacks
Refunds
```

## Explainable Match Evidence

Expose why a record was matched:

```text
Reference Match       ✓
Amount Match          ✗
Date Match            ✓
Customer Match        ✓
```

## Advanced Ambiguity Workspace

Provide finance users with side-by-side candidate comparison and guided resolution.

## Enterprise Integrations

Potential integrations include:

```text
ERP Systems
Accounting Platforms
Payment Gateways
Bank APIs
Data Warehouses
```

---

# 🛡️ Design Philosophy

ReconEDGE follows one central principle:

> ## **Never let AI invent financial truth.**

The system understands the difference between:

```text
MATCHED
```

and:

```text
INSUFFICIENT EVIDENCE
```

The second case is not a failure.

It is a signal that a human should review the transaction.

---



# 🏁 Final Architecture

```text
                         RECONEDGE AI
                      AI Finance Controller

                              │
                              ▼
                   ┌────────────────────┐
                   │ Upload Financial   │
                   │ Data               │
                   └─────────┬──────────┘
                             ▼
                   ┌────────────────────┐
                   │ Schema Detection   │
                   │ & Column Mapping   │
                   └─────────┬──────────┘
                             ▼
                   ┌────────────────────┐
                   │ Normalization &    │
                   │ Validation         │
                   └─────────┬──────────┘
                             ▼
                   ┌────────────────────┐
                   │ Deterministic      │
                   │ Reconciliation     │
                   └─────────┬──────────┘
                             ▼
                   ┌────────────────────┐
                   │ Exception          │
                   │ Detection          │
                   └─────────┬──────────┘
                             ▼
                   ┌────────────────────┐
                   │ Gemini AI          │
                   │ Explain & Recommend│
                   └─────────┬──────────┘
                             ▼
                   ┌────────────────────┐
                   │ Human Review &     │
                   │ Controlled Resolve │
                   └─────────┬──────────┘
                             ▼
                   ┌────────────────────┐
                   │ Immutable Audit    │
                   │ Trail              │
                   └────────────────────┘
```

---

# ⭐ ReconEDGE AI

## Reconcile. Detect. Explain. Resolve.

ReconEDGE AI brings together:

**Deterministic Financial Controls + Generative AI + Human Oversight + Auditability**

to create a safer, more explainable, and more scalable approach to financial reconciliation.

> **Don't let AI guess your books.**
>
> **Let AI explain your evidence.**
