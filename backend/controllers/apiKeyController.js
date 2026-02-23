const ApiKey = require('../models/ApiKey');
const logger = require('../utils/logger');

exports.createApiKey = async (req, res) => {
  try {
    const { name, scopes, expiresAt } = req.body;
    const userId = req.user._id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'API Key名称不能为空' });
    }

    const existingCount = await ApiKey.countDocuments({ user: userId, isActive: true });
    if (existingCount >= 10) {
      return res.status(400).json({ message: '每个用户最多只能创建10个API Key' });
    }

    const rawApiKey = ApiKey.generateApiKey();
    const keyHash = ApiKey.hashApiKey(rawApiKey);
    const keyPrefix = ApiKey.getKeyPrefix(rawApiKey);

    const validScopes = scopes && Array.isArray(scopes) && scopes.length > 0 
      ? scopes 
      : ['all'];

    const apiKeyRecord = new ApiKey({
      user: userId,
      name: name.trim(),
      keyPrefix,
      keyHash,
      scopes: validScopes,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    await apiKeyRecord.save();

    logger.info(`API Key created for user ${userId}: ${keyPrefix}`);

    res.status(201).json({
      message: 'API Key创建成功',
      apiKey: {
        id: apiKeyRecord._id,
        name: apiKeyRecord.name,
        key: rawApiKey,
        keyPrefix: apiKeyRecord.keyPrefix,
        scopes: apiKeyRecord.scopes,
        expiresAt: apiKeyRecord.expiresAt,
        createdAt: apiKeyRecord.createdAt
      },
      warning: '请立即保存此API Key，它只会显示一次！'
    });
  } catch (error) {
    logger.error('创建API Key失败:', error);
    res.status(500).json({ message: '创建API Key失败', error: error.message });
  }
};

exports.listApiKeys = async (req, res) => {
  try {
    const userId = req.user._id;

    const apiKeys = await ApiKey.find({ user: userId })
      .select('-keyHash')
      .sort({ createdAt: -1 });

    res.json({
      apiKeys: apiKeys.map(key => ({
        id: key._id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scopes: key.scopes,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        usageCount: key.usageCount,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt
      }))
    });
  } catch (error) {
    logger.error('获取API Key列表失败:', error);
    res.status(500).json({ message: '获取API Key列表失败', error: error.message });
  }
};

exports.deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const apiKey = await ApiKey.findOne({ _id: id, user: userId });
    if (!apiKey) {
      return res.status(404).json({ message: 'API Key不存在' });
    }

    await ApiKey.deleteOne({ _id: id });

    logger.info(`API Key deleted for user ${userId}: ${apiKey.keyPrefix}`);

    res.json({ message: 'API Key已删除' });
  } catch (error) {
    logger.error('删除API Key失败:', error);
    res.status(500).json({ message: '删除API Key失败', error: error.message });
  }
};

exports.toggleApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const apiKey = await ApiKey.findOne({ _id: id, user: userId });
    if (!apiKey) {
      return res.status(404).json({ message: 'API Key不存在' });
    }

    apiKey.isActive = !apiKey.isActive;
    await apiKey.save();

    logger.info(`API Key ${apiKey.isActive ? 'activated' : 'deactivated'} for user ${userId}: ${apiKey.keyPrefix}`);

    res.json({ 
      message: apiKey.isActive ? 'API Key已启用' : 'API Key已禁用',
      isActive: apiKey.isActive
    });
  } catch (error) {
    logger.error('切换API Key状态失败:', error);
    res.status(500).json({ message: '切换API Key状态失败', error: error.message });
  }
};

exports.updateApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, scopes } = req.body;
    const userId = req.user._id;

    const apiKey = await ApiKey.findOne({ _id: id, user: userId });
    if (!apiKey) {
      return res.status(404).json({ message: 'API Key不存在' });
    }

    if (name && name.trim() !== '') {
      apiKey.name = name.trim();
    }

    if (scopes && Array.isArray(scopes) && scopes.length > 0) {
      apiKey.scopes = scopes;
    }

    await apiKey.save();

    logger.info(`API Key updated for user ${userId}: ${apiKey.keyPrefix}`);

    res.json({
      message: 'API Key已更新',
      apiKey: {
        id: apiKey._id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        isActive: apiKey.isActive,
        lastUsedAt: apiKey.lastUsedAt,
        usageCount: apiKey.usageCount,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt
      }
    });
  } catch (error) {
    logger.error('更新API Key失败:', error);
    res.status(500).json({ message: '更新API Key失败', error: error.message });
  }
};
