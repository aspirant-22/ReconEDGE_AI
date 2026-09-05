const mongoose = require('mongoose');

const RESULT_STATUSES = ['MATCHED', 'EXCEPTION'];

// Human exception workflow lifecycle. Kept separate from the deterministic
// reconciliation `status`/`exceptionType` so the original classification is
// never rewritten to make a discrepancy disappear.
const WORKFLOW_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'ESCALATED'];

const WORKFLOW_ACTIONS = ['START_REVIEW', 'RESOLVE', 'REJECT', 'ESCALATE', 'REOPEN'];

// Controlled human resolution categories. The human explicitly chooses these;
// Gemini never generates them.
const RESOLUTION_CODES = [
  'BANK_FEE',
  'TIMING_DIFFERENCE',
  'DUPLICATE_CONFIRMED',
  'FALSE_POSITIVE',
  'DATA_ENTRY_ERROR',
  'MISSING_DOCUMENT',
  'CUSTOMER_DISPUTE',
  'SYSTEM_ERROR',
  'MANUAL_ADJUSTMENT',
  'OTHER',
];

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
    // ---- Human workflow state (Phase 12). Never overwrites reconciliation data. ----
    workflowStatus: {
      type: String,
      enum: WORKFLOW_STATUSES,
      default: 'OPEN',
      index: true,
    },
    lastAction: {
      type: String,
      enum: WORKFLOW_ACTIONS,
      default: null,
    },
    resolutionCode: {
      type: String,
      enum: RESOLUTION_CODES,
      default: null,
    },
    resolutionReason: { type: String, default: null },
    resolutionNotes: { type: String, default: null },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reconciliationResultSchema.index({ runId: 1, status: 1 });
reconciliationResultSchema.index({ runId: 1, exceptionType: 1 });
reconciliationResultSchema.index({ runId: 1, workflowStatus: 1 });

const ReconciliationResult = mongoose.model('ReconciliationResult', reconciliationResultSchema);

module.exports = ReconciliationResult;
module.exports.RESULT_STATUSES = RESULT_STATUSES;
module.exports.WORKFLOW_STATUSES = WORKFLOW_STATUSES;
module.exports.WORKFLOW_ACTIONS = WORKFLOW_ACTIONS;
module.exports.RESOLUTION_CODES = RESOLUTION_CODES;
