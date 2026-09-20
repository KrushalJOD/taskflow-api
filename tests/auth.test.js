const request = require('supertest');
const { createApp } = require('../src/app');
const db = require('../src/db');

describe('Auth API', () => {
  let app;

  beforeEach(() => {
    db.resetStore();
    app = createApp();
  });

  test('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ username: 'alice' });
    expect(res.body.id).toBeDefined();
  });

  test('rejects registration with a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', password: '123' });

    expect(res.status).toBe(400);
  });

  test('rejects duplicate usernames', async () => {
    await request(app).post('/api/auth/register').send({ username: 'carol', password: 'password123' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'carol', password: 'password123' });

    expect(res.status).toBe(409);
  });

  test('logs in with correct credentials and returns a JWT', async () => {
    await request(app).post('/api/auth/register').send({ username: 'dave', password: 'password123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'dave', password: 'password123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  test('rejects login with wrong password', async () => {
    await request(app).post('/api/auth/register').send({ username: 'erin', password: 'password123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'erin', password: 'wrongpass' });

    expect(res.status).toBe(401);
  });
});
