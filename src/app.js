const express = require('express');
const cors = require('cors');
require('dotenv').config();

const readingsRouter  = require('./routes/readings');
const stationsRouter  = require('./routes/stations');
const usersRouter      = require('./routes/users');
const alertsRouter     = require('./routes/alerts');
const lineWebhookRouter = require('./routes/lineWebhook');
const notificationSettingsRouter = require('./routes/notificationSettings');
const { getMqttStatus } = require('./config/mqtt');

const app = express();

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
// Preserve raw body buffer for LINE Webhook signature verification
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

// Request logger (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[HTTP] ${req.method} ${req.path}`);
    next();
  });
}

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth', usersRouter);
app.use('/api/users', usersRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/line', lineWebhookRouter);
app.use('/api/notifications', notificationSettingsRouter);
app.use('/api/readings', readingsRouter);
app.use('/api/stations', stationsRouter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mqtt: getMqttStatus(),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Express] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

module.exports = app;
