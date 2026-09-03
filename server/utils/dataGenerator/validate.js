function validateDataset(payments, bankTransactions, invoices, groundTruth, scenarioCounts) {
  const errors = [];

  const paymentIds = new Set(payments.map((p) => p.paymentId));
  if (paymentIds.size !== payments.length) {
    errors.push('Duplicate payment IDs found');
  }

  const bankIds = new Set(bankTransactions.map((b) => b.bankTransactionId));
  if (bankIds.size !== bankTransactions.length) {
    errors.push('Duplicate bank transaction IDs found');
  }

  const invoiceIds = new Set(invoices.map((inv) => inv.invoiceId));
  if (invoiceIds.size !== invoices.length) {
    errors.push('Duplicate invoice IDs found');
  }

  for (const p of payments) {
    if (typeof p.amount !== 'number' || p.amount <= 0 || isNaN(p.amount)) {
      errors.push(`Invalid amount for payment ${p.paymentId}`);
    }
    if (p.currency !== 'INR') {
      errors.push(`Invalid currency for payment ${p.paymentId}`);
    }
    if (!p.paymentId || !p.orderId || !p.customerId) {
      errors.push(`Missing required fields for payment ${p.paymentId}`);
    }
  }

  for (const b of bankTransactions) {
    if (typeof b.amount !== 'number' || b.amount <= 0 || isNaN(b.amount)) {
      errors.push(`Invalid amount for bank transaction ${b.bankTransactionId}`);
    }
    if (b.currency !== 'INR') {
      errors.push(`Invalid currency for bank transaction ${b.bankTransactionId}`);
    }
  }

  for (const inv of invoices) {
    if (typeof inv.invoiceAmount !== 'number' || inv.invoiceAmount <= 0 || isNaN(inv.invoiceAmount)) {
      errors.push(`Invalid amount for invoice ${inv.invoiceId}`);
    }
    if (inv.currency !== 'INR') {
      errors.push(`Invalid currency for invoice ${inv.invoiceId}`);
    }
  }

  if (groundTruth.length !== payments.length) {
    errors.push(
      `Ground truth count (${groundTruth.length}) does not match payment count (${payments.length})`
    );
  }

  const gtPaymentIds = new Set(groundTruth.map((gt) => gt.paymentId));
  if (gtPaymentIds.size !== groundTruth.length) {
    errors.push('Duplicate payment IDs in ground truth');
  }

  const totalScenarios = Object.values(scenarioCounts).reduce((a, b) => a + b, 0);
  if (totalScenarios !== payments.length) {
    errors.push(
      `Scenario counts total (${totalScenarios}) does not match payment count (${payments.length})`
    );
  }

  const bankIdSet = new Set(bankTransactions.map((b) => b.bankTransactionId));
  for (const gt of groundTruth) {
    if (gt.expectedBankTransactionId && !bankIdSet.has(gt.expectedBankTransactionId)) {
      errors.push(
        `Ground truth references non-existent bank transaction ${gt.expectedBankTransactionId} for payment ${gt.paymentId}`
      );
    }
  }

  const invoiceIdSet = new Set(invoices.map((inv) => inv.invoiceId));
  for (const gt of groundTruth) {
    if (gt.expectedInvoiceId && !invoiceIdSet.has(gt.expectedInvoiceId)) {
      errors.push(
        `Ground truth references non-existent invoice ${gt.expectedInvoiceId} for payment ${gt.paymentId}`
      );
    }
  }

  for (const gt of groundTruth) {
    if (gt.scenario === 'EXACT_MATCH') {
      const payment = payments.find((p) => p.paymentId === gt.paymentId);
      const bankTx = bankTransactions.find((b) => b.bankTransactionId === gt.expectedBankTransactionId);
      const invoice = invoices.find((inv) => inv.invoiceId === gt.expectedInvoiceId);

      if (payment && bankTx && invoice) {
        if (Math.abs(payment.amount - bankTx.amount) > 0.01) {
          errors.push(
            `EXACT_MATCH ${gt.paymentId}: payment amount ${payment.amount} != bank amount ${bankTx.amount}`
          );
        }
        if (Math.abs(payment.amount - invoice.invoiceAmount) > 0.01) {
          errors.push(
            `EXACT_MATCH ${gt.paymentId}: payment amount ${payment.amount} != invoice amount ${invoice.invoiceAmount}`
          );
        }
      }
    }

    if (gt.scenario === 'AMOUNT_MISMATCH') {
      const payment = payments.find((p) => p.paymentId === gt.paymentId);
      const bankTx = bankTransactions.find((b) => b.bankTransactionId === gt.expectedBankTransactionId);
      if (payment && bankTx) {
        if (Math.abs(payment.amount - bankTx.amount) < 0.01) {
          errors.push(
            `AMOUNT_MISMATCH ${gt.paymentId}: amounts are actually equal`
          );
        }
      }
    }

    if (gt.scenario === 'MISSING_BANK_TRANSACTION') {
      if (gt.expectedBankTransactionId !== null) {
        errors.push(
          `MISSING_BANK_TRANSACTION ${gt.paymentId}: expectedBankTransactionId should be null`
        );
      }
    }
  }

  const unmatchedBankIds = new Set(
    groundTruth
      .filter((gt) => gt.scenario === 'UNMATCHED')
      .map((gt) => gt.paymentId)
  );

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = { validateDataset };
