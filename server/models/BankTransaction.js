const mongoose = require('mongoose');

const bankTransactionSchema = new mongoose.Schema(
  {
    runId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      required: true,
      index: true,
    },
    transactionId: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    amountPaise: { type: Number, default: 0 },
    currency: { type: String, default: 'INR', trim: true },
    transactionDate: { type: Date, default: null },
    reference: { type: String, default: null, trim: true },
    description: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

bankTransactionSchema.index({ runId: 1, transactionId: 1 }, { unique: true });

module.exports = mongoose.model('BankTransaction', bankTransactionSchema);
