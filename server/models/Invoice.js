const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    runId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      required: true,
      index: true,
    },
    invoiceId: { type: String, required: true, trim: true },
    customerId: { type: String, default: null, trim: true },
    amount: { type: Number, required: true },
    amountPaise: { type: Number, default: 0 },
    currency: { type: String, default: 'INR', trim: true },
    invoiceDate: { type: Date, default: null },
    reference: { type: String, default: null, trim: true },
    description: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

invoiceSchema.index({ runId: 1, invoiceId: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
