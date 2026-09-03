function calculateFinancialAnalytics(results) {
  let totalPaymentAmount = 0;
  let totalBankAmount = 0;
  let totalInvoiceAmount = 0;
  let matchedPaymentAmount = 0;
  let exceptionPaymentAmount = 0;
  let amountMismatchImpact = 0;

  for (const r of results) {
    if (r.paymentId) {
      const paymentAmt = r.paymentAmount || 0;
      totalPaymentAmount += paymentAmt;

      if (r.status === 'MATCHED') {
        matchedPaymentAmount += paymentAmt;
      } else {
        exceptionPaymentAmount += paymentAmt;
      }
    }

    if (r.bankAmount) {
      totalBankAmount += r.bankAmount;
    }

    if (r.invoiceAmount) {
      totalInvoiceAmount += r.invoiceAmount;
    }

    if (r.exceptionType === 'AMOUNT_MISMATCH' && r.paymentAmount && r.bankAmount) {
      amountMismatchImpact += Math.abs(r.paymentAmount - r.bankAmount);
    }
  }

  const totalAmount = totalPaymentAmount + totalBankAmount + totalInvoiceAmount;
  const matchedAmount = matchedPaymentAmount;
  const exceptionAmount = exceptionPaymentAmount;

  return {
    totalPaymentAmount: Math.round(totalPaymentAmount * 100) / 100,
    totalBankAmount: Math.round(totalBankAmount * 100) / 100,
    totalInvoiceAmount: Math.round(totalInvoiceAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    matchedPaymentAmount: Math.round(matchedPaymentAmount * 100) / 100,
    exceptionPaymentAmount: Math.round(exceptionPaymentAmount * 100) / 100,
    amountMismatchImpact: Math.round(amountMismatchImpact * 100) / 100,
    matchedAmountRate: totalPaymentAmount > 0 ? Number(((matchedPaymentAmount / totalPaymentAmount) * 100).toFixed(2)) : 0,
    exceptionAmountRate: totalPaymentAmount > 0 ? Number(((exceptionPaymentAmount / totalPaymentAmount) * 100).toFixed(2)) : 0,
  };
}

module.exports = { calculateFinancialAnalytics };
