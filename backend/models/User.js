const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const logger = require('../utils/logger');
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  nickname: {
    type: String,
    trim: true,
    default: ''
  },
  bio: {
    type: String,
    trim: true,
    default: '',
    maxlength: 500
  },
  avatar: {
    type: String,
    default: ''
  },
  // 工作信息配置
  workProfile: {
    // 基本身份信息
    industry: {
      type: String,
      trim: true,
      default: ''
    },
    position: {
      type: String,
      trim: true,
      default: ''
    },
    level: {
      type: String,
      enum: ['junior', 'middle', 'senior', 'expert', 'manager', ''],
      default: ''
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    // 工作职责
    responsibilities: [{
      type: String,
      trim: true
    }],
    // 关键绩效指标
    kpiGoals: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000
    },
    // 写作风格偏好
    writingStyle: {
      type: String,
      enum: ['concise', 'reflective', 'data_driven', 'narrative', ''],
      default: ''
    },
    // 总结用途
    summaryPurpose: {
      type: String,
      enum: ['report_up', 'annual_review', 'self_reflection', 'team_sharing', 'promotion', ''],
      default: ''
    },
    // 希望避免的内容
    avoidContent: [{
      type: String,
      enum: ['empty_words', 'exaggeration', 'technical_inaccuracy', 'emotional_expression']
    }],
    // 是否已完成初始配置
    isProfileCompleted: {
      type: Boolean,
      default: false
    },
    // 用户自定义标签
    customTags: [{
      type: String,
      trim: true
    }]
  },
  // LLM配置（用户级别）
  llmConfigs: [{
    name: {
      type: String,
      required: true,
      trim: true,
      default: '默认配置'
    },
    provider: {
      type: String,
      enum: ['local', 'openai', 'anthropic', 'custom'],
      required: true,
      default: 'custom'
    },
    apiKey: {
      type: String,
      default: ''
    },
    apiUrl: {
      type: String,
      default: ''
    },
    model: {
      type: String,
      required: true,
      default: 'deepseek-ai/DeepSeek-V3'
    },
    timeout: {
      type: Number,
      default: 600000
    },
    temperature: {
      type: Number,
      min: 0,
      max: 2,
      default: 0.7
    },
    maxTokens: {
      type: Number,
      default: 8000
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // 定制化提示词
  customPrompts: {
    daily: {
      type: String,
      default: ''
    },
    monthly: {
      type: String,
      default: ''
    },
    yearly: {
      type: String,
      default: ''
    }
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

// 密码加密中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// 密码比较方法
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);