const mongoose = require('mongoose');
const Job = require('../models/BackgroundJob');
const Summary = require('../models/Summary');
const Diary = require('../models/Diary');
const Suggestion = require('../models/TodoSuggestion');
const workflow = require('../services/summaryWorkflow');
const queue = require('../services/jobQueue');
const sourceVersion = require('../services/sourceVersion');
const { label } = require('../services/summaryPeriods');
const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { res.status(e.code === 11000 ? 409 : e.permanent || e.name === 'CastError' ? 400 : 500).json({ success: false, message: e.publicMessage || '操作未完成，请稍后重试' }); }
};
const publicJob = job => ({ _id: job._id, kind: job.kind, status: job.status, stage: job.stage, attempts: job.attempts,
  createdAt: job.createdAt, updatedAt: job.updatedAt, error: job.error, result: job.result,
  type: job.payload.type, target: job.payload.target, rangeLabel: job.payload.rangeLabel });
exports.list = wrap(async (req, res) => {
  const kind = req.query.kind === 'index' ? 'index' : 'summary';
  const jobs = await Job.find({ user: req.user.id, kind }).select('-payload.snapshot -payload.generatedContent').sort({ createdAt: -1 }).limit(30).lean();
  const reportIds = jobs.map(job => job.result?.summaryId).filter(id => mongoose.isValidObjectId(id));
  const reports = await Summary.find({ _id: { $in: reportIds }, user: req.user.id }).select('_id').lean();
  const available = new Set(reports.map(report => String(report._id)));
  res.json({ success: true, data: jobs.map(job => {
    const item = publicJob(job);
    if (item.result?.summaryId && !available.has(String(item.result.summaryId))) {
      item.result = { ...item.result };
      delete item.result.summaryId;
      item.stage = '原报告已删除或被备份恢复替换，请在总结列表查看';
    }
    return item;
  }) });
});
exports.retry = wrap(async (req, res) => {
  const job = await queue.retry(req.user.id, req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: '未找到可重试的任务' });
  res.status(202).json({ success: true, data: publicJob(job), message: '已加入重试队列' });
});
exports.preview = wrap(async (req, res) => res.json({ success: true, data: await workflow.preview(req.user.id, req.body) }));
exports.create = wrap(async (req, res) => {
  const job = await workflow.enqueue(req.user.id, req.body);
  res.status(202).json({ success: true, data: publicJob(job), message: '已加入后台队列，可在生成任务中查看进度' });
});
exports.legacy = (type, previous = false) => wrap(async (req, res) => {
  let anchor = req.body?.date || label(new Date());
  if (type === 'yearly' && req.query.year) {
    if (!/^\d{4}$/.test(req.query.year)) throw workflow.invalid('年份无效');
    anchor = `${req.query.year}-01-01`;
  }
  const job = await workflow.enqueue(req.user.id, { type, anchor, previous });
  res.status(202).json({ success: true, data: publicJob(job), message: '已加入后台队列，旧总结保留，完成后可查看新版本' });
});
exports.suggestions = wrap(async (req, res) => {
  const summary = await Summary.findOne({ _id: req.params.id, user: req.user.id }).lean();
  if (!summary) return res.status(404).json({ success: false, message: '总结不存在' });
  const data = await Suggestion.find({ summary: summary._id, user: req.user.id }).sort({ ordinal: 1 }).lean();
  const snapshots = summary.meta?.sources;
  let sourceStatus = 'unknown', changed = [];
  if (Array.isArray(snapshots)) {
    const current = await Diary.find({ user: req.user.id, isDeleted: false, startTime: { $gte: new Date(summary.meta.rangeStart), $lt: new Date(summary.meta.rangeEnd) } }).lean();
    const versions = new Map(current.map(d => [String(d._id), sourceVersion(d)]));
    changed = snapshots.filter(s => versions.get(s.id) !== s.version).map(s => s.id);
    const original = new Set(snapshots.map(s => s.id));
    changed.push(...current.filter(d => !original.has(String(d._id))).map(d => String(d._id)));
    sourceStatus = changed.length ? 'changed' : 'current';
  }
  res.json({ success: true, data, sourceStatus, changedCount: changed.length });
});
exports.accept = wrap(async (req, res) => res.json({ success: true, data: await workflow.accept(req.user.id, req.params.suggestionId, req.body) }));
exports.dismiss = wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.suggestionId)) throw workflow.invalid('建议编号无效');
  const candidate = await Suggestion.findOneAndUpdate({ _id: req.params.suggestionId, user: req.user.id, status: 'pending' }, { $set: { status: 'dismissed' } }, { new: true });
  if (!candidate) return res.status(409).json({ success: false, message: '建议不存在或已处理' });
  res.json({ success: true, data: candidate });
});
