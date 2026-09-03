function generateInvoices(rng, payments, startDate, endDate) {
  const invoices = [];

  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    const invoiceId = `INV-${String(900001 + i).padStart(6, '0')}`;

    const invoiceDate = new Date(
      new Date(payment.paymentDate).getTime() - rng.nextInt(1, 24) * 60 * 60 * 1000
    );

    invoices.push({
      invoiceId,
      orderId: payment.orderId,
      customerId: payment.customerId,
      invoiceAmount: payment.amount,
      invoiceDate: invoiceDate.toISOString(),
      currency: payment.currency,
      status: 'PAID',
      description: `Invoice for order ${payment.orderId}`,
    });
  }

  return invoices;
}

module.exports = { generateInvoices };
