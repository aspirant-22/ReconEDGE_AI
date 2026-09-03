# Generated Data

This directory contains synthetic financial data generated for ReconEDGE AI evaluation.

## Files

| File | Description |
|------|-------------|
| `payments.json` | Payment gateway transaction records |
| `bank-transactions.json` | Bank settlement transaction records |
| `invoices.json` | Invoice records |
| `ground-truth.json` | Expected relationships and scenarios |
| `dataset-summary.json` | Summary statistics of the generated dataset |
| `payments.csv` | CSV version of payment records |
| `bank-transactions.csv` | CSV version of bank transaction records |
| `invoices.csv` | CSV version of invoice records |

## Ground Truth

The `ground-truth.json` file contains the expected relationships between records. This is used to evaluate the reconciliation engine in Phase 3.

Each entry maps a payment to its expected bank transaction and invoice, along with the scenario type.

## Scenarios

### EXACT_MATCH
Payment, bank transaction, and invoice have consistent amounts, dates, and identifiers. This represents the happy path where all three sources agree.

### AMOUNT_MISMATCH
The payment amount differs from the bank transaction amount. This simulates fees, rounding errors, or partial settlements.

### MISSING_BANK_TRANSACTION
A payment exists but its corresponding bank transaction is absent. This simulates pending settlements or failed bank postings.

### DUPLICATE_BANK_TRANSACTION
A payment has two corresponding bank transactions. This simulates duplicate settlements or retry attempts.

### DATE_MISMATCH
Payment and bank transaction exist but the bank transaction date is significantly delayed beyond normal settlement tolerance.

### UNMATCHED
A bank transaction exists that does not correspond to any known payment. This simulates orphaned transactions or data entry errors.

## Configuration

Default configuration:
- Payment count: 500
- Seed: 42
- Date range: 2026-07-01 to 2026-08-31
- Currency: INR
- Amount range: ₹100 – ₹100,000

## Generation

```bash
cd server
npm run generate:data
```

With custom parameters:

```bash
node utils/dataGenerator/generateData.js --count=1000 --seed=99
```
