const Diary = require('../models/Diary');
const pg = require('../utils/pgClient');
const { createLLMInstances } = require('./userController');
const logger = require('../utils/logger');

// 将向量数组转为 PostgreSQL vector 格式
const vectorToSql = (vec) => `[${vec.join(',')}]`;

const indexWorkflow = require('../services/indexWorkflow');
const Sync = require('../models/DiarySync');
const sourceVersion = require('../services/sourceVersion');
exports.reindex = async (req, res) => {
  try {
    const job = await indexWorkflow.enqueue(req.user.id, 'pg', true);
    res.status(202).json({ success: true, jobId: job._id, message: '已加入索引重建队列，请在同步任务中查看进度' });
  } catch (_) { res.status(500).json({ success: false, message: '索引任务入队失败' }); }
};
exports.reindexForUser = user => indexWorkflow.enqueue(user, 'pg', true);

exports.query = async (req, res) => {
  try {
    const userId = req.user.id;
    const question = String(req.body.question || '').trim();
    const topK = Math.max(1, Math.min(10, Number(req.body.topK) || 5));
    if (!question) return res.status(400).json({ success: false, message: '缺少question' });

    try { logger.llm('RAG查询开始', { userId, questionPreview: question.substring(0, 100), topK }); } catch (_) { }

    // 解析相对日期词，必要时限定检索范围
    const parseRelativeDateRange = (q) => {
      const now = new Date();
      const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
      const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
      const has = (kw) => q.includes(kw);

      if (has('昨天')) {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        return { label: '昨天', start: startOfDay(y), end: endOfDay(y) };
      }
      if (has('今天')) {
        return { label: '今天', start: startOfDay(now), end: endOfDay(now) };
      }
      if (has('前天')) {
        const y2 = new Date(now); y2.setDate(y2.getDate() - 2);
        return { label: '前天', start: startOfDay(y2), end: endOfDay(y2) };
      }
      if (has('上周')) {
        const d = now.getDay();
        const thisMonday = new Date(now);
        thisMonday.setDate(now.getDate() - ((d + 6) % 7));
        const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
        const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1);
        return { label: '上周', start: startOfDay(lastMonday), end: endOfDay(lastSunday) };
      }
      if (has('上个月') || has('上月')) {
        const firstPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastPrev = new Date(now.getFullYear(), now.getMonth(), 0);
        return { label: '上个月', start: startOfDay(firstPrev), end: endOfDay(lastPrev) };
      }
      return null;
    };

    // 增加绝对日期解析
    const parseAbsoluteDateRange = (q) => {
      const now = new Date();
      const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
      const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
      const ymd1 = q.match(/(\d{4})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{1,2})/);
      const ymd2 = q.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)?/);
      if (ymd1 || ymd2) {
        const m = ymd1 || ymd2;
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const target = new Date(year, month - 1, day);
          return {
            label: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            start: startOfDay(target), end: endOfDay(target)
          };
        }
      }
      const md1 = q.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)?/);
      const md2 = q.match(/(\d{1,2})\s*[\/-]\s*(\d{1,2})/);
      if (md1 || md2) {
        const m = md1 || md2;
        const month = Number(m[1]);
        const day = Number(m[2]);
        const year = now.getFullYear();
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const target = new Date(year, month - 1, day);
          return {
            label: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            start: startOfDay(target), end: endOfDay(target)
          };
        }
      }
      return null;
    };

    const dateRange = parseRelativeDateRange(question) || parseAbsoluteDateRange(question);

    const embedder = await indexWorkflow.configFor(userId);
    const qvec = await embedder.embed(question);
    const embeddingVersion = indexWorkflow.embeddingVersion(embedder);
    const live = await Diary.find({ user: userId, isDeleted: false,
      ...(dateRange ? { startTime: { $gte: dateRange.start, $lt: dateRange.end } } : {}) }).lean();
    const states = await Sync.find({ user: userId }).lean();
    const versions = new Map(states.map(d => [String(d._id), d.pgVersion]));
    const eligible = live.filter(d => versions.get(String(d._id)) === sourceVersion(d) + embeddingVersion);
    if (!eligible.length) return res.json({ success: true, answer: '该范围内没有已同步的有效日记。请查看同步状态，完成后再查询。', snippets: [] });
    const result = await pg.query(`
      SELECT text, diary_id, chunk_id, 1 - (embedding <=> $1::vector) AS score
      FROM diary_embeddings WHERE user_id=$2 AND diary_id=ANY($3)
      ORDER BY embedding <=> $1::vector LIMIT $4
    `, [vectorToSql(qvec), userId, eligible.map(d => String(d._id)), topK]);
    // Re-read immediately before assembling the prompt to reject edits/deletions during retrieval.
    const diaryMetas = await Diary.find({ _id: { $in: eligible.map(d => d._id) }, user: userId, isDeleted: false }).lean();
    const diaryMap = new Map(diaryMetas.map(d => [String(d._id), d]));
    const scored = result.rows.filter(s => {
      const d = diaryMap.get(s.diary_id);
      return d && s.chunk_id.startsWith(indexWorkflow.chunkPrefix(sourceVersion(d) + embeddingVersion));
    });
    if (!scored.length) return res.json({ success: true, answer: '资料正在更新，请同步完成后重试。', snippets: [] });

    // 为片段附加时间元信息，并按开始时间进行线性排序
    const scoredWithMeta = scored.map((s) => {
      const meta = diaryMap.get(s.diary_id);
      const start = meta?.startTime ? new Date(meta.startTime) : null;
      const end = meta?.endTime ? new Date(meta.endTime) : null;
      return { ...s, _meta: { start, end } };
    });

    const scoredChrono = scoredWithMeta.slice().sort((a, b) => {
      const as = a._meta.start ? a._meta.start.getTime() : 0;
      const bs = b._meta.start ? b._meta.start.getTime() : 0;
      return as - bs;
    });

    // 组装上下文（包含日期与具体时间点/范围），按时间线输出
    const fmtDate = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '未知日期';
    const fmtTime = (d) => d ? d.toLocaleString('zh-CN', { hour12: false }) : '';

    const context = scoredChrono.map((s, i) => {
      const start = s._meta.start;
      const end = s._meta.end;
      const dateStr = fmtDate(start);
      const timeRange = start && end ? `${fmtTime(start)} - ${fmtTime(end)}` : (start ? fmtTime(start) : '');
      return `【片段${i + 1} | ${dateStr} ${timeRange}】\n${s.text}`;
    }).join('\n\n');

    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const rangeNote = dateRange ? `\n已按"${dateRange.label}"筛选片段（${dateRange.start.toLocaleDateString('zh-CN')} - ${dateRange.end.toLocaleDateString('zh-CN')}）` : '';
    const llmPrompt = `你是一位熟悉我工作内容的助手。\n当前日期：${nowStr}（时区：Asia/Shanghai）。若问题包含相对日期词（如"昨天""今天""前天""上周""上个月"），请以当前日期解析这些词并严格依据参考片段作答。${rangeNote}\n\n参考片段（按时间线排列）：\n\n${context}\n\n问题：${question}\n\n回答要求（必须同时满足）：\n- 以严格的时间线组织答案，从最早到最晚；\n- 每个要点标注对应片段编号，如【片段1】、【片段2】；\n- 在每个要点中明确具体时间点或时间范围；\n- 仅依据参考片段作答，不进行臆测，无法确定的请明确说明"依据不足"；\n- 最后给出简短结论，并列出"依据映射表"：结论要点 -> 片段编号；\n- 使用中文，结构化分点，便于追溯。`;

    let answer = null;

    const { externalLLM, localLLM } = await createLLMInstances(userId);

    if (externalLLM) {
      try {
        answer = await externalLLM.generateText(llmPrompt, { temperature: 0.2, maxTokens: 3000, requireComplete: true });
        try { logger.llm('外部LLM生成成功', { length: (answer || '').length, preview: (answer || '').substring(0, 200) }); } catch (_) { }
      } catch (e) {
        try { logger.error('外部LLM生成失败', { message: e.message }); } catch (_) { }
      }
    }

    if (!answer && localLLM) {
      try {
        answer = await localLLM.generateText(llmPrompt, { temperature: 0.2, maxTokens: 3000 });
        try { logger.llm('本地LLM生成成功', { length: (answer || '').length, preview: (answer || '').substring(0, 200) }); } catch (_) { }
      } catch (e) {
        try { logger.error('本地LLM生成失败', { message: e.message }); } catch (_) { }
      }
    }

    if (typeof answer === 'string' && !answer.trim()) {
      answer = null;
    }

    if (!answer) {
      answer = '抱歉，未能生成答案。';
      try { logger.llm('答案未生成，使用占位文本'); } catch (_) { }
    }

    try { logger.llm('RAG查询结束', { answerLength: (answer || '').length, snippetCount: scored.length }); } catch (_) { }

    // 返回时附带日期信息
    const snippetsOut = scoredChrono.map(s => {
      const meta = diaryMap.get(s.diary_id);
      return {
        text: s.text,
        diary: s.diary_id,
        score: Number(s.score),
        startTime: meta?.startTime || null,
        endTime: meta?.endTime || null
      };
    });

    const out = { success: true, answer, snippets: snippetsOut };
    if (dateRange) {
      out.dateFilter = {
        label: dateRange.label,
        start: dateRange.start,
        end: dateRange.end
      };
    }
    return res.json(out);
  } catch (error) {
    try { logger.error('RAG查询失败', { message: error.message }); } catch (_) { }
    return res.status(500).json({ success: false, message: 'RAG查询失败', error: error.message });
  }
};
