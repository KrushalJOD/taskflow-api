/**
 * Minimal in-memory data store.
 *
 * A real deployment would point this at Postgres/Mongo, but keeping the
 * persistence layer in-memory means the whole pipeline (tests, container
 * build, staging deploy) needs no external database service, which keeps
 * the Jenkins pipeline simple and fast while still exercising a real
 * request -> auth -> business-logic -> response path.
 */

let users = [];
let tasks = [];
let userSeq = 1;
let taskSeq = 1;

function resetStore() {
  users = [];
  tasks = [];
  userSeq = 1;
  taskSeq = 1;
}

function createUser({ username, passwordHash }) {
  const user = { id: userSeq++, username, passwordHash };
  users.push(user);
  return user;
}

function findUserByUsername(username) {
  return users.find((u) => u.username === username);
}

function createTask({ ownerId, title, description }) {
  const task = {
    id: taskSeq++,
    ownerId,
    title,
    description: description || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
}

function listTasksForOwner(ownerId) {
  return tasks.filter((t) => t.ownerId === ownerId);
}

function findTask(id, ownerId) {
  return tasks.find((t) => t.id === Number(id) && t.ownerId === ownerId);
}

function updateTask(id, ownerId, updates) {
  const task = findTask(id, ownerId);
  if (!task) {return null;}
  Object.assign(task, updates);
  return task;
}

function deleteTask(id, ownerId) {
  const index = tasks.findIndex((t) => t.id === Number(id) && t.ownerId === ownerId);
  if (index === -1) {return false;}
  tasks.splice(index, 1);
  return true;
}

module.exports = {
  resetStore,
  createUser,
  findUserByUsername,
  createTask,
  listTasksForOwner,
  findTask,
  updateTask,
  deleteTask,
};
