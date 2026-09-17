const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const controller = require('../controllers/settingsController');
const settings = { llmType: 'external', externalProvider: 'deepseek', externalApiKey: 'synthetic', externalModel: 'deepseek-flash' };
const response = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
for (const upstreamStatus of [401, 403, 429]) {
  test(`provider ${upstreamStatus} cannot masquerade as application login failure`, async t => {
    t.mock.method(axios, 'post', async () => { const error = new Error('synthetic upstream failure'); error.response = { status: upstreamStatus, data: { error: { message: 'synthetic' } } }; throw error; });
    const res = response();
    await controller.testLLMConnection({ body: settings }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.success, false);
    assert.equal(res.body.upstreamStatus, upstreamStatus);
    if (upstreamStatus !== 429) { assert.equal(res.body.code, 'MODEL_AUTH_FAILED'); assert.match(res.body.message, /网站登录仍然有效/); }
  });
}
test('missing model key remains a local validation error', async () => {
  const res = response();
  await controller.testLLMConnection({ body: { ...settings, externalApiKey: '' } }, res);
  assert.equal(res.statusCode, 400);
});
