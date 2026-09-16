const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { prepareBackup, restoreBackupData, applySettings } = require('../services/backupRestore');
const { saveHTMLFile, resolveHTMLFile } = require('../services/summaryFiles');
const User = require('../models/User');
const Diary = require('../models/Diary');
const Todo = require('../models/Todo');
const Summary = require('../models/Summary');
const uid = '111111111111111111111111';
const did = '222222222222222222222222';
const tid = '333333333333333333333333';
function backup() {
  return { metadata: { version: '1.0', userId: uid }, data: {
    diaries: [{ _id: did, user: uid, content: 'diary', startTime: '2026-09-01', endTime: '2026-09-02', relatedTodo: tid }],
    todos: [{ _id: tid, user: uid, content: 'todo', dueDate: '2026-09-02', relatedDiary: did }],
    summaries: [{ _id: '444444444444444444444444', user: uid, content: 'summary', date: '2026-09-01', type: 'weekly', htmlFilePath: '/etc/passwd' }]
  } };
}
test('restore maps both relation directions and discards untrusted HTML paths', async () => {
  const result = await prepareBackup(backup(), uid);
  assert.notEqual(String(result.diaries[0]._id), did);
  assert.equal(String(result.diaries[0].relatedTodo), String(result.todos[0]._id));
  assert.equal(String(result.todos[0].relatedDiary), String(result.diaries[0]._id));
  assert.equal(result.summaries[0].htmlFilePath, null);
});
for (const [name, corrupt] of [
  ['missing collection', b => delete b.data.todos],
  ['invalid record', b => b.data.todos[0].dueDate = 'invalid'],
  ['foreign owner', b => b.data.todos[0].user = did],
  ['foreign backup', b => b.metadata.userId = did],
  ['dangling reference', b => b.data.todos[0].relatedDiary = tid],
  ['duplicate ID', b => b.data.todos.push(b.data.todos[0])],
  ['invalid enum', b => b.data.todos[0].status = 'unknown']
]) test(`rejects ${name} before database access`, async () => {
  const value = backup(); corrupt(value);
  await assert.rejects(restoreBackupData(value, uid));
});
test('settings restore preserves account identity and validates schema', async () => {
  const user = new User({ _id: uid, username: 'a', email: 'a@example.test', password: 'hash' });
  applySettings(user, { profile: { username: 'hijack', password: 'changed', customPrompts: { weekly: 'week', html_generation: 'html' } } }, 'merge');
  await user.validate();
  assert.equal(user.username, 'a');
  assert.equal(user.password, 'hash');
  assert.equal(user.toObject().customPrompts.html_generation, 'html');
  assert.equal(user.toObject().customPrompts.weekly, 'week');
});
test('unique report files preserve content across periods and regenerations', async () => {
  const paths = [];
  try {
    for (const date of ['2026-09-01', '2026-09-08', '2026-09-08']) paths.push(await saveHTMLFile(date, uid, 'weekly', new Date(date)));
    assert.equal(new Set(paths).size, 3);
    assert.equal(await fs.readFile(resolveHTMLFile(paths[0]), 'utf8'), '2026-09-01');
    assert.equal(resolveHTMLFile('/private/summaries/../../secret'), null);
    assert.equal(resolveHTMLFile('/uploads/summaries/old.html'), null);
  } finally { await Promise.all(paths.map(p => fs.unlink(resolveHTMLFile(p)))); }
});

async function serve(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}
test('public parent and legacy summary URLs cannot disclose files', async t => {
  const app = express(); require('../middleware/publicUploads')(app);
  const base = await serve(t, app);
  for (const url of ['/uploads/summaries/old.html', '/uploads/secret.html', '/uploads/avatars/../summaries/old.html']) {
    assert.equal((await fetch(base + url)).status, 404);
  }
});
test('summary HTML enforces login and ownership; owner receives sandboxed private response', async t => {
  const { protect } = require('../middleware/auth');
  const { getSummaryHTML } = require('../controllers/summaryFileController');
  const file = await saveHTMLFile('<html>private-report</html>');
  t.after(() => fs.unlink(resolveHTMLFile(file)));
  t.mock.method(User, 'findById', async id => ({ id }));
  t.mock.method(Summary, 'findOne', async query => query.user === uid ? { htmlFilePath: file } : null);
  const app = express(); app.get('/:id/html', protect, getSummaryHTML);
  const base = await serve(t, app);
  const url = `${base}/${did}/html`;
  const auth = id => ({ Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key')}` });
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: auth(tid) })).status, 404);
  const response = await fetch(url, { headers: auth(uid) });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '<html>private-report</html>');
  assert.match(response.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
test('backup routes reject unauthenticated multipart requests before creating files', async t => {
  const app = express(); app.use('/backup', require('../routes/backup'));
  const base = await serve(t, app);
  const temp = path.join(__dirname, '../temp');
  const before = await fs.readdir(temp).catch(() => []);
  const form = new FormData(); form.set('backupFile', new Blob(['bad']), 'bad.json');
  assert.equal((await fetch(base + '/backup/restore', { method: 'POST', body: form })).status, 401);
  assert.deepEqual(await fs.readdir(temp).catch(() => []), before);
});
test('authenticated invalid backup upload is removed; repeated uploads are limited', async t => {
  t.mock.method(require('../utils/logger'), 'error', () => {});
  const { backupUpload } = require('../middleware/backupUpload');
  const { restoreBackup } = require('../controllers/backupController');
  const uploaded = [];
  const app = express();
  app.post('/', (req, res, next) => { req.user = { id: tid }; next(); }, backupUpload, (req, res) => { uploaded.push(req.file.path); return restoreBackup(req, res); });
  const base = await serve(t, app);
  for (let i = 0; i < 11; i++) {
    const form = new FormData(); form.set('backupFile', new Blob(['{}']), 'bad.json');
    const response = await fetch(base, { method: 'POST', body: form });
    assert.equal(response.status, i < 10 ? 400 : 429);
  }
  for (const filename of uploaded) {
    // finish handler asynchronously unlinks the file.
    for (let i = 0; i < 20; i++) {
      if (!await fs.stat(filename).catch(() => null)) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    await assert.rejects(fs.stat(filename), { code: 'ENOENT' });
  }
});
test('standalone MongoDB rejects restore before starting a transaction', async t => {
  const old = mongoose.connection.db;
  mongoose.connection.db = { admin: () => ({ command: async () => ({ ok: 1 }) }) };
  t.after(() => { mongoose.connection.db = old; });
  const start = t.mock.method(mongoose, 'startSession', async () => { throw new Error('must not start'); });
  await assert.rejects(restoreBackupData(backup(), uid), { status: 503 });
  assert.equal(start.mock.callCount(), 0);
});
test('transaction failure propagates, all mutations use session, snapshot precedes deletion', async t => {
  const old = mongoose.connection.db;
  mongoose.connection.db = { admin: () => ({ command: async () => ({ setName: 'test' }) }) };
  t.after(() => { mongoose.connection.db = old; });
  let ended = false; let snapshot; let deleted = 0;
  const session = { withTransaction: async fn => fn(), endSession: async () => { ended = true; } };
  t.mock.method(mongoose, 'startSession', async () => session);
  const user = new User({ _id: uid, username: 'test', email: 'test@example.test', password: 'hash' });
  t.mock.method(User, 'findById', () => ({ session: s => { assert.equal(s, session); return user; } }));
  t.mock.method(fs, 'writeFile', async (filename, content) => { snapshot = JSON.parse(content); });
  for (const Model of [Diary, Todo, Summary]) {
    t.mock.method(Model, 'find', () => ({ session: s => { assert.equal(s, session); return { lean: async () => [{ original: true }] }; } }));
    t.mock.method(Model, 'deleteMany', async (filter, options) => { assert.equal(options.session, session); assert.ok(snapshot); deleted++; });
    t.mock.method(Model, 'insertMany', async (docs, options) => {
      assert.equal(options.session, session);
      if (Model === Todo) throw new Error('injected database failure');
    });
  }
  await assert.rejects(restoreBackupData(backup(), uid), /injected database failure/);
  assert.equal(deleted, 2);
  assert.equal(ended, true);
  assert.equal(snapshot.data.diaries[0].original, true);
});
test('HTML prompt changes are private and default template remains unchanged', async t => {
  const controller = require('../controllers/summaryController');
  const template = path.join(__dirname, '../templates/html_generation_prompt.txt');
  const before = await fs.readFile(template, 'utf8');
  const users = new Map([[uid, new User({ customPrompts: {} })], [tid, new User({ customPrompts: {} })]]);
  t.mock.method(User, 'findById', async id => users.get(id));
  t.mock.method(users.get(uid), 'save', async () => {});
  function response() { return { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } }; }
  await controller.updatePromptTemplate({ user: { id: uid }, params: { type: 'html_generation' }, body: { content: 'private prompt' } }, response());
  const own = response(); const other = response();
  await controller.getPromptTemplate({ user: { id: uid }, params: { type: 'html_generation' } }, own);
  await controller.getPromptTemplate({ user: { id: tid }, params: { type: 'html_generation' } }, other);
  assert.equal(own.data.content, 'private prompt');
  assert.equal(other.data.content, before);
  assert.equal(await fs.readFile(template, 'utf8'), before);
});
