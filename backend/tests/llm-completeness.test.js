const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExternalLLM = require('../utils/externalLLM');
const model = () => new ExternalLLM({ provider: 'zhipu', enabled: true, apiKey: 'synthetic', model: 'glm-4.7' });
const response = (reason, content) => ({ data: { choices: [{ finish_reason: reason, message: { content } }] } });

test('truncated reports retry with a larger budget and preserve the entire prompt', async t => {
  const llm = model(); const calls = [];
  t.mock.method(llm.client, 'post', async (_, body) => {
    calls.push(JSON.parse(JSON.stringify(body)));
    return calls.length === 1 ? response('length', 'unfinished') : response('stop', 'complete');
  });
  const prompt = 'x'.repeat(15000);
  assert.equal(await llm.generateText(prompt, { maxTokens: 4000, requireComplete: true }), 'complete');
  assert.deepEqual(calls.map(c => c.max_tokens), [4000, 8000]);
  assert.ok(calls.every(c => c.messages[0].content === prompt));
});

test('persistent truncation fails explicitly instead of saving partial content', async t => {
  const llm = model(); let calls = 0;
  t.mock.method(llm.client, 'post', async () => { calls++; return response('length', 'unfinished'); });
  await assert.rejects(llm.generateText('report', { maxTokens: 4000, requireComplete: true }),
    e => e.code === 'LLM_OUTPUT_TRUNCATED' && e.permanent && !!e.publicMessage);
  assert.equal(calls, 2);
});

test('transient retries do not truncate complete-report input', async t => {
  const llm = model(); const calls = [];
  t.mock.method(llm.client, 'post', async (_, body) => {
    calls.push(JSON.parse(JSON.stringify(body)));
    if (calls.length === 1) throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' });
    return response('stop', 'complete');
  });
  const prompt = 'x'.repeat(15000);
  await llm.generateText(prompt, { maxTokens: 4000, requireComplete: true });
  assert.ok(calls.every(c => c.messages[0].content === prompt));
});

test('token cap and Anthropic max_tokens stop cannot bypass completeness checks', async t => {
  const llm = model(); let calls = 0;
  t.mock.method(llm.client, 'post', async () => { calls++; return { data: { stop_reason: 'max_tokens', content: [{ type: 'text', text: 'partial' }] } }; });
  await assert.rejects(llm.generateText('report', { maxTokens: 32768, requireComplete: true }), { code: 'LLM_OUTPUT_TRUNCATED' });
  assert.equal(calls, 1);
});
