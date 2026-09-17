const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const logger = require('../utils/logger');
const axios = require('axios');
const Embeddings = require('../utils/embeddings');

// 导入模型
const Diary = require('../models/Diary');
const Todo = require('../models/Todo');
const Summary = require('../models/Summary');
const User = require('../models/User');

// 获取LLM设置
exports.getLLMSettings = async (req, res) => {
  try {
    const settingsFilePath = path.join(__dirname, '../config/llm-settings.json');
    
    if (!fs.existsSync(settingsFilePath)) {
      return res.json({
        llmType: 'local',
        useLocalLLM: true,
        apiUrl: '',
        model: '',
        timeout: 30000,
        temperature: 0.7,
        externalProvider: 'openai',
        externalApiKey: '',
        externalApiUrl: '',
        externalModel: '',
        externalTimeout: 30000,
        externalTemperature: 0.7,
        externalMaxTokens: 1000,
        // Embeddings 默认配置
        externalEmbeddingsProvider: process.env.EXTERNAL_EMBEDDINGS_PROVIDER || 'siliconflow',
        externalEmbeddingsApiKey: process.env.EXTERNAL_EMBEDDINGS_API_KEY || '',
        externalEmbeddingsApiUrl: process.env.EXTERNAL_EMBEDDINGS_API_URL || '',
        externalEmbeddingsModel: process.env.EXTERNAL_EMBEDDINGS_MODEL || '',
        externalEmbeddingsTimeout: parseInt(process.env.EXTERNAL_EMBEDDINGS_TIMEOUT || '3600000', 10)
      });
    }
    
    const settingsData = fs.readFileSync(settingsFilePath, 'utf8');
    const settings = JSON.parse(settingsData);
    
    return res.json(settings);
  } catch (error) {
    logger.error('获取LLM设置失败:', error);
    return res.status(500).json({ message: '获取LLM设置失败' });
  }
};

// 保存LLM设置
exports.saveLLMSettings = async (req, res) => {
  try {
    const settings = req.body;
    const settingsFilePath = path.join(__dirname, '../config/llm-settings.json');
    const configDir = path.dirname(settingsFilePath);
    
    // 确保配置目录存在
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // 保存设置到文件
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    
    // 更新环境变量
    if (settings.llmType) process.env.LLM_TYPE = settings.llmType;
    if (settings.useLocalLLM !== undefined) process.env.USE_LOCAL_LLM = String(settings.useLocalLLM);
    if (settings.apiUrl) process.env.LOCAL_LLM_API_URL = settings.apiUrl;
    if (settings.model) process.env.LOCAL_LLM_MODEL = settings.model;
    if (settings.timeout) process.env.LOCAL_LLM_TIMEOUT = String(settings.timeout);
    if (settings.temperature) process.env.LOCAL_LLM_TEMPERATURE = String(settings.temperature);
    if (settings.externalProvider) process.env.EXTERNAL_LLM_PROVIDER = settings.externalProvider;
    if (settings.externalApiKey) process.env.EXTERNAL_LLM_API_KEY = settings.externalApiKey;
    if (settings.externalApiUrl) process.env.EXTERNAL_LLM_API_URL = settings.externalApiUrl;
    if (settings.externalModel) process.env.EXTERNAL_LLM_MODEL = settings.externalModel;
    if (settings.externalTimeout) process.env.EXTERNAL_LLM_TIMEOUT = String(settings.externalTimeout);
    if (settings.externalTemperature) process.env.EXTERNAL_LLM_TEMPERATURE = String(settings.externalTemperature);
    if (settings.externalMaxTokens) process.env.EXTERNAL_LLM_MAX_TOKENS = String(settings.externalMaxTokens);

    // Embeddings 环境变量
    if (settings.externalEmbeddingsProvider) process.env.EXTERNAL_EMBEDDINGS_PROVIDER = settings.externalEmbeddingsProvider;
    if (settings.externalEmbeddingsApiKey) process.env.EXTERNAL_EMBEDDINGS_API_KEY = settings.externalEmbeddingsApiKey;
    if (settings.externalEmbeddingsApiUrl) process.env.EXTERNAL_EMBEDDINGS_API_URL = settings.externalEmbeddingsApiUrl;
    if (settings.externalEmbeddingsModel) process.env.EXTERNAL_EMBEDDINGS_MODEL = settings.externalEmbeddingsModel;
    if (settings.externalEmbeddingsTimeout) process.env.EXTERNAL_EMBEDDINGS_TIMEOUT = String(settings.externalEmbeddingsTimeout);
    
    logger.info('LLM设置已保存并更新环境变量');
    return res.json({ message: 'LLM设置保存成功' });
  } catch (error) {
    logger.error('保存LLM设置失败:', error);
    return res.status(500).json({ message: '保存LLM设置失败' });
  }
};

// 测试LLM连接
exports.testLLMConnection = async (req, res) => {
  try {
    const settings = req.body;
    
    if (settings.llmType === 'external') {
      // 测试外部LLM连接
      await testExternalLLM(settings, res);
    } else {
      // 测试本地LLM连接
      if (!settings.apiUrl) {
        return res.status(400).json({ success: false, message: 'API地址不能为空' });
      }
      
      if (!settings.model) {
        return res.status(400).json({ success: false, message: '模型名称不能为空' });
      }
      
      const timeout = settings.timeout || 30000;
      
      try {
        const response = await axios.post(settings.apiUrl, {
          model: settings.model,
          messages: [{ role: 'user', content: '你好，这是一个测试消息。请回复"连接测试成功"。' }],
          temperature: settings.temperature || 0.7,
          max_tokens: 100
        }, {
          timeout: timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data && response.data.choices && response.data.choices[0]) {
          return res.json({ 
            success: true, 
            message: '连接成功，模型响应: ' + response.data.choices[0].message.content.substring(0, 200) + '...' 
          });
        } else {
          return res.json({ 
            success: false, 
            message: '连接成功但响应格式不正确' 
          });
        }
      } catch (error) {
        logger.error('测试本地LLM连接失败:', error);
        return res.status(500).json({ 
          success: false, 
          message: '测试LLM连接失败: ' + (error.response?.data?.message || error.message) 
        });
      }
    }
  } catch (error) {
    logger.error('测试LLM连接失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: '测试LLM连接失败: ' + error.message 
    });
  }
};

// 获取用户LLM配置列表
exports.getUserLLMConfigs = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    return res.json({ configs: user.llmConfigs });
  } catch (error) {
    logger.error('获取用户LLM配置失败:', error);
    return res.status(500).json({ message: '获取用户LLM配置失败' });
  }
};

// 保存用户LLM配置
exports.saveUserLLMConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const configData = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 创建新配置
    const newConfig = {
      name: configData.name,
      provider: configData.provider,
      apiKey: configData.apiKey,
      model: configData.model,
      apiUrl: configData.apiUrl,
      timeout: configData.timeout || 30000,
      temperature: configData.temperature || 0.7,
      maxTokens: configData.maxTokens || 32000,
      isDefault: configData.isDefault || false,
      createdAt: new Date()
    };
    
    // 如果设置为默认配置，先取消其他配置的默认状态
    if (newConfig.isDefault) {
      user.llmConfigs.forEach(config => {
        config.isDefault = false;
      });
    }
    
    user.llmConfigs.push(newConfig);
    await user.save();
    
    return res.json({ message: '配置保存成功', config: newConfig });
  } catch (error) {
    logger.error('保存用户LLM配置失败:', error);
    return res.status(500).json({ message: '保存用户LLM配置失败' });
  }
};

// 更新用户LLM配置
exports.updateUserLLMConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { configId } = req.params;
    const configData = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 查找配置
    const config = user.llmConfigs.id(configId);
    if (!config) {
      return res.status(404).json({ message: '配置不存在' });
    }
    
    // 更新配置
    config.name = configData.name || config.name;
    config.provider = configData.provider || config.provider;
    config.apiKey = configData.apiKey || config.apiKey;
    config.model = configData.model || config.model;
    config.apiUrl = configData.apiUrl || config.apiUrl;
    config.timeout = configData.timeout || config.timeout;
    config.temperature = configData.temperature || config.temperature;
    config.maxTokens = configData.maxTokens || config.maxTokens;
    config.updatedAt = new Date();
    
    // 处理默认配置设置
    if (configData.isDefault !== undefined) {
      if (configData.isDefault) {
        // 设置为默认配置，先取消其他配置的默认状态
        user.llmConfigs.forEach(c => {
          if (c._id.toString() !== configId) {
            c.isDefault = false;
          }
        });
      }
      config.isDefault = configData.isDefault;
    }
    
    await user.save();
    
    return res.json({ message: '配置更新成功', config });
  } catch (error) {
    logger.error('更新用户LLM配置失败:', error);
    return res.status(500).json({ message: '更新用户LLM配置失败' });
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
    
    // 查找配置索引
    const configIndex = user.llmConfigs.findIndex(config => config._id.toString() === configId);
    if (configIndex === -1) {
      return res.status(404).json({ message: '配置不存在' });
    }
    
    // 删除配置
    user.llmConfigs.splice(configIndex, 1);
    await user.save();
    
    return res.json({ message: '配置删除成功' });
  } catch (error) {
    logger.error('删除用户LLM配置失败:', error);
    return res.status(500).json({ message: '删除用户LLM配置失败' });
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
  
  // 统一规范提供商值，避免大小写或前后空格造成不匹配
  const provider = String(settings.externalProvider || '')
    .toLowerCase()
    .trim();
  // 同步清理关键字段，避免携带不可见字符导致 400
  const externalModel = String(settings.externalModel || '').trim();
  const externalApiUrl = String(settings.externalApiUrl || '').trim();
  const externalApiKeyRaw = String(settings.externalApiKey || '').trim();
  const testMessage = '你好，这是一个测试消息。请回复"连接测试成功"。';
  const timeout = settings.externalTimeout || 30000;
  // const requestedMaxTokens = parseInt(settings.externalMaxTokens || 32000, 10);
  // 针对 externalMaxTokens 做健壮处理，避免空字符串/非法值变 NaN 导致 400
  const rawMaxTokens = settings.externalMaxTokens;
  let requestedMaxTokens = Number.parseInt(String(rawMaxTokens || '').trim(), 10);
  if (!Number.isFinite(requestedMaxTokens) || requestedMaxTokens <= 0) {
    requestedMaxTokens = provider === 'deepseek' ? 1024 : 2048;
  }
  // 针对DeepSeek等提供商进行安全限制，避免因超大max_tokens导致400
  const safeMaxTokens = provider === 'deepseek' ? Math.min(requestedMaxTokens, 4096) : requestedMaxTokens;
  const temperature = settings.externalTemperature || 0.7;

  // 兼容常见别名与错误URL，降低配置错误导致的400/500
  let normalizedModel = externalModel;
  let normalizedApiUrl = externalApiUrl;

  // 针对 DeepSeek：将常见OpenRouter别名映射为官方模型名
  if (provider === 'deepseek') {
    const m = normalizedModel.toLowerCase();
    if (m.includes('deepseek-ai/deepseek-v3') || m.includes('deepseek-v3') || m.includes('deepseek/v3')) {
      normalizedModel = 'deepseek-chat';
    }
    if (m.includes('deepseek-ai/deepseek-reasoner') || m === 'deepseek-reasoner') {
      normalizedModel = 'deepseek-reasoner';
    }
    // 如果误填了 OpenRouter 的地址，强制回退到 DeepSeek 官方地址
    if (!normalizedApiUrl || /openrouter\.ai/i.test(normalizedApiUrl)) {
      normalizedApiUrl = 'https://api.deepseek.com/v1/chat/completions';
    }
  }

  // 针对 OpenRouter：如误填 DeepSeek 官方地址，回退到 OpenRouter
  if (provider === 'openrouter') {
    if (!normalizedApiUrl || /deepseek\.com/i.test(normalizedApiUrl)) {
      normalizedApiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    }
  }
  
  let requestConfig = {
    timeout: timeout,
    headers: {
      'Content-Type': 'application/json'
    },
    // 禁用环境代理，避免企业/系统代理导致的TLS/连接问题
    proxy: false
  };
  
  let requestData = {};
  let apiUrl = '';
  
  // 根据不同提供商构建请求
  switch (provider) {
    case 'openai':
      apiUrl = externalApiUrl || 'https://api.openai.com/v1/chat/completions';
      // 确保API密钥是有效的字符串且不包含无效字符
      const openaiApiKey = externalApiKeyRaw;
      if (!openaiApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${openaiApiKey}`;
      requestData = {
        model: externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature,
        max_tokens: safeMaxTokens
      };
      break;
      
    case 'claude':
      apiUrl = externalApiUrl || 'https://api.anthropic.com/v1/messages';
      // 确保API密钥是有效的字符串且不包含无效字符
      const claudeApiKey = externalApiKeyRaw;
      if (!claudeApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['x-api-key'] = claudeApiKey;
      requestConfig.headers['anthropic-version'] = '2023-06-01';
      requestData = {
        model: externalModel,
        max_tokens: safeMaxTokens,
        messages: [{ role: 'user', content: testMessage }],
        temperature
      };
      break;
      
    case 'qianwen':
      apiUrl = externalApiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
      // 确保API密钥是有效的字符串且不包含无效字符
      const qianwenApiKey = externalApiKeyRaw;
      if (!qianwenApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${qianwenApiKey}`;
      requestData = {
        model: externalModel,
        input: {
          messages: [{ role: 'user', content: testMessage }]
        },
        parameters: {
          temperature,
          max_tokens: safeMaxTokens
        }
      };
      break;
      
    case 'openrouter':
      apiUrl = normalizedApiUrl || 'https://openrouter.ai/api/v1/chat/completions';
      const openrouterApiKey = externalApiKeyRaw;
      if (!openrouterApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${openrouterApiKey}`;
      requestConfig.headers['HTTP-Referer'] = 'https://workdiaryapp.com';
      requestConfig.headers['X-Title'] = 'Work Diary App';
      requestData = {
        model: normalizedModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature,
        max_tokens: safeMaxTokens
      };
      break;
      
    case 'deepseek':
      apiUrl = normalizedApiUrl || 'https://api.deepseek.com/v1/chat/completions';
      const deepseekApiKey = externalApiKeyRaw;
      if (!deepseekApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${deepseekApiKey}`;
      requestData = {
        model: normalizedModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature,
        max_tokens: safeMaxTokens
      };
      
      // 添加 DeepSeek 专用调试日志
      logger.info('DeepSeek 请求参数详情', {
        apiUrl,
        model: normalizedModel,
        originalModel: settings.externalModel,
        temperature,
        max_tokens: safeMaxTokens,
        originalMaxTokens: settings.externalMaxTokens,
        apiKeyPrefix: deepseekApiKey.substring(0, 8) + '...',
        requestDataPreview: JSON.stringify(requestData)
      });
      break;
      
    case 'qwen':
      apiUrl = externalApiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
      const qwenApiKey = externalApiKeyRaw;
      if (!qwenApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${qwenApiKey}`;
      requestData = {
        model: externalModel,
        input: {
          messages: [{ role: 'user', content: testMessage }]
        },
        parameters: {
          temperature,
          max_tokens: safeMaxTokens
        }
      };
      break;
      
    case 'doubao':
      apiUrl = externalApiUrl || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      const doubaoApiKey = externalApiKeyRaw;
      if (!doubaoApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${doubaoApiKey}`;
      requestData = {
        model: externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature,
        max_tokens: safeMaxTokens
      };
      break;
      
    case 'siliconflow':
      apiUrl = externalApiUrl || 'https://api.siliconflow.cn/v1/chat/completions';
      const siliconflowApiKey = externalApiKeyRaw;
      if (!siliconflowApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${siliconflowApiKey}`;
      requestData = {
        model: externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature,
        max_tokens: safeMaxTokens
      };
      break;
      
    case 'zhipu':
      apiUrl = externalApiUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      const zhipuApiKey = externalApiKeyRaw;
      if (!zhipuApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${zhipuApiKey}`;
      requestData = {
        model: externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature,
        max_tokens: safeMaxTokens
      };
      break;
      
    case 'custom':
      // 处理自定义提供商
      if (!externalApiUrl) {
        return res.status(400).json({ success: false, message: '自定义API地址不能为空' });
      }
      
      const customApiKey = externalApiKeyRaw;
      if (!customApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      
      apiUrl = externalApiUrl;
      
      // 添加额外的安全检查，确保API密钥不包含无效字符
      try {
        encodeURIComponent(customApiKey);
        requestConfig.headers['Authorization'] = `Bearer ${customApiKey}`;
      } catch (encodingError) {
        logger.error('API密钥编码错误:', encodingError);
        return res.status(400).json({ 
          success: false, 
          message: 'API密钥包含无效字符: ' + encodingError.message 
        });
      }
      
      requestData = {
        model: externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature,
        max_tokens: safeMaxTokens
      };
      break;
      
    default:
      return res.status(400).json({ success: false, message: '不支持的外部LLM提供商' });
  }
  
  try {
    logger.info('发送测试请求到LLM API', { 
      provider, 
      apiUrl, 
      model: settings.externalModel,
      temperature,
      maxTokens: safeMaxTokens,
      hasApiKey: !!settings.externalApiKey,
      apiKeyLength: settings.externalApiKey ? settings.externalApiKey.length : 0
    });
    
    // 发送测试请求
    const response = await axios.post(apiUrl, requestData, requestConfig);
    
    // 检查响应
    let responseText = '';
    
    switch (provider) {
      case 'openai':
      case 'openrouter':
      case 'deepseek':
      case 'doubao':
      case 'siliconflow':
      case 'zhipu':
      case 'custom':
        if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
          responseText = response.data.choices[0].message.content;
        }
        break;
        
      case 'anthropic':
      case 'claude':
        if (response.data && response.data.content && response.data.content[0] && response.data.content[0].text) {
          responseText = response.data.content[0].text;
        }
        break;
        
      case 'qianwen':
      case 'qwen':
        if (response.data && response.data.output && response.data.output.text) {
          responseText = response.data.output.text;
        }
        break;
    }
    
    if (responseText) {
      return res.json({ 
        success: true, 
        message: '连接成功，模型响应: ' + responseText.substring(0, 200) + '...' 
      });
    } else {
      return res.json({ 
        success: false, 
        message: '连接成功但响应格式不正确' 
      });
    }
  } catch (error) {
    // 如果是TLS证书校验问题且无HTTP响应，尝试一次“宽松TLS”重试，仅用于定位问题
    if (!error.response && (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'SELF_SIGNED_CERT_IN_CHAIN' || error.code === 'CERT_HAS_EXPIRED')) {
      try {
        const https = require('https');
        const insecureConfig = { ...requestConfig, httpsAgent: new https.Agent({ rejectUnauthorized: false }) };
        const responseRetry = await axios.post(apiUrl, requestData, insecureConfig);

        let responseText = '';
        switch (provider) {
          case 'openai':
          case 'openrouter':
          case 'deepseek':
          case 'doubao':
          case 'siliconflow':
          case 'zhipu':
          case 'custom':
            if (responseRetry.data && responseRetry.data.choices && responseRetry.data.choices[0] && responseRetry.data.choices[0].message) {
              responseText = responseRetry.data.choices[0].message.content;
            }
            break;
          case 'anthropic':
          case 'claude':
            if (responseRetry.data && responseRetry.data.content && responseRetry.data.content[0] && responseRetry.data.content[0].text) {
              responseText = responseRetry.data.content[0].text;
            }
            break;
          case 'qianwen':
          case 'qwen':
            if (responseRetry.data && responseRetry.data.output && responseRetry.data.output.text) {
              responseText = responseRetry.data.output.text;
            }
            break;
        }

        if (responseText) {
          return res.json({ success: true, message: '连接成功（宽松TLS），模型响应: ' + responseText.substring(0, 200) + '...' });
        }
        return res.json({ success: true, message: '连接成功（宽松TLS）但响应格式不标准' });
      } catch (retryErr) {
        // 将重试错误与原始错误一起记录
        try {
          logger.error('TLS校验失败，宽松TLS重试仍失败', {
            provider,
            apiUrl,
            model: settings.externalModel,
            originalCode: error.code,
            retryMessage: retryErr.message,
            retryStatus: retryErr.response?.status,
          });
        } catch (_) {}
        // 继续走下方标准错误响应逻辑
      }
    }

    const statusCode = error.response?.status || 500;
    const rawData = error.response?.data;
    // 记录更详细的错误，便于排查（包含提供商、地址、模型与返回体摘要）
    try {
      logger.error('测试用户LLM配置失败:', {
        provider,
        apiUrl,
        model: settings.externalModel,
        status: statusCode,
        message: error.message,
        responsePreview: rawData ? JSON.stringify(rawData).substring(0, 500) + '...' : null
      });
    } catch (_) {
      logger.error('测试用户LLM配置失败:', error);
    }

    // 将关键错误信息直接放入 message，便于前端提示
    const briefErrorMsg =
      (rawData && (rawData.error?.message || rawData.message)) ||
      (error.code ? `${error.code}: ${error.message}` : error.message);

    const providerAuthFailure = statusCode === 401 || statusCode === 403;
    const friendlyMessage = providerAuthFailure
      ? '模型服务拒绝了认证，请检查 API 密钥、接口地址和模型访问权限。网站登录仍然有效。'
      : statusCode === 500
        ? `测试LLM配置失败（网络/连接错误）: ${briefErrorMsg}`
        : `测试LLM配置失败（${statusCode}）: ${briefErrorMsg}`;

    // A provider's 401 is not a failure of this application's login session.
    // Never forward it as HTTP 401: the browser correctly logs out on app 401s.
    return res.status(error.code === 'ECONNABORTED' ? 504 : 502).json({
      success: false,
      code: providerAuthFailure ? 'MODEL_AUTH_FAILED' : 'MODEL_TEST_FAILED',
      upstreamStatus: error.response?.status || null,
      message: friendlyMessage,
      provider,
      apiUrl,
      model: settings.externalModel,
      error: rawData || { message: error.message }
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

// 获取用户默认LLM配置
exports.getUserDefaultLLMConfig = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }
    
    // 查找默认配置
    const defaultConfig = user.llmConfigs.find(config => config.isDefault && config.isActive);
    if (defaultConfig) {
      return {
        provider: defaultConfig.provider,
        apiKey: defaultConfig.apiKey,
        apiUrl: defaultConfig.apiUrl,
        model: defaultConfig.model,
        timeout: defaultConfig.timeout,
        temperature: defaultConfig.temperature,
        maxTokens: defaultConfig.maxTokens
      };
    }
    
    // 如果没有默认配置，返回第一个活跃配置
    const activeConfig = user.llmConfigs.find(config => config.isActive);
    if (activeConfig) {
      return {
        provider: activeConfig.provider,
        apiKey: activeConfig.apiKey,
        apiUrl: activeConfig.apiUrl,
        model: activeConfig.model,
        timeout: activeConfig.timeout,
        temperature: activeConfig.temperature,
        maxTokens: activeConfig.maxTokens
      };
    }
    
    return null;
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

    // 获取用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 查找指定的配置
    const config = user.llmConfigs.id(configId);
    if (!config) {
      return res.status(404).json({ success: false, message: '配置不存在' });
    }

    // 构建测试设置对象
    const testSettings = {
      externalProvider: config.provider,
      externalApiKey: config.apiKey,
      externalModel: config.model,
      externalApiUrl: config.apiUrl,
      externalTimeout: config.timeout,
      externalTemperature: config.temperature,
      externalMaxTokens: config.maxTokens
    };

    // 调用测试外部LLM函数
    await testExternalLLM(testSettings, res);
  } catch (error) {
    logger.error('测试用户LLM配置失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: '测试用户LLM配置失败: ' + error.message 
    });
  }
};

// 测试嵌入模型连接
exports.testEmbeddingsConnection = async (req, res) => {
  try {
    const {
      externalEmbeddingsProvider,
      externalEmbeddingsApiKey,
      externalEmbeddingsApiUrl,
      externalEmbeddingsModel,
      externalEmbeddingsTimeout
    } = req.body || {};

    if (!externalEmbeddingsProvider) {
      return res.status(400).json({ success: false, message: '请选择嵌入提供商' });
    }
    if (!externalEmbeddingsApiKey) {
      return res.status(400).json({ success: false, message: 'API密钥不能为空' });
    }
    if (!externalEmbeddingsModel) {
      return res.status(400).json({ success: false, message: '模型名称不能为空' });
    }

    const embedder = new Embeddings({
      provider: String(externalEmbeddingsProvider).toLowerCase().trim(),
      apiKey: String(externalEmbeddingsApiKey).trim(),
      apiUrl: String(externalEmbeddingsApiUrl || '').trim(),
      model: String(externalEmbeddingsModel).trim(),
      timeout: parseInt(externalEmbeddingsTimeout || '3600000', 10)
    });

    const vec = await embedder.embed('连接测试 - workdiaryapp');
    if (Array.isArray(vec) && vec.length > 0) {
      return res.json({ success: true, message: '嵌入成功', vectorDimensions: vec.length });
    }
    return res.status(500).json({ success: false, message: '嵌入失败或返回空向量' });
  } catch (error) {
    logger.error('测试嵌入模型连接失败:', error);
    return res.status(500).json({ success: false, message: '测试嵌入模型连接失败: ' + (error.response?.data?.message || error.message) });
  }
};

// ================= 用户级别嵌入配置 =================

// 获取用户嵌入配置列表
exports.getUserEmbeddingConfigs = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('embeddingConfigs').lean();
    if (!user) return res.status(404).json({ message: '用户不存在' });
    return res.json({ configs: user.embeddingConfigs || [] });
  } catch (error) {
    logger.error('获取用户嵌入配置失败:', error);
    return res.status(500).json({ message: '获取用户嵌入配置失败' });
  }
};

// 保存用户嵌入配置
exports.saveUserEmbeddingConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const configData = req.body || {};

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: '用户不存在' });

    const newConfig = {
      name: configData.name || '默认嵌入配置',
      provider: String(configData.provider || 'siliconflow'),
      apiKey: configData.apiKey || '',
      apiUrl: configData.apiUrl || '',
      model: configData.model || 'bge-m3',
      timeout: parseInt(configData.timeout || 60000, 10),
      isDefault: Boolean(configData.isDefault),
      isActive: configData.isActive !== undefined ? Boolean(configData.isActive) : true,
      createdAt: new Date()
    };

    if (newConfig.isDefault) {
      (user.embeddingConfigs || []).forEach(c => { c.isDefault = false; });
    }

    user.embeddingConfigs = user.embeddingConfigs || [];
    user.embeddingConfigs.push(newConfig);
    await user.save();

    return res.json({ message: '嵌入配置保存成功', config: newConfig });
  } catch (error) {
    logger.error('保存用户嵌入配置失败:', error);
    return res.status(500).json({ message: '保存用户嵌入配置失败' });
  }
};

// 更新用户嵌入配置
exports.updateUserEmbeddingConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { configId } = req.params;
    const configData = req.body || {};

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: '用户不存在' });

    const config = user.embeddingConfigs.id(configId);
    if (!config) return res.status(404).json({ message: '配置不存在' });

    config.name = configData.name || config.name;
    config.provider = configData.provider || config.provider;
    config.apiKey = configData.apiKey || config.apiKey;
    config.apiUrl = configData.apiUrl || config.apiUrl;
    config.model = configData.model || config.model;
    config.timeout = configData.timeout || config.timeout;
    config.isActive = configData.isActive !== undefined ? Boolean(configData.isActive) : config.isActive;

    if (configData.isDefault !== undefined) {
      if (configData.isDefault) {
        (user.embeddingConfigs || []).forEach(c => {
          if (c._id.toString() !== configId) c.isDefault = false;
        });
      }
      config.isDefault = Boolean(configData.isDefault);
    }

    await user.save();
    return res.json({ message: '嵌入配置更新成功', config });
  } catch (error) {
    logger.error('更新用户嵌入配置失败:', error);
    return res.status(500).json({ message: '更新用户嵌入配置失败' });
  }
};

// 删除用户嵌入配置
exports.deleteUserEmbeddingConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { configId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: '用户不存在' });

    const idx = (user.embeddingConfigs || []).findIndex(c => c._id.toString() === configId);
    if (idx === -1) return res.status(404).json({ message: '配置不存在' });

    user.embeddingConfigs.splice(idx, 1);
    await user.save();
    return res.json({ message: '嵌入配置删除成功' });
  } catch (error) {
    logger.error('删除用户嵌入配置失败:', error);
    return res.status(500).json({ message: '删除用户嵌入配置失败' });
  }
};

// 设置默认用户嵌入配置
exports.setDefaultUserEmbeddingConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { configId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: '用户不存在' });

    const exists = (user.embeddingConfigs || []).some(c => c._id.toString() === configId);
    if (!exists) return res.status(404).json({ message: '配置不存在' });

    (user.embeddingConfigs || []).forEach(c => { c.isDefault = false; });
    const target = user.embeddingConfigs.find(c => c._id.toString() === configId);
    if (target) target.isDefault = true;
    await user.save();
    return res.json({ message: '默认嵌入配置设置成功' });
  } catch (error) {
    logger.error('设置默认嵌入配置失败:', error);
    return res.status(500).json({ message: '设置默认嵌入配置失败' });
  }
};

// 获取用户默认嵌入配置（供其他模块调用）
exports.getUserDefaultEmbeddingConfig = async (userId) => {
  try {
    const user = await User.findById(userId).select('embeddingConfigs');
    if (!user) return null;
    const def = (user.embeddingConfigs || []).find(c => c.isDefault && c.isActive);
    if (!def) return null;
    return {
      provider: def.provider,
      apiKey: def.apiKey,
      apiUrl: def.apiUrl,
      model: def.model,
      timeout: def.timeout || 60000
    };
  } catch (error) {
    logger.error('获取默认嵌入配置失败:', error);
    return null;
  }
};

// 测试用户嵌入配置
exports.testUserEmbeddingConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const { configId } = req.params;

    const user = await User.findById(userId).select('embeddingConfigs');
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    const config = (user.embeddingConfigs || []).find(c => c._id.toString() === configId);
    if (!config) return res.status(404).json({ success: false, message: '配置不存在' });

    const embedder = new Embeddings({
      provider: String(config.provider || '').toLowerCase(),
      apiKey: String(config.apiKey || ''),
      apiUrl: String(config.apiUrl || ''),
      model: String(config.model || ''),
      timeout: parseInt(config.timeout || 60000, 10)
    });
    const vec = await embedder.embed('用户嵌入配置连接测试 - workdiaryapp');
    if (Array.isArray(vec) && vec.length > 0) {
      return res.json({ success: true, message: '嵌入成功', vectorDimensions: vec.length });
    }
    return res.status(500).json({ success: false, message: '嵌入失败或返回空向量' });
  } catch (error) {
    logger.error('测试用户嵌入配置失败:', error);
    return res.status(500).json({ success: false, message: '测试用户嵌入配置失败: ' + (error.response?.data?.message || error.message) });
  }
};
