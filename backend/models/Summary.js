const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['daily', 'monthly', 'yearly'],
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  statistics: {
    totalEntries: { type: Number, default: 0 },
    totalTime: { type: Number, default: 0 }, // 分钟
    tagDistribution: { type: Map, of: Number }
  },
  htmlFilePath: {
    type: String,
    default: null // 存储生成的HTML文件路径
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Summary', summarySchema);