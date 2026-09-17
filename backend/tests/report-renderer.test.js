const test = require('node:test');
const assert = require('node:assert/strict');
const { renderReport, renderKey } = require('../services/reportRenderer');
const { diaryChunks } = require('../services/reportEditorial');
const report = { type: 'weekly', date: '2026-09-14', content: '## 本周结论\n\n- **已交付**接口\n\n|事项|结果|\n|---|---|\n|联调|通过|', meta: { rangeLabel: '2026-09-14 至 2026-09-20' } };
test('saved Markdown renders headings, lists and tables without changing the report', () => {
  const original = JSON.stringify(report);
  const html = renderReport(report);
  assert.match(html, /<h2 id="section-1">本周结论/);
  assert.match(html, /<strong>已交付<\/strong>/);
  assert.match(html, /<table>/);
  assert.match(html, /href="#section-1"/);
  assert.equal(JSON.stringify(report), original);
  assert.notEqual(renderKey(report), renderKey({ ...report, content: 'changed' }));
});
test('untrusted report markup and source excerpts cannot execute or load images', () => {
  const html = renderReport({ ...report, content: '<script>alert(1)</script>\n![pixel](https://example.com/pixel)\n[x](javascript:alert(1))', meta: { sourceSnapshots: [{ date: '<img>', excerpt: '<script>source</script>' }] } });
  assert.doesNotMatch(html, /<script|<img|href="javascript:/);
  assert.match(html, /&lt;script&gt;source/);
});
test('large input chunks retain every character, source identity and record boundaries', () => {
  const diary = { _id: 'source-a', content: '前文\\"\n'.repeat(12000) + '末尾事实', startTime: '2026-09-14' };
  const chunks = diaryChunks([diary, { _id: 'source-b', content: '另一事项' }]);
  assert.ok(chunks.every(c => c.length <= 9000));
  const rows = chunks.flatMap(c => c.trim().split('\n').map(JSON.parse));
  assert.equal(rows.filter(r => r.id === 'source-a').map(r => r.content).join(''), diary.content);
  assert.equal(rows.at(-1).id, 'source-b');
});
