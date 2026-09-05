const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
  userId: {
    type: String,
    default: null,
  },
  userName: {
    type: String,
    default: null,
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: [
      'LOGIN',
      'LOGOUT',
      'RECONCILIATION_RUN',
      'EXCEPTION_ANALYSIS',
      'FINANCE_QA_QUERY',
      'DASHBOARD_VIEW',
      'RECONCILIATION_CREATED',
      'FILE_UPLOADED',
      'VALIDATION_COMPLETED',
      'RECONCILIATION_STARTED',
      'RECONCILIATION_COMPLETED',
      'RECONCILIATION_FAILED',
      'RECONCILIATION_ARCHIVED',
      'RECONCILIATION_UNARCHIVED',
      'EXCEPTION_REVIEW_STARTED',
      'EXCEPTION_RESOLVED',
      'EXCEPTION_REJECTED',
      'EXCEPTION_ESCALATED',
      'EXCEPTION_REOPENED',
    ],
    index: true,
  },
  resource: {
    type: String,
    default: null,
  },
  resourceId: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED'],
    default: 'SUCCESS',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resourceId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
