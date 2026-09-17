const Diary = require('../models/Diary');
const pg = require('../utils/pgClient');
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
    const topK = Math.max(1, Math.min(10, Math.floor(Number(req.body.topK) || 5)));
    if (question.length > 5000) return res.status(400).json({ success: false, message: '问题请控制在5000字以内' });
    if (!question) return res.status(400).json({ success: false, message: '缺少question' });

    try { logger.llm('RAG查询开始', { userId, questionPreview: question.substring(0, 100), topK }); } catch (_) { }

    const dateRange = require('../services/questionPeriod')(question);

    let scored, diaryMap;
    if (dateRange) {
      // Date questions need the full live period, not a vector top-K sample.
      const diaries = await Diary.find({ user: userId, isDeleted: false,
        startTime: { $gte: dateRange.start, $lt: dateRange.end } }).sort({ startTime: 1, _id: 1 }).lean();
      if (!diaries.length) return res.json({ success: true, answer: '该时间范围内没有日记记录。', snippets: [], dateFilter: dateRange });
      diaryMap = new Map(diaries.map(d => [String(d._id), d]));
      scored = diaries.map(d => ({ diary_id: String(d._id), text: d.content, score: 1 }));
    } else {
    const embedder = await indexWorkflow.configFor(userId);
    let qvec;
    try { qvec = await embedder.embed(question); }
    catch (error) {
      if (!/timeout|ETIMEDOUT|ECONNABORTED|ECONNRESET/i.test(error.message || error.code || '')) throw error;
      qvec = await embedder.embed(question);
    }
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
    diaryMap = new Map(diaryMetas.map(d => [String(d._id), d]));
    scored = result.rows.filter(s => {
      const d = diaryMap.get(s.diary_id);
      return d && s.chunk_id.startsWith(indexWorkflow.chunkPrefix(sourceVersion(d) + embeddingVersion));
    });
    if (!scored.length) return res.json({ success: true, answer: '资料正在更新，请同步完成后重试。', snippets: [] });

    }
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
    const fmtDate = d => d ? require('../services/summaryPeriods').label(d) : '未知日期';
    const fmtTime = (d) => d ? d.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }) : '';

    let context = scoredChrono.map((s, i) => {
      const start = s._meta.start;
      const end = s._meta.end;
      const dateStr = fmtDate(start);
      const timeRange = start && end ? `${fmtTime(start)} - ${fmtTime(end)}` : (start ? fmtTime(start) : '');
      return `【片段${i + 1} | ${dateStr} ${timeRange}】\n${s.text}`;
    }).join('\n\n');

    const now = new Date();
    const nowStr = fmtDate(now);
    const rangeNote = dateRange ? `\n已按"${dateRange.label}"筛选片段（${fmtDate(dateRange.start)} - ${fmtDate(new Date(+dateRange.end - 1))}）` : '';
    const makePrompt = context => `你是一位熟悉我工作内容的助手。\n当前日期：${nowStr}（时区：Asia/Shanghai）。若问题包含相对日期词（如"昨天""今天""前天""上周""上个月"），请以当前日期解析这些词并严格依据参考片段作答。${rangeNote}\n\n参考片段（按时间线排列）：\n\n${context}\n\n问题：${question}\n\n回答要求（必须同时满足）：\n- 以严格的时间线组织答案，从最早到最晚；\n- 每个要点标注对应片段编号，如【片段1】、【片段2】；\n- 在每个要点中明确具体时间点或时间范围；\n- 仅依据参考片段作答，不进行臆测，无法确定的请明确说明"依据不足"；\n- 最后给出简短结论，并列出"依据映射表"：结论要点 -> 片段编号；\n- 使用中文，结构化分点，便于追溯。`;

    const model = await require('../services/summaryWorkflow').modelFor(userId);
    const ask = async prompt => {
      const answer = await model.generateText(prompt, { temperature: 0.2, maxTokens: Number(model.config?.maxTokens) || 16000, requireComplete: true });
      if (typeof answer !== 'string' || !answer.trim()) throw Object.assign(new Error('Empty model response'), { publicMessage: '回答模型未返回内容，请检查模型设置后重试。' });
      return answer;
    };
    // Compress every chunk when needed, preserving source numbers. Never drop the tail.
    for (let level = 0; context.length > 12000; level++) {
      if (level >= 5) throw Object.assign(new Error('Context too large'), { publicMessage: '资料过多，请缩小问题的时间范围。' });
      const parts = [];
      for (let i = 0; i < context.length; i += 10000) {
        parts.push(await ask(`根据问题整理下面的资料，保留日期、事实及原有【片段N】编号，不添加事实，控制在1200字内。问题：${question}\n资料：${context.slice(i, i + 10000)}`));
      }
      context = parts.join('\n\n');
    }
    const answer = await ask(makePrompt(context));

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
    const timeout = /timeout|ETIMEDOUT|ECONNABORTED/i.test(error.message || '');
    return res.status(timeout ? 504 : 502).json({ success: false, message: error.publicMessage || (timeout ? '检索或回答服务响应超时，请稍后重试；也可以指定日期（例如上周）直接查询日记。' : '检索或回答服务暂不可用，请检查模型与向量服务配置后重试。') });
  }
};
