const mongoose = require('mongoose');

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