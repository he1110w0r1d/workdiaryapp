const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const Diary = require('../models/Diary');
const Todo = require('../models/Todo');
const Summary = require('../models/Summary');
const User = require('../models/User');
const { restoreBackupData } = require('../services/backupRestore');

// Only an explicitly supplied TEST_MONGODB_URI is used; production .env is never loaded.
test('real replica set: failed restore rolls back records/settings; success preserves relations', {
  skip: !process.env.TEST_MONGODB_URI && 'Set TEST_MONGODB_URI to an isolated test replica set',
  timeout: 60000
}, async t => {
  const dbName = `workdiary_restore_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  const uid = new mongoose.Types.ObjectId();
  t.after(async () => {
    assert.equal(mongoose.connection.name, dbName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    const dir = path.join(__dirname, '../backup');
    const files = await fs.readdir(dir).catch(() => []);
    for (const file of files) if (file.startsWith(`backup-${uid}-pre-restore-`)) await fs.unlink(path.join(dir, file));
  });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.ok(hello.setName || hello.msg === 'isdbgrid', 'TEST_MONGODB_URI must support transactions');
  await Promise.all([Diary.init(), Todo.init(), Summary.init(), User.init()]);
  await User.create({ _id: uid, username: 'restore-test', email: 'restore@example.test', password: 'test-only', nickname: 'original' });
  const other = new mongoose.Types.ObjectId();
  await Diary.create({ user: other, content: 'other user', startTime: new Date(), endTime: new Date() });
  const diary = await Diary.create({ user: uid, content: 'original diary', startTime: new Date(), endTime: new Date() });
  const todo = await Todo.create({ user: uid, content: 'original todo', dueDate: new Date(), relatedDiary: diary._id });
  diary.relatedTodo = todo._id; await diary.save();
  await Summary.create({ user: uid, content: 'original summary', date: new Date(), type: 'weekly' });
  const read = async () => JSON.parse(JSON.stringify({
    diaries: await Diary.find({ user: uid }).lean(), todos: await Todo.find({ user: uid }).lean(), summaries: await Summary.find({ user: uid }).lean()
  }));
  const original = await read();
  const backup = { metadata: { userId: String(uid) }, data: { ...structuredClone(original), user: { profile: { nickname: 'restored' } } } };
  const invalid = structuredClone(backup); invalid.data.todos[0].dueDate = 'bad';
  await assert.rejects(restoreBackupData(invalid, String(uid)));
  assert.deepEqual(await read(), original);

  const fault = t.mock.method(Todo, 'insertMany', async () => { throw new Error('injected insert failure'); });
  await assert.rejects(restoreBackupData(backup, String(uid)), /injected insert failure/);
  fault.mock.restore();
  assert.deepEqual(await read(), original);
  assert.equal((await User.findById(uid)).nickname, 'original');

  const result = await restoreBackupData(backup, String(uid));
  const restored = await read();
  assert.equal(restored.diaries[0].relatedTodo, restored.todos[0]._id);
  assert.equal(restored.todos[0].relatedDiary, restored.diaries[0]._id);
  assert.notEqual(restored.diaries[0]._id, original.diaries[0]._id);
  assert.equal((await User.findById(uid)).nickname, 'restored');
  assert.equal(await Diary.countDocuments({ user: other }), 1);
  const snapshot = JSON.parse(await fs.readFile(path.join(__dirname, '../backup', result.snapshotFileName), 'utf8'));
  assert.deepEqual(snapshot.data.diaries, original.diaries);

  const Suggestion = require('../models/TodoSuggestion');
  const summary = await Summary.findOne({ user: uid });
  const currentDiary = await Diary.findOne({ user: uid });
  const candidate = await Suggestion.create({ user: uid, summary: summary._id, ordinal: 0, content: 'pending action', priority: '中', sourceDiaryIds: [currentDiary._id], dataGeneration: 1 });
  const pendingJob = await require('../services/summaryWorkflow').enqueue(uid, { type: 'daily', anchor: require('../services/summaryPeriods').label(currentDiary.startTime) });
  const packageWithSuggestions = JSON.parse(JSON.stringify({ metadata: { userId: String(uid) }, data: { ...(await read()), suggestions: await Suggestion.find({ user: uid }).lean() } }));
  await restoreBackupData(packageWithSuggestions, String(uid));
  const restoredCandidate = await Suggestion.findOne({ user: uid });
  assert.notEqual(restoredCandidate.id, candidate.id);
  assert.equal(restoredCandidate.dataGeneration, 2);
  assert.ok(await Summary.exists({ _id: restoredCandidate.summary, user: uid }));
  assert.ok(await Diary.exists({ _id: restoredCandidate.sourceDiaryIds[0], user: uid }));
  const created = await require('../services/summaryWorkflow').accept(uid, restoredCandidate._id, { dueDate: '2026-10-01' });
  assert.equal(created.content, 'pending action');
  assert.equal(String(created.sourceDiaryIds[0]), String(restoredCandidate.sourceDiaryIds[0]));
  await assert.rejects(require('../services/workflowWrite')(uid, pendingJob.payload.dataGeneration, async () => {}), /旧任务已失效/);
});
