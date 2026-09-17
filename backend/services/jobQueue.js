const { randomUUID } = require('crypto');
const Job = require('../models/BackgroundJob');
const leaseMs = 90000;

async function enqueue(user, kind, key, payload) {
  const activeKey = `${user}:${kind}:${key}`;
  try { return await Job.create({ user, kind, activeKey, payload }); }
  catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await Job.findOne({ activeKey });
    if (existing) return existing;
    return enqueue(user, kind, key, payload);
  }
}

async function runOne(kind, handler) {
  const now = new Date();
  const token = randomUUID();
  const job = await Job.findOneAndUpdate({ kind, $or: [
    { status: 'queued', runAfter: { $lte: now } },
    { status: 'running', leaseUntil: { $lt: now } }
  ] }, { $set: { status: 'running', token, leaseUntil: new Date(+now + leaseMs), stage: '开始处理' }, $inc: { attempts: 1 } },
  { new: true, sort: { createdAt: 1 } });
  if (!job) return false;
  const owner = { _id: job._id, token, status: 'running' };
  let lost = false;
  const heartbeat = setInterval(async () => {
    try {
      const r = await Job.updateOne(owner, { $set: { leaseUntil: new Date(Date.now() + leaseMs) } });
      if (!r.matchedCount) lost = true;
    } catch (_) { lost = true; }
  }, 20000);
  heartbeat.unref();
  const checkpoint = async (stage) => {
    if (lost) throw new Error('任务租约已失效');
    const r = await Job.updateOne(owner, { $set: { stage, leaseUntil: new Date(Date.now() + leaseMs) } });
    if (!r.matchedCount) { lost = true; throw new Error('任务租约已失效'); }
  };
  try {
    if (job.attempts > 3) throw new Error('任务多次中断，请手动重试');
    const result = await handler(job, checkpoint);
    await checkpoint('完成');
    await Job.updateOne(owner, { $set: { status: 'succeeded', result, error: null }, $unset: { activeKey: 1, token: 1, leaseUntil: 1, 'payload.snapshot': 1, 'payload.generatedContent': 1, 'payload.completedCalls': 1 } });
  } catch (error) {
    // Keep third-party responses, credentials and diary content out of persisted errors.
    const retry = job.attempts < (kind === 'summary' ? 2 : 3) && !error.permanent;
    await Job.updateOne(owner, { $set: {
      status: retry ? 'queued' : 'failed', stage: retry ? '处理失败，稍后重试' : '处理失败，可手动重试',
      error: error.publicMessage || '处理未完成，请检查模型或检索服务配置后重试',
      runAfter: new Date(Date.now() + job.attempts * 60000)
    }, $unset: { token: 1, leaseUntil: 1, ...(retry ? {} : { activeKey: 1 }) } });
  } finally { clearInterval(heartbeat); }
  return true;
}

async function retry(user, id) {
  const job = await Job.findOne({ _id: id, user, status: 'failed' });
  if (!job) return null;
  // Reuse the job id: reports and candidate acceptance use deterministic ids.
  const activeKey = `${user}:${job.kind}:${job.payload.key}`;
  return Job.findOneAndUpdate({ _id: id, user, status: 'failed' }, {
    $set: { activeKey, status: 'queued', attempts: 0, runAfter: new Date(), error: null, stage: '等待重试' }
  }, { new: true });
}

function startWorker(kind, handler) {
  let stopped = false;
  let timer;
  async function tick() {
    try { await runOne(kind, handler); } catch (e) { console.error(`后台 ${kind} 任务暂不可用`); }
    if (!stopped) { timer = setTimeout(tick, 2000); timer.unref(); }
  }
  tick();
  return () => { stopped = true; clearTimeout(timer); };
}
module.exports = { enqueue, retry, runOne, startWorker };
