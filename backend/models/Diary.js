const mongoose = require('mongoose');

const logger = require('../utils/logger');
const diarySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  location: {
    type: String,
    default: ''
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  tags: [{
    type: String
  }],
  workPriority: {
    type: String,
    enum: ['高', '中', '低'],
    default: '中'
  },
  // 待办相关字段
  isTodo: {
    type: Boolean,
    default: false
  },
  todoStatus: {
    type: String,
    enum: ['待办', '已完成', '已放弃', '已转交'],
    default: '待办'
  },
  // 关联的待办项
  relatedTodo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Todo',
    default: null
  },
  // 状态变更描述
  statusDescription: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 索引优化
diarySchema.index({ user: 1, createdAt: -1 });
diarySchema.index({ user: 1, startTime: 1 });

module.exports = mongoose.model('Diary', diarySchema);