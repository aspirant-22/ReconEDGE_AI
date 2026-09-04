// Mongo -> Phase 3 engine data adapter.
//
// Loads the canonical record documents for a run from MongoDB and maps them to
// the field shape the existing deterministic reconciliation engine expects.
// The engine itself remains completely unchanged.

const PaymentRecord = require('../../models/PaymentRecord');
const BankTransaction = require('../../models/BankTransaction');
const Invoice = require('../../models/Invoice');

function paymentToEngine(doc) {
  return {
    paymentId: doc.paymentId,
    orderId: '',
    customerId: doc.customerId,
    amount: doc.amount,
    currency: doc.currency || 'INR',
    paymentDate: doc.paymentDate,
    description: doc.description || '',
  };
}

function bankToEngine(doc) {
  return {
    bankTransactionId: doc.transactionId,
    referenceId: doc.reference || doc.transactionId,
    amount: doc.amount,
    currency: doc.currency || 'INR',
    transactionDate: doc.transactionDate,
    description: doc.description || '',
  };
}

function invoiceToEngine(doc) {
  return {
    invoiceId: doc.invoiceId,
    orderId: '',
    customerId: doc.customerId,
    invoiceAmount: doc.amount,
    currency: doc.currency || 'INR',
    invoiceDate: doc.invoiceDate,
    description: doc.description || '',
  };
}

async function loadRunData(runId) {
  const [payments, bankTransactions, invoices] = await Promise.all([
    PaymentRecord.find({ runId }).lean(),
    BankTransaction.find({ runId }).lean(),
    Invoice.find({ runId }).lean(),
  ]);

  return {
    payments: payments.map(paymentToEngine),
    bankTransactions: bankTransactions.map(bankToEngine),
    invoices: invoices.map(invoiceToEngine),
  };
}

module.exports = { loadRunData, paymentToEngine, bankToEngine, invoiceToEngine };
