const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Diary = require('../models/Diary');
const Todo = require('../models/Todo');
const User = require('../models/User');
const Summary = require('../models/Summary');
const diaryController = require('../controllers/diaryController');
const todoController = require('../controllers/todoController');
const { getDashboard } = require('../controllers/dashboardController');
const { restoreBackup, getBackupStatus } = require('../controllers/backupController');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

function response() { return { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } }; }

test('workflow regression with isolated database', { skip: !process.env.TEST_MONGODB_URI, timeout: 60000 }, async t => {
  const dbName = `workdiary_workflow_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName });
  t.after(async () => { assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  // Prevent external services, even if the test shell has unrelated Dify settings.
  t.mock.method(require('../utils/dify').prototype, 'ensureBaseAuth', () => { throw new Error('offline test'); });
  t.mock.method(require('../utils/logger'), 'warn', () => {});
  const user = await User.create({ username: 'workflow-test', email: 'workflow@example.invalid', password: 'test-only' });
  const other = new mongoose.Types.ObjectId();
  const diary = await Diary.create({ user: user._id, content: 'original', startTime: '2026-09-07T01:00:00Z', endTime: '2026-09-07T02:00:00Z', workPriority: '高' });
  const todo = await Todo.create({ user: user._id, content: 'follow-up action', dueDate: '2026-09-25T10:00:00Z', priority: '高', relatedDiary: diary._id });
  diary.relatedTodo = todo._id; diary.isTodo = true; await diary.save();
  const request = (body = {}, query = {}, id = diary.id) => ({ user, body, query, params: { id } });

  await t.test('save diary preserves task even with legacy false flag', async () => {
    const before = (await Todo.findById(todo._id)).toObject();
    for (const body of [{ content: 'edited' }, { content: 'edited again', isTodo: false, todoDueDate: null }]) {
      const res = response(); await diaryController.updateDiary(request(body), res); assert.equal(res.code, 200);
    }
    assert.deepEqual((await Todo.findById(todo._id)).toObject(), before);
    const after = await Diary.findById(diary._id);
    assert.equal(after.isTodo, true); assert.equal(String(after.relatedTodo), todo.id); assert.equal(after.workPriority, '高');
  });
  await t.test('invalid diary time leaves persisted data unchanged', async () => {
    const res = response(); await diaryController.updateDiary(request({ endTime: '2026-09-06T00:00:00Z' }), res);
    assert.equal(res.code, 400); assert.equal((await Diary.findById(diary._id)).endTime.toISOString(), '2026-09-07T02:00:00.000Z');
  });
  await t.test('detail read performs no Dify write', async () => {
    const spy = t.mock.method(require('../utils/dify').prototype, 'createByText', async () => { throw new Error('must not sync'); });
    const res = response(); await diaryController.getDiaryById(request(), res); assert.equal(res.code, 200); assert.equal(spy.mock.callCount(), 0); spy.mock.restore();
  });
  await t.test('edit, complete and reopen task preserves source and history', async () => {
    const before = (await Diary.findById(diary._id)).content;
    let res = response(); await todoController.updateTodo(request({ content: 'updated task', dueDate: '2026-09-28T10:00:00Z', priority: '低' }, {}, todo.id), res); assert.equal(res.code, 200);
    for (const status of ['已完成', '待办']) { res = response(); await todoController.updateTodoStatus(request({ status, summary: status }, {}, todo.id), res); assert.equal(res.code, 200); }
    const after = await Todo.findById(todo._id); assert.equal(after.statusHistory.length, 2); assert.equal(after.status, '待办');
    assert.equal(after.dueDate.toISOString(), '2026-09-28T10:00:00.000Z'); assert.equal((await Diary.findById(diary._id)).content, before);
  });
  await t.test('foreign task and diary links are rejected', async () => {
    const foreign = await Diary.create({ user: other, content: 'private', startTime: new Date(), endTime: new Date() });
    const res = response(); await todoController.createTodo(request({ content: 'bad link', dueDate: new Date(), relatedDiary: foreign.id }), res); assert.equal(res.code, 400);
    const denied = response(); await todoController.updateTodo({ user: { id: String(other) }, params: { id: todo.id }, body: { content: 'hijack' } }, denied); assert.equal(denied.code, 404);
  });
  await t.test('aggregate counts and task pagination match records', async () => {
    await Todo.insertMany(Array.from({ length: 24 }, (_, i) => ({ user: user._id, content: `task ${i}`, dueDate: new Date('2026-09-20'), status: '待办' })));
    const stats = response(); await todoController.getTodoStats(request(), stats); assert.equal(stats.data.stats.statusStats.find(x => x._id === '待办').count, 25);
    const first = response(), second = response();
    await todoController.getTodos(request({}, { status: '待办', page: 1, limit: 20 }), first);
    await todoController.getTodos(request({}, { status: '待办', page: 2, limit: 20 }), second);
    assert.equal(first.data.pagination.total, 25); assert.equal(second.data.todos.length, 5);
    assert.equal(new Set([...first.data.todos, ...second.data.todos].map(x => x.id)).size, 25);
    const literal = response(); await todoController.getTodos(request({}, { search: '.*' }), literal); assert.equal(literal.data.todos.length, 0);
  });
  await t.test('dashboard counts beyond 1000 and excludes deleted or foreign entries', async () => {
    await Diary.insertMany(Array.from({ length: 1001 }, () => ({ user: user._id, content: 'bulk', startTime: new Date(), endTime: new Date(), tags: ['test'] })));
    await Diary.create({ user: user._id, content: 'deleted', startTime: new Date(), endTime: new Date(), isDeleted: true });
    const res = response(); await getDashboard(request({}, { timezone: 'Asia/Shanghai' }), res); assert.equal(res.code, 200); assert.equal(res.data.stats.totalDiaries, 1002);
    assert.equal(res.data.tags[0].value, 1001);
  });
  await t.test('weekly summary excludes deleted inputs before contacting a model', async () => {
    const summaryUser = await User.create({ username: 'summary-test', email: 'summary@example.invalid', password: 'test-only' });
    await Diary.create({ user: summaryUser._id, content: 'deleted-only', startTime: new Date(), endTime: new Date(), isDeleted: true });
    const res = response(); await require('../controllers/summaryController').generateWeeklySummary({ user: summaryUser, body: {}, query: {} }, res);
    assert.equal(res.code, 404);
  });
  await t.test('backup dry run validates and reports counts without replacing data', async () => {
    const file = path.join(os.tmpdir(), `workflow-${randomUUID()}.json`);
    try {
      const backup = { metadata: { userId: user.id }, data: { diaries: await Diary.find({ user: user._id }).lean(), todos: await Todo.find({ user: user._id }).lean(), summaries: [] } };
      await fs.writeFile(file, JSON.stringify(backup));
      const res = response(); await restoreBackup({ user, file: { path: file }, body: { dryRun: 'true' } }, res);
      assert.equal(res.code, 200); assert.equal(res.data.counts.diaries.current, 1003); assert.equal(res.data.counts.diaries.incoming, 1003);
      assert.ok(await Diary.findById(diary._id));
      const capability = response(); await getBackupStatus({ user }, capability); assert.equal(capability.data.restoreAvailable, true);
    } finally { await fs.unlink(file); }
  });
});
