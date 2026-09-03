const PAYMENT_METHODS = ['UPI', 'CARD', 'NETBANKING', 'WALLET'];
const GATEWAYS = ['SyntheticPay', 'PayGateway', 'QuickPay'];
const CURRENCIES = ['INR'];

function generatePayments(rng, count, startDate, endDate) {
  const payments = [];

  for (let i = 0; i < count; i++) {
    const paymentId = `PAY-${String(100001 + i).padStart(6, '0')}`;
    const orderId = `ORD-${String(500001 + i).padStart(6, '0')}`;
    const customerId = `CUS-${String(200001 + i).padStart(6, '0')}`;
    const amount = rng.nextDecimal(100, 100000, 2);
    const currency = rng.choice(CURRENCIES);
    const paymentDate = rng.randomDate(startDate, endDate);
    const paymentMethod = rng.choice(PAYMENT_METHODS);
    const gateway = rng.choice(GATEWAYS);

    payments.push({
      paymentId,
      orderId,
      customerId,
      amount,
      currency,
      paymentDate: paymentDate.toISOString(),
      paymentMethod,
      status: 'SUCCESS',
      gateway,
      description: `Order ${orderId} payment`,
    });
  }

  return payments;
}

module.exports = { generatePayments };
