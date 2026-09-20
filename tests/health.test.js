const request = require('supertest');
const { createApp } = require('../src/app');

describe('Operational endpoints', () => {
  const app = createApp();

  test('GET /health reports ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /metrics exposes Prometheus-format metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });

  test('unknown routes return 404 JSON', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
  });
});
