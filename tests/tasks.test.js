const request = require('supertest');
const { createApp } = require('../src/app');
const db = require('../src/db');

describe('Tasks API', () => {
  let app;
  let token;

  beforeEach(async () => {
    db.resetStore();
    app = createApp();
    await request(app).post('/api/auth/register').send({ username: 'frank', password: 'password123' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'frank', password: 'password123' });
    token = loginRes.body.token;
  });

  test('rejects requests without a bearer token', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  test('creates and lists a task for the authenticated user', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Write pipeline report', description: 'Finish the 7.3HD submission' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('pending');

    const listRes = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].title).toBe('Write pipeline report');
  });

  test('rejects a task with no title', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'missing a title' });

    expect(res.status).toBe(400);
  });

  test('updates a task status', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Deploy to staging' });

    const patchRes = await request(app)
      .patch(`/api/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.status).toBe('in_progress');
  });

  test('rejects an invalid status value', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Deploy to production' });

    const patchRes = await request(app)
      .patch(`/api/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'not-a-real-status' });

    expect(patchRes.status).toBe(400);
  });

  test('deletes a task', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Temporary task' });

    const deleteRes = await request(app)
      .delete(`/api/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  test('returns 404 for a task belonging to another user', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: "Frank's private task" });

    await request(app).post('/api/auth/register').send({ username: 'grace', password: 'password123' });
    const graceLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'grace', password: 'password123' });

    const res = await request(app)
      .get(`/api/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${graceLogin.body.token}`);

    expect(res.status).toBe(404);
  });
});
