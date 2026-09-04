const mongoose = require('mongoose');

const RESULT_STATUSES = ['MATCHED', 'EXCEPTION'];

const reconciliationResultSchema = new mongoose.Schema(
  {
    runId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      required: true,
      index: true,
    },
    paymentId: { type: String, default: null },
    bankTransactionId: { type: String, default: null },
    invoiceId: { type: String, default: null },
    status: {
      type: String,
      enum: RESULT_STATUSES,
      index: true,
    },
    exceptionType: {
      type: String,
      default: null,
      index: true,
    },
    matchMethod: { type: String, default: null },
    confidence: { type: Number, default: 0 },
    paymentAmount: { type: Number, default: null },
    bankAmount: { type: Number, default: null },
    invoiceAmount: { type: Number, default: null },
    amountDifference: { type: Number, default: null },
    invoiceAmountDifference: { type: Number, default: null },
    dateDifferenceDays: { type: Number, default: null },
    paymentDate: { type: Date, default: null },
    bankDate: { type: Date, default: null },
    invoiceDate: { type: Date, default: null },
  },
  { timestamps: true }
);

reconciliationResultSchema.index({ runId: 1, status: 1 });
reconciliationResultSchema.index({ runId: 1, exceptionType: 1 });

module.exports = mongoose.model('ReconciliationResult', reconciliationResultSchema);
