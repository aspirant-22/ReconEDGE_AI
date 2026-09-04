const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

const ALLOWED_ACTIONS = [
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
];

/**
 * Persist a structured, safe audit trail entry.
 *
 * Deliberately stores only safe identifiers/status — never secrets, JWTs,
 * passwords, authorization headers, full AI prompts, or raw financial payloads.
 */
async function createAuditEvent(entry) {
  try {
    const action = entry.action;
    if (!ALLOWED_ACTIONS.includes(action)) {
      return null;
    }

    const doc = await AuditLog.create({
      timestamp: entry.timestamp || new Date(),
      userId: entry.userId || null,
      userName: entry.userName || null,
      action,
      resource: entry.resource || null,
      resourceId: entry.resourceId || null,
      status: entry.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
      metadata: entry.metadata || {},
    });

    return doc;
  } catch (error) {
    logger.warn(`Audit log write skipped: ${logger.sanitize(error.message)}`);
    return null;
  }
}

exports.createAuditEvent = createAuditEvent;

exports.getLogs = async (req, res) => {
  try {
    const { search, action, status, runId, from, to } = req.query;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const skip = (page - 1) * limit;

    // A user may only ever see their own audit trail.
    const query = { userId: req.user ? String(req.user._id) : null };

    if (status === 'SUCCESS' || status === 'FAILED') {
      query.status = status;
    }

    if (action && ALLOWED_ACTIONS.includes(action)) {
      query.action = action;
    }

    if (runId && mongoose && mongoose.isValidObjectId(String(runId))) {
      query.resourceId = String(runId);
    }

    if (from || to) {
      query.timestamp = {};
      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) query.timestamp.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) query.timestamp.$lte = toDate;
      }
      if (Object.keys(query.timestamp).length === 0) delete query.timestamp;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { action: regex },
        { resource: regex },
        { resourceId: regex },
        { userName: regex },
      ];
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      logs: logs.map(mapLog),
      pagination: {
        total,
        page,
        limit,
        pages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    logger.error(`Audit logs controller error: ${logger.sanitize(error.message)}`);
    res.status(500).json({
      success: false,
      error: { code: 'AUDIT_ERROR', message: 'Unable to load audit logs.' },
    });
  }
};

function mapLog(log) {
  return {
    id: log._id,
    timestamp: log.timestamp,
    userId: log.userId,
    userName: log.userName,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    status: log.status,
    metadata: log.metadata || {},
  };
}
