const RECONCILIATION_CONFIG = {
  dateToleranceDays: 3,
  amountTolerancePaise: 0,
  confidenceScores: {
    EXACT_REFERENCE: 1.0,
    ORDER_CUSTOMER: 0.95,
    AMOUNT_DATE: 0.85,
    DESCRIPTION: 0.70,
  },
};

function toPaise(amount) {
  return Math.round(amount * 100);
}

function fromPaise(paise) {
  return paise / 100;
}

function normalizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ');
}

function normalizeCurrency(currency) {
  if (typeof currency !== 'string') return 'INR';
  return currency.trim().toUpperCase();
}

function normalizeId(id) {
  if (typeof id !== 'string') return '';
  return id.trim().toUpperCase();
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function normalizePayment(payment) {
  return {
    ...payment,
    paymentId: normalizeId(payment.paymentId),
    referenceId: normalizeId(payment.referenceId),
    invoiceId: normalizeId(payment.invoiceId),
    orderId: normalizeId(payment.orderId),
    customerId: normalizeId(payment.customerId),
    amount: Number(payment.amount),
    amountPaise: toPaise(Number(payment.amount)),
    currency: normalizeCurrency(payment.currency),
    paymentDate: new Date(payment.paymentDate),
    description: normalizeString(payment.description),
  };
}

function normalizeBankTransaction(bankTx) {
  return {
    ...bankTx,
    bankTransactionId: normalizeId(bankTx.bankTransactionId),
    referenceId: normalizeId(bankTx.referenceId),
    amount: Number(bankTx.amount),
    amountPaise: toPaise(Number(bankTx.amount)),
    currency: normalizeCurrency(bankTx.currency),
    transactionDate: new Date(bankTx.transactionDate),
    description: normalizeString(bankTx.description),
  };
}

function normalizeInvoice(invoice) {
  return {
    ...invoice,
    invoiceId: normalizeId(invoice.invoiceId),
    referenceId: normalizeId(invoice.referenceId),
    orderId: normalizeId(invoice.orderId),
    customerId: normalizeId(invoice.customerId),
    invoiceAmount: Number(invoice.invoiceAmount),
    invoiceAmountPaise: toPaise(Number(invoice.invoiceAmount)),
    currency: normalizeCurrency(invoice.currency),
    invoiceDate: new Date(invoice.invoiceDate),
    description: normalizeString(invoice.description),
  };
}

function normalizeAll(payments, bankTransactions, invoices) {
  return {
    payments: payments.map(normalizePayment),
    bankTransactions: bankTransactions.map(normalizeBankTransaction),
    invoices: invoices.map(normalizeInvoice),
  };
}

module.exports = {
  RECONCILIATION_CONFIG,
  toPaise,
  fromPaise,
  normalizeString,
  normalizeCurrency,
  normalizeId,
  daysBetween,
  normalizePayment,
  normalizeBankTransaction,
  normalizeInvoice,
  normalizeAll,
};
