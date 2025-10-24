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

// 重新索引当前用户的所有日记
exports.reindex = async (req, res) => {
  try {
    const userId = req.user.id;
    const diaries = await Diary.find({ user: userId }).sort({ date: -1 }).lean();
    const embedder = new Embeddings();
    let totalChunks = 0;

    try { logger.llm('RAG重建索引开始', { userId, diaryCount: diaries.length }); } catch (_) {}

    for (const d of diaries) {
      const chunks = chunkDiary(d.content || d.text || d.title || '');
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

    try { logger.llm('RAG重建索引完成', { userId, indexedDiaries: diaries.length, indexedChunks: totalChunks }); } catch (_) {}

    return res.json({ success: true, indexedDiaries: diaries.length, indexedChunks: totalChunks });
  } catch (error) {
    try { logger.error('RAG索引失败', { message: error.message }); } catch (_) {}
    return res.status(500).json({ success: false, message: 'RAG索引失败', error: error.message });
  }
};

// 新增：为指定用户重建索引（供内部调用，无HTTP响应）
exports.reindexForUser = async (userId) => {
  const diaries = await Diary.find({ user: userId }).sort({ date: -1 }).lean();
  const embedder = new Embeddings();
  let totalChunks = 0;

  try { logger.llm('RAG重建索引开始', { userId, diaryCount: diaries.length }); } catch (_) {}

  for (const d of diaries) {
    const chunks = chunkDiary(d.content || d.text || d.title || '');
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

  try { logger.llm('RAG重建索引完成', { userId, indexedDiaries: diaries.length, indexedChunks: totalChunks }); } catch (_) {}

  return { indexedDiaries: diaries.length, indexedChunks: totalChunks };
};

// 查询RAG：返回LLM答案与命中片段
exports.query = async (req, res) => {
  try {
    const userId = req.user.id;
    const question = String(req.body.question || '').trim();
    const topK = Math.max(1, Math.min(8, Number(req.body.topK) || 5));
    if (!question) return res.status(400).json({ success: false, message: '缺少question' });

    try { logger.llm('RAG查询开始', { userId, questionPreview: question.substring(0, 100), topK }); } catch (_) {}

    const embedder = new Embeddings();
    const qvec = await embedder.embed(question);
    try { logger.llm('查询向量生成', { dim: qvec.length }); } catch (_) {}

    const docs = await DiaryEmbedding.find({ user: userId }).select('text vector diary').lean();
    try { logger.llm('候选片段加载完成', { count: docs.length }); } catch (_) {}

    const scored = docs.map(doc => ({ ...doc, score: cosine(qvec, doc.vector || []) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    try { logger.llm('TopK命中分数', { scores: scored.map(s => Number(s.score.toFixed(3))) }); } catch (_) {}

    // 取命中片段对应的日记时间信息
    const diaryIds = Array.from(new Set(scored.map(s => String(s.diary))));
    const diaryMetas = await Diary.find({ _id: { $in: diaryIds } }).select('startTime endTime').lean();
    const diaryMap = new Map(diaryMetas.map(d => [String(d._id), d]));

    // 组装上下文（包含日期与时间范围）
    const context = scored.map((s, i) => {
      const meta = diaryMap.get(String(s.diary));
      const start = meta?.startTime ? new Date(meta.startTime) : null;
      const end = meta?.endTime ? new Date(meta.endTime) : null;
      const dateStr = start ? `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}` : '未知日期';
      const timeRange = start && end ? `${start.toLocaleString()} - ${end.toLocaleString()}` : '';
      return `# 片段${i+1} (score=${s.score.toFixed(3)})\n日期: ${dateStr}${timeRange ? `\n时间: ${timeRange}` : ''}\n${s.text}`;
    }).join('\n\n');

    // 用LLM生成答案
    const { externalLLM, localLLM } = await createLLMInstances(userId);

    const llmPrompt = `你是我的专业工作助理。请基于“我的工作日记”片段回答，不要称其为“知识库”。\n\n【工作日记片段】\n${context}\n\n【问题】\n${question}\n\n输出要求（使用Markdown）：\n1. **时间线**：按日期先后组织（YYYY-MM-DD），逐条说明当天发生的关键事项；如同一天有多条，合并归纳并标注要点。\n2. **结论/回答**：围绕问题给出直接回答，必要时引用对应日期或片段编号作为依据。\n3. **专业助理总结与分析**：严格包含以下四小节，采用要点式：\n   - 关键结论\n   - 风险\n   - 阻碍\n   - 建议\n\n约束：\n- 仅依据提供的日记片段，不要编造信息；\n- 用中文、结构清晰；\n- 如片段不足以完整回答，请明确指出不足并给出补充建议。`;

    try {
      logger.llm('LLM实例就绪', {
        externalProvider: externalLLM?.config?.provider,
        externalApiUrl: externalLLM?.config?.apiUrl,
        externalModel: externalLLM?.config?.model,
        localEnabled: localLLM?.config?.enabled,
        localModel: localLLM?.config?.model,
        promptLength: llmPrompt.length
      });
    } catch (_) {}

    let answer = null;
    if (externalLLM) {
      try {
        const maxOut = externalLLM?.config?.maxTokens || 4096;
        answer = await externalLLM._callExternalLLM(llmPrompt, { maxTokens: maxOut, temperature: 0.2 });
        try { logger.llm('外部LLM生成成功', { length: (answer || '').length, preview: (answer || '').substring(0, 200), maxTokensUsed: maxOut }); } catch (_) {}
      } catch (e) {
        try { logger.error('外部LLM生成失败', { message: e.message }); } catch (_) {}
      }
    }
    if (!answer && localLLM) {
      try {
        answer = await localLLM.generateText(llmPrompt, { temperature: 0.2 });
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
    const snippetsOut = scored.map(s => {
      const meta = diaryMap.get(String(s.diary));
      return {
        text: s.text,
        diary: s.diary,
        score: s.score,
        startTime: meta?.startTime || null,
        endTime: meta?.endTime || null
      };
    });

    return res.json({ success: true, answer, snippets: snippetsOut });
  } catch (error) {
    try { logger.error('RAG查询失败', { message: error.message }); } catch (_) {}
    return res.status(500).json({ success: false, message: 'RAG查询失败', error: error.message });
  }
};