const mongoose = require('mongoose');

// Immutable, append-only human resolution history record.
//
// Reconcile lifecycle note: this model is created but NEVER updated or deleted
// by the application. Every human workflow action appends one entry here so the
// exception's full resolution timeline is always reconstructable.
const exceptionResolutionSchema = new mongoose.Schema(
  {
    runId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      required: true,
      index: true,
    },
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReconciliationResult',
      required: true,
      index: true,
    },
    exceptionRef: {
      type: String,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      default: null,
    },
    action: {
      type: String,
      enum: ['START_REVIEW', 'RESOLVE', 'REJECT', 'ESCALATE', 'REOPEN'],
      required: true,
    },
    previousStatus: {
      type: String,
      enum: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'ESCALATED'],
      required: true,
    },
    newStatus: {
      type: String,
      enum: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'ESCALATED'],
      required: true,
    },
    resolutionCode: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

exceptionResolutionSchema.index({ runId: 1, resultId: 1, createdAt: -1 });
exceptionResolutionSchema.index({ resultId: 1, createdAt: -1 });

module.exports = mongoose.model('ExceptionResolution', exceptionResolutionSchema);