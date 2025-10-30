const Diary = require('../models/Diary');
const DiaryEmbedding = require('../models/DiaryEmbedding');
const Embeddings = require('../utils/embeddings');
const ExternalLLM = require('../utils/externalLLM');
const { createLLMInstances } = require('./userController');
const logger = require('../utils/logger');

// 简易分片：按段落长度切分
const chunkDiary = (text, maxLen = 800) => {
  const t = String(text || '');
  const parts = t.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  const chunks = [];
  for (const p of parts) {
    if (p.length <= maxLen) {
      chunks.push(p);
    } else {
      for (let i = 0; i < p.length; i += maxLen) {
        chunks.push(p.slice(i, i + maxLen));
      }
    }
  }
  return chunks.length ? chunks : [t.slice(0, maxLen)];
};

// 余弦相似度
const cosine = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) {
    const va = a[i] || 0;
    const vb = b[i] || 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
};

// 构建单条日记的索引文本：标题 + 正文 + 地点 + 标签
const buildIndexText = (d) => [
  d.title || '',
  d.content || d.text || '',
  d.location ? `地点:${d.location}` : '',
  Array.isArray(d.tags) && d.tags.length ? `标签:${d.tags.join(' ')}` : ''
].filter(Boolean).join('\n');

// 重新索引当前用户的所有日记
exports.reindex = async (req, res) => {
  try {
    const userId = req.user.id;
    const diaries = await Diary.find({ user: userId }).sort({ date: -1 }).lean();
    const embedder = new Embeddings();
    let totalChunks = 0;

    // 支持策略：paragraph | perDiary（整篇）
    const strategy = String((req.query.strategy || req.body?.strategy || 'paragraph')).toLowerCase();

    try { logger.llm('RAG重建索引开始', { userId, diaryCount: diaries.length, strategy }); } catch (_) {}

    for (const d of diaries) {
      const baseText = buildIndexText(d);
      const chunks = strategy === 'perdiary' ? [baseText] : chunkDiary(baseText);
      let idx = 0;
      for (const c of chunks) {
        const vec = await embedder.embed(c);
        const chunkId = `${d._id}:${idx++}`;
        await DiaryEmbedding.findOneAndUpdate(
          { user: userId, diary: d._id, chunkId },
          { user: userId, diary: d._id, chunkId, text: c, vector: vec, updatedAt: new Date() },
          { upsert: true }
        );
        totalChunks++;
      }
    }

    try { logger.llm('RAG重建索引完成', { userId, indexedDiaries: diaries.length, indexedChunks: totalChunks, strategy }); } catch (_) {}

    return res.json({ success: true, indexedDiaries: diaries.length, indexedChunks: totalChunks, strategy });
  } catch (error) {
    try { logger.error('RAG索引失败', { message: error.message }); } catch (_) {}
    return res.status(500).json({ success: false, message: 'RAG索引失败', error: error.message });
  }
};

// 新增：为指定用户重建索引（供内部调用，无HTTP响应）
exports.reindexForUser = async (userId, options = {}) => {
  const diaries = await Diary.find({ user: userId }).sort({ date: -1 }).lean();
  const embedder = new Embeddings();
  let totalChunks = 0;
  const strategy = String((options.strategy || 'paragraph')).toLowerCase();

  try { logger.llm('RAG重建索引开始', { userId, diaryCount: diaries.length, strategy }); } catch (_) {}

  for (const d of diaries) {
    const baseText = buildIndexText(d);
    const chunks = strategy === 'perdiary' ? [baseText] : chunkDiary(baseText);
    let idx = 0;
    for (const c of chunks) {
      const vec = await embedder.embed(c);
      const chunkId = `${d._id}:${idx++}`;
      await DiaryEmbedding.findOneAndUpdate(
        { user: userId, diary: d._id, chunkId },
        { user: userId, diary: d._id, chunkId, text: c, vector: vec, updatedAt: new Date() },
        { upsert: true }
      );
      totalChunks++;
    }
  }

  try { logger.llm('RAG重建索引完成', { userId, indexedDiaries: diaries.length, indexedChunks: totalChunks, strategy }); } catch (_) {}

  return { indexedDiaries: diaries.length, indexedChunks: totalChunks, strategy };
};

// 查询RAG：返回LLM答案与命中片段
exports.query = async (req, res) => {
  try {
    const userId = req.user.id;
    const question = String(req.body.question || '').trim();
    const topK = Math.max(1, Math.min(10, Number(req.body.topK) || 5));
    if (!question) return res.status(400).json({ success: false, message: '缺少question' });

    try { logger.llm('RAG查询开始', { userId, questionPreview: question.substring(0, 100), topK }); } catch (_) {}
    // 解析相对日期词，必要时限定检索范围（今天/昨天/前天/上周/上个月）
    const parseRelativeDateRange = (q) => {
      const now = new Date();
      const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
      const endOfDay = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
      const has = (kw) => q.includes(kw);
      // 昨天/今天/前天
      if (has('昨天')) {
        const y = new Date(now); y.setDate(y.getDate()-1);
        return { label: '昨天', start: startOfDay(y), end: endOfDay(y) };
      }
      if (has('今天')) {
        return { label: '今天', start: startOfDay(now), end: endOfDay(now) };
      }
      if (has('前天')) {
        const y2 = new Date(now); y2.setDate(y2.getDate()-2);
        return { label: '前天', start: startOfDay(y2), end: endOfDay(y2) };
      }
      // 上周：以周一为起点
      if (has('上周')) {
        const d = now.getDay(); // 0:周日
        const thisMonday = new Date(now);
        thisMonday.setDate(now.getDate() - ((d+6)%7));
        const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate()-7);
        const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate()-1);
        return { label: '上周', start: startOfDay(lastMonday), end: endOfDay(lastSunday) };
      }
      // 上个月
      if (has('上个月') || has('上月')) {
        const firstPrev = new Date(now.getFullYear(), now.getMonth()-1, 1);
        const lastPrev = new Date(now.getFullYear(), now.getMonth(), 0);
        return { label: '上个月', start: startOfDay(firstPrev), end: endOfDay(lastPrev) };
      }
      return null;
    };

    const dateRange = parseRelativeDateRange(question);

    const embedder = new Embeddings();
    const qvec = await embedder.embed(question);
    try { logger.llm('查询向量生成', { dim: qvec.length }); } catch (_) {}
    let docs = [];
    if (dateRange) {
      // 若问题包含相对日期词，仅检索该日期范围内的片段
      const diariesInRange = await Diary.find({
        user: userId,
        startTime: { $gte: dateRange.start, $lt: dateRange.end }
      }).select('_id').lean();
      const diaryIds = diariesInRange.map(d => d._id);
      docs = await DiaryEmbedding.find({ user: userId, diary: { $in: diaryIds } }).select('text vector diary').lean();
      try { logger.llm('候选片段加载完成(按日期过滤)', { count: docs.length, label: dateRange.label }); } catch (_) {}
      // 若过滤后为空，回退到全量
      if (!docs.length) {
        docs = await DiaryEmbedding.find({ user: userId }).select('text vector diary').lean();
        try { logger.llm('日期过滤无结果，回退全量', { count: docs.length }); } catch (_) {}
      }
    } else {
      docs = await DiaryEmbedding.find({ user: userId }).select('text vector diary').lean();
      try { logger.llm('候选片段加载完成', { count: docs.length }); } catch (_) {}
    }

    const scored = docs.map(doc => ({ ...doc, score: cosine(qvec, doc.vector || []) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    try { logger.llm('TopK命中分数', { scores: scored.map(s => Number(s.score.toFixed(3))) }); } catch (_) {}

    // 取命中片段对应的日记时间信息
    const diaryIds = Array.from(new Set(scored.map(s => String(s.diary))));
    const diaryMetas = await Diary.find({ _id: { $in: diaryIds } }).select('startTime endTime').lean();
    const diaryMap = new Map(diaryMetas.map(d => [String(d._id), d]));

    // 为片段附加时间元信息，并按开始时间进行线性排序
    const scoredWithMeta = scored.map((s) => {
      const meta = diaryMap.get(String(s.diary));
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
    const fmtDate = (d) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '未知日期';
    const fmtTime = (d) => d ? d.toLocaleString('zh-CN', { hour12: false }) : '';

    const context = scoredChrono.map((s, i) => {
      const start = s._meta.start;
      const end = s._meta.end;
      const dateStr = fmtDate(start);
      const timeRange = start && end ? `${fmtTime(start)} - ${fmtTime(end)}` : (start ? fmtTime(start) : '');
      return `【片段${i+1} | ${dateStr} ${timeRange}】\n${s.text}`;
    }).join('\n\n');

    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const rangeNote = dateRange ? `\n已按“${dateRange.label}”筛选片段（${dateRange.start.toLocaleDateString('zh-CN')} - ${dateRange.end.toLocaleDateString('zh-CN')}）` : '';
    const llmPrompt = `你是一位熟悉我工作内容的助手。\n当前日期：${nowStr}（时区：Asia/Shanghai）。若问题包含相对日期词（如“昨天”“今天”“前天”“上周”“上个月”），请以当前日期解析这些词并严格依据参考片段作答。${rangeNote}\n\n参考片段（按时间线排列）：\n\n${context}\n\n问题：${question}\n\n回答要求（必须同时满足）：\n- 以严格的时间线组织答案，从最早到最晚；\n- 每个要点标注对应片段编号，如【片段1】、【片段2】；\n- 在每个要点中明确具体时间点或时间范围；\n- 仅依据参考片段作答，不进行臆测，无法确定的请明确说明“依据不足”；\n- 最后给出简短结论，并列出“依据映射表”：结论要点 -> 片段编号；\n- 使用中文，结构化分点，便于追溯。`;

    let answer = null;

    const { externalLLM, localLLM } = await createLLMInstances(userId);

    if (externalLLM) {
      try {
        answer = await externalLLM.generateText(llmPrompt, { temperature: 0.2, maxTokens: 3000 });
        try { logger.llm('外部LLM生成成功', { length: (answer || '').length, preview: (answer || '').substring(0, 200) }); } catch (_) {}
      } catch (e) {
        try { logger.error('外部LLM生成失败', { message: e.message }); } catch (_) {}
      }
    }

    if (!answer && localLLM) {
      try {
        answer = await localLLM.generateText(llmPrompt, { temperature: 0.2, maxTokens: 3000 });
        try { logger.llm('本地LLM生成成功', { length: (answer || '').length, preview: (answer || '').substring(0, 200) }); } catch (_) {}
      } catch (e) {
        try { logger.error('本地LLM生成失败', { message: e.message }); } catch (_) {}
      }
    }

    // 若是空白字符串，按未生成处理
    if (typeof answer === 'string' && !answer.trim()) {
      answer = null;
    }

    if (!answer) {
      answer = '抱歉，未能生成答案。';
      try { logger.llm('答案未生成，使用占位文本'); } catch (_) {}
    }

    try { logger.llm('RAG查询结束', { answerLength: (answer || '').length, snippetCount: scored.length }); } catch (_) {}

    // 返回时附带日期信息，便于前端或后续处理
    const snippetsOut = scoredChrono.map(s => {
      const meta = diaryMap.get(String(s.diary));
      return {
        text: s.text,
        diary: s.diary,
        score: s.score,
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
    try { logger.error('RAG查询失败', { message: error.message }); } catch (_) {}
    return res.status(500).json({ success: false, message: 'RAG查询失败', error: error.message }); }
};