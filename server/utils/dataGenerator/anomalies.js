const SCENARIO_DISTRIBUTION = {
  EXACT_MATCH: 0.70,
  AMOUNT_MISMATCH: 0.10,
  MISSING_BANK_TRANSACTION: 0.05,
  DUPLICATE_BANK_TRANSACTION: 0.05,
  DATE_MISMATCH: 0.05,
  UNMATCHED_BANK_TRANSACTION: 0.05,
};

function assignScenarios(rng, paymentCount, distribution = SCENARIO_DISTRIBUTION) {
  const counts = {};
  let remaining = paymentCount;

  const sortedKeys = Object.keys(distribution).sort(
    (a, b) => distribution[b] - distribution[a]
  );

  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    if (i === sortedKeys.length - 1) {
      counts[key] = remaining;
    } else {
      counts[key] = Math.round(paymentCount * distribution[key]);
      remaining -= counts[key];
    }
  }

  const scenarios = [];
  for (const [scenario, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      scenarios.push(scenario);
    }
  }

  return { scenarios: rng.shuffle(scenarios), counts };
}

function applyAnomalies(rng, payments, bankTransactions, invoices, scenarios) {
  const modifiedBankTransactions = [...bankTransactions];
  const groundTruth = [];
  const unmatchedBankTransactions = [];
  let bankIdCounter = 700001 + bankTransactions.length;

  const scenarioCounts = {
    EXACT_MATCH: 0,
    AMOUNT_MISMATCH: 0,
    MISSING_BANK_TRANSACTION: 0,
    DUPLICATE_BANK_TRANSACTION: 0,
    DATE_MISMATCH: 0,
    UNMATCHED_BANK_TRANSACTION: 0,
  };

  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    const scenario = scenarios[i];
    const bankTx = modifiedBankTransactions[i];
    const invoice = invoices[i];

    switch (scenario) {
      case 'EXACT_MATCH': {
        scenarioCounts.EXACT_MATCH++;
        groundTruth.push({
          paymentId: payment.paymentId,
          expectedBankTransactionId: bankTx.bankTransactionId,
          expectedInvoiceId: invoice.invoiceId,
          scenario: 'EXACT_MATCH',
        });
        break;
      }

      case 'AMOUNT_MISMATCH': {
        const diff = rng.nextDecimal(5, 500, 2);
        const modifyPayment = rng.randomBoolean(0.5);
        if (modifyPayment) {
          payments[i] = { ...payment, amount: payment.amount + diff };
        } else {
          modifiedBankTransactions[i] = { ...bankTx, amount: bankTx.amount - diff };
        }
        scenarioCounts.AMOUNT_MISMATCH++;
        groundTruth.push({
          paymentId: payment.paymentId,
          expectedBankTransactionId: bankTx.bankTransactionId,
          expectedInvoiceId: invoice.invoiceId,
          scenario: 'AMOUNT_MISMATCH',
        });
        break;
      }

      case 'MISSING_BANK_TRANSACTION': {
        modifiedBankTransactions[i] = null;
        scenarioCounts.MISSING_BANK_TRANSACTION++;
        groundTruth.push({
          paymentId: payment.paymentId,
          expectedBankTransactionId: null,
          expectedInvoiceId: invoice.invoiceId,
          scenario: 'MISSING_BANK_TRANSACTION',
        });
        break;
      }

      case 'DUPLICATE_BANK_TRANSACTION': {
        const duplicateBankId = `BANK-${String(bankIdCounter++).padStart(6, '0')}`;
        const duplicateAmount = bankTx.amount + rng.nextDecimal(-20, 20, 2);
        const duplicateDate = new Date(
          new Date(bankTx.transactionDate).getTime() + rng.nextInt(1, 12) * 60 * 60 * 1000
        );
        const duplicate = {
          bankTransactionId: duplicateBankId,
          referenceId: bankTx.referenceId,
          amount: Math.max(0.01, duplicateAmount),
          transactionDate: duplicateDate.toISOString(),
          currency: bankTx.currency,
          type: bankTx.type,
          status: bankTx.status,
          description: `Duplicate: ${bankTx.description}`,
        };
        modifiedBankTransactions.push(duplicate);
        scenarioCounts.DUPLICATE_BANK_TRANSACTION++;
        groundTruth.push({
          paymentId: payment.paymentId,
          expectedBankTransactionId: bankTx.bankTransactionId,
          expectedInvoiceId: invoice.invoiceId,
          scenario: 'DUPLICATE_BANK_TRANSACTION',
        });
        break;
      }

      case 'DATE_MISMATCH': {
        const daysDelay = rng.nextInt(8, 21);
        const newDate = new Date(
          new Date(bankTx.transactionDate).getTime() + daysDelay * 24 * 60 * 60 * 1000
        );
        modifiedBankTransactions[i] = { ...bankTx, transactionDate: newDate.toISOString() };
        scenarioCounts.DATE_MISMATCH++;
        groundTruth.push({
          paymentId: payment.paymentId,
          expectedBankTransactionId: bankTx.bankTransactionId,
          expectedInvoiceId: invoice.invoiceId,
          scenario: 'DATE_MISMATCH',
        });
        break;
      }

      case 'UNMATCHED_BANK_TRANSACTION': {
        scenarioCounts.UNMATCHED_BANK_TRANSACTION++;
        groundTruth.push({
          paymentId: payment.paymentId,
          expectedBankTransactionId: null,
          expectedInvoiceId: invoice.invoiceId,
          scenario: 'UNMATCHED',
        });
        break;
      }
    }
  }

  const unmatchedCount = Math.round(payments.length * SCENARIO_DISTRIBUTION.UNMATCHED_BANK_TRANSACTION);
  for (let i = 0; i < unmatchedCount; i++) {
    const unmatchedBankId = `BANK-${String(bankIdCounter++).padStart(6, '0')}`;
    const unmatchedDate = rng.randomDate(new Date('2026-07-01'), new Date('2026-08-31'));
    unmatchedBankTransactions.push({
      bankTransactionId: unmatchedBankId,
      referenceId: `UNKNOWN-REF-${rng.nextInt(1000, 9999)}`,
      amount: rng.nextDecimal(100, 50000, 2),
      transactionDate: unmatchedDate.toISOString(),
      currency: 'INR',
      type: rng.choice(['CREDIT', 'DEBIT']),
      status: 'SETTLED',
      description: `Unmatched transaction ${unmatchedBankId}`,
    });
  }

  const finalBankTransactions = modifiedBankTransactions
    .filter((tx) => tx !== null)
    .concat(unmatchedBankTransactions);

  return {
    payments,
    bankTransactions: finalBankTransactions,
    invoices,
    groundTruth,
    scenarioCounts,
  };
}

function getPaymentCount(scenarios) {
  return scenarios.length;
}

module.exports = {
  SCENARIO_DISTRIBUTION,
  assignScenarios,
  applyAnomalies,
  getPaymentCount,
};
