const mongoose = require('mongoose');

const RUN_STATUSES = [
  'CREATED',
  'UPLOADING',
  'VALIDATING',
  'READY',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
];

const FILE_TYPE_VALUES = ['PAYMENTS', 'BANK_TRANSACTIONS', 'INVOICES'];

const fileMetaSchema = new mongoose.Schema(
  {
    fileName: { type: String, default: null },
    fileType: { type: String, enum: FILE_TYPE_VALUES, default: null },
    extension: { type: String, default: null },
    sizeBytes: { type: Number, default: 0 },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: null },
  },
  { _id: false }
);

const reconciliationRunSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Reconciliation name is required'],
      trim: true,
      maxlength: 200,
    },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    status: {
      type: String,
      enum: RUN_STATUSES,
      default: 'CREATED',
      index: true,
    },
    paymentFile: { type: fileMetaSchema, default: null },
    bankFile: { type: fileMetaSchema, default: null },
    invoiceFile: { type: fileMetaSchema, default: null },
    paymentCount: { type: Number, default: 0 },
    bankTransactionCount: { type: Number, default: 0 },
    invoiceCount: { type: Number, default: 0 },
    validPaymentCount: { type: Number, default: 0 },
    validBankTransactionCount: { type: Number, default: 0 },
    validInvoiceCount: { type: Number, default: 0 },
    matchedCount: { type: Number, default: 0 },
    exceptionCount: { type: Number, default: 0 },
    processingTimeMs: { type: Number, default: null },
    errorMessage: { type: String, default: null },
    analytics: { type: mongoose.Schema.Types.Mixed, default: null },
    completedAt: { type: Date, default: null },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

reconciliationRunSchema.index({ userId: 1, createdAt: -1 });
reconciliationRunSchema.index({ userId: 1, status: 1 });
reconciliationRunSchema.index({ userId: 1, isArchived: 1 });
reconciliationRunSchema.index({ status: 1, createdAt: -1 });

const ReconciliationRun = mongoose.model('ReconciliationRun', reconciliationRunSchema);

module.exports = ReconciliationRun;
module.exports.RUN_STATUSES = RUN_STATUSES;
module.exports.FILE_TYPE_VALUES = FILE_TYPE_VALUES;
