function toMinorUnits(amount) {
  if (amount === null || amount === undefined) return null;
  return Math.round(amount * 100);
}

function isPresent(value) {
  return value !== null && value !== undefined;
}

function calculateFinancialAnalytics(results) {
  let totalPaymentAmount = 0;
  let totalBankAmount = 0;
  let totalInvoiceAmount = 0;
  let matchedPaymentAmount = 0;
  let exceptionPaymentAmount = 0;
  let amountMismatchImpact = 0;

  const seenBankIds = new Set();

  for (const r of results) {
    if (isPresent(r.paymentId)) {
      const paymentAmt = toMinorUnits(r.paymentAmount) || 0;
      totalPaymentAmount += paymentAmt;

      if (r.status === 'MATCHED') {
        matchedPaymentAmount += paymentAmt;
      } else {
        exceptionPaymentAmount += paymentAmt;
      }
    }

    if (isPresent(r.bankTransactionId)) {
      if (!seenBankIds.has(r.bankTransactionId)) {
        seenBankIds.add(r.bankTransactionId);
        const bankAmt = toMinorUnits(r.bankAmount) || 0;
        totalBankAmount += bankAmt;
      }
    }

    if (isPresent(r.invoiceId)) {
      const invoiceAmt = toMinorUnits(r.invoiceAmount) || 0;
      totalInvoiceAmount += invoiceAmt;
    }

    if (
      r.exceptionType === 'AMOUNT_MISMATCH' &&
      isPresent(r.paymentAmount) &&
      isPresent(r.bankAmount)
    ) {
      amountMismatchImpact += Math.abs(toMinorUnits(r.paymentAmount) - toMinorUnits(r.bankAmount));
    }
  }

  const totalAmount = totalPaymentAmount + totalBankAmount + totalInvoiceAmount;

  return {
    totalPaymentAmount: totalPaymentAmount / 100,
    totalBankAmount: totalBankAmount / 100,
    totalInvoiceAmount: totalInvoiceAmount / 100,
    totalAmount: totalAmount / 100,
    matchedPaymentAmount: matchedPaymentAmount / 100,
    exceptionPaymentAmount: exceptionPaymentAmount / 100,
    amountMismatchImpact: amountMismatchImpact / 100,
    matchedAmountRate: totalPaymentAmount > 0 ? Number(((matchedPaymentAmount / totalPaymentAmount) * 100).toFixed(2)) : 0,
    exceptionAmountRate: totalPaymentAmount > 0 ? Number(((exceptionPaymentAmount / totalPaymentAmount) * 100).toFixed(2)) : 0,
  };
}

module.exports = { calculateFinancialAnalytics };
