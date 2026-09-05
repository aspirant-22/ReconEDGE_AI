const { RECONCILIATION_CONFIG, daysBetween } = require('./normalizer');

function buildIndexes(bankTransactions, invoices) {
  const bankByReferenceId = new Map();
  const bankByAmount = new Map();
  const invoiceByReferenceId = new Map();
  const invoiceById = new Map();
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
    if (invoice.referenceId) {
      if (!invoiceByReferenceId.has(invoice.referenceId)) {
        invoiceByReferenceId.set(invoice.referenceId, []);
      }
      invoiceByReferenceId.get(invoice.referenceId).push(invoice);
    }

    if (invoice.invoiceId) {
      invoiceById.set(invoice.invoiceId, invoice);
    }

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

  return {
    bankByReferenceId,
    bankByAmount,
    invoiceByReferenceId,
    invoiceById,
    invoiceByOrderCustomer,
    invoiceByOrder,
  };
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

  // Primary identity key: the payment's canonical reference when present,
  // otherwise the payment id. The demo dataset carries bank.referenceId ==
  // payment.paymentId, so this fallback keeps that path intact. Never match on
  // an empty string.
  const refKey = payment.referenceId || payment.paymentId;
  const candidatesByRef = (refKey && bankByReferenceId.get(refKey)) || [];
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
  const { invoiceByReferenceId, invoiceById, invoiceByOrderCustomer, invoiceByOrder } = indexes;
  const config = RECONCILIATION_CONFIG;

  // 1. Explicit payment.invoiceId — preserve the declared relationship when the
  //    invoice exists. Never replace it based on row order, amount alone, or
  //    blank customer/order evidence.
  if (payment.invoiceId && invoiceById.has(payment.invoiceId)) {
    const invoice = invoiceById.get(payment.invoiceId);
    const amountDiff = Math.abs(payment.amountPaise - invoice.invoiceAmountPaise);
    return {
      invoiceId: invoice.invoiceId,
      matchMethod: 'EXACT_REFERENCE',
      confidence: config.confidenceScores.EXACT_REFERENCE,
      amountDifference: fromPaise(payment.amountPaise - invoice.invoiceAmountPaise),
      hasAmountMismatch: amountDiff > 0,
    };
  }

  // 2. Shared business reference — the dataset-independent identity path. Not
  //    gated on amount/date equality; a unique reference links the inverse even
  //    when amounts differ. Multiple invoices for one reference is ambiguous and
  //    must never blind-link.
  if (payment.referenceId) {
    const byRef = invoiceByReferenceId.get(payment.referenceId) || [];
    if (byRef.length === 1) {
      const invoice = byRef[0];
      const amountDiff = Math.abs(payment.amountPaise - invoice.invoiceAmountPaise);
      return {
        invoiceId: invoice.invoiceId,
        matchMethod: 'EXACT_REFERENCE',
        confidence: config.confidenceScores.EXACT_REFERENCE,
        amountDifference: fromPaise(payment.amountPaise - invoice.invoiceAmountPaise),
        hasAmountMismatch: amountDiff > 0,
      };
    }
    if (byRef.length > 1) {
      return null;
    }
  }

  // 3. Order/customer fallback — only ever uses non-empty identity evidence.
  //    Empty strings must never count as a match signal, so the fallback is
  //    disabled when BOTH order and customer are blank.
  if (!payment.orderId && !payment.customerId) return null;

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

  if (unmatchedByOrderCustomer.length > 1) {
    return null;
  }

  const candidatesByOrder = invoiceByOrder.get(payment.orderId) || [];
  const unmatchedByOrder = candidatesByOrder.filter(
    (inv) => !usedInvoiceIds.has(inv.invoiceId)
  );

  for (const invoice of unmatchedByOrder) {
    if (payment.customerId && invoice.customerId && invoice.customerId === payment.customerId) {
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
