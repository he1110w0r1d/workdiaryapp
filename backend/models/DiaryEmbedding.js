const mongoose = require('mongoose');

const DiaryEmbeddingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  diary: { type: mongoose.Schema.Types.ObjectId, ref: 'Diary', index: true },
  chunkId: { type: String, index: true },
  text: { type: String },
  vector: { type: [Number], index: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

DiaryEmbeddingSchema.index({ user: 1, diary: 1, chunkId: 1 }, { unique: true });

module.exports = mongoose.model('DiaryEmbedding', DiaryEmbeddingSchema);