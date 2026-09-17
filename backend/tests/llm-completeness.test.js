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
  assert.deepEqual(calls.map(c => c.max_tokens), [4000, 4000]);
});

test('configured reasoning budget and long complete input are preserved', async t => {
  const llm = model();
  const prompt = 'x'.repeat(24000);
  t.mock.method(llm.client, 'post', async (_, body) => {
    assert.equal(body.max_tokens, 32000);
    assert.equal(body.messages[0].content, prompt);
    return response('stop', 'complete');
  });
  assert.equal(await llm.generateText(prompt, { maxTokens: 32000, requireComplete: true }), 'complete');
});

test('token cap and Anthropic max_tokens stop cannot bypass completeness checks', async t => {
  const previousCap = process.env.EXTERNAL_LLM_MAX_OUTPUT_TOKENS_CAP;
  process.env.EXTERNAL_LLM_MAX_OUTPUT_TOKENS_CAP = '32768';
  t.after(() => { if (previousCap === undefined) delete process.env.EXTERNAL_LLM_MAX_OUTPUT_TOKENS_CAP; else process.env.EXTERNAL_LLM_MAX_OUTPUT_TOKENS_CAP = previousCap; });
  const llm = model(); let calls = 0;
  t.mock.method(llm.client, 'post', async () => { calls++; return { data: { stop_reason: 'max_tokens', content: [{ type: 'text', text: 'partial' }] } }; });
  await assert.rejects(llm.generateText('report', { maxTokens: 32768, requireComplete: true }), { code: 'LLM_OUTPUT_TRUNCATED' });
  assert.equal(calls, 1);
});


test('large output budgets and long ordinary input reach provider unchanged', async t => {
  const llm = model(); const prompt = '资料'.repeat(30000);
  for (const provider of ['deepseek', 'openai', 'claude', 'custom']) assert.equal(llm._getSafeMaxTokens(provider, 131072), 131072);
  let calls = 0;
  t.mock.method(llm.client, 'post', async (_, body) => {
    assert.equal(body.max_tokens, 131072); assert.equal(body.messages[0].content, prompt);
    if (++calls === 1) { const error = new Error('timeout'); error.code = 'ECONNABORTED'; throw error; }
    return response('stop', 'complete');
  });
  assert.equal(await llm.generateText(prompt, { maxTokens: 131072 }), 'complete');
  assert.equal(calls, 2);
});
