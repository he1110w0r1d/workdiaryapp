const { test } = require('node:test');
const assert = require('node:assert/strict');
const questionPeriod = require('../services/questionPeriod');
const Diary = require('../models/Diary');
const workflow = require('../services/summaryWorkflow');
const index = require('../services/indexWorkflow');
const { query } = require('../controllers/ragController');

test('questions use Shanghai midnight and exclusive ends regardless of host timezone', () => {
  const now = new Date('2026-09-13T17:00:00Z'); // Monday in Shanghai, Sunday in UTC
  const week = questionPeriod('上周的主要工作是什么？', now);
  assert.equal(week.start.toISOString(), '2026-09-06T16:00:00.000Z');
  assert.equal(week.end.toISOString(), '2026-09-13T16:00:00.000Z');
  assert.equal(questionPeriod('昨天', now).start.toISOString(), '2026-09-12T16:00:00.000Z');
  assert.throws(() => questionPeriod('2026-02-30工作', now));
  assert.equal(questionPeriod('项目进展', now), null);
});

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
test('date query bypasses unavailable vectors and includes every diary beyond topK', async t => {
  const diaries = Array.from({ length: 12 }, (_, i) => ({ _id: String(i), content: `事实${i}`, startTime: new Date(), endTime: new Date() }));
  t.mock.method(Diary, 'find', filter => {
    assert.equal(filter.user, 'owner'); assert.equal(filter.isDeleted, false);
    assert.ok(filter.startTime.$gte && filter.startTime.$lt);
    return { sort: () => ({ lean: async () => diaries }) };
  });
  t.mock.method(index, 'configFor', () => { throw new Error('must not call vector provider'); });
  t.mock.method(workflow, 'modelFor', async () => ({ config: { maxTokens: 32000 }, generateText: async (prompt, options) => {
    assert.ok(prompt.includes('事实11')); assert.equal(options.maxTokens, 32000); assert.equal(options.requireComplete, true); return '完整答案';
  } }));
  const res = response(); await query({ user: { id: 'owner' }, body: { question: '上周工作', topK: 1 } }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.answer, '完整答案'); assert.equal(res.body.snippets.length, 12);
});

test('model failure is an actionable failure, never a successful placeholder', async t => {
  t.mock.method(Diary, 'find', () => ({ sort: () => ({ lean: async () => [{ _id: '1', content: 'work' }] }) }));
  t.mock.method(workflow, 'modelFor', async () => ({ config: {}, generateText: async () => { throw new Error('timeout of 60000ms exceeded'); } }));
  const res = response(); await query({ user: { id: 'owner' }, body: { question: '昨天' } }, res);
  assert.equal(res.statusCode, 504); assert.equal(res.body.success, false); assert.match(res.body.message, /超时/);
});
