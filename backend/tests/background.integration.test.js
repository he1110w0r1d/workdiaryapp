const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Job = require('../models/BackgroundJob');
const User = require('../models/User');
const Diary = require('../models/Diary');
const Todo = require('../models/Todo');
const Summary = require('../models/Summary');
const Suggestion = require('../models/TodoSuggestion');
const Sync = require('../models/DiarySync');
const queue = require('../services/jobQueue');
const workflow = require('../services/summaryWorkflow');
const index = require('../services/indexWorkflow');
const controller = require('../controllers/workflowController');
const response = () => ({ code: 200, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } });

test('durable background workflows in an isolated Mongo database', { skip: !process.env.TEST_MONGODB_URI, timeout: 60000 }, async t => {
  const dbName = `workdiary_jobs_test_${randomUUID().replaceAll('-', '')}`;
  await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName });
  t.after(async () => { assert.equal(mongoose.connection.name, dbName); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await Promise.all([Job.init(), Suggestion.init(), Sync.init()]);
  const user = await User.create({ username: 'jobs', email: 'jobs@example.invalid', password: 'synthetic' });
  const other = new mongoose.Types.ObjectId();
  const diary = await Diary.create({ user: user._id, content: 'Finish API integration next week', startTime: '2026-09-15T02:00:00Z', endTime: '2026-09-15T03:00:00Z' });
  const old = await Summary.create({ user: user._id, type: 'daily', date: '2026-09-14T16:00:00Z', content: 'old report' });
  const model = { config: { model: 'test' }, generateText: async prompt => prompt.includes('只返回JSON数组') ? JSON.stringify([{ content: 'Review API', priority: '高', relatedDiaryIds: [diary.id, String(other)] }]) : 'new report' };
  let summaryJob;
  await t.test('simultaneous enqueue deduplicates active summary jobs', async () => {
    const jobs = await Promise.all(Array.from({ length: 5 }, () => workflow.enqueue(user._id, { type: 'daily', anchor: '2026-09-15' })));
    assert.equal(new Set(jobs.map(j => j.id)).size, 1); summaryJob = jobs[0];
  });
  await t.test('failed generation preserves old report and exposes a retry', async () => {
    await queue.runOne('summary', async () => { throw workflow.invalid('synthetic failure'); });
    assert.ok(await Summary.exists({ _id: old._id }));
    assert.equal((await Job.findById(summaryJob._id)).status, 'failed');
    assert.equal(await queue.retry(other, summaryJob._id), null);
    await queue.retry(user._id, summaryJob._id);
  });
  await t.test('successful generation preserves history and stages suggestions only', async () => {
    await queue.runOne('summary', (j, cp) => workflow.generate(j, cp, { model }));
    assert.equal(await Summary.countDocuments({ user: user._id }), 2);
    assert.equal(await Todo.countDocuments({ user: user._id }), 0);
    const suggestion = await Suggestion.findOne({ summary: summaryJob._id });
    assert.deepEqual(suggestion.sourceDiaryIds.map(String), [diary.id]);
    const res = response(); await controller.list({ user, query: {} }, res);
    assert.equal(res.data.data[0].payload, undefined);
    assert.equal(JSON.stringify(res.data).includes(diary.content), false);
  });
  await t.test('concurrent acceptance creates one Todo and rejects foreign users', async () => {
    const s = await Suggestion.findOne({ summary: summaryJob._id });
    await assert.rejects(workflow.accept(other, s._id, { dueDate: '2026-09-20' }));
    await Promise.all(Array.from({ length: 4 }, () => workflow.accept(user._id, s._id, { dueDate: '2026-09-20', content: 'Confirmed API review' })));
    assert.equal(await Todo.countDocuments({ sourceSuggestion: s._id }), 1);
    assert.equal((await Diary.findById(diary._id)).relatedTodo, null);
  });
  await t.test('editing source marks the historical report outdated', async () => {
    diary.content = 'Edited content'; await diary.save();
    const res = response(); await controller.suggestions({ user, params: { id: summaryJob.id } }, res);
    assert.equal(res.data.sourceStatus, 'changed');
    assert.equal((await Summary.findById(summaryJob._id)).content, 'new report');
  });
  await t.test('expired lease is recovered and late completion cannot overwrite owner', async () => {
    const stale = await Job.create({ user: user._id, kind: 'index', payload: { key: 'expired' }, status: 'running', leaseUntil: new Date(0), token: 'old' });
    await queue.runOne('index', async (j, cp) => { assert.equal(j.id, stale.id); await cp('resumed'); return { recovered: true }; });
    const r = await Job.updateOne({ _id: stale._id, token: 'old' }, { $set: { status: 'failed' } });
    assert.equal(r.matchedCount, 0); assert.equal((await Job.findById(stale._id)).status, 'succeeded');
  });
  await t.test('reconciliation deduplicates unchanged work and indexes replacement/deletion atomically', async () => {
    const calls = [];
    const pg = { getClient: async () => ({ query: async (sql, args) => { calls.push([sql, args]); }, release() {} }) };
    const embedder = { config: (await index.configFor(user._id)).config, embed: async () => [0.1, 0.2] };
    const job = await index.enqueue(user._id);
    await queue.runOne('index', (j, cp) => index.run(j, cp, { pg, embedder }));
    assert.equal(calls[0][0], 'BEGIN'); assert.ok(calls.some(c => c[0].startsWith('DELETE'))); assert.equal(calls.at(-1)[0], 'COMMIT');
    assert.equal((await index.enqueue(user._id)).id, job.id);
    diary.isDeleted = true; await diary.save();
    await index.enqueue(user._id); calls.length = 0;
    await queue.runOne('index', (j, cp) => index.run(j, cp, { pg, embedder }));
    assert.equal(calls.some(c => c[0].includes('INSERT')), false);
    assert.equal((await Sync.findById(diary._id)).pgVersion, 'deleted');
  });
  await t.test('index failure rolls back replacement and never records success', async () => {
    diary.isDeleted = false; await diary.save();
    await index.enqueue(user._id, 'pg', true);
    const calls = [];
    const pg = { getClient: async () => ({ query: async sql => { calls.push(sql); if (sql.includes('INSERT')) throw new Error('injected'); }, release() {} }) };
    await queue.runOne('index', (j, cp) => index.run(j, cp, { pg, embedder: { config: {}, embed: async () => [1] } }));
    assert.ok(calls.includes('ROLLBACK')); assert.equal((await Sync.findById(diary._id)).pgVersion, 'deleted');
  });
  await t.test('RAG never falls back from an empty date range or uses stale/deleted sources', async () => {
    const pg = require('../utils/pgClient');
    const stub = t.mock.method(pg, 'query', async () => { throw new Error('must not query ineligible rows'); });
    const rag = require('../controllers/ragController');
    for (const question of ['2000年1月1日的工作', '最近工作']) {
      const res = response(); await rag.query({ user, body: { question } }, res);
      assert.equal(res.code, 200); assert.deepEqual(res.data.snippets, []);
    }
    assert.equal(stub.mock.callCount(), 0); stub.mock.restore();
    await pg.pool.end();
  });
  await t.test('Dify recovers a created document after a lost response and deletes tombstones', async () => {
    await Job.deleteMany({ kind: 'index' });
    const existingId = 'test-document'; const deleted = []; let creates = 0, updates = 0;
    const dify = { baseUrl: 'test', datasetId: 'synthetic', ensureBaseAuth() {}, findDocuments: async () => [{ id: existingId, indexing_status: 'completed' }],
      createByText: async () => { creates++; return { id: 'unexpected' }; }, updateByText: async () => { updates++; }, deleteDocument: async id => { deleted.push(id); } };
    await index.enqueue(user._id, 'dify');
    await queue.runOne('index', (j, cp) => index.run(j, cp, { dify }));
    assert.equal(creates, 0); assert.equal(updates, 1);
    await index.beforeDiaryRemoval(diary); await Diary.deleteOne({ _id: diary._id });
    await index.enqueue(user._id, 'dify');
    await queue.runOne('index', (j, cp) => index.run(j, cp, { dify }));
    assert.deepEqual(deleted, [existingId]); assert.equal((await Sync.findById(diary._id)).difyVersion, 'deleted');
    assert.deepEqual((await Todo.findOne({ sourceSuggestion: { $exists: true } })).sourceDiaryIds, []);
  });
  await t.test('Dify success waits for indexing and retries do not resubmit unchanged content', async () => {
    const d = await Diary.create({ user: user._id, content: 'async indexing', startTime: new Date(), endTime: new Date() });
    let status = 'indexing', updates = 0;
    const dify = { baseUrl: 'test', datasetId: 'synthetic', ensureBaseAuth() {},
      findDocuments: async name => name.endsWith(d.id) ? [{ id: 'async-document', indexing_status: status }] : [],
      updateByText: async () => { updates++; } };
    const job = await index.enqueue(user._id, 'dify');
    await queue.runOne('index', (j, cp) => index.run(j, cp, { dify }));
    assert.equal((await Job.findById(job._id)).status, 'queued');
    assert.notEqual((await Sync.findById(d._id)).difyVersion, (await Sync.findById(d._id)).difySubmittedVersion);
    status = 'completed'; await Job.updateOne({ _id: job._id }, { $set: { runAfter: new Date(0) } });
    await queue.runOne('index', (j, cp) => index.run(j, cp, { dify }));
    assert.equal((await Job.findById(job._id)).status, 'succeeded'); assert.equal(updates, 1);
  });
  await t.test('a restore generation fence prevents stale reports and suggestion acceptance', async () => {
    await User.updateOne({ _id: user._id }, { $inc: { dataGeneration: 1 } });
    const s = await Suggestion.findOne({ summary: summaryJob._id });
    await assert.rejects(workflow.accept(user._id, s._id), /旧任务已失效/);
    const write = require('../services/workflowWrite'); let saved = false;
    await assert.rejects(write(user._id, 0, async () => { saved = true; }), /旧任务已失效/);
    assert.equal(saved, false);
  });
});
