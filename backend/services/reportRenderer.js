const MarkdownIt = require('markdown-it');
const crypto = require('crypto');
const VERSION = 'reading-report-v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function renderKey(summary) {
  return crypto.createHash('sha256').update(JSON.stringify([VERSION, summary.content, summary.type, summary.date, summary.meta?.rangeLabel, summary.meta?.sourceSnapshots])).digest('hex');
}
function renderReport(summary) {
  const md = new MarkdownIt({ html: false, breaks: true, linkify: false });
  // Reports must be self-contained; external images could disclose readership.
  md.renderer.rules.image = (tokens, idx) => escape(tokens[idx].content);
  const toc = []; let heading = 0;
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const id = `section-${++heading}`;
    tokens[idx].attrSet('id', id);
    if (['h1', 'h2'].includes(tokens[idx].tag)) toc.push({ id, text: tokens[idx + 1]?.content || '' });
    return self.renderToken(tokens, idx, options);
  };
  const body = md.render(String(summary.content || ''));
  const type = ({ weekly: '每周工作简报', monthly: '月度工作复盘', daily: '每日工作小结', yearly: '年度工作回顾' })[summary.type] || '工作总结';
  const range = summary.meta?.rangeLabel || new Date(summary.date).toISOString().slice(0, 10);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(range)} · ${type}</title><style>
  :root{color-scheme:light;--ink:#24352f;--muted:#727c74;--line:#e0e5de;--accent:#355d4f}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:30px}body{margin:0;background:#f3f4ef;color:var(--ink);font:16px/1.85 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}a{color:var(--accent);text-underline-offset:4px} .layout{max-width:1160px;margin:56px auto;padding:0 28px;display:grid;grid-template-columns:180px minmax(0,1fr);gap:42px}aside{align-self:start;position:sticky;top:36px;font-size:13px}aside strong{font-weight:500;letter-spacing:2px;color:var(--muted)}nav a{display:block;padding:9px 0;text-decoration:none;line-height:1.5}article{min-width:0;background:#fff;border:1px solid var(--line);border-radius:12px;padding:48px 56px;box-shadow:0 8px 36px #263b3010}.eyebrow{font-size:11px;letter-spacing:3px;color:var(--accent)}header{border-bottom:1px solid var(--line);padding-bottom:30px;margin-bottom:30px}header h1{font-size:32px;line-height:1.4;margin:12px 0;letter-spacing:-1px}.range{color:var(--muted);font-size:14px}.content h1,.content h2{font-size:21px;line-height:1.5;margin:40px 0 18px;padding-top:10px;border-top:1px solid var(--line)}.content>:first-child{margin-top:0;border-top:0}.content h3{font-size:17px;margin:28px 0 10px;color:var(--accent)}p{margin:12px 0}ul,ol{padding-left:24px}li{padding-left:3px;margin:8px 0}strong{font-weight:650}blockquote{margin:22px 0;padding:10px 20px;background:#f1f5f0;border-left:3px solid #527662;color:#3f584c}table{display:block;overflow:auto;width:100%;border-collapse:collapse;font-size:14px}th,td{border:1px solid var(--line);padding:10px 14px;text-align:left}th{background:#f3f5f0}pre{overflow:auto;padding:18px;background:#f4f5f1;border-radius:6px}code{font-size:.9em;overflow-wrap:anywhere}.content{overflow-wrap:anywhere}footer{margin-top:42px;padding-top:20px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}footer p{margin:4px 0}details{margin-top:18px}summary{cursor:pointer;color:var(--accent)}.source{white-space:pre-wrap;border-top:1px solid var(--line);padding:12px 0;font-size:13px}.source time{display:block;font-weight:600} @media(max-width:800px){.layout{display:block;margin:20px auto;padding:0 12px}aside{position:static;margin:0 12px 20px}nav{display:flex;gap:8px 18px;flex-wrap:wrap}nav a{padding:3px 0}article{padding:28px 22px}header h1{font-size:27px}.content h2{font-size:20px}}@media print{body{background:white;font-size:11pt}.layout{display:block;margin:0;padding:0}aside{display:none}article{border:0;box-shadow:none;padding:0}h2,h3{break-after:avoid}p,li{orphans:3;widows:3}a{color:inherit;text-decoration:none}details{display:none}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  </style></head><body><div class="layout"><aside><strong>阅读目录</strong><nav>${toc.map(x => `<a href="#${x.id}">${escape(x.text)}</a>`).join('')}</nav></aside><article><header><div class="eyebrow">WORK DIARY / ${summary.type === 'monthly' ? 'MONTHLY' : 'REPORT'}</div><h1>${type}</h1><div class="range">${escape(range)} · 北京时间</div></header><main class="content">${body}</main><footer><p>基于该版本保存的工作记录整理，请结合原始记录核对。</p><p>可使用浏览器打印功能保存为 PDF。</p>${Array.isArray(summary.meta?.sourceSnapshots) ? `<details><summary>查看生成时的来源摘录（${summary.meta.sourceSnapshots.length} 条）</summary>${summary.meta.sourceSnapshots.map(s => `<div class="source"><time>${escape(s.date)}</time>${escape(s.excerpt)}</div>`).join('')}</details>` : ''}</footer></article></div></body></html>`;
}
module.exports = { renderReport, renderKey };
