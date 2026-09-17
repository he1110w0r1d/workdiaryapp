const Diary = require('../models/Diary');
const Summary = require('../models/Summary');
const User = require('../models/User');
const Job = require('../models/BackgroundJob');
const Suggestion = require('../models/TodoSuggestion');
const Todo = require('../models/Todo');
const queue = require('./jobQueue');
const sourceVersion = require('./sourceVersion');
const { reportInstructions, diaryChunks } = require('./reportEditorial');
const { period, label } = require('./summaryPeriods');

function invalid(message) { const e = new Error(message); e.publicMessage = message; e.permanent = true; return e; }
const sources = (user, p) => Diary.find({ user, isDeleted: false, startTime: { $gte: new Date(p.start), $lt: new Date(p.end) } }).sort({ startTime: 1, _id: 1 }).lean();

async function preview(user, input) {
  const p = period(input.type, input.anchor, input.previous === true);
  const diaries = await sources(user, p);
  return { ...p, count: diaries.length, totalMinutes: diaries.reduce((n, d) => n + Math.max(0, Math.floor((new Date(d.endTime) - new Date(d.startTime)) / 60000)), 0) };
}
async function enqueue(user, input, automatic = false) {
  const p = await preview(user, input);
  if (!p.count) throw invalid('该统计周期没有未删除的日记');
  const key = `${p.type}:${p.start}:${automatic ? 'auto' : 'manual'}`;
  if (automatic) {
    const exists = await Summary.exists({ user, type: p.type, date: new Date(p.start) });
    if (exists) return null;
    // A failed automatic task stays visible; do not retry it forever on every restart.
    const previous = await Job.findOne({ user, kind: 'summary', 'payload.key': key });
    if (previous) return previous;
  }
  const owner = await User.findById(user).select('dataGeneration').lean();
  return queue.enqueue(user, 'summary', key, { ...p, key, dataGeneration: owner?.dataGeneration || 0, generatedBy: automatic ? 'auto' : 'manual' });
}

async function modelFor(user) {
  const config = await require('../controllers/settingsController').getUserDefaultLLMConfig(user);
  const Local = require('../utils/localLLM');
  const External = require('../utils/externalLLM');
  const model = config ? (config.provider === 'local' ? new Local({ ...config, enabled: true }) : new External({ ...config, enabled: true }))
    : process.env.LLM_TYPE === 'external' ? new External() : new Local();
  if (!model.config.enabled) throw invalid('请先在设置中启用并配置总结模型');
  return model;
}

async function generate(job, checkpoint, dependencies = {}) {
  const existing = await Summary.findOne({ _id: job._id, user: job.user });
  if (existing) return { summaryId: String(existing._id) };
  const p = job.payload;
  await checkpoint('读取统计周期内的日记');
  const diaries = p.snapshot || await sources(job.user, p);
  if (!diaries.length) throw invalid('该统计周期没有未删除的日记');
  // Persist the exact input for restart/retry. The API never exposes this snapshot.
  if (!p.snapshot) {
    const saved = await Job.updateOne({ _id: job._id, token: job.token }, { $set: { 'payload.snapshot': diaries } });
    if (!saved.matchedCount) throw new Error('任务租约已失效');
  }
  const user = await User.findById(job.user).select('customPrompts nickname username workProfile').lean();
  const model = dependencies.model || await modelFor(job.user);
  const ask = async (prompt) => {
    const text = await model.generateText(prompt, { maxTokens: Number(model.config?.maxTokens) || 16000, requireComplete: true });
    if (typeof text !== 'string' || !text.trim()) throw new Error('模型没有返回内容');
    return text.trim();
  };
  const editorial = ['weekly', 'monthly'].includes(p.type);
  let chunks = diaryChunks(diaries);
  let material = chunks.join('\n');
  // Every source is processed; chunks preserve diary boundaries and identity.
  for (let level = 0; material.length > 12000; level++) {
    if (level > 5) throw invalid('模型未能压缩长周期资料，请缩短统计周期后重试');
    const parts = [];
    for (const chunk of chunks) {
      await checkpoint(`整理长周期资料（第 ${level + 1} 轮，第 ${parts.length + 1} 段）`);
      parts.push(await ask(`按项目或主题归并以下工作记录，保留每项的实际进展、已确认结果、阻碍、明确后续事项、日期及来源ID；区分未记录结果与已完成，不新增事实，不评分。输出不超过1500字。\n${chunk}`));
    }
    material = parts.join('\n');
    chunks = [];
    let chunk = '';
    for (const part of parts) {
      if (part.length > 10000) throw invalid('模型未能压缩资料，请重试');
      if (chunk && chunk.length + part.length > 10000) { chunks.push(chunk); chunk = ''; }
      chunk += part + '\n';
    }
    if (chunk) chunks.push(chunk);
  }
  await checkpoint('生成总结正文');
  const template = user?.customPrompts?.[p.type] || (editorial ? '' : (model._getPromptTemplate ? await model._getPromptTemplate(p.type, job.user) : '按成果、问题和后续行动整理工作总结。'));
  const todoFilter = { user: job.user, isDeleted: false };
  const inPeriod = { $gte: new Date(p.start), $lt: new Date(p.end) };
  const [created, completed, pending, allPending] = await Promise.all([
    Todo.countDocuments({ ...todoFilter, createdAt: inPeriod }),
    Todo.countDocuments({ ...todoFilter, statusHistory: { $elemMatch: { status: '已完成', changedAt: inPeriod } } }),
    Todo.countDocuments({ ...todoFilter, createdAt: inPeriod, status: '待办' }),
    Todo.countDocuments({ ...todoFilter, status: '待办' })
  ]);
  const values = { date: p.rangeLabel, year: p.rangeLabel.slice(0, 4), month: p.rangeLabel.slice(5, 7), totalEntries: diaries.length,
    workDetails: '见下方工作资料', totalTime: diaries.reduce((n, d) => n + Math.max(0, Math.floor((new Date(d.endTime) - new Date(d.startTime)) / 60000)), 0),
    userName: user?.nickname || user?.username, userPosition: user?.workProfile?.position, userDepartment: user?.workProfile?.department,
    userLevel: user?.workProfile?.level, userIndustry: user?.workProfile?.industry, userResponsibilities: user?.workProfile?.responsibilities?.join('、'),
    todayTodosCreated: created, todayTodosCompleted: completed, todayTodosPending: pending, totalPendingTodos: allPending,
    weeklyTodosCreated: created, weeklyTodosCompleted: completed, weeklyTodosPending: pending,
    monthlyTodosCreated: created, monthlyTodosCompleted: completed, monthlyTodosPending: pending,
    score: '根据资料评估', suggestion: '根据资料提出' };
  const custom = template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '未提供');
  const content = p.generatedContent || await ask(`${editorial ? reportInstructions(p.type) : ''}\n统计周期：${p.rangeLabel}（北京时间），类型：${p.type}。\n仅依据下列资料，总结中区分已完成工作与建议，不能把建议写成已完成事实。待办新增和完成次数按所选周期统计，待完成数量反映生成时状态，不代表历史期末状态。个人格式要求：\n${custom}\n\n工作资料：\n${material}`);
  if (!p.generatedContent) {
    const saved = await Job.updateOne({ _id: job._id, token: job.token }, { $set: { 'payload.generatedContent': content } });
    if (!saved.matchedCount) throw new Error('任务租约已失效');
  }
  await checkpoint('提取待确认建议');
  const raw = await ask(`从工作资料中提取明确建议执行的未来事项，最多10条，不确定则返回空数组。只返回JSON数组，每条字段content、priority（高/中/低）、relatedDiaryIds（仅使用资料中的ID），不要生成截止日期。\n资料：\n${material}`);
  let items;
  try { items = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch (_) { throw invalid('模型的待办建议格式无效，请重试；已有报告不会被删除'); }
  if (!Array.isArray(items) || items.length > 10 || items.some(x => !x || typeof x.content !== 'string' || !x.content.trim() || x.content.length > 2000 || !['高', '中', '低'].includes(x.priority))) throw invalid('模型的待办建议字段无效，请重试');
  const allowed = new Set(diaries.map(d => String(d._id)));
  await checkpoint('保存新版本和建议');
  await require('./workflowWrite')(job.user, p.dataGeneration, async session => {
    await checkpoint('保存新版本');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await Suggestion.updateOne({ summary: job._id, ordinal: i }, { $setOnInsert: {
        user: job.user, dataGeneration: p.dataGeneration || 0, content: item.content.trim(), priority: item.priority,
        sourceDiaryIds: [...new Set((Array.isArray(item.relatedDiaryIds) ? item.relatedDiaryIds : []).filter(id => allowed.has(id)))]
      } }, { upsert: true, runValidators: true, session });
    }
    // Only pending candidates can be removed after a crashed attempt produced a different result.
    await Suggestion.deleteMany({ summary: job._id, ordinal: { $gte: items.length }, status: 'pending' }, { session });
    await checkpoint('保存总结');
    const tagDistribution = {};
    for (const d of diaries) for (const tag of d.tags || []) tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
    await Summary.updateOne({ _id: job._id }, { $setOnInsert: {
      user: job.user, type: p.type, date: new Date(p.start), content,
      statistics: { totalEntries: diaries.length, totalTime: diaries.reduce((n, d) => n + Math.max(0, Math.floor((new Date(d.endTime) - new Date(d.startTime)) / 60000)), 0), tagDistribution },
      meta: { rangeStart: p.start, rangeEnd: p.end, rangeLabel: p.rangeLabel, timezone: p.timezone,
        generatedBy: p.generatedBy, jobId: String(job._id), model: model.config?.model,
        ...(editorial ? { editorialVersion: 1, sourceSnapshots: diaries.map(d => ({ id: String(d._id), date: new Date(d.startTime).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }), excerpt: String(d.content || '').slice(0, 400) + (String(d.content || '').length > 400 ? '…（摘录）' : '') })) } : {}),
        sources: diaries.map(d => ({ id: String(d._id), version: sourceVersion(d) })) }
    } }, { upsert: true, runValidators: true, session });
  });
  return { summaryId: String(job._id), suggestions: items.length };
}

async function accept(user, id, values = {}) {
  let candidate = await Suggestion.findOne({ _id: id, user });
  if (!candidate || candidate.status === 'dismissed') throw invalid('建议不存在或已忽略');
  if (!await Summary.exists({ _id: candidate.summary, user })) throw invalid('原总结已不存在');
  return require('./workflowWrite')(user, candidate.dataGeneration, async session => {
    candidate = await Suggestion.findOne({ _id: id, user }).session(session);
    if (!candidate || candidate.status === 'dismissed') throw invalid('建议不存在或已忽略');
    if (candidate.status === 'pending') {
      const content = String(values.content || candidate.content).trim();
      const priority = values.priority || candidate.priority;
      const dueDate = new Date(values.dueDate);
      if (!content || content.length > 2000 || !['高', '中', '低'].includes(priority) || !Number.isFinite(+dueDate)) throw invalid('请填写内容、优先级和有效的截止日期');
      const live = await Diary.find({ _id: { $in: candidate.sourceDiaryIds }, user, isDeleted: false }).select('_id').session(session).lean();
      const decision = { content, priority, dueDate, sourceDiaryIds: live.map(d => d._id), relatedDiary: live[0]?._id || null };
      candidate = await Suggestion.findOneAndUpdate({ _id: id, user, status: 'pending' }, { $set: { status: 'accepted', decision } }, { new: true, session })
        || await Suggestion.findOne({ _id: id, user }).session(session);
    }
    if (candidate.status !== 'accepted') throw invalid('建议已被忽略');
    if (await Todo.exists({ _id: candidate.todoId, user, isDeleted: true }).session(session)) throw invalid('该建议的待办已被删除，不能重复创建');
    // Decision first, deterministic Todo id second: a retry repairs an interrupted acceptance.
    await Todo.updateOne({ _id: candidate.todoId }, { $setOnInsert: { user, ...candidate.decision, sourceSuggestion: candidate._id, status: '待办' } }, { upsert: true, runValidators: true, session });
    return Todo.findOne({ _id: candidate.todoId, user }).session(session);
  });
}

async function enqueueScheduled(type) {
  const users = await User.find().select('_id').lean();
  for (const user of users) {
    try { await enqueue(user._id, { type, anchor: label(new Date()), previous: true }, true); }
    catch (e) { if (!e.permanent) console.error('自动总结入队失败'); }
  }
}
module.exports = { preview, enqueue, generate, accept, enqueueScheduled, invalid, modelFor };
