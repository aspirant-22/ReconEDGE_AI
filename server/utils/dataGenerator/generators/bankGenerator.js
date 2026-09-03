function generateBankTransactions(rng, payments, startDate, endDate) {
  const bankTransactions = [];

  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    const bankTransactionId = `BANK-${String(700001 + i).padStart(6, '0')}`;

    const settlementDelay = rng.nextInt(1, 3) * 24 * 60 * 60 * 1000;
    const transactionDate = new Date(
      new Date(payment.paymentDate).getTime() + settlementDelay
    );

    bankTransactions.push({
      bankTransactionId,
      referenceId: payment.paymentId,
      amount: payment.amount,
      transactionDate: transactionDate.toISOString(),
      currency: payment.currency,
      type: 'CREDIT',
      status: 'SETTLED',
      description: `${payment.gateway} settlement ${payment.orderId}`,
    });
  }

  return bankTransactions;
}

module.exports = { generateBankTransactions };
