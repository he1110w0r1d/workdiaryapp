const fs = require('fs');
const path = require('path');
const axios = require('axios');
const User = require('../models/User');

const logger = require('../utils/logger');
// 设置文件路径
const settingsFilePath = path.join(__dirname, '../config/llm-settings.json');

// 确保config目录存在
const ensureConfigDir = () => {
  const configDir = path.join(__dirname, '../config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
};

// 注意：API密钥现在以明文形式存储（适用于局域网内部使用）

// 获取用户LLM配置
exports.getUserLLMConfigs = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('llmConfigs');
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 解密API密钥后返回
    const configs = user.llmConfigs.map(config => ({
      ...config.toObject(),
      apiKey: config.apiKey ? '***已设置***' : '' // 不返回真实密钥，只显示是否已设置
    }));

    return res.json({ configs });
  } catch (error) {
    logger.error('获取用户LLM配置失败:', error);
    return res.status(500).json({ message: '获取LLM配置失败' });
  }
};

// 保存用户LLM配置
exports.saveUserLLMConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, provider, apiKey, apiUrl, model, timeout, temperature, maxTokens, isDefault } = req.body;

    logger.llm('=== 添加新LLM配置 ===');
    logger.info('用户ID:', userId);
    logger.info('请求数据:', { name, provider, model, isDefault });

    // 验证必填字段
    if (!name || !provider || !model) {
      return res.status(400).json({ message: '配置名称、提供商和模型不能为空' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    logger.info('添加前现有配置数量:', user.llmConfigs.length);

    // 新添加的配置自动设置为默认配置，取消其他配置的默认状态
    user.llmConfigs.forEach(config => {
      config.isDefault = false;
    });

    // 添加新配置
    const newConfig = {
      name,
      provider,
      apiKey: apiKey || '',
      apiUrl: apiUrl || '',
      model,
      timeout: timeout || 600000,
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 8000,
      isDefault: true, // 新添加的配置自动设置为默认
      isActive: true
    };

    logger.info('新配置:', newConfig);

    user.llmConfigs.push(newConfig);
    
    logger.info('=== 保存到数据库前的数据跟踪 ===');
    logger.info('用户ID:', user._id);
    logger.info('即将保存的完整llmConfigs数组:', JSON.stringify(user.llmConfigs, null, 2));
    logger.info('llmConfigs数组长度:', user.llmConfigs.length);
    
    await user.save();

    logger.info('保存成功，新配置ID:', newConfig._id);
    logger.info('添加后配置数量:', user.llmConfigs.length);

    return res.json({ message: 'LLM配置保存成功', configId: newConfig._id });
  } catch (error) {
    logger.error('保存用户LLM配置失败:', error);
    return res.status(500).json({ message: '保存LLM配置失败' });
  }
};

// 更新用户LLM配置
exports.updateUserLLMConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { configId } = req.params;
    const { name, provider, apiKey, apiUrl, model, timeout, temperature, maxTokens, isDefault, isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const config = user.llmConfigs.id(configId);
    if (!config) {
      return res.status(404).json({ message: 'LLM配置不存在' });
    }

    // 如果设置为默认配置，先取消其他配置的默认状态
    if (isDefault) {
      user.llmConfigs.forEach(c => {
        if (c._id.toString() !== configId) {
          c.isDefault = false;
        }
      });
    }

    // 更新配置
    if (name) config.name = name;
    if (provider) config.provider = provider;
    if (apiKey) config.apiKey = apiKey;
    if (apiUrl !== undefined) config.apiUrl = apiUrl;
    if (model) config.model = model;
    if (timeout) config.timeout = timeout;
    if (temperature !== undefined) config.temperature = temperature;
    if (maxTokens) config.maxTokens = maxTokens;
    if (isDefault !== undefined) config.isDefault = isDefault;
    if (isActive !== undefined) config.isActive = isActive;

    await user.save();

    return res.json({ message: 'LLM配置更新成功' });
  } catch (error) {
    logger.error('更新用户LLM配置失败:', error);
    return res.status(500).json({ message: '更新LLM配置失败' });
  }
};

// 删除用户LLM配置
exports.deleteUserLLMConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { configId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const config = user.llmConfigs.id(configId);
    if (!config) {
      return res.status(404).json({ message: 'LLM配置不存在' });
    }

    // 允许删除所有配置

    // 如果删除的是默认配置，且还有其他配置，将第一个配置设为默认
    const wasDefault = config.isDefault;
    user.llmConfigs.pull(configId);
    
    if (wasDefault && user.llmConfigs.length > 0) {
      user.llmConfigs[0].isDefault = true;
    }

    await user.save();

    return res.json({ message: 'LLM配置删除成功' });
  } catch (error) {
    logger.error('删除用户LLM配置失败:', error);
    return res.status(500).json({ message: '删除LLM配置失败' });
  }
};

// 获取用户默认LLM配置（供其他模块使用）
exports.getUserDefaultLLMConfig = async (userId) => {
  try {
    const user = await User.findById(userId).select('llmConfigs');
    if (!user || !user.llmConfigs.length) {
      return null;
    }

    // 查找默认配置
    let defaultConfig = user.llmConfigs.find(config => config.isDefault && config.isActive);
    
    // 如果没有默认配置，使用第一个激活的配置
    if (!defaultConfig) {
      defaultConfig = user.llmConfigs.find(config => config.isActive);
    }

    if (!defaultConfig) {
      return null;
    }

    // 直接返回配置（API密钥已为明文）
    return defaultConfig.toObject();
  } catch (error) {
    logger.error('获取用户默认LLM配置失败:', error);
    return null;
  }
};

// 测试用户LLM配置
exports.testUserLLMConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { configId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const config = user.llmConfigs.id(configId);
    if (!config) {
      return res.status(404).json({ message: 'LLM配置不存在' });
    }

    // 直接使用配置（API密钥已为明文）
    const decryptedConfig = config.toObject();

    // 根据提供商类型测试连接
    if (config.provider === 'local') {
      await testLocalLLM({
        apiUrl: config.apiUrl,
        model: config.model,
        timeout: config.timeout,
        temperature: config.temperature
      }, res);
    } else {
      await testExternalLLM({
        externalProvider: config.provider,
        externalApiKey: decryptedConfig.apiKey,
        externalApiUrl: config.apiUrl,
        externalModel: config.model,
        externalTimeout: config.timeout,
        externalTemperature: config.temperature,
        externalMaxTokens: config.maxTokens
      }, res);
    }
  } catch (error) {
    logger.error('测试用户LLM配置失败:', error);
    return res.status(500).json({ message: '测试LLM配置失败' });
  }
};

// 获取默认设置
const getDefaultSettings = () => {
  return {
    // LLM类型：local（本地）或 external（外部）
    llmType: process.env.LLM_TYPE || 'local',
    
    // 本地LLM设置
    useLocalLLM: process.env.USE_LOCAL_LLM === 'true',
    apiUrl: process.env.LOCAL_LLM_API_URL || 'http://localhost:11434/api/generate',
    model: process.env.LOCAL_LLM_MODEL || 'qwen3:4b',
    timeout: parseInt(process.env.LOCAL_LLM_TIMEOUT || '600000'),
    temperature: parseFloat(process.env.LOCAL_LLM_TEMPERATURE || '0.7'),
    
    // 外部LLM设置
    externalProvider: process.env.EXTERNAL_LLM_PROVIDER || '自定义',
    externalApiKey: process.env.EXTERNAL_LLM_API_KEY || '',
    externalApiUrl: process.env.EXTERNAL_LLM_API_URL || 'https://api.siliconflow.cn/v1/chat/completions',
    externalModel: process.env.EXTERNAL_LLM_MODEL || 'deepseek-ai/DeepSeek-V3',
    externalTimeout: parseInt(process.env.EXTERNAL_LLM_TIMEOUT || '600000'),
    externalTemperature: parseFloat(process.env.EXTERNAL_LLM_TEMPERATURE || '0.7'),
    externalMaxTokens: parseInt(process.env.EXTERNAL_LLM_MAX_TOKENS || '2000')
  };
};

// 获取LLM设置
exports.getLLMSettings = async (req, res) => {
  try {
    ensureConfigDir();
    
    // 检查设置文件是否存在
    if (fs.existsSync(settingsFilePath)) {
      const settingsData = fs.readFileSync(settingsFilePath, 'utf8');
      const settings = JSON.parse(settingsData);
      return res.json(settings);
    } else {
      // 返回默认设置
      const defaultSettings = getDefaultSettings();
      return res.json(defaultSettings);
    }
  } catch (error) {
    logger.error('获取LLM设置失败:', error);
    return res.status(500).json({ message: '获取LLM设置失败' });
  }
};

// 保存LLM设置
exports.saveLLMSettings = async (req, res) => {
  try {
    ensureConfigDir();
    
    const settings = req.body;
    
    // 验证设置数据
    if (settings.model === 'custom' && !settings.customModel) {
      return res.status(400).json({ message: '自定义模型名称不能为空' });
    }
    
    // 如果是自定义模型，使用customModel字段的值
    if (settings.model === 'custom' && settings.customModel) {
      settings.model = settings.customModel;
      delete settings.customModel;
    }
    
    // 保存设置到文件
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    
    // 更新环境变量
    process.env.LLM_TYPE = settings.llmType || 'local';
    process.env.USE_LOCAL_LLM = String(settings.useLocalLLM);
    process.env.LOCAL_LLM_API_URL = settings.apiUrl;
    process.env.LOCAL_LLM_MODEL = settings.model;
    process.env.LOCAL_LLM_TIMEOUT = String(settings.timeout);
    process.env.LOCAL_LLM_TEMPERATURE = String(settings.temperature);
    
    // 外部LLM环境变量
    if (settings.externalProvider) process.env.EXTERNAL_LLM_PROVIDER = settings.externalProvider;
    if (settings.externalApiKey) process.env.EXTERNAL_LLM_API_KEY = settings.externalApiKey;
    if (settings.externalApiUrl) process.env.EXTERNAL_LLM_API_URL = settings.externalApiUrl;
    if (settings.externalModel) process.env.EXTERNAL_LLM_MODEL = settings.externalModel;
    if (settings.externalTimeout) process.env.EXTERNAL_LLM_TIMEOUT = String(settings.externalTimeout);
    if (settings.externalTemperature) process.env.EXTERNAL_LLM_TEMPERATURE = String(settings.externalTemperature);
    if (settings.externalMaxTokens) process.env.EXTERNAL_LLM_MAX_TOKENS = String(settings.externalMaxTokens);
    
    return res.json({ message: '设置保存成功' });
  } catch (error) {
    logger.error('保存LLM设置失败:', error);
    return res.status(500).json({ message: '保存LLM设置失败' });
  }
};

// 测试LLM连接
exports.testLLMConnection = async (req, res) => {
  try {
    const settings = req.body;
    const llmType = settings.llmType || 'local';
    
    if (llmType === 'local') {
      return await testLocalLLM(settings, res);
    } else if (llmType === 'external') {
      return await testExternalLLM(settings, res);
    } else {
      return res.status(400).json({ success: false, message: '不支持的LLM类型' });
    }
  } catch (error) {
    logger.error('测试LLM连接失败:', error);
    
    // 构建错误消息
    let errorMessage = '连接失败';
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = '连接被拒绝，请检查API地址和端口是否正确';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = '连接超时，请检查API地址是否可访问';
    } else if (error.response) {
      errorMessage = `服务器返回错误: ${error.response.status} ${error.response.statusText}`;
      if (error.response.data && error.response.data.error) {
        errorMessage += ` - ${error.response.data.error}`;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return res.status(500).json({ success: false, message: errorMessage });
  }
};

// 测试本地LLM连接
const testLocalLLM = async (settings, res) => {
  // 验证设置数据
  if (!settings.apiUrl) {
    return res.status(400).json({ success: false, message: 'API地址不能为空' });
  }
  
  if (!settings.model) {
    return res.status(400).json({ success: false, message: '模型名称不能为空' });
  }
  
  // 如果是自定义模型，使用customModel字段的值
  const modelName = settings.model === 'custom' ? settings.customModel : settings.model;
  
  if (settings.model === 'custom' && !settings.customModel) {
    return res.status(400).json({ success: false, message: '自定义模型名称不能为空' });
  }
  
  // 创建测试请求
  const testPrompt = '你好，这是一个测试消息。请回复"连接测试成功"。';
  
  // 设置请求超时
  const timeout = settings.timeout || 30000;
  
  // 发送测试请求
  const response = await axios.post(settings.apiUrl, {
    model: modelName,
    prompt: testPrompt,
    temperature: settings.temperature || 0.7,
    stream: false
  }, {
    timeout: timeout
  });
  
  // 检查响应
  if (response.data && response.data.response) {
    return res.json({ 
      success: true, 
      message: '连接成功，模型响应: ' + response.data.response.substring(0, 50) + '...' 
    });
  } else {
    return res.json({ 
      success: false, 
      message: '连接成功但响应格式不正确' 
    });
  }
};

// 测试外部LLM连接
const testExternalLLM = async (settings, res) => {
  // 验证设置数据
  if (!settings.externalProvider) {
    return res.status(400).json({ success: false, message: '请选择外部LLM提供商' });
  }
  
  if (!settings.externalApiKey) {
    return res.status(400).json({ success: false, message: 'API密钥不能为空' });
  }
  
  if (!settings.externalModel) {
    return res.status(400).json({ success: false, message: '模型名称不能为空' });
  }
  
  const provider = settings.externalProvider;
  const testMessage = '你好，这是一个测试消息。请回复"连接测试成功"。';
  const timeout = settings.externalTimeout || 30000;
  
  let requestConfig = {
    timeout: timeout,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  let requestData = {};
  let apiUrl = '';
  
  // 根据不同提供商构建请求
  switch (provider) {
    case 'openai':
      apiUrl = settings.externalApiUrl || 'https://api.openai.com/v1/chat/completions';
      requestConfig.headers['Authorization'] = `Bearer ${settings.externalApiKey}`;
      requestData = {
        model: settings.externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature: settings.externalTemperature || 0.7,
        max_tokens: settings.externalMaxTokens || 100
      };
      break;
      
    case 'claude':
      apiUrl = settings.externalApiUrl || 'https://api.anthropic.com/v1/messages';
      requestConfig.headers['x-api-key'] = settings.externalApiKey;
      requestConfig.headers['anthropic-version'] = '2023-06-01';
      requestData = {
        model: settings.externalModel,
        max_tokens: settings.externalMaxTokens || 100,
        messages: [{ role: 'user', content: testMessage }],
        temperature: settings.externalTemperature || 0.7
      };
      break;
      
    case 'qianwen':
      apiUrl = settings.externalApiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
      requestConfig.headers['Authorization'] = `Bearer ${settings.externalApiKey}`;
      requestData = {
        model: settings.externalModel,
        input: {
          messages: [{ role: 'user', content: testMessage }]
        },
        parameters: {
          temperature: settings.externalTemperature || 0.7,
          max_tokens: settings.externalMaxTokens || 100
        }
      };
      break;
      
    case 'custom':
      if (!settings.externalApiUrl) {
        return res.status(400).json({ success: false, message: '自定义API地址不能为空' });
      }
      apiUrl = settings.externalApiUrl;
      requestConfig.headers['Authorization'] = `Bearer ${settings.externalApiKey}`;
      requestData = {
        model: settings.externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature: settings.externalTemperature || 0.7,
        max_tokens: settings.externalMaxTokens || 100
      };
      break;
      
    default:
      return res.status(400).json({ success: false, message: '不支持的外部LLM提供商' });
  }
  
  // 发送测试请求
  const response = await axios.post(apiUrl, requestData, requestConfig);
  
  // 检查响应
  let responseText = '';
  
  switch (provider) {
    case 'openai':
    case 'custom':
      if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        responseText = response.data.choices[0].message.content;
      }
      break;
      
    case 'claude':
      if (response.data && response.data.content && response.data.content[0] && response.data.content[0].text) {
        responseText = response.data.content[0].text;
      }
      break;
      
    case 'qianwen':
      if (response.data && response.data.output && response.data.output.text) {
        responseText = response.data.output.text;
      }
      break;
  }
  
  if (responseText) {
    return res.json({ 
      success: true, 
      message: '连接成功，模型响应: ' + responseText.substring(0, 50) + '...' 
    });
  } else {
    return res.json({ 
      success: false, 
      message: '连接成功但响应格式不正确' 
    });
  }
};

// 设置默认用户LLM配置
exports.setDefaultUserLLMConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { configId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 检查配置是否存在
    const configExists = user.llmConfigs.some(config => config._id.toString() === configId);
    if (!configExists) {
      return res.status(404).json({ message: '配置不存在' });
    }

    // 将所有配置的isDefault设为false
    user.llmConfigs.forEach(config => {
      config.isDefault = false;
    });

    // 将指定配置的isDefault设为true
    const targetConfig = user.llmConfigs.find(config => config._id.toString() === configId);
    if (targetConfig) {
      targetConfig.isDefault = true;
    }

    await user.save();

    return res.json({ message: '默认配置设置成功' });
  } catch (error) {
    logger.error('设置默认配置失败:', error);
    return res.status(500).json({ message: '设置默认配置失败' });
  }
};