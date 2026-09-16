const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const Diary = require('../models/Diary');
const Todo = require('../models/Todo');
const Summary = require('../models/Summary');
const User = require('../models/User');

const invalid = (message) => Object.assign(new Error(message), { status: 400 });
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const models = { diaries: Diary, todos: Todo, summaries: Summary, suggestions: require('../models/TodoSuggestion') };

async function prepareBackup(backup, userId) {
  if (!object(backup) || !object(backup.metadata) || !object(backup.data)) throw invalid('无效的备份格式');
  if (String(backup.metadata.userId) !== String(userId)) throw invalid('只能恢复当前用户的备份');
  const maps = {};
  const prepared = {};
  for (const key of Object.keys(models)) {
    const records = key === 'suggestions' && backup.data[key] === undefined ? [] : backup.data[key];
    if (!Array.isArray(records)) throw invalid(`${key} 必须是数组，空集合请明确提供 []`);
    maps[key] = new Map();
    for (const record of records) {
      if (!object(record) || !id(record._id) || String(record.user) !== String(userId)) throw invalid(`${key} 包含无效 ID 或其他用户的数据`);
      const oldId = record._id.toLowerCase();
      if (maps[key].has(oldId)) throw invalid(`${key} 包含重复 ID`);
      maps[key].set(oldId, new mongoose.Types.ObjectId());
    }
  }
  for (const [key, Model] of Object.entries(models)) {
    prepared[key] = [];
    for (const record of backup.data[key] || []) {
      const copy = { ...record, _id: maps[key].get(record._id.toLowerCase()), user: userId };
      for (const [field, target] of [['relatedTodo', 'todos'], ['relatedDiary', 'diaries']]) {
        if (copy[field] != null) {
          const mapped = id(copy[field]) && maps[target].get(copy[field].toLowerCase());
          if (!mapped) throw invalid(`${key}.${field} 引用了备份之外的记录`);
          copy[field] = mapped;
        }
      }
      if (key === 'diaries') copy.difyDocId = null;
      if (copy.sourceDiaryIds) {
        if (!Array.isArray(copy.sourceDiaryIds)) throw invalid('sourceDiaryIds 必须是数组');
        copy.sourceDiaryIds = copy.sourceDiaryIds.map(old => {
          const mapped = id(old) && maps.diaries.get(old.toLowerCase());
          if (!mapped) throw invalid('sourceDiaryIds 引用了备份之外的日记');
          return mapped;
        });
      }
      if (key === 'todos') copy.sourceSuggestion = copy.sourceSuggestion ? maps.suggestions.get(String(copy.sourceSuggestion).toLowerCase()) : undefined;
      if (key === 'suggestions') {
        copy.summary = maps.summaries.get(String(copy.summary).toLowerCase());
        if (!copy.summary) throw invalid('建议引用的总结不在备份中');
        copy.todoId = maps.todos.get(String(copy.todoId).toLowerCase()) || new mongoose.Types.ObjectId();
        if (copy.status === 'accepted') {
          const restoredTodo = prepared.todos.find(t => String(t._id) === String(copy.todoId));
          // An accepted suggestion whose task was permanently removed must never recreate it.
          if (!restoredTodo) { copy.status = 'dismissed'; copy.decision = undefined; }
          else copy.decision = { content: restoredTodo.content, priority: restoredTodo.priority, dueDate: restoredTodo.dueDate, relatedDiary: restoredTodo.relatedDiary, sourceDiaryIds: restoredTodo.sourceDiaryIds };
        } else copy.decision = undefined;
      }
      if (copy.deletedBy != null && String(copy.deletedBy) !== String(userId)) throw invalid('删除者不属于当前用户');
      // HTML 是可重新生成的缓存，不信任备份中的文件路径。
      if (key === 'summaries') { copy.htmlFilePath = null; if (copy.meta) copy.meta = { ...copy.meta, sources: null, jobId: null, restored: true }; }
      const doc = new Model(copy);
      await doc.validate();
      prepared[key].push(doc.toObject());
    }
  }
  if (backup.data.user != null && !object(backup.data.user)) throw invalid('无效的用户设置');
  return prepared;
}

function applySettings(userDoc, incoming, strategy) {
  const result = { profileUpdated: false, llmConfigsApplied: 0, embeddingConfigsApplied: 0 };
  if (!incoming || strategy === 'skip') return result;
  if (incoming.profile != null) {
    if (!object(incoming.profile)) throw invalid('无效的个人资料');
    for (const field of ['nickname', 'bio', 'avatar', 'workProfile', 'customPrompts']) {
      if (incoming.profile[field] != null) userDoc[field] = incoming.profile[field];
    }
    result.profileUpdated = true;
  }
  for (const field of ['llmConfigs', 'embeddingConfigs']) {
    const values = incoming[field] ?? [];
    if (!Array.isArray(values) || values.some(v => !object(v))) throw invalid(`无效的 ${field}`);
    const keyOf = x => JSON.stringify([x.provider || '', x.model || '', String(x.name || '').trim()]);
    const existing = strategy === 'overwrite' ? [] : [...(userDoc[field] || [])];
    const keys = new Set(existing.map(keyOf));
    const added = values.filter(v => {
      const key = keyOf(v);
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    });
    userDoc[field] = [...existing, ...added];
    result[`${field}Applied`] = added.length;
  }
  return result;
}

async function restoreBackupData(backup, userId, strategy = 'merge') {
  if (!['merge', 'overwrite', 'skip'].includes(strategy)) throw invalid('无效的设置恢复策略');
  const prepared = await prepareBackup(backup, userId);
  // 独立 MongoDB 不支持事务时，在任何删除前拒绝恢复。
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw Object.assign(new Error('恢复需要 MongoDB 副本集或分片集群；原数据未修改'), { status: 503 });
  }
  const session = await mongoose.startSession();
  let restored;
  try {
    await session.withTransaction(async () => {
      const userDoc = await User.findById(userId).session(session);
      if (!userDoc) throw invalid('用户不存在');
      const oldUser = userDoc.toObject();
      restored = applySettings(userDoc, backup.data.user, strategy);
      await userDoc.validate();
      const snapshot = { metadata: { version: '1.0', userId: String(userId), createdAt: new Date().toISOString() }, data: {} };
      for (const [key, Model] of Object.entries(models)) {
        snapshot.data[key] = await Model.find({ user: userId }).session(session).lean();
      }
      snapshot.data.user = { profile: Object.fromEntries(['nickname', 'bio', 'avatar', 'workProfile', 'customPrompts'].map(k => [k, oldUser[k]])), llmConfigs: oldUser.llmConfigs, embeddingConfigs: oldUser.embeddingConfigs };
      for (const diary of snapshot.data.diaries) {
        await require('../models/DiarySync').updateOne({ _id: diary._id }, { $setOnInsert: { user: userId, difyDocId: diary.difyDocId || undefined } }, { upsert: true, session });
      }
      const dir = path.join(__dirname, '../backup');
      await fs.mkdir(dir, { recursive: true });
      const snapshotName = `backup-${userId}-pre-restore-${crypto.randomUUID()}.json`;
      await fs.writeFile(path.join(dir, snapshotName), JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
      for (const [key, Model] of Object.entries(models)) {
        await Model.deleteMany({ user: userId }, { session });
        if (prepared[key].length) await Model.insertMany(prepared[key], { session });
      }
      userDoc.dataGeneration = (userDoc.dataGeneration || 0) + 1;
      await userDoc.save({ session });
      await models.suggestions.updateMany({ user: userId }, { $set: { dataGeneration: userDoc.dataGeneration } }, { session });
      restored.snapshotFileName = snapshotName;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    await session.endSession();
  }
  return { ...restored, ...Object.fromEntries(Object.entries(prepared).map(([k, v]) => [k, v.length])), strategy };
}

module.exports = { prepareBackup, applySettings, restoreBackupData };
