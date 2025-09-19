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
      
    case 'custom':
      // 处理自定义提供商，特别针对DeepSeek等需要特殊处理的服务
      if (!settings.externalApiUrl) {
        return res.status(400).json({ success: false, message: '自定义API地址不能为空' });
      }
      
      // 确保API密钥是有效的字符串且不包含无效字符
      const customApiKey = String(settings.externalApiKey).trim();
      if (!customApiKey) {
        return res.status(400).json({ success: false, message: 'API密钥不能为空' });
      }
      
      // 特殊处理DeepSeek API
      if (settings.externalApiUrl.includes('deepseek')) {
        // 如果是DeepSeek API，自动添加/chat/completions路径
        if (!settings.externalApiUrl.endsWith('/chat/completions')) {
          apiUrl = settings.externalApiUrl.endsWith('/v1') ? 
            settings.externalApiUrl + '/chat/completions' : 
            settings.externalApiUrl.replace(/\/$/, '') + '/v1/chat/completions';
        } else {
          apiUrl = settings.externalApiUrl;
        }
      } else {
        // 对于其他自定义API，直接使用提供的URL
        apiUrl = settings.externalApiUrl;
      }
      
      // 添加额外的安全检查，确保API密钥不包含无效字符
      try {
        // 检查API密钥是否包含无效字符
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