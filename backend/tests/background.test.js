const { test } = require('node:test');
const assert = require('node:assert/strict');
const { period } = require('../services/summaryPeriods');
test('Shanghai periods handle week/year boundaries and leap months', () => {
  assert.equal(period('weekly', '2026-01-01').start, '2025-12-28T16:00:00.000Z');
  assert.equal(period('monthly', '2024-03-01', true).rangeLabel, '2024-02-01 至 2024-02-29');
  assert.equal(period('yearly', '2026-09-16', true).rangeLabel, '2025-01-01 至 2025-12-31');
  assert.equal(period('daily', '2026-01-01', true).rangeLabel, '2025-12-31 至 2025-12-31');
  assert.throws(() => period('daily', '2026-02-30'));
});
test('configured embedding failures cannot silently change vector models', async t => {
  const Embeddings = require('../utils/embeddings');
  const external = new Embeddings({ strict: true, apiKey: 'synthetic', provider: 'openai' });
  t.mock.method(external.client, 'post', async () => { throw new Error('offline'); });
  await assert.rejects(external.embed('test'), /offline/);
  const local = new Embeddings({ strict: true, apiKey: '' });
  assert.equal((await local.embed('test')).length, 256);
});
test('malformed suggestions in backups are rejected instead of treated as an empty collection', async () => {
  const { prepareBackup } = require('../services/backupRestore');
  const userId = '111111111111111111111111';
  for (const suggestions of [false, null, {}]) await assert.rejects(prepareBackup({ metadata: { userId }, data: { diaries: [], todos: [], summaries: [], suggestions } }, userId), /suggestions/);
});
