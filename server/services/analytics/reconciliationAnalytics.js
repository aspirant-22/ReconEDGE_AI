const fs = require('fs');
const path = require('path');

function calculateReconciliationOverview(results, metrics) {
  const paymentResults = results.filter((r) => r.paymentId);
  const bankResults = results.filter((r) => r.bankTransactionId);
  const invoiceResults = results.filter((r) => r.invoiceId);
  const matched = results.filter((r) => r.status === 'MATCHED');
  const exceptions = results.filter((r) => r.status === 'EXCEPTION');

  return {
    totalPayments: metrics.inputRecords.payments,
    totalBankTransactions: metrics.inputRecords.bankTransactions,
    totalInvoices: metrics.inputRecords.invoices,
    totalReconciliationRecords: results.length,
    matchedRecords: metrics.matchedRecords,
    paymentMatchRate: metrics.matchRates.payment,
    bankMatchRate: metrics.matchRates.bank,
    invoiceMatchRate: metrics.matchRates.invoice,
    bankAssignmentAccuracy: metrics.evaluation.exceptionDetection.accuracy === 1 ? 100 : Number((metrics.evaluation.exceptionDetection.accuracy * 100).toFixed(2)),
    totalExceptions: metrics.exceptionRecords,
    exceptionRate: Number(((metrics.exceptionRecords / metrics.inputRecords.payments) * 100).toFixed(2)),
    resolvedExceptions: null,
    unresolvedExceptions: null,
  };
}

module.exports = { calculateReconciliationOverview };
