const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const dashboardRoutes = require('./routes/dashboard');
const financeQARoutes = require('./routes/financeQA');
const reconciliationRoutes = require('./routes/reconciliation');
const reconciliationRunRoutes = require('./routes/reconciliationRuns');
const auditLogRoutes = require('./routes/auditLogs');
const { securityHeaders } = require('./middleware/securityHeaders');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();

const app = express();

app.use(securityHeaders);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', aiRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', financeQARoutes);
app.use('/api', reconciliationRoutes);
app.use('/api', reconciliationRunRoutes);
app.use('/api', auditLogRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use(errorHandler);

module.exports = app;
