// Deterministic regression fixture for the Phase 12.1 targeted classification
// fix. Mirrors the four real-uploaded misclassifications (PMT-50009/50012/50042
// -> AMOUNT_MISMATCH, PMT-50030 -> AMOUNT_MISMATCH), the required negatives
// (PMT-50003 -> MISSING_BANK_TRANSACTION, TXN-900005/900051/900052/900053 ->
// UNMATCHED_BANK_TRANSACTION), an exact-match reference case, and the
// duplicate-reference couples (two payments + two bank lines + one invoice) that
// must resolve deterministically to DUPLICATE_BANK_TRANSACTION for the
// legitimate payment and DUPLICATE_PAYMENT for the redundant one.
//
// Invoices deliberately do NOT share customerId with their payment so that
// order/customer matching cannot link them (mirroring the real uploaded data,
// where only the shared reference joins the records).

const payments = [
  { paymentId: 'PMT-50009', customerId: 'CUST-009', amount: 13736.72, currency: 'INR', paymentDate: '2026-07-15', reference: 'REF10008', description: 'Payment 50009' },
  { paymentId: 'PMT-50012', customerId: 'CUST-012', amount: 22770.18, currency: 'INR', paymentDate: '2026-07-18', reference: 'REF10011', description: 'Payment 50012' },
  { paymentId: 'PMT-50042', customerId: 'CUST-042', amount: 24880.68, currency: 'INR', paymentDate: '2026-07-29', reference: 'REF10041', description: 'Payment 50042' },
  { paymentId: 'PMT-50030', customerId: 'CUST-030', amount: 29229.29, currency: 'INR', paymentDate: '2026-07-25', reference: 'REF10029', description: 'Payment 50030' },
  { paymentId: 'PMT-50003', customerId: 'CUST-003', amount: 5000.0, currency: 'INR', paymentDate: '2026-07-05', reference: 'REF10002', description: 'Payment 50003' },
  { paymentId: 'PMT-50100', customerId: 'CUST-100', amount: 3333.33, currency: 'INR', paymentDate: '2026-08-01', reference: 'REF10100', description: 'Payment 50100' },
  { paymentId: 'PMT-50015', customerId: 'CUST-015', amount: 4500.0, currency: 'INR', paymentDate: '2026-07-20', reference: 'REF10014', description: 'Payment 50015' },
  { paymentId: 'PMT-50016', customerId: 'CUST-016', amount: 4510.0, currency: 'INR', paymentDate: '2026-07-20', reference: 'REF10014', description: 'Payment 50016' },
  { paymentId: 'PMT-50047', customerId: 'CUST-047', amount: 6120.0, currency: 'INR', paymentDate: '2026-07-27', reference: 'REF10046', description: 'Payment 50047' },
  { paymentId: 'PMT-50048', customerId: 'CUST-048', amount: 6105.0, currency: 'INR', paymentDate: '2026-07-27', reference: 'REF10046', description: 'Payment 50048' },
];

const bankTransactions = [
  { transactionId: 'TXN-900009', reference: 'REF10008', amount: 13736.72, currency: 'INR', transactionDate: '2026-07-16', type: 'CREDIT', status: 'SETTLED', description: 'Settlement 50009' },
  { transactionId: 'TXN-900012', reference: 'REF10011', amount: 22770.18, currency: 'INR', transactionDate: '2026-07-19', type: 'CREDIT', status: 'SETTLED', description: 'Settlement 50012' },
  { transactionId: 'TXN-900042', reference: 'REF10041', amount: 24880.68, currency: 'INR', transactionDate: '2026-07-30', type: 'CREDIT', status: 'SETTLED', description: 'Settlement 50042' },
  { transactionId: 'TXN-900030', reference: 'REF10029', amount: 29329.29, currency: 'INR', transactionDate: '2026-07-26', type: 'CREDIT', status: 'SETTLED', description: 'Settlement 50030' },
  { transactionId: 'TXN-90100', reference: 'REF10100', amount: 3333.33, currency: 'INR', transactionDate: '2026-08-02', type: 'CREDIT', status: 'SETTLED', description: 'Settlement 50100' },
  { transactionId: 'TXN-900015', reference: 'REF10014', amount: 4500.0, currency: 'INR', transactionDate: '2026-07-21', type: 'CREDIT', status: 'SETTLED', description: 'Settlement 50015' },
  { transactionId: 'TXN-900016', reference: 'REF10014', amount: 4510.0, currency: 'INR', transactionDate: '2026-07-22', type: 'CREDIT', status: 'SETTLED', description: 'Settlement 50016' },
  { transactionId: 'TXN-900047', reference: 'REF10046', amount: 6105.0, currency: 'INR', transactionDate: '2026-07-29', type: 'CREDIT', status: 'SETTLED', description: 'Settlement 50048' },
  { transactionId: 'TXN-900046', reference: 'REF10046', amount: 6120.0, currency: 'INR', transactionDate: '2026-07-28', type: 'CREDIT', status: 'SETTLED', description: 'Settlement 50047' },
  { transactionId: 'TXN-900005', reference: 'REF900004', amount: 9999.99, currency: 'INR', transactionDate: '2026-07-06', type: 'CREDIT', status: 'SETTLED', description: 'External deposit' },
  { transactionId: 'TXN-900051', reference: 'REF900050', amount: 10001.01, currency: 'INR', transactionDate: '2026-07-07', type: 'CREDIT', status: 'SETTLED', description: 'External deposit' },
  { transactionId: 'TXN-900052', reference: 'REF900051', amount: 10002.02, currency: 'INR', transactionDate: '2026-07-08', type: 'CREDIT', status: 'SETTLED', description: 'External deposit' },
  { transactionId: 'TXN-900053', reference: 'REF900052', amount: 10003.03, currency: 'INR', transactionDate: '2026-07-09', type: 'CREDIT', status: 'SETTLED', description: 'External deposit' },
];

const invoices = [
  { invoiceId: 'INV-10009', customerId: 'CUST-INV-009', amount: 13806.63, currency: 'INR', invoiceDate: '2026-07-10', reference: 'REF10008', description: 'Invoice 10009' },
  { invoiceId: 'INV-10012', customerId: 'CUST-INV-012', amount: 22661.60, currency: 'INR', invoiceDate: '2026-07-13', reference: 'REF10011', description: 'Invoice 10012' },
  { invoiceId: 'INV-10042', customerId: 'CUST-INV-042', amount: 25155.20, currency: 'INR', invoiceDate: '2026-07-24', reference: 'REF10041', description: 'Invoice 10042' },
  { invoiceId: 'INV-10030', customerId: 'CUST-INV-030', amount: 29229.29, currency: 'INR', invoiceDate: '2026-07-20', reference: 'REF10029', description: 'Invoice 10030' },
  { invoiceId: 'INV-10003', customerId: 'CUST-INV-003', amount: 5000.0, currency: 'INR', invoiceDate: '2026-07-04', reference: 'REF10002', description: 'Invoice 10003' },
  { invoiceId: 'INV-100100', customerId: 'CUST-INV-100', amount: 3333.33, currency: 'INR', invoiceDate: '2026-08-01', reference: 'REF10100', description: 'Invoice 100100' },
  { invoiceId: 'INV-10015', customerId: 'CUST-INV-015', amount: 4500.0, currency: 'INR', invoiceDate: '2026-07-19', reference: 'REF10014', description: 'Invoice 10015' },
  { invoiceId: 'INV-10047', customerId: 'CUST-INV-047', amount: 6120.0, currency: 'INR', invoiceDate: '2026-07-26', reference: 'REF10046', description: 'Invoice 10047' },
];

// Expected POST-FIX classifications (the Phase 12.1 contract).
const expected = {
  'PMT-50009': { status: 'EXCEPTION', exceptionType: 'AMOUNT_MISMATCH' },
  'PMT-50012': { status: 'EXCEPTION', exceptionType: 'AMOUNT_MISMATCH' },
  'PMT-50042': { status: 'EXCEPTION', exceptionType: 'AMOUNT_MISMATCH' },
  'PMT-50030': { status: 'EXCEPTION', exceptionType: 'AMOUNT_MISMATCH' },
  'PMT-50003': { status: 'EXCEPTION', exceptionType: 'MISSING_BANK_TRANSACTION' },
  'PMT-50100': { status: 'MATCHED', exceptionType: null },
// Duplicate-reference couples (two payments, two bank lines, one invoice)
// resolve deterministically: the legitimate/primary payment flags the duplicate
// bank lines, the redundant payment flags as a duplicate payment. Both keep
// their own bank and the shared invoice.
'PMT-50015': { status: 'EXCEPTION', exceptionType: 'DUPLICATE_BANK_TRANSACTION' },
  'PMT-50016': { status: 'EXCEPTION', exceptionType: 'DUPLICATE_PAYMENT' },
  'PMT-50047': { status: 'EXCEPTION', exceptionType: 'DUPLICATE_BANK_TRANSACTION' },
  'PMT-50048': { status: 'EXCEPTION', exceptionType: 'DUPLICATE_PAYMENT' },
};

const expectedUnmatchedBanks = ['TXN-900005', 'TXN-900051', 'TXN-900052', 'TXN-900053'];

module.exports = {
  payments,
  bankTransactions,
  invoices,
  expected,
  expectedUnmatchedBanks,
};