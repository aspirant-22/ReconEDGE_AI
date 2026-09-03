const { normalizeAll, fromPaise } = require('./normalizer');
const { buildIndexes, matchPaymentToBank, matchPaymentToInvoice } = require('./matcher');
const { detectDuplicateBankTransactions, selectBestDuplicate } = require('./duplicateDetector');
const { classifyAllResults } = require('./exceptionClassifier');

function reconcile(payments, bankTransactions, invoices) {
  const { payments: normPayments, bankTransactions: normBank, invoices: normInvoices } =
    normalizeAll(payments, bankTransactions, invoices);

  const bankMap = new Map(normBank.map((b) => [b.bankTransactionId, b]));
  const invoiceMap = new Map(normInvoices.map((inv) => [inv.invoiceId, inv]));

  const indexes = buildIndexes(normBank, normInvoices);

  const usedBankIds = new Set();
  const usedInvoiceIds = new Set();

  const { duplicateGroups, processed: duplicateProcessed } =
    detectDuplicateBankTransactions(normBank, null);

  const duplicateMap = new Map();
  const duplicateBankIds = new Set();
  for (const group of duplicateGroups) {
    for (const dupId of group.duplicates) {
      duplicateMap.set(dupId, group);
      duplicateBankIds.add(dupId);
    }
  }

  const results = [];

  for (const payment of normPayments) {
    const bankMatch = matchPaymentToBank(payment, indexes, usedBankIds);

    let bankTransactionId = null;
    let matchMethod = null;
    let confidence = 0;
    let amountDifference = 0;
    let dateDifferenceDays = 0;
    let hasAmountMismatch = false;
    let hasDateMismatch = false;
    let isDuplicate = false;

    if (bankMatch) {
      if (bankMatch.isDuplicate) {
        const group = duplicateGroups.find(
          (g) => g.referenceId === payment.paymentId
        );
        if (group) {
          const best = selectBestDuplicate(group, payment, bankMap);
          if (best) {
            bankTransactionId = best.bankTransactionId;
            usedBankIds.add(best.bankTransactionId);
            matchMethod = 'EXACT_REFERENCE';
            confidence = 1.0;
            isDuplicate = true;

            const dateDiff = Math.abs(
              (new Date(payment.paymentDate).getTime() -
                new Date(best.transactionDate).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            amountDifference = fromPaise(payment.amountPaise - best.amountPaise);
            dateDifferenceDays = dateDiff;
            hasAmountMismatch = Math.abs(payment.amountPaise - best.amountPaise) > 0;
            hasDateMismatch = dateDiff > 3;
          }
        }
      } else {
        bankTransactionId = bankMatch.bankTransactionId;
        usedBankIds.add(bankTransactionId);
        matchMethod = bankMatch.matchMethod;
        confidence = bankMatch.confidence;
        amountDifference = bankMatch.amountDifference;
        dateDifferenceDays = bankMatch.dateDifferenceDays;
        hasAmountMismatch = bankMatch.hasAmountMismatch || false;
        hasDateMismatch = bankMatch.hasDateMismatch || false;
      }
    }

    const invoiceMatch = matchPaymentToInvoice(payment, indexes, usedInvoiceIds);
    let invoiceId = null;
    let invoiceMatchMethod = null;
    let invoiceConfidence = 0;
    let invoiceAmountDifference = 0;

    if (invoiceMatch) {
      invoiceId = invoiceMatch.invoiceId;
      usedInvoiceIds.add(invoiceId);
      invoiceMatchMethod = invoiceMatch.matchMethod;
      invoiceConfidence = invoiceMatch.confidence;
      invoiceAmountDifference = invoiceMatch.amountDifference;
      hasAmountMismatch = hasAmountMismatch || invoiceMatch.hasAmountMismatch || false;
    }

    const paymentAmount = Number(payment.amount);
    const bankAmount = bankTransactionId ? Number(bankMap.get(bankTransactionId).amount) : null;
    const invoiceAmount = invoiceId ? Number(invoiceMap.get(invoiceId).invoiceAmount) : null;

    results.push({
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      customerId: payment.customerId,
      bankTransactionId,
      invoiceId,
      matchMethod,
      invoiceMatchMethod,
      confidence: Math.min(confidence, invoiceConfidence || confidence),
      paymentAmount,
      bankAmount,
      invoiceAmount,
      amountDifference,
      invoiceAmountDifference,
      dateDifferenceDays,
      hasAmountMismatch,
      hasDateMismatch,
      isDuplicate,
    });
  }

  for (const bankTx of normBank) {
    if (!usedBankIds.has(bankTx.bankTransactionId) && !duplicateBankIds.has(bankTx.bankTransactionId)) {
      results.push({
        paymentId: null,
        orderId: null,
        customerId: null,
        bankTransactionId: bankTx.bankTransactionId,
        invoiceId: null,
        status: 'EXCEPTION',
        exceptionType: 'UNMATCHED_BANK_TRANSACTION',
        matchMethod: null,
        confidence: 0,
        paymentAmount: null,
        bankAmount: Number(bankTx.amount),
        invoiceAmount: null,
        amountDifference: 0,
        dateDifferenceDays: 0,
        hasAmountMismatch: false,
        hasDateMismatch: false,
        isDuplicate: false,
      });
    }
  }

  const classified = classifyAllResults(results);

  return classified;
}

module.exports = { reconcile };
