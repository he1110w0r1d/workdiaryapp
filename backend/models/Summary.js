const mongoose = require('mongoose');

const logger = require('../utils/logger');
const summarySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
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
  // 额外元信息，用于明确时间范围与生成方式
  meta: {
    type: Object,
    default: null
  },
  htmlFilePath: {
    type: String,
    default: null // 存储生成的HTML文件路径
  },
  // 已读/未读状态
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Summary', summarySchema);