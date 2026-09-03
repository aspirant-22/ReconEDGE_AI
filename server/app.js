const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const dashboardRoutes = require('./routes/dashboard');
const financeQARoutes = require('./routes/financeQA');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', aiRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', financeQARoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use(errorHandler);

module.exports = app;
