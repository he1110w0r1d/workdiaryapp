const { period, label } = require('./summaryPeriods');
const DAY = 86400000;
module.exports = function questionPeriod(question, now = new Date()) {
  const today = label(now);
  const shift = n => label(new Date(new Date(`${today}T00:00:00+08:00`).getTime() + n * DAY));
  let type = 'daily', anchor = today, previous = false, name;
  if (question.includes('前天')) { anchor = shift(-2); name = '前天'; }
  else if (question.includes('昨天')) { anchor = shift(-1); name = '昨天'; }
  else if (question.includes('今天')) name = '今天';
  else if (question.includes('上周')) { type = 'weekly'; previous = true; name = '上周'; }
  else if (/本周|这周/.test(question)) { type = 'weekly'; name = '本周'; }
  else if (/上个月|上月/.test(question)) { type = 'monthly'; previous = true; name = '上月'; }
  else if (/本月|这个月/.test(question)) { type = 'monthly'; name = '本月'; }
  else {
    const match = question.match(/(?:(\d{4})\s*[年/\-]\s*)?(\d{1,2})\s*[月/\-]\s*(\d{1,2})(?:日|号)?/);
    if (!match) return null;
    anchor = `${match[1] || today.slice(0, 4)}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    name = anchor;
  }
  try {
    const p = period(type, anchor, previous);
    return { label: name, start: new Date(p.start), end: new Date(p.end) };
  } catch (_) {
    throw Object.assign(new Error('Invalid question date'), { publicMessage: '问题中的日期无效，请使用真实日期，例如2026-09-17。' });
  }
};
