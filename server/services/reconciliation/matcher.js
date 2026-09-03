const { RECONCILIATION_CONFIG, daysBetween } = require('./normalizer');

function buildIndexes(bankTransactions, invoices) {
  const bankByReferenceId = new Map();
  const bankByAmount = new Map();
  const invoiceByOrderCustomer = new Map();
  const invoiceByOrder = new Map();

  for (const bankTx of bankTransactions) {
    if (bankTx.referenceId) {
      if (!bankByReferenceId.has(bankTx.referenceId)) {
        bankByReferenceId.set(bankTx.referenceId, []);
      }
      bankByReferenceId.get(bankTx.referenceId).push(bankTx);
    }

    const amountKey = `${bankTx.amountPaise}_${bankTx.currency}`;
    if (!bankByAmount.has(amountKey)) {
      bankByAmount.set(amountKey, []);
    }
    bankByAmount.get(amountKey).push(bankTx);
  }

  for (const invoice of invoices) {
    const key = `${invoice.orderId}_${invoice.customerId}`;
    if (!invoiceByOrderCustomer.has(key)) {
      invoiceByOrderCustomer.set(key, []);
    }
    invoiceByOrderCustomer.get(key).push(invoice);

    if (!invoiceByOrder.has(invoice.orderId)) {
      invoiceByOrder.set(invoice.orderId, []);
    }
    invoiceByOrder.get(invoice.orderId).push(invoice);
  }

  return { bankByReferenceId, bankByAmount, invoiceByOrderCustomer, invoiceByOrder };
}

function extractOrderIdFromDescription(description) {
  const match = description.match(/ORD-\d+/i);
  return match ? match[0].toUpperCase() : null;
}

function extractPaymentIdFromDescription(description) {
  const match = description.match(/PAY-\d+/i);
  return match ? match[0].toUpperCase() : null;
}

function matchPaymentToBank(payment, indexes, usedBankIds) {
  const { bankByReferenceId, bankByAmount } = indexes;
  const config = RECONCILIATION_CONFIG;

  const candidatesByRef = bankByReferenceId.get(payment.paymentId) || [];
  const unmatchedByRef = candidatesByRef.filter((b) => !usedBankIds.has(b.bankTransactionId));

  if (unmatchedByRef.length === 1) {
    const bankTx = unmatchedByRef[0];
    const dateDiff = daysBetween(payment.paymentDate, bankTx.transactionDate);
    const amountDiff = Math.abs(payment.amountPaise - bankTx.amountPaise);

    if (amountDiff === 0 && dateDiff <= config.dateToleranceDays) {
      return {
        bankTransactionId: bankTx.bankTransactionId,
        matchMethod: 'EXACT_REFERENCE',
        confidence: config.confidenceScores.EXACT_REFERENCE,
        amountDifference: fromPaise(amountDiff),
        dateDifferenceDays: dateDiff,
      };
    }

    if (amountDiff > 0) {
      return {
        bankTransactionId: bankTx.bankTransactionId,
        matchMethod: 'EXACT_REFERENCE',
        confidence: config.confidenceScores.EXACT_REFERENCE,
        amountDifference: fromPaise(payment.amountPaise - bankTx.amountPaise),
        dateDifferenceDays: dateDiff,
        hasAmountMismatch: true,
      };
    }

    if (dateDiff > config.dateToleranceDays) {
      return {
        bankTransactionId: bankTx.bankTransactionId,
        matchMethod: 'EXACT_REFERENCE',
        confidence: config.confidenceScores.EXACT_REFERENCE,
        amountDifference: 0,
        dateDifferenceDays: dateDiff,
        hasDateMismatch: true,
      };
    }
  }

  if (unmatchedByRef.length > 1) {
    return {
      bankTransactionId: null,
      candidates: unmatchedByRef.map((b) => b.bankTransactionId),
      matchMethod: 'EXACT_REFERENCE',
      confidence: 0,
      isDuplicate: true,
    };
  }

  const amountKey = `${payment.amountPaise}_${payment.currency}`;
  const candidatesByAmount = bankByAmount.get(amountKey) || [];
  const unmatchedByAmount = candidatesByAmount.filter((b) => !usedBankIds.has(b.bankTransactionId));

  for (const bankTx of unmatchedByAmount) {
    const dateDiff = daysBetween(payment.paymentDate, bankTx.transactionDate);
    if (dateDiff <= config.dateToleranceDays) {
      return {
        bankTransactionId: bankTx.bankTransactionId,
        matchMethod: 'AMOUNT_DATE',
        confidence: config.confidenceScores.AMOUNT_DATE,
        amountDifference: 0,
        dateDifferenceDays: dateDiff,
      };
    }
  }

  for (const bankTx of unmatchedByAmount) {
    const dateDiff = daysBetween(payment.paymentDate, bankTx.transactionDate);
    const descriptionHasOrder = bankTx.description.includes(payment.orderId);
    if (descriptionHasOrder) {
      return {
        bankTransactionId: bankTx.bankTransactionId,
        matchMethod: 'DESCRIPTION',
        confidence: config.confidenceScores.DESCRIPTION,
        amountDifference: fromPaise(payment.amountPaise - bankTx.amountPaise),
        dateDifferenceDays: dateDiff,
      };
    }
  }

  return null;
}

function matchPaymentToInvoice(payment, indexes, usedInvoiceIds) {
  const { invoiceByOrderCustomer, invoiceByOrder } = indexes;
  const config = RECONCILIATION_CONFIG;

  const orderCustomerKey = `${payment.orderId}_${payment.customerId}`;
  const candidatesByOrderCustomer = invoiceByOrderCustomer.get(orderCustomerKey) || [];
  const unmatchedByOrderCustomer = candidatesByOrderCustomer.filter(
    (inv) => !usedInvoiceIds.has(inv.invoiceId)
  );

  if (unmatchedByOrderCustomer.length === 1) {
    const invoice = unmatchedByOrderCustomer[0];
    const amountDiff = Math.abs(payment.amountPaise - invoice.invoiceAmountPaise);

    if (amountDiff === 0) {
      return {
        invoiceId: invoice.invoiceId,
        matchMethod: 'ORDER_CUSTOMER',
        confidence: config.confidenceScores.ORDER_CUSTOMER,
        amountDifference: 0,
      };
    }

    return {
      invoiceId: invoice.invoiceId,
      matchMethod: 'ORDER_CUSTOMER',
      confidence: config.confidenceScores.ORDER_CUSTOMER,
      amountDifference: fromPaise(payment.amountPaise - invoice.invoiceAmountPaise),
      hasAmountMismatch: amountDiff > 0,
    };
  }

  const candidatesByOrder = invoiceByOrder.get(payment.orderId) || [];
  const unmatchedByOrder = candidatesByOrder.filter(
    (inv) => !usedInvoiceIds.has(inv.invoiceId)
  );

  for (const invoice of unmatchedByOrder) {
    if (invoice.customerId === payment.customerId) {
      const amountDiff = Math.abs(payment.amountPaise - invoice.invoiceAmountPaise);
      return {
        invoiceId: invoice.invoiceId,
        matchMethod: 'ORDER_CUSTOMER',
        confidence: config.confidenceScores.ORDER_CUSTOMER,
        amountDifference: fromPaise(payment.amountPaise - invoice.invoiceAmountPaise),
        hasAmountMismatch: amountDiff > 0,
      };
    }
  }

  for (const invoice of unmatchedByOrder) {
    const amountDiff = Math.abs(payment.amountPaise - invoice.invoiceAmountPaise);
    if (amountDiff === 0) {
      return {
        invoiceId: invoice.invoiceId,
        matchMethod: 'AMOUNT_DATE',
        confidence: config.confidenceScores.AMOUNT_DATE,
        amountDifference: 0,
      };
    }
  }

  return null;
}

function fromPaise(paise) {
  return paise / 100;
}

module.exports = {
  buildIndexes,
  matchPaymentToBank,
  matchPaymentToInvoice,
  extractOrderIdFromDescription,
  extractPaymentIdFromDescription,
};
