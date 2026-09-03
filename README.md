# ReconEDGE AI

**AI Finance Controller for Automated Financial Reconciliation**

## Current Phase

**Phase 4 — Metrics & Analytics**

Phase 4 builds a deterministic analytics layer on top of the reconciliation engine, transforming raw results into meaningful financial-control metrics for dashboard consumption.

## Tech Stack

### Frontend
- React.js (Vite)
- Tailwind CSS
- React Router
- Axios
- Lucide React

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- JWT + bcryptjs

## Project Structure

```
recon-edge-ai/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts
│   │   ├── layouts/       # Page layouts
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── utils/         # Utility functions
│   └── ...
├── server/          # Express backend
│   ├── config/      # Configuration (DB)
│   ├── controllers/ # Request handlers
│   ├── middleware/   # Auth, error handling
│   ├── models/      # Mongoose schemas
│   ├── routes/      # API routes
│   ├── services/    # Business logic
│   │   └── reconciliation/  # Reconciliation engine
│   └── utils/       # Utility functions
├── data/            # Data storage
│   └── generated/   # Synthetic data + results
└── README.md
```

## Setup

### Prerequisites
- Node.js (v18+)
- MongoDB (running locally or connection string)

### Installation

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### Environment Variables

```bash
cd server
cp .env.example .env
```

Edit `.env` with your values:
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — Secret key for JWT signing
- `GEMINI_API_KEY` — Gemini API key (for future phases)
- `CLIENT_URL` — Frontend URL (default: http://localhost:5173)

### Running

```bash
# From root — runs both client and server
npm run dev

# Or run individually:
cd server && npm run dev
cd client && npm run dev
```

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | No |
| POST | `/api/auth/register` | Register user | No |
| POST | `/api/auth/login` | Login user | No |
| GET | `/api/auth/me` | Get current user | Yes |

## Phase 3 — Deterministic Reconciliation Engine

### Architecture

The reconciliation engine follows a multi-stage pipeline:

1. **Normalization** — Standardize data formats (dates, amounts, IDs)
2. **Indexing** — Build lookup maps for efficient matching
3. **Duplicate Detection** — Identify duplicate bank transactions
4. **Matching** — Match payments to bank transactions and invoices
5. **Residual Scan** — Detect unmatched bank transactions
6. **Classification** — Categorize exceptions
7. **Evaluation** — Compare predictions to ground truth

### Matching Strategy

| Stage | Method | Confidence |
|-------|--------|------------|
| 1 | Reference ID exact match | 1.0 |
| 2 | Order + Customer ID match | 0.95 |
| 3 | Amount + Date match | 0.85 |
| 4 | Description parsing | 0.70 |

### Exception Categories

| Category | Description |
|----------|-------------|
| AMOUNT_MISMATCH | Payment and bank amounts differ |
| MISSING_BANK_TRANSACTION | No bank transaction found for payment |
| DUPLICATE_BANK_TRANSACTION | Multiple bank transactions for same payment |
| DATE_MISMATCH | Bank transaction date outside tolerance |
| UNMATCHED_BANK_TRANSACTION | Bank transaction not matched to any payment |

### Ground Truth Isolation

The engine never reads `ground-truth.json` during prediction/matching. Ground truth is only used post-prediction for evaluation. This ensures the engine operates independently.

### Running

```bash
cd server

# Run reconciliation engine
npm run reconcile:data

# Run tests
npm test
```

### Output Files

Generated in `data/generated/`:
- `reconciliation-results.json` — Matched records and exceptions
- `reconciliation-metrics.json` — Performance metrics and evaluation

### Evaluation Metrics

**Exception Detection (Binary):**
- Precision, Recall, F1 Score
- True Positives, False Positives, False Negatives, True Negatives

**Exception Classification (Per-Category):**
- Precision, Recall, F1 per exception type

**Match Rates:**
- Payment Match Rate
- Bank Match Rate
- Invoice Match Rate

### Test Coverage

```bash
# Run all tests
cd server
npm test

# Tests cover:
# - Unmatched bank transaction detection
# - Exception classifier logic
# - Per-category classification
# - Separate match rate calculations
```

## Phase 2 — Synthetic Financial Data

### Why Synthetic Data

Synthetic data allows us to test the reconciliation engine with known ground truth. We can precisely measure match rate, precision, recall, and exception detection accuracy because we control the expected relationships.

### Dataset Types

| Dataset | Description |
|---------|-------------|
| Payments | Payment gateway transaction records (INR) |
| Bank Transactions | Bank settlement records |
| Invoices | Invoice records |
| Ground Truth | Expected relationships and scenario labels |

### Default Configuration

- Payment count: 500
- Seed: 42
- Date range: 2026-07-01 to 2026-08-31
- Currency: INR
- Amount range: ₹100 – ₹100,000

### Generation

```bash
cd server
npm run generate:data
```

With custom parameters:

```bash
node utils/dataGenerator/generateData.js --count=1000 --seed=99
```

### Scenario Distribution

| Scenario | Approximate % | Description |
|----------|---------------|-------------|
| EXACT_MATCH | 70% | All three sources agree |
| AMOUNT_MISMATCH | 10% | Payment and bank amounts differ |
| MISSING_BANK_TRANSACTION | 5% | Bank transaction is absent |
| DUPLICATE_BANK_TRANSACTION | 5% | Duplicate bank settlement |
| DATE_MISMATCH | 5% | Bank transaction date is delayed |
| UNMATCHED_BANK_TRANSACTION | 5% | Orphaned bank transaction |

### Output Files

Generated in `data/generated/`:
- `payments.json` / `payments.csv`
- `bank-transactions.json` / `bank-transactions.csv`
- `invoices.json` / `invoices.csv`
- `ground-truth.json`
- `dataset-summary.json`

### Seeded Generation

The generator uses a seeded pseudo-random number generator. The same seed always produces the same dataset, ensuring reproducible evaluation.

### Validation

The generator validates all generated data before writing files:
- Unique IDs across all datasets
- Valid amounts (positive, numeric)
- Correct currency (INR)
- Ground truth references valid records
- Scenario counts match payment count
- Relationship consistency for each scenario

## Phase 4 — Metrics & Analytics

### Overview

Phase 4 builds a deterministic analytics layer on top of the reconciliation engine. It transforms raw reconciliation results into meaningful financial-control metrics.

### Architecture

```
reconciliation-results.json
        ↓
Phase 4 Metrics & Analytics
        ↓
Operational + Exception + Quality Metrics
        ↓
reconciliation-analytics.json
```

### Available Metrics

| Category | Metrics |
|----------|---------|
| Overview | totalPayments, totalBankTransactions, totalInvoices, matchedRecords, paymentMatchRate, bankMatchRate, invoiceMatchRate, bankAssignmentAccuracy |
| Exceptions | totalExceptions, exceptionRate, breakdown by category |
| Severity | highSeverityCount, mediumSeverityCount, lowSeverityCount |
| Financial Impact | totalPaymentAmount, totalBankAmount, matchedPaymentAmount, amountMismatchImpact |
| Control Effectiveness | reconciliationRate, exceptionRate, cleanMatchRate, controlEffectivenessScore |
| Health | healthStatus (HEALTHY/WARNING/CRITICAL), healthReason |

### Severity Model

| Severity | Categories |
|----------|-----------|
| HIGH | MISSING_BANK_TRANSACTION, UNMATCHED_BANK_TRANSACTION, DUPLICATE_BANK_TRANSACTION |
| MEDIUM | AMOUNT_MISMATCH, DATE_MISMATCH |

### Health Classification

| Status | Threshold |
|--------|-----------|
| HEALTHY | Exception rate < 10% |
| WARNING | Exception rate >= 10% and < 25% |
| CRITICAL | Exception rate >= 25% |

### Running

```bash
cd server

# Generate analytics
npm run analyze:data
```

### Output

Generated in `data/generated/`:
- `reconciliation-analytics.json`

### Phase 4 vs Phase 3

| Aspect | Phase 3 (Reconciliation Metrics) | Phase 4 (Analytics) |
|--------|----------------------------------|---------------------|
| Purpose | Evaluation correctness | Business/operational metrics |
| Input | Reconciliation results + ground truth | Reconciliation results |
| Ground Truth | Required | Not used |
| Output | reconciliation-metrics.json | reconciliation-analytics.json |

**Phase 4 does not use Gemini or AI.**

## Frontend Routes

| Route | Page | Auth Required |
|-------|------|---------------|
| `/login` | Login | No |
| `/register` | Register | No |
| `/dashboard` | Dashboard | Yes |
| `/reconciliation` | Reconciliation | Yes |
| `/exceptions` | Exceptions | Yes |
| `/audit-logs` | Audit Logs | Yes |
