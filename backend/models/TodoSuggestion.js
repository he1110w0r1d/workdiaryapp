const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  summary: { type: mongoose.Schema.Types.ObjectId, ref: 'Summary', required: true },
  ordinal: { type: Number, required: true },
  dataGeneration: { type: Number, default: 0 },
  content: { type: String, required: true },
  priority: { type: String, enum: ['高', '中', '低'], default: '中' },
  dueDate: Date,
  sourceDiaryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Diary' }],
  status: { type: String, enum: ['pending', 'accepted', 'dismissed'], default: 'pending' },
  decision: Object,
  todoId: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() }
}, { timestamps: true });
schema.index({ summary: 1, ordinal: 1 }, { unique: true });
schema.index({ user: 1, status: 1 });
module.exports = mongoose.model('TodoSuggestion', schema);
