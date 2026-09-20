const express = require('express');
const { register, metricsMiddleware } = require('./metrics');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(metricsMiddleware);

  // Liveness/readiness endpoint used by the Deploy stage's smoke test and by
  // the Monitoring stage's uptime checks.
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptimeSeconds: process.uptime(),
      version: process.env.APP_VERSION || 'dev',
    });
  });

  // Prometheus-format metrics endpoint scraped by the Monitoring stage.
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', taskRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Centralised error handler so unexpected exceptions still return JSON
    // and increment the 5xx metric instead of crashing the process.
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = { createApp };
