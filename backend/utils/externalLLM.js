const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * 外部LLM工具类
 * 用于与外部LLM API进行通信
 */
class ExternalLLM {
  constructor(config = {}) {
    // 默认配置
    this.config = {
      // 外部LLM提供商
      provider: process.env.EXTERNAL_LLM_PROVIDER || 'openai',
      // API密钥
      apiKey: process.env.EXTERNAL_LLM_API_KEY || '',
      // API地址
      apiUrl: process.env.EXTERNAL_LLM_API_URL || '',
      // 模型名称
      model: process.env.EXTERNAL_LLM_MODEL || 'gpt-3.5-turbo',
      // 请求超时时间（毫秒）
      timeout: parseInt(process.env.EXTERNAL_LLM_TIMEOUT || '300000'),
      // 温度参数，控制输出的随机性
      temperature: parseFloat(process.env.EXTERNAL_LLM_TEMPERATURE || '0.7'),
      // 最大token数
      maxTokens: parseInt(process.env.EXTERNAL_LLM_MAX_TOKENS || '2000'),
      // 是否启用外部LLM
      enabled: process.env.LLM_TYPE === 'external',
      ...config
    };

    // 创建axios实例
    this.client = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * 生成工作总结
   * @param {Object} data 工作数据
   * @param {string} type 总结类型 (daily, monthly, yearly)
   * @param {Object} options 额外选项
   * @param {string} userId 用户ID，用于获取定制化提示词
   * @returns {Promise<string>} 生成的总结内容
   */
  async generateSummary(data, type, options = {}, userId = null) {
    if (!this.config.enabled) {
      console.log('外部LLM未启用，跳过外部LLM总结生成');
      return null;
    }

    if (!this.config.apiKey) {
      console.log('外部LLM API密钥未配置，跳过外部LLM总结生成');
      return null;
    }

    try {
      // 准备提示词模板
      const promptTemplate = await this._getPromptTemplate(type, userId);
      
      // 填充提示词模板
      const prompt = this._fillPromptTemplate(promptTemplate, data, type);
      
      console.log('=== 发送给外部LLM的提示词 ===');
      console.log(prompt);
      console.log('=== 提示词结束 ===');
      
      // 调用外部LLM
      const response = await this._callExternalLLM(prompt, options);
      
      console.log('=== 外部LLM返回的内容 ===');
      console.log(response);
      console.log('=== 返回内容结束 ===');
      
      // 返回生成的内容
      return response;
    } catch (error) {
      console.error('外部LLM生成总结失败:', error.message);
      return null;
    }
  }

  /**
   * 生成文本内容
   * @param {string} prompt 提示词
   * @param {Object} options 额外选项
   * @returns {Promise<string>} 生成的文本内容
   */
  async generateText(prompt, options = {}) {
    if (!this.config.enabled) {
      console.log('外部LLM未启用，跳过外部LLM文本生成');
      return null;
    }

    if (!this.config.apiKey) {
      console.log('外部LLM API密钥未配置，跳过外部LLM文本生成');
      return null;
    }

    try {
      return await this._callExternalLLM(prompt, options);
    } catch (error) {
      console.error('外部LLM生成文本失败:', error);
      throw error;
    }
  }

  /**
   * 调用外部LLM API
   * @param {string} prompt 提示词
   * @param {Object} options 额外选项
   * @returns {Promise<string>} 生成的内容
   */
  async _callExternalLLM(prompt, options = {}) {
    const provider = this.config.provider;
    const temperature = options.temperature || this.config.temperature;
    const maxTokens = options.maxTokens || this.config.maxTokens;
    
    let requestConfig = {
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    let requestData = {};
    let apiUrl = '';
    
    // 根据不同提供商构建请求
    switch (provider) {
      case 'openai':
        apiUrl = this.config.apiUrl || 'https://api.openai.com/v1/chat/completions';
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestData = {
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: temperature,
          max_tokens: maxTokens
        };
        break;
        
      case 'claude':
        apiUrl = this.config.apiUrl || 'https://api.anthropic.com/v1/messages';
        requestConfig.headers['x-api-key'] = this.config.apiKey;
        requestConfig.headers['anthropic-version'] = '2023-06-01';
        requestData = {
          model: this.config.model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
          temperature: temperature
        };
        break;
        
      case 'qianwen':
        apiUrl = this.config.apiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestData = {
          model: this.config.model,
          input: {
            messages: [{ role: 'user', content: prompt }]
          },
          parameters: {
            temperature: temperature,
            max_tokens: maxTokens
          }
        };
        break;
        
      case 'custom':
        if (!this.config.apiUrl) {
          throw new Error('自定义API地址未配置');
        }
        apiUrl = this.config.apiUrl;
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestData = {
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: temperature,
          max_tokens: maxTokens
        };
        break;
        
      default:
        throw new Error(`不支持的外部LLM提供商: ${provider}`);
    }
    
    // 发送请求
    const response = await this.client.post(apiUrl, requestData, requestConfig);
    
    // 解析响应
    return this._parseResponse(response.data, provider);
  }

  /**
   * 解析API响应
   * @param {Object} responseData 响应数据
   * @param {string} provider 提供商
   * @returns {string} 解析后的文本内容
   */
  _parseResponse(responseData, provider) {
    switch (provider) {
      case 'openai':
      case 'custom':
        if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
          return responseData.choices[0].message.content;
        }
        break;
        
      case 'claude':
        if (responseData.content && responseData.content[0] && responseData.content[0].text) {
          return responseData.content[0].text;
        }
        break;
        
      case 'qianwen':
        if (responseData.output && responseData.output.text) {
          return responseData.output.text;
        }
        break;
    }
    
    throw new Error('无法解析API响应');
  }

  /**
   * 获取提示词模板
   * @param {string} type 总结类型
   * @returns {Promise<string>} 提示词模板
   */
  async _getPromptTemplate(type, userId = null) {
    try {
      // 如果提供了用户ID，优先尝试获取用户的定制化提示词
      if (userId) {
        try {
          const User = require('../models/User');
          const user = await User.findById(userId);
          
          if (user && user.customPrompts && user.customPrompts[type]) {
            console.log(`使用用户 ${userId} 的定制化${type}提示词`);
            return user.customPrompts[type];
          }
        } catch (error) {
          console.log('获取用户定制化提示词失败，使用默认模板:', error.message);
        }
      }
      
      // 模板文件路径
      const templatePath = path.join(__dirname, '../templates', `${type}_summary_prompt.txt`);
      
      // 检查模板文件是否存在
      if (fs.existsSync(templatePath)) {
        // 读取模板文件
        return fs.promises.readFile(templatePath, 'utf8');
      } else {
        // 使用默认模板
        return this._getDefaultPromptTemplate(type);
      }
    } catch (error) {
      console.error('获取提示词模板失败:', error.message);
      return this._getDefaultPromptTemplate(type);
    }
  }

  /**
   * 获取默认提示词模板
   * @param {string} type 总结类型
   * @returns {string} 默认提示词模板
   */
  _getDefaultPromptTemplate(type) {
    const templates = {
      daily: `你是一位专业的工作总结助手。请根据以下工作日记数据，生成一份详细的日工作总结。

工作日期: {{date}}
工作条目数量: {{totalEntries}}
总工作时长: {{totalTime}}分钟

工作详情:
{{workDetails}}

请生成包含以下内容的总结:
1. 工作概览
2. 主要工作内容分析
3. 工作成果
4. 存在的问题和改进建议
5. 明日工作计划

请使用markdown格式输出。`,
      
      monthly: `你是一位专业的工作总结助手。请根据以下月度工作数据，生成一份详细的月度工作总结。

月份: {{date}}
工作天数: {{workDays}}
工作条目数量: {{totalEntries}}
总工作时长: {{totalTime}}分钟
日均工作时长: {{averageTime}}分钟

工作标签分布:
{{tagDistribution}}

每日工作统计:
{{dailyWorkStats}}

请生成包含以下内容的总结:
1. 月度工作概览
2. 工作重点及成果
3. 工作效率分析
4. 问题与挑战
5. 下月工作规划

请使用markdown格式输出。`,
      
      yearly: `你是一位专业的工作总结助手。请根据以下年度工作数据，生成一份详细的年度工作总结。

年份: {{date}}
工作条目数量: {{totalEntries}}
总工作时长: {{totalTime}}分钟
月均工作时长: {{averageTime}}分钟

月度工作趋势:
{{monthlyWorkTrend}}

工作类型分布:
{{tagDistribution}}

请生成包含以下内容的总结:
1. 年度工作概览
2. 重大工作成果
3. 工作能力提升
4. 存在问题与不足
5. 来年工作展望

请使用markdown格式输出。`
    };
    
    return templates[type] || templates.daily;
  }

  /**
   * 填充提示词模板
   * @param {string} template 提示词模板
   * @param {Object} data 工作数据
   * @param {string} type 总结类型
   * @returns {string} 填充后的提示词
   */
  _fillPromptTemplate(template, data, type) {
    let filledTemplate = template;
    
    // 根据总结类型处理不同的数据
    switch (type) {
      case 'daily':
        filledTemplate = filledTemplate
          .replace('{{date}}', data.date.toLocaleDateString('zh-CN'))
          .replace('{{totalEntries}}', data.diaries.length)
          .replace('{{totalTime}}', data.totalWorkTime)
          .replace('{{workDetails}}', this._formatDailyWorkDetails(data.diaries));
        break;
        
      case 'monthly':
        filledTemplate = filledTemplate
          .replace('{{date}}', `${data.date.getFullYear()}年${data.date.getMonth() + 1}月`)
          .replace('{{workDays}}', Object.keys(data.dailyWork).length)
          .replace('{{totalEntries}}', data.diaries.length)
          .replace('{{totalTime}}', data.totalWorkTime)
          .replace('{{averageTime}}', Math.floor(data.totalWorkTime / Object.keys(data.dailyWork).length))
          .replace('{{tagDistribution}}', this._formatTagDistribution(data.tagDistribution))
          .replace('{{dailyWorkStats}}', this._formatDailyWorkStats(data.dailyWork));
        break;
        
      case 'yearly':
        filledTemplate = filledTemplate
          .replace('{{date}}', data.date.getFullYear())
          .replace('{{totalEntries}}', data.diaries.length)
          .replace('{{totalTime}}', data.totalWorkTime)
          .replace('{{averageTime}}', Math.floor(data.totalWorkTime / 12))
          .replace('{{monthlyWorkTrend}}', this._formatMonthlyWorkTrend(data.monthlyWork))
          .replace('{{tagDistribution}}', this._formatTagDistribution(data.tagDistribution));
        break;
    }
    
    return filledTemplate;
  }

  /**
   * 格式化日工作详情
   * @param {Array} diaries 工作日记数组
   * @returns {string} 格式化后的工作详情
   */
  _formatDailyWorkDetails(diaries) {
    return diaries.map((diary, index) => {
      return `${index + 1}. ${diary.content}\n` +
        `   时间: ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')}\n` +
        (diary.location ? `   地点: ${diary.location}\n` : '') +
        (diary.tags.length > 0 ? `   标签: ${diary.tags.join(', ')}\n` : '');
    }).join('\n');
  }

  /**
   * 格式化标签分布
   * @param {Object} tagDistribution 标签分布对象
   * @returns {string} 格式化后的标签分布
   */
  _formatTagDistribution(tagDistribution) {
    return Object.entries(tagDistribution)
      .map(([tag, count]) => `- ${tag}: ${count}次`)
      .join('\n');
  }

  /**
   * 格式化每日工作统计
   * @param {Object} dailyWork 每日工作对象
   * @returns {string} 格式化后的每日工作统计
   */
  _formatDailyWorkStats(dailyWork) {
    return Object.entries(dailyWork)
      .map(([date, minutes]) => {
        return `- ${new Date(date).toLocaleDateString('zh-CN')}: ${Math.floor(minutes / 60)}小时${minutes % 60}分钟`;
      })
      .join('\n');
  }

  /**
   * 格式化月度工作趋势
   * @param {Object} monthlyWork 月度工作对象
   * @returns {string} 格式化后的月度工作趋势
   */
  _formatMonthlyWorkTrend(monthlyWork) {
    return Object.entries(monthlyWork)
      .map(([month, minutes]) => {
        return `- ${month}: ${Math.floor(minutes / 60)}小时${minutes % 60}分钟`;
      })
      .join('\n');
  }
}

module.exports = ExternalLLM;