const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: ['summary', 'index'], required: true },
  activeKey: String,
  payload: { type: Object, required: true },
  status: { type: String, enum: ['queued', 'running', 'succeeded', 'failed'], default: 'queued' },
  stage: { type: String, default: '等待处理' },
  attempts: { type: Number, default: 0 },
  runAfter: { type: Date, default: Date.now },
  leaseUntil: Date,
  token: String,
  result: Object,
  error: String
}, { timestamps: true });
schema.index({ activeKey: 1 }, { unique: true, sparse: true });
schema.index({ kind: 1, status: 1, runAfter: 1, leaseUntil: 1 });
schema.index({ user: 1, kind: 1, createdAt: -1 });
schema.index({ user: 1, kind: 1, 'payload.fingerprintKey': 1 });
schema.index({ user: 1, kind: 1, 'payload.key': 1 });
module.exports = mongoose.model('BackgroundJob', schema);
