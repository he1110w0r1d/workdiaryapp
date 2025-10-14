const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const logger = require('../utils/logger');
const axios = require('axios');

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
        externalMaxTokens: 1000
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
            message: '连接成功，模型响应: ' + response.data.choices[0].message.content.substring(0, 50) + '...' 
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
      maxTokens: configData.maxTokens || 1000,
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
      // 确保API密钥是有效的字符串且不包含无效字符
      const openaiApiKey = String(settings.externalApiKey).trim();
      if (!openaiApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${openaiApiKey}`;
      requestData = {
        model: settings.externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature: settings.externalTemperature || 0.7,
        max_tokens: settings.externalMaxTokens || 100
      };
      break;
      
    case 'claude':
      apiUrl = settings.externalApiUrl || 'https://api.anthropic.com/v1/messages';
      // 确保API密钥是有效的字符串且不包含无效字符
      const claudeApiKey = String(settings.externalApiKey).trim();
      if (!claudeApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['x-api-key'] = claudeApiKey;
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
      // 确保API密钥是有效的字符串且不包含无效字符
      const qianwenApiKey = String(settings.externalApiKey).trim();
      if (!qianwenApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${qianwenApiKey}`;
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
      
    case 'openrouter':
      apiUrl = settings.externalApiUrl || 'https://openrouter.ai/api/v1/chat/completions';
      const openrouterApiKey = String(settings.externalApiKey).trim();
      if (!openrouterApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${openrouterApiKey}`;
      requestConfig.headers['HTTP-Referer'] = 'https://workdiaryapp.com';
      requestConfig.headers['X-Title'] = 'Work Diary App';
      requestData = {
        model: settings.externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature: settings.externalTemperature || 0.7,
        max_tokens: settings.externalMaxTokens || 100
      };
      break;
      
    case 'deepseek':
      apiUrl = settings.externalApiUrl || 'https://api.deepseek.com/v1/chat/completions';
      const deepseekApiKey = String(settings.externalApiKey).trim();
      if (!deepseekApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${deepseekApiKey}`;
      requestData = {
        model: settings.externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature: settings.externalTemperature || 0.7,
        max_tokens: settings.externalMaxTokens || 100
      };
      break;
      
    case 'qwen':
      apiUrl = settings.externalApiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
      const qwenApiKey = String(settings.externalApiKey).trim();
      if (!qwenApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${qwenApiKey}`;
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
      
    case 'doubao':
      apiUrl = settings.externalApiUrl || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      const doubaoApiKey = String(settings.externalApiKey).trim();
      if (!doubaoApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${doubaoApiKey}`;
      requestData = {
        model: settings.externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature: settings.externalTemperature || 0.7,
        max_tokens: settings.externalMaxTokens || 100
      };
      break;
      
    case 'siliconflow':
      apiUrl = settings.externalApiUrl || 'https://api.siliconflow.cn/v1/chat/completions';
      const siliconflowApiKey = String(settings.externalApiKey).trim();
      if (!siliconflowApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${siliconflowApiKey}`;
      requestData = {
        model: settings.externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature: settings.externalTemperature || 0.7,
        max_tokens: settings.externalMaxTokens || 100
      };
      break;
      
    case 'zhipu':
      apiUrl = settings.externalApiUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      const zhipuApiKey = String(settings.externalApiKey).trim();
      if (!zhipuApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      requestConfig.headers['Authorization'] = `Bearer ${zhipuApiKey}`;
      requestData = {
        model: settings.externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature: settings.externalTemperature || 0.7,
        max_tokens: settings.externalMaxTokens || 100
      };
      break;
      
    case 'custom':
      // 处理自定义提供商
      if (!settings.externalApiUrl) {
        return res.status(400).json({ success: false, message: '自定义API地址不能为空' });
      }
      
      const customApiKey = String(settings.externalApiKey).trim();
      if (!customApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      
      apiUrl = settings.externalApiUrl;
      
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
        model: settings.externalModel,
        messages: [{ role: 'user', content: testMessage }],
        temperature: settings.externalTemperature || 0.7,
        max_tokens: settings.externalMaxTokens || 100
      };
      break;
      
    default:
      return res.status(400).json({ success: false, message: '不支持的外部LLM提供商' });
  }
  
  try {
    logger.info('发送测试请求到LLM API', { 
      provider, 
      apiUrl, 
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
        message: '连接成功，模型响应: ' + responseText.substring(0, 50) + '...' 
      });
    } else {
      return res.json({ 
        success: false, 
        message: '连接成功但响应格式不正确' 
      });
    }
  } catch (error) {
    logger.error('测试用户LLM配置失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: '测试LLM配置失败: ' + (error.response?.data?.message || error.message) 
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