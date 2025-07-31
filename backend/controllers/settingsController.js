const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 设置文件路径
const settingsFilePath = path.join(__dirname, '../config/llm-settings.json');

// 确保config目录存在
const ensureConfigDir = () => {
  const configDir = path.join(__dirname, '../config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
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
    model: process.env.LOCAL_LLM_MODEL || 'llama3',
    timeout: parseInt(process.env.LOCAL_LLM_TIMEOUT || '60000'),
    temperature: parseFloat(process.env.LOCAL_LLM_TEMPERATURE || '0.7'),
    
    // 外部LLM设置
    externalProvider: process.env.EXTERNAL_LLM_PROVIDER || 'openai',
    externalApiKey: process.env.EXTERNAL_LLM_API_KEY || '',
    externalApiUrl: process.env.EXTERNAL_LLM_API_URL || '',
    externalModel: process.env.EXTERNAL_LLM_MODEL || 'gpt-3.5-turbo',
    externalTimeout: parseInt(process.env.EXTERNAL_LLM_TIMEOUT || '30000'),
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
    console.error('获取LLM设置失败:', error);
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
    console.error('保存LLM设置失败:', error);
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
    console.error('测试LLM连接失败:', error);
    
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