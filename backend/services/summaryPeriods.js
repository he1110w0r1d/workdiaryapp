const DAY = 86400000;
const label = date => new Date(+date + 8 * 3600000).toISOString().slice(0, 10);
function period(type, anchor = label(new Date()), previous = false) {
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(type) || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) throw new Error('总结类型或日期无效');
  const d = new Date(`${anchor}T00:00:00+08:00`);
  if (!Number.isFinite(+d) || label(d) !== anchor || +anchor.slice(0, 4) < 1970) throw new Error('日期无效');
  let start = d, end;
  if (type === 'daily') { if (previous) start = new Date(+d - DAY); end = new Date(+start + DAY); }
  if (type === 'weekly') {
    const weekday = new Date(+d + 8 * 3600000).getUTCDay();
    start = new Date(+d - ((weekday + 6) % 7 + (previous ? 7 : 0)) * DAY); end = new Date(+start + 7 * DAY);
  }
  if (type === 'monthly' || type === 'yearly') {
    const y = +anchor.slice(0, 4), m = +anchor.slice(5, 7) - 1;
    const offset = 8 * 3600000;
    start = new Date(Date.UTC(y - (type === 'yearly' && previous ? 1 : 0), type === 'yearly' ? 0 : m - (previous ? 1 : 0), 1) - offset);
    end = new Date(Date.UTC(y + (type === 'yearly' && !previous ? 1 : 0), type === 'yearly' ? 0 : m + (previous ? 0 : 1), 1) - offset);
  }
  return { type, start: start.toISOString(), end: end.toISOString(), rangeLabel: `${label(start)} 至 ${label(new Date(+end - DAY))}`, timezone: 'Asia/Shanghai' };
}
module.exports = { period, label };
