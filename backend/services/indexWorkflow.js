const { createHash } = require('crypto');
const Diary = require('../models/Diary');
const Sync = require('../models/DiarySync');
const Job = require('../models/BackgroundJob');
const queue = require('./jobQueue');
const sourceVersion = require('./sourceVersion');
const { invalid } = require('./summaryWorkflow');
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Existing deployments use varchar(50) for chunk_id. Diary/user ids already have separate columns.
const chunkPrefix = version => `${hash(version).slice(0, 32)}:`;
const textFor = d => [d.content, `时间: ${new Date(d.startTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} - ${new Date(d.endTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`, `地点: ${d.location || ''}`, `标签: ${(d.tags || []).join(' ')}`].join('\n');

async function remember(d) {
  // Called before hard deletion, including backup replacement. It is harmless if deletion rolls back.
  await Sync.updateOne({ _id: d._id }, { $setOnInsert: { user: d.user, difyDocId: d.difyDocId || undefined } }, { upsert: true });
}
async function beforeDiaryRemoval(d) {
  await remember(d);
  await require('../models/Todo').updateMany({ user: d.user, relatedDiary: d._id }, { $set: { relatedDiary: null } });
  await require('../models/Todo').updateMany({ user: d.user, sourceDiaryIds: d._id }, { $pull: { sourceDiaryIds: d._id } });
  await require('../models/TodoSuggestion').updateMany({ user: d.user, sourceDiaryIds: d._id }, { $pull: { sourceDiaryIds: d._id, 'decision.sourceDiaryIds': d._id } });
  await require('../models/TodoSuggestion').updateMany({ user: d.user, 'decision.relatedDiary': d._id }, { $set: { 'decision.relatedDiary': null } });
}
async function configFor(user) {
  const config = await require('../controllers/settingsController').getUserDefaultEmbeddingConfig(user);
  return new (require('../utils/embeddings'))({ ...(config || {}), strict: true, timeout: 60000 });
}
const embeddingVersion = embedder => hash([embedder.config.provider, embedder.config.apiUrl, embedder.config.model, !!embedder.config.apiKey]);
async function enqueue(user, target = 'pg', force = false) {
  const diaries = await Diary.find({ user }).lean();
  for (const d of diaries) await remember(d);
  const version = target === 'pg' ? embeddingVersion(await configFor(user)) : hash([process.env.DIFY_BASE_URL, process.env.DIFY_DATASET_ID, process.env.DIFY_DATASET_NAME]);
  const records = await Sync.find({ user }).lean();
  const fingerprint = hash([version, diaries.map(d => [String(d._id), sourceVersion(d)]).sort(), records.map(d => String(d._id)).sort()]);
  const key = `${target}:${fingerprint}`;
  if (!force) {
    const prior = await Job.findOne({ user, kind: 'index', 'payload.fingerprintKey': key }).sort({ createdAt: -1 });
    if (prior) {
      const active = new Map(diaries.filter(d => !d.isDeleted).map(d => [String(d._id), d]));
      const field = target === 'pg' ? 'pgVersion' : 'difyVersion';
      const consistent = records.every(record => record[field] === (active.has(String(record._id)) ? sourceVersion(active.get(String(record._id))) + version : 'deleted'));
      if (prior.status !== 'succeeded' || consistent) return prior;
    }
  }
  // One active job per target/user serializes external writes. The fingerprint is still kept for reconciliation.
  return queue.enqueue(user, 'index', target, { key: target, fingerprintKey: key, target, force, embeddingVersion: version });
}

async function run(job, checkpoint, dependencies = {}) {
  const target = job.payload.target;
  const diaries = await Diary.find({ user: job.user }).lean();
  for (const d of diaries) await remember(d);
  const live = new Map(diaries.filter(d => !d.isDeleted).map(d => [String(d._id), d]));
  const records = await Sync.find({ user: job.user }).lean();
  const embedder = target === 'pg' ? dependencies.embedder || await configFor(job.user) : null;
  const embedVersion = embedder && embeddingVersion(embedder);
  let dify;
  if (target === 'dify') {
    dify = dependencies.dify || new (require('../utils/dify'))();
    dify.ensureBaseAuth();
    if (!dify.datasetId) await dify.resolveDatasetIdByName(dify.datasetName || '工作日记记录');
  }
  let updated = 0;
  for (const record of records) {
    const d = live.get(String(record._id));
    const version = d ? sourceVersion(d) + (embedVersion || job.payload.embeddingVersion) : 'deleted';
    const field = target === 'pg' ? 'pgVersion' : 'difyVersion';
    if (target === 'dify' && record.difyDatasetId && (record.difyDatasetId !== dify.datasetId || record.difyBaseUrl !== dify.baseUrl)) throw invalid('Dify知识库已变更，请先处理原知识库文档，再切换同步配置');
    if (record[field] === version && !job.payload.force) continue;
    await checkpoint(`同步${target === 'pg' ? '检索' : 'Dify'}资料（${++updated}/${records.length}）`);
    if (target === 'pg') {
      const chunks = d ? textFor(d).match(/[\s\S]{1,800}/g) || [] : [];
      const vectors = [];
      for (const chunk of chunks) {
        const vector = await embedder.embed(chunk);
        if (!vector.length || vector.some(x => !Number.isFinite(x))) throw new Error('无效的嵌入向量');
        vectors.push(vector);
      }
      const current = await Diary.findOne({ _id: record._id, user: job.user }).lean();
      if ((current && !current.isDeleted ? sourceVersion(current) + embedVersion : 'deleted') !== version) continue;
      await checkpoint('写入检索索引');
      const client = await (dependencies.pg || require('../utils/pgClient')).getClient();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`workdiary:${job.user}:${record._id}`]);
        await checkpoint('写入检索索引');
        // Replacing all chunks avoids leftover text after a diary becomes shorter.
        await client.query('DELETE FROM diary_embeddings WHERE user_id=$1 AND diary_id=$2', [String(job.user), String(record._id)]);
        for (let i = 0; i < chunks.length; i++) await client.query('INSERT INTO diary_embeddings (user_id,diary_id,chunk_id,text,embedding,updated_at) VALUES ($1,$2,$3,$4,$5::vector,NOW())', [String(job.user), String(record._id), `${chunkPrefix(version)}${i}`, chunks[i], `[${vectors[i].join(',')}]`]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        if (/dimensions/i.test(e.message || '')) e.publicMessage = '嵌入向量维度与现有检索库不一致，请选择匹配的嵌入模型后重试';
        throw e;
      } finally { client.release(); }
    } else {
      const name = `workdiary:${job.user}:${record._id}`;
      // Find by stable name before creation, recovering a response lost after Dify accepted it.
      const matches = await dify.findDocuments(name);
      const ids = [...new Set([record.difyDocId, ...matches.map(x => x.id)].filter(Boolean))];
      if (!d) {
        for (const id of ids) { try { await dify.deleteDocument(id); } catch (e) { if (e.response?.status !== 404) throw e; } }
        await Sync.updateOne({ _id: record._id }, { $unset: { difyDocId: 1, difySubmittedVersion: 1 } });
      } else {
        let id = ids[0];
        const submitted = id && record.difySubmittedVersion === version && matches.some(x => x.id === id && x.indexing_status !== 'error');
        if (id && !submitted) {
          try { await dify.updateByText(id, name, textFor(d)); }
          catch (e) { if (e.response?.status !== 404) throw e; id = null; }
        }
        if (!id) id = (await dify.createByText(name, textFor(d))).id;
        await Sync.updateOne({ _id: record._id }, { $set: { difyDocId: id, difySubmittedVersion: version, difyDatasetId: dify.datasetId, difyBaseUrl: dify.baseUrl } });
        // Keep the legacy field for exports; never change the user's authored content.
        await Diary.updateOne({ _id: record._id, user: job.user }, { $set: { difyDocId: id } });
        for (const duplicate of ids.filter(x => x !== id)) { try { await dify.deleteDocument(duplicate); } catch (e) { if (e.response?.status !== 404) throw e; } }
        const indexed = (await dify.findDocuments(name)).find(x => x.id === id);
        if (indexed?.indexing_status !== 'completed' || indexed?.enabled === false) {
          const error = new Error('Dify indexing pending');
          error.publicMessage = indexed?.indexing_status === 'error' ? 'Dify索引失败，请检查知识库后重试' : '文档已提交，Dify尚未完成索引；稍后重试会继续检查进度';
          throw error;
        }
      }
    }
    await checkpoint('记录同步版本');
    await Sync.updateOne({ _id: record._id }, { $set: { [field]: version } });
  }
  return { target, updated };
}

async function reconcile() {
  const users = new Set([...(await Diary.distinct('user')).map(String), ...(await Sync.distinct('user')).map(String)]);
  for (const user of users) {
    await enqueue(user, 'pg');
    if (process.env.DIFY_BASE_URL && process.env.DIFY_DATASET_API_KEY) await enqueue(user, 'dify');
  }
}
function start() {
  queue.startWorker('index', run);
  let busy = false;
  const tick = async () => { if (busy) return; busy = true; try { await reconcile(); } catch (_) { console.error('检索同步扫描未完成'); } finally { busy = false; } };
  tick(); const timer = setInterval(tick, 60000); timer.unref();
}
module.exports = { remember, beforeDiaryRemoval, enqueue, run, start, configFor, embeddingVersion, chunkPrefix, textFor };
