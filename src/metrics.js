const client = require('prom-client');

// Collect default Node.js process metrics (CPU, memory, event loop lag, etc.)
// so the Monitoring stage has real, non-trivial metrics to scrape, not just
// a hard-coded counter.
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests received',
  labelNames: ['method', 'route', 'status_code'],
});

const taskErrorsTotal = new client.Counter({
  name: 'taskflow_errors_total',
  help: 'Total number of application-level errors (5xx) raised by TaskFlow',
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(taskErrorsTotal);

function metricsMiddleware(req, res, next) {
  const endTimer = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = (req.route && req.route.path) || req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };
    httpRequestsTotal.inc(labels);
    endTimer(labels);
    if (res.statusCode >= 500) {
      taskErrorsTotal.inc();
    }
  });
  next();
}

module.exports = { register, metricsMiddleware, taskErrorsTotal };
