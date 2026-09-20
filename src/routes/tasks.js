const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const VALID_STATUSES = ['pending', 'in_progress', 'done'];

router.use(requireAuth);

router.get('/', (req, res) => {
  const tasks = db.listTasksForOwner(req.user.sub);
  res.json(tasks);
});

router.post('/', (req, res) => {
  const { title, description } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const task = db.createTask({ ownerId: req.user.sub, title, description });
  return res.status(201).json(task);
});

router.get('/:id', (req, res) => {
  const task = db.findTask(req.params.id, req.user.sub);
  if (!task) {return res.status(404).json({ error: 'task not found' });}
  return res.json(task);
});

router.patch('/:id', (req, res) => {
  const { title, description, status } = req.body || {};

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }

  const updates = {};
  if (title !== undefined) {updates.title = title;}
  if (description !== undefined) {updates.description = description;}
  if (status !== undefined) {updates.status = status;}

  const task = db.updateTask(req.params.id, req.user.sub, updates);
  if (!task) {return res.status(404).json({ error: 'task not found' });}
  return res.json(task);
});

router.delete('/:id', (req, res) => {
  const deleted = db.deleteTask(req.params.id, req.user.sub);
  if (!deleted) {return res.status(404).json({ error: 'task not found' });}
  return res.status(204).send();
});

module.exports = router;
