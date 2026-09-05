const { fromPaise } = require('./normalizer');

function classifyException(result) {
  if (result.status === 'EXCEPTION' && result.exceptionType) {
    return result;
  }

  if (!result.paymentId && result.bankTransactionId) {
    return {
      ...result,
      status: 'EXCEPTION',
      exceptionType: 'UNMATCHED_BANK_TRANSACTION',
    };
  }

  if (result.isDuplicatePayment) {
    return {
      ...result,
      status: 'EXCEPTION',
      exceptionType: 'DUPLICATE_PAYMENT',
    };
  }

  if (result.isDuplicate) {
    return {
      ...result,
      status: 'EXCEPTION',
      exceptionType: 'DUPLICATE_BANK_TRANSACTION',
    };
  }

  if (!result.bankTransactionId && result.paymentId) {
    return {
      ...result,
      status: 'EXCEPTION',
      exceptionType: 'MISSING_BANK_TRANSACTION',
    };
  }

  if (result.hasAmountMismatch && (result.bankTransactionId || result.invoiceId)) {
    let actualAmount = result.bankAmount;
    let difference = result.amountDifference;

    if (result.invoiceId && Math.abs(result.invoiceAmountDifference) > 0) {
      actualAmount = result.invoiceAmount;
      difference = result.invoiceAmountDifference;
    } else if (result.bankTransactionId && Math.abs(result.amountDifference) > 0) {
      actualAmount = result.bankAmount;
      difference = result.amountDifference;
    }

    return {
      ...result,
      status: 'EXCEPTION',
      exceptionType: 'AMOUNT_MISMATCH',
      expectedAmount: result.paymentAmount,
      actualAmount,
      difference,
      differencePercent: result.paymentAmount !== 0
        ? ((difference / result.paymentAmount) * 100).toFixed(2)
        : 0,
    };
  }

  if (result.hasDateMismatch && result.bankTransactionId) {
    return {
      ...result,
      status: 'EXCEPTION',
      exceptionType: 'DATE_MISMATCH',
      differenceInDays: result.dateDifferenceDays,
    };
  }

  if (!result.invoiceId && result.paymentId) {
    return {
      ...result,
      status: 'EXCEPTION',
      exceptionType: 'MISSING_INVOICE',
    };
  }

  return {
    ...result,
    status: 'MATCHED',
    exceptionType: null,
  };
}

function classifyAllResults(results) {
  return results.map(classifyException);
}

module.exports = { classifyException, classifyAllResults };
