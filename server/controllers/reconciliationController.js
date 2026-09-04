const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { reconcile } = require('../services/reconciliation/reconciliationEngine');
const {
  calculatePaymentMatchRate,
  calculateBankMatchRate,
  calculateInvoiceMatchRate,
} = require('../services/reconciliation/metrics');
const { generateAnalytics } = require('../services/analytics/analyticsEngine');
const { calculateFinancialAnalytics } = require('../services/analytics/financialAnalytics');
const { createAuditEvent } = require('./auditLogController');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'generated');

const RESULTS_PATH = path.join(DATA_DIR, 'reconciliation-results.json');
const METRICS_PATH = path.join(DATA_DIR, 'reconciliation-metrics.json');
const ANALYTICS_PATH = path.join(DATA_DIR, 'reconciliation-analytics.json');

function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function currentUserInfo(req) {
  const user = req.user;
  return {
    userId: user ? String(user._id) : null,
    userName: user ? user.name : null,
  };
}

function serializeResults(results) {
  return results.map((r) => ({
    paymentId: r.paymentId,
    bankTransactionId: r.bankTransactionId,
    invoiceId: r.invoiceId,
    status: r.status,
    exceptionType: r.exceptionType || null,
    matchMethod: r.matchMethod,
    confidence: r.confidence,
    paymentAmount: r.paymentAmount,
    bankAmount: r.bankAmount,
    invoiceAmount: r.invoiceAmount,
    amountDifference: r.amountDifference,
    dateDifferenceDays: r.dateDifferenceDays,
  }));
}

function buildResponse(results, metrics) {
  const matched = results.filter((r) => r.status === 'MATCHED');
  const exceptions = results.filter((r) => r.status === 'EXCEPTION');

  const exceptionDistribution = {};
  for (const exc of exceptions) {
    const type = exc.exceptionType || 'UNKNOWN';
    exceptionDistribution[type] = (exceptionDistribution[type] || 0) + 1;
  }

  return {
    dataset: {
      payments: metrics.inputRecords.payments,
      bankTransactions: metrics.inputRecords.bankTransactions,
      invoices: metrics.inputRecords.invoices,
    },
    summary: {
      matched: matched.length,
      exceptions: exceptions.length,
      paymentMatchRate: metrics.matchRates.payment,
      bankMatchRate: metrics.matchRates.bank,
      invoiceMatchRate: metrics.matchRates.invoice,
      exceptionRate: Number(((exceptions.length / metrics.inputRecords.payments) * 100).toFixed(2)),
    },
    exceptionDistribution,
  };
}

exports.getReconciliation = (req, res) => {
  try {
    const results = loadJson(RESULTS_PATH);
    const metrics = loadJson(METRICS_PATH);
    const analytics = loadJson(ANALYTICS_PATH);

    if (!results || !metrics || !analytics) {
      return res.json({
        success: true,
        hasData: false,
        data: null,
      });
    }

    const response = buildResponse(results, metrics);
    response.generatedAt = analytics.generatedAt || null;
    response.processingTimeMs = metrics.processingTimeMs || null;
    response.results = serializeResults(results);
    response.financial = {
      totalPaymentAmount: analytics.financialImpact.totalPaymentAmount,
      matchedPaymentAmount: analytics.financialImpact.matchedPaymentAmount,
      exceptionPaymentAmount: analytics.financialImpact.exceptionPaymentAmount,
      amountMismatchImpact: analytics.financialImpact.amountMismatchImpact,
    };

    res.json({
      success: true,
      hasData: true,
      data: response,
    });
  } catch (error) {
    logger.error(`Reconciliation controller error: ${logger.sanitize(error.message)}`);
    res.status(500).json({
      success: false,
      error: { code: 'RECONCILIATION_ERROR', message: 'Unable to load reconciliation data.' },
    });
  }
};

exports.runReconciliation = async (req, res) => {
  try {
    const payments = loadJson(path.join(DATA_DIR, 'payments.json'));
    const bankTransactions = loadJson(path.join(DATA_DIR, 'bank-transactions.json'));
    const invoices = loadJson(path.join(DATA_DIR, 'invoices.json'));

    if (!payments || !bankTransactions || !invoices) {
      return res.status(503).json({
        success: false,
        error: { code: 'DATA_NOT_FOUND', message: 'Source dataset is not available.' },
      });
    }

    const startTime = Date.now();
    const results = reconcile(payments, bankTransactions, invoices);
    const processingTimeMs = Date.now() - startTime;

    const matched = results.filter((r) => r.status === 'MATCHED');
    const exceptions = results.filter((r) => r.status === 'EXCEPTION');

    const previousMetrics = loadJson(METRICS_PATH);

    const runtimeMetrics = {
      inputRecords: {
        payments: payments.length,
        bankTransactions: bankTransactions.length,
        invoices: invoices.length,
      },
      matchedRecords: matched.length,
      exceptionRecords: exceptions.length,
      matchRates: {
        payment: calculatePaymentMatchRate(results),
        bank: calculateBankMatchRate(results),
        invoice: calculateInvoiceMatchRate(results),
      },
      processingTimeMs,
      recordsPerSecond: 0,
      exceptionDistribution: {},
      evaluation:
        previousMetrics && previousMetrics.evaluation ? previousMetrics.evaluation : null,
    };

    const exceptionCounts = {};
    for (const exc of exceptions) {
      const type = exc.exceptionType || 'UNKNOWN';
      exceptionCounts[type] = (exceptionCounts[type] || 0) + 1;
    }
    runtimeMetrics.exceptionDistribution = exceptionCounts;

    const analytics = generateAnalytics(results, runtimeMetrics);
    const financial = calculateFinancialAnalytics(results);

    const serializedResults = serializeResults(results);

    writeJson(RESULTS_PATH, serializedResults);
    writeJson(METRICS_PATH, runtimeMetrics);
    writeJson(ANALYTICS_PATH, analytics);

    const { userId, userName } = currentUserInfo(req);
    createAuditEvent({
      userId,
      userName,
      action: 'RECONCILIATION_RUN',
      resource: 'RECONCILIATION',
      resourceId: null,
      status: 'SUCCESS',
      metadata: {
        processingTimeMs,
        matched: matched.length,
        exceptions: exceptions.length,
      },
    });

    const response = buildResponse(results, runtimeMetrics);
    response.generatedAt = analytics.generatedAt || null;
    response.processingTimeMs = processingTimeMs;
    response.results = serializedResults;
    response.financial = {
      totalPaymentAmount: financial.totalPaymentAmount,
      matchedPaymentAmount: financial.matchedPaymentAmount,
      exceptionPaymentAmount: financial.exceptionPaymentAmount,
      amountMismatchImpact: financial.amountMismatchImpact,
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error(`Reconciliation run error: ${logger.sanitize(error.message)}`);
    res.status(500).json({
      success: false,
      error: { code: 'RECONCILIATION_RUN_ERROR', message: 'Reconciliation failed. Please try again.' },
    });
  }
};
