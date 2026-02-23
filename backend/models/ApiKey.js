const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  // 关联用户
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // API Key名称（用于标识）
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  // API Key的前缀（用于展示，如 "wdk_abc..."）
  keyPrefix: {
    type: String,
    required: true
  },
  // API Key的哈希值（存储加密后的key）
  keyHash: {
    type: String,
    required: true
  },
  // 权限范围
  scopes: [{
    type: String,
    enum: ['diary:read', 'diary:write', 'todo:read', 'todo:write', 'summary:read', 'all'],
    default: ['all']
  }],
  // 上次使用时间
  lastUsedAt: {
    type: Date,
    default: null
  },
  // 使用次数统计
  usageCount: {
    type: Number,
    default: 0
  },
  // 是否激活
  isActive: {
    type: Boolean,
    default: true
  },
  // 过期时间（可选，null表示永不过期）
  expiresAt: {
    type: Date,
    default: null
  },
  // 创建时间
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 索引：用于快速查找
apiKeySchema.index({ keyHash: 1 });
apiKeySchema.index({ user: 1, isActive: 1 });

// 静态方法：生成新的API Key
apiKeySchema.statics.generateApiKey = function() {
  // 生成32字节的随机密钥
  const rawKey = crypto.randomBytes(32).toString('hex');
  // 添加前缀以便识别
  const apiKey = `wdk_${rawKey}`;
  return apiKey;
};

// 静态方法：对API Key进行哈希
apiKeySchema.statics.hashApiKey = function(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
};

// 静态方法：获取API Key前缀（用于展示）
apiKeySchema.statics.getKeyPrefix = function(apiKey) {
  // 返回前12个字符作为前缀展示
  return apiKey.substring(0, 12) + '...';
};

// 静态方法：通过API Key查找记录
apiKeySchema.statics.findByApiKey = async function(apiKey) {
  const keyHash = this.hashApiKey(apiKey);
  const apiKeyRecord = await this.findOne({ 
    keyHash, 
    isActive: true 
  }).populate('user');
  
  if (!apiKeyRecord) return null;
  
  // 检查是否过期
  if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
    apiKeyRecord.isActive = false;
    await apiKeyRecord.save();
    return null;
  }
  
  return apiKeyRecord;
};

// 实例方法：更新使用统计
apiKeySchema.methods.recordUsage = async function() {
  this.lastUsedAt = new Date();
  this.usageCount += 1;
  await this.save();
};

// 实例方法：检查是否有指定权限
apiKeySchema.methods.hasScope = function(requiredScope) {
  if (this.scopes.includes('all')) return true;
  return this.scopes.includes(requiredScope);
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
