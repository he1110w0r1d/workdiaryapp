const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  sourceSuggestion: { type: mongoose.Schema.Types.ObjectId, ref: 'TodoSuggestion' },
  sourceDiaryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Diary' }],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    enum: ['高', '中', '低'],
    default: '中'
  },
  status: {
    type: String,
    enum: ['待办', '已完成', '已放弃', '已转交'],
    default: '待办'
  },
  dueDate: {
    type: Date,
    required: true
  },
  // 关联的工作日记（如果是从日记创建的待办）
  relatedDiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Diary',
    default: null
  },
  // 状态变更记录
  statusHistory: [{
    status: {
      type: String,
      enum: ['待办', '已完成', '已放弃', '已转交'],
      required: true
    },
    reason: {
      type: String,
      trim: true,
      default: ''
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    // 转交相关信息
    transferTo: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  // 软删除相关字段
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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
todoSchema.index({ user: 1, status: 1, createdAt: -1 });
todoSchema.index({ user: 1, dueDate: 1 });
todoSchema.index({ user: 1, priority: 1 });
todoSchema.index({ user: 1, isDeleted: 1 });
todoSchema.index({ isDeleted: 1, deletedAt: 1 });

// 更新时间中间件
todoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Todo', todoSchema);
