const axios = require('axios');
const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger');
/**
 * 本地LLM工具类
 * 用于与本地部署的大语言模型进行通信
 */
class LocalLLM {
  constructor(config = {}) {
    // 默认配置
    this.config = {
      // 本地LLM API地址，默认为Ollama的API地址
      apiUrl: process.env.LOCAL_LLM_API_URL || 'http://localhost:11434/api/generate',
      // 模型名称
      model: process.env.LOCAL_LLM_MODEL || 'llama3',
      // 请求超时时间（毫秒）
      timeout: process.env.LOCAL_LLM_TIMEOUT || 300000,
      // 温度参数，控制输出的随机性
      temperature: process.env.LOCAL_LLM_TEMPERATURE || 0.7,
      // 是否启用本地LLM
      enabled: process.env.USE_LOCAL_LLM === 'true',
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
      logger.llm('本地LLM未启用，跳过LLM总结生成');
      return null;
    }

    try {
      // 准备提示词模板
      const promptTemplate = await this._getPromptTemplate(type, userId);
      
      // 填充提示词模板
      const prompt = this._fillPromptTemplate(promptTemplate, data, type);
      
      // 调用本地LLM
      const response = await this.client.post(this.config.apiUrl, {
        model: this.config.model,
        prompt: prompt,
        temperature: options.temperature || this.config.temperature,
        stream: false
      });
      
      // 返回生成的内容
      return response.data.response;
    } catch (error) {
      logger.error('本地LLM生成总结失败:', error.message);
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
      logger.llm('本地LLM未启用，跳过本地LLM文本生成');
      return null;
    }

    try {
      // 调用本地LLM API
      const response = await this.client.post(this.config.apiUrl, {
        model: this.config.model,
        prompt: prompt,
        temperature: options.temperature || this.config.temperature,
        stream: false
      });
      
      // 返回生成的内容
      return response.data.response;
    } catch (error) {
      logger.error('本地LLM生成文本失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取提示词模板
   * @param {string} type 总结类型
   * @param {string} userId 用户ID，用于获取定制化提示词
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
            logger.info(`使用用户 ${userId} 的定制化${type}提示词`);
            return user.customPrompts[type];
          }
        } catch (error) {
          logger.info('获取用户定制化提示词失败，使用默认模板:', error.message);
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
      logger.error('获取提示词模板失败:', error.message);
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
    
    // 填充用户基本信息占位符
    if (data.user) {
      filledTemplate = filledTemplate
        .replace('{{userName}}', data.user.nickname || data.user.username || '')
        .replace('{{userPosition}}', data.user.workProfile?.position || '')
        .replace('{{userDepartment}}', data.user.workProfile?.department || '')
        .replace('{{userLevel}}', this._formatUserLevel(data.user.workProfile?.level) || '')
        .replace('{{userIndustry}}', data.user.workProfile?.industry || '')
        .replace('{{userResponsibilities}}', this._formatResponsibilities(data.user.workProfile?.responsibilities) || '');
    }
    
    // 根据总结类型处理不同的数据
    switch (type) {
      case 'daily':
        filledTemplate = filledTemplate
          .replace('{{date}}', data.date.toLocaleDateString('zh-CN'))
          .replace('{{totalEntries}}', data.diaries.length)
          .replace('{{totalTime}}', data.totalWorkTime)
          .replace('{{workDetails}}', this._formatDailyWorkDetails(data.diaries));
        break;
        
      case 'weekly':
        // 计算周的日期范围
        const weekStart = new Date(data.date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        filledTemplate = filledTemplate
          .replace('{{date}}', `${weekStart.toLocaleDateString('zh-CN')} 到 ${weekEnd.toLocaleDateString('zh-CN')}`)
          .replace('{{totalEntries}}', data.diaries.length)
          .replace('{{totalTime}}', `${Math.floor(data.totalWorkTime / 60)}小时${data.totalWorkTime % 60}分钟`)
          .replace('{{workDetails}}', data.workDetails || '')
          .replace('{{summaryData}}', JSON.stringify({
            totalEntries: data.totalEntries,
            totalTime: data.totalWorkTime,
            dailyWork: data.dailyWork,
            tagDistribution: data.tagDistribution
          }, null, 2));
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

  /**
   * 格式化用户级别
   * @param {string} level 用户级别
   * @returns {string} 格式化后的级别
   */
  _formatUserLevel(level) {
    const levelMap = {
      'junior': '初级',
      'middle': '中级', 
      'senior': '高级',
      'expert': '专家',
      'manager': '管理层'
    };
    return levelMap[level] || level || '';
  }

  /**
   * 格式化用户职责
   * @param {Array} responsibilities 职责数组
   * @returns {string} 格式化后的职责
   */
  _formatResponsibilities(responsibilities) {
    if (!responsibilities || !Array.isArray(responsibilities) || responsibilities.length === 0) {
      return '';
    }
    return responsibilities.join('、');
  }
}

module.exports = LocalLLM;