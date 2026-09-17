const axios = require('axios');
const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger');
/**
 * 外部LLM工具类
 * 用于与外部LLM API进行通信
 */
class ExternalLLM {
  constructor(config = {}) {
    // 默认配置
    // 先合并基础配置
    const baseConfig = {
      // 外部LLM提供商
      provider: process.env.EXTERNAL_LLM_PROVIDER || 'openai',
      // API密钥
      apiKey: process.env.EXTERNAL_LLM_API_KEY || '',
      // API地址
      apiUrl: process.env.EXTERNAL_LLM_API_URL || '',
      // 模型名称
      model: process.env.EXTERNAL_LLM_MODEL || 'deepseek-ai/DeepSeek-V3',
      // 请求超时时间（毫秒），允许用户配置覆盖，最小1秒
      timeout: parseInt(process.env.EXTERNAL_LLM_TIMEOUT || '600000'),
      // 温度参数，控制输出的随机性
      temperature: parseFloat(process.env.EXTERNAL_LLM_TEMPERATURE || '0.7'),
      // 最大token数（理想请求上限，可被安全裁剪）
      maxTokens: parseInt(process.env.EXTERNAL_LLM_MAX_TOKENS || '65000'),
      // 是否启用外部LLM
      enabled: process.env.LLM_TYPE === 'external',
      ...config
    };

    // 规范化与下限保护：尊重用户超时配置，不偷偷扩大等待时间
    const inputTimeout = Number(baseConfig.timeout);
    const resolvedTimeout = Number.isFinite(inputTimeout) ? Math.max(inputTimeout, 1000) : 300000;

    this.config = {
      ...baseConfig,
      timeout: resolvedTimeout
    };

    // 创建axios实例（禁用环境代理，避免企业/系统代理导致TLS/连接问题或30秒内断开）
    this.client = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      },
      proxy: false
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
      logger.llm('外部LLM未启用，跳过外部LLM总结生成');
      return null;
    }

    if (!this.config.apiKey) {
      logger.llm('外部LLM API密钥未配置，跳过外部LLM总结生成');
      return null;
    }

    try {
      // 准备提示词模板
      const promptTemplate = await this._getPromptTemplate(type, userId);
      
      // 填充提示词模板
      const prompt = this._fillPromptTemplate(promptTemplate, data, type);
      
      logger.llm('=== 发送给外部LLM的提示词 ===');
      logger.info(prompt);
      
      // 调用外部LLM生成内容
      const response = await this._callExternalLLM(prompt, options);
      
      // 返回生成的内容
      return response;
    } catch (error) {
      logger.error('外部LLM生成总结失败:', error.message);
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
      logger.llm('外部LLM未启用，跳过外部LLM文本生成');
      return null;
    }

    if (!this.config.apiKey) {
      logger.llm('外部LLM API密钥未配置，跳过外部LLM文本生成');
      return null;
    }

    try {
      return await this._callExternalLLM(prompt, options);
    } catch (error) {
      logger.error('外部LLM生成文本失败:', { message: error.message, code: error.code, status: error.response?.status });
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
    const requestedMaxTokens = options.maxTokens || this.config.maxTokens;
    // 暂不计算maxTokens，先完成URL与提供商推断，再安全限制

    // 统一归一化模型与URL，避免 DeepSeek/OpenRouter 因别名或错误地址返回400
    const providerLower = String(provider || '').toLowerCase().trim();
    let normalizedModel = String(this.config.model || '').trim();
    let normalizedApiUrl = String(this.config.apiUrl || '').trim();

    const promptToSend = prompt; // Preserve complete input; provider validates its actual context window.

    if (providerLower === 'deepseek') {
      const m = normalizedModel.toLowerCase();
      if (m.includes('deepseek-ai/deepseek-v3') || m.includes('deepseek-v3') || m.includes('deepseek/v3')) {
        normalizedModel = 'deepseek-chat';
      }
      if (m.includes('deepseek-ai/deepseek-reasoner') || m === 'deepseek-reasoner') {
        normalizedModel = 'deepseek-reasoner';
      }
      if (!normalizedApiUrl || /openrouter\.ai/i.test(normalizedApiUrl)) {
        normalizedApiUrl = 'https://api.deepseek.com/v1/chat/completions';
      }
    }

    if (providerLower === 'openrouter') {
      if (!normalizedApiUrl || /deepseek\.com/i.test(normalizedApiUrl)) {
        normalizedApiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      }
    }

    // 基于URL推断实际提供商（处理provider=custom但URL为OpenRouter/DeepSeek的情况）
    let effectiveProvider = providerLower;
    if (/openrouter\.ai/i.test(normalizedApiUrl)) {
      effectiveProvider = 'openrouter';
    } else if (/api\.deepseek\.com/i.test(normalizedApiUrl)) {
      effectiveProvider = 'deepseek';
    }

    const maxTokens = this._getSafeMaxTokens(effectiveProvider, requestedMaxTokens);

    let requestConfig = {
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      },
      proxy: false
    };

    let requestData = {};
    let apiUrl = '';

    const contentMessage = [{ role: 'user', content: promptToSend }];

    // 根据不同提供商构建请求
    switch (effectiveProvider) {
      case 'openai':
        apiUrl = this.config.apiUrl || 'https://api.openai.com/v1/chat/completions';
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestData = {
          model: this.config.model,
          messages: contentMessage,
          temperature: temperature,
          max_tokens: maxTokens
        };
        break;

      case 'claude':
      case 'anthropic':
        apiUrl = this.config.apiUrl || 'https://api.anthropic.com/v1/messages';
        requestConfig.headers['x-api-key'] = this.config.apiKey;
        requestConfig.headers['anthropic-version'] = '2023-06-01';
        requestData = {
          model: this.config.model,
          max_tokens: maxTokens,
          messages: contentMessage,
          temperature: temperature
        };
        break;

      case 'qianwen':
        apiUrl = this.config.apiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestData = {
          model: this.config.model,
          input: {
            messages: contentMessage
          },
          parameters: {
            temperature: temperature,
            max_tokens: maxTokens
          }
        };
        break;

      case 'openrouter':
        apiUrl = normalizedApiUrl || 'https://openrouter.ai/api/v1/chat/completions';
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestConfig.headers['HTTP-Referer'] = 'https://workdiaryapp.com';
        requestConfig.headers['X-Title'] = 'Work Diary App';
        requestData = {
          model: normalizedModel,
          messages: contentMessage,
          temperature: temperature,
          max_tokens: maxTokens
        };
        break;

      case 'deepseek':
        apiUrl = normalizedApiUrl || 'https://api.deepseek.com/v1/chat/completions';
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestData = {
          model: normalizedModel,
          messages: contentMessage,
          temperature: temperature,
          max_tokens: maxTokens
        };
        break;

      case 'qwen':
        apiUrl = this.config.apiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestData = {
          model: this.config.model,
          input: {
            messages: contentMessage
          },
          parameters: {
            temperature: temperature,
            max_tokens: maxTokens
          }
        };
        break;
        
      case 'doubao':
        apiUrl = this.config.apiUrl || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestData = {
          model: this.config.model,
          messages: contentMessage,
          temperature: temperature,
          max_tokens: maxTokens
        };
        break;
        
      case 'siliconflow':
        apiUrl = this.config.apiUrl || 'https://api.siliconflow.cn/v1/chat/completions';
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestData = {
          model: this.config.model,
          messages: contentMessage,
          temperature: temperature,
          max_tokens: maxTokens
        };
        break;
        
      case 'zhipu':
        apiUrl = this.config.apiUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestData = {
          model: this.config.model,
          messages: contentMessage,
          temperature: temperature,
          max_tokens: maxTokens
        };
        if (/^glm-5\.3-flash$/i.test(this.config.model) && ['low', 'high', 'max'].includes(options.reasoningEffort)) {
          requestData.reasoning_effort = options.reasoningEffort;
          requestData.thinking = { type: 'enabled' };
        }
        break;

      case 'custom':
        if (!this.config.apiUrl) {
          throw new Error('自定义API地址未配置');
        }
        apiUrl = this.config.apiUrl;
        requestConfig.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        requestData = {
          model: this.config.model,
          messages: contentMessage,
          temperature: temperature,
          max_tokens: maxTokens
        };
        break;

      default:
        throw new Error(`不支持的外部LLM提供商: ${effectiveProvider}`);
    }

    // 发送请求前记录关键信息，便于排查
    try {
      logger.llm('调用外部LLM', {
        provider,
        effectiveProvider,
        apiUrl,
        model: requestData.model,
        temperature,
        maxTokens
      });
    } catch (_) {}

    // 发送请求并增加一次重试（通用瞬时错误重试）
    let response;
    try {
      response = await this.client.post(apiUrl, requestData, requestConfig);
    } catch (error) {
      logger.error('外部LLM请求失败', {
        provider,
        effectiveProvider,
        apiUrl,
        message: error.message,
        code: error.code,
        status: error.response?.status,
      });
      const isTransient = /ECONNABORTED|ETIMEDOUT|ECONNRESET|timeout|aborted/i.test(error.message || '') || error.code === 'ECONNABORTED';
      if (isTransient && options.retryTransient !== false) {
        try {
          logger.llm('出现瞬时错误，保留完整输入和输出预算重试一次');
          response = await this.client.post(apiUrl, requestData, requestConfig);
        } catch (retryErr) {
          logger.error('外部LLM重试仍失败', {
            message: retryErr.message,
            code: retryErr.code,
            status: retryErr.response?.status
          });
          throw retryErr;
        }
      } else {
        throw error; // Surface model limits instead of silently reducing user configuration.
      }
    }

    // A successful HTTP response can still contain a report cut off by the token limit.
    const truncated = data => {
      const choice = data?.choices?.[0] || data?.data?.choices?.[0] || data?.result?.choices?.[0];
      return [choice?.finish_reason, choice?.native_finish_reason, data?.stop_reason]
        .some(reason => ['length', 'max_tokens', 'MAX_TOKENS'].includes(reason));
    };
    if (options.requireComplete && truncated(response.data)) {
      const expanded = this._getSafeMaxTokens(effectiveProvider, Math.min(requestData.max_tokens * 2, options.maxOutputBudget || Number.MAX_SAFE_INTEGER));
      if (options.retryTruncated !== false && expanded > requestData.max_tokens) {
        requestData.max_tokens = expanded;
        response = await this.client.post(apiUrl, requestData, requestConfig);
      }
      if (truncated(response.data)) {
        const error = new Error('模型输出达到长度上限，未保存不完整报告');
        error.code = 'LLM_OUTPUT_TRUNCATED';
        error.usedMaxTokens = requestData.max_tokens;
        error.publicMessage = '模型输出被截断，请缩短统计周期或调整模型输出限制后重试；已有报告保留';
        error.permanent = true;
        throw error;
      }
    }
    // 解析响应
    return this._parseResponse(response.data, effectiveProvider);
  }

  /**
   * 验证输出预算，不按提供商或模型名称猜测能力上限
   * @param {string} provider
   * @param {number} asked
   * @returns {number}
   */
  _getSafeMaxTokens(provider, asked) {
    const n = Number(asked);
    if (!Number.isSafeInteger(n) || n < 1) throw new Error('最大输出 Token 必须为正整数');
    // Only an explicitly configured operator budget can cap output. Provider/model
    // names are not reliable limits: new models and compatible gateways differ.
    const envCap = Number(process.env.EXTERNAL_LLM_MAX_OUTPUT_TOKENS_CAP);
    return Number.isSafeInteger(envCap) && envCap > 0 ? Math.min(n, envCap) : n;
  }

  /**
   * 解析API响应
   * @param {Object} responseData 响应数据
   * @param {string} provider 提供商
   * @returns {string} 解析后的文本内容
   */
  _parseResponse(responseData, provider) {
    // 首先记录完整的响应数据用于调试
    logger.llm(`=== ${provider} API响应数据 ===`);
    logger.llm(JSON.stringify(responseData, null, 2));
    
    let content = null;
    // 通用递归文本提取器：尽可能从复杂结构中收集可读文本
    const collectText = (node, path = '', acc = []) => {
      try {
        if (node == null) return acc;
        if (typeof node === 'string') {
          acc.push(node);
          return acc;
        }
        if (Array.isArray(node)) {
          node.forEach((item, idx) => collectText(item, `${path}[${idx}]`, acc));
          return acc;
        }
        if (typeof node === 'object') {
          // 优先字段（常见于各路由/模型的内容块键）
          const preferredKeys = ['text', 'content', 'markdown', 'html', 'output_text', 'result'];
          // 其次尝试容器字段
          const containerKeys = ['data', 'message', 'choices'];
          // 明确排除不应拼接到最终内容中的键（推理/中间态等）
          const excludedKeys = ['reasoning', 'reasoning_details', 'thinking', 'tool_calls', 'provider', 'object', 'id', 'created', 'finish_reason', 'native_finish_reason', 'role', 'index', 'usage'];
          for (const key of preferredKeys) {
            if (typeof node[key] === 'string') collectText(node[key], `${path}.${key}`, acc);
            else if (node[key]) collectText(node[key], `${path}.${key}`, acc);
          }
          for (const key of containerKeys) {
            if (node[key]) collectText(node[key], `${path}.${key}`, acc);
          }
          // 兜底：遍历所有可枚举键，避免漏掉少见字段名
          Object.keys(node).forEach((k) => {
            if (![...preferredKeys, ...containerKeys, ...excludedKeys].includes(k)) {
              const val = node[k];
              if (typeof val === 'string') acc.push(val);
              else if (val && (typeof val === 'object' || Array.isArray(val))) collectText(val, `${path}.${k}`, acc);
            }
          });
        }
      } catch (e) {
        // 提取失败不影响主流程
      }
      return acc;
    };
    
    switch (provider) {
      case 'openai':
      case 'deepseek':
      case 'doubao':
      case 'siliconflow':
      case 'custom':
        if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
          content = responseData.choices[0].message.content;
        }
        break;

      case 'zhipu':
        {
          const choice0 = responseData?.choices?.[0];
          const message = choice0?.message || {};
          // 记录截断原因（如有），便于排查 max_tokens 问题
          try {
            if (choice0?.finish_reason || choice0?.native_finish_reason) {
              logger.llm(`Zhipu finish_reason=${choice0?.finish_reason}, native=${choice0?.native_finish_reason}`);
            }
          } catch (_) {}

          // 优先使用标准 content
          const mc = message?.content;
          if (typeof mc === 'string' && mc.trim().length > 0) {
            content = mc;
          }

          // 若 content 为空，尝试 reasoning_content（部分模型会把输出放这里）
          if (!content && typeof message?.reasoning_content === 'string' && message.reasoning_content.trim().length > 0) {
            content = message.reasoning_content;
          }

          // 仍为空则进行聚合提取（包含 message 内可读文本，避免遗漏）
          if (!content) {
            const msgParts = collectText(message);
            if (msgParts.length > 0) content = msgParts.join('\n');
          }

          // 顶层兜底
          if (!content) {
            const topParts = collectText(responseData);
            if (topParts.length > 0) content = topParts.join('\n');
          }
        }
        break;
        
      case 'openrouter':
        // OpenRouter返回结构通常兼容OpenAI结构，但可能包含内容块数组与推理字段
        // 明确优先使用 message.content 的字符串；若为数组，仅合并输出文本块
        {
          let message = null;
          const choice0 = responseData?.choices?.[0];
          if (choice0?.message) {
            message = choice0.message;
          } else if (responseData?.data?.choices?.[0]?.message) {
            message = responseData.data.choices[0].message;
          } else if (responseData?.result?.choices?.[0]?.message) {
            message = responseData.result.choices[0].message;
          } else if (responseData?.message) {
            message = responseData.message;
          }

          // 记录截断原因（如有），便于排查 max_tokens 问题
          try {
            if (choice0?.finish_reason || choice0?.native_finish_reason) {
              logger.llm(`OpenRouter finish_reason=${choice0?.finish_reason}, native=${choice0?.native_finish_reason}`);
            }
          } catch (_) {}

          if (message) {
            const mc = message.content;
            if (typeof mc === 'string' && mc.trim().length > 0) {
              content = mc;
            } else if (Array.isArray(mc)) {
              // 仅拼接明确的输出文本块，忽略输入回显和推理块
              const textParts = [];
              mc.forEach((part) => {
                const type = (part && part.type) || '';
                const txt = (typeof part?.text === 'string') ? part.text : (typeof part?.content === 'string' ? part.content : null);
                if (txt && !/^(reasoning|thinking|input_text|tool|safety)/i.test(type)) {
                  textParts.push(txt);
                }
              });
              if (textParts.length > 0) content = textParts.join('\n');
            }
            // 如仍未取到，收敛到 message 对象的其它文本（排除推理字段）
            if (!content) {
              const msgParts = collectText(message);
              if (msgParts.length > 0) content = msgParts.join('\n');
            }
          }

          // 兜底：尝试从顶层响应中提取（排除推理字段）
          if (!content) {
            const topParts = collectText(responseData);
            if (topParts.length > 0) content = topParts.join('\n');
          }
        }
        break;
        
      case 'claude':
      case 'anthropic':
        if (responseData.content && responseData.content[0] && responseData.content[0].text) {
          content = responseData.content[0].text;
        }
        break;
        
      case 'qianwen':
      case 'qwen':
        if (responseData.output && responseData.output.text) {
          content = responseData.output.text;
        }
        break;
    }
    
    if (content) {
      logger.llm(`=== ${provider} 解析成功的内容 ===`);
      if (typeof content === 'string') {
        logger.llm(`内容长度: ${content.length} 字符`);
        logger.llm(`内容预览: ${content.substring(0, 200)}...`);
        // 记录聚合详情，便于定位是否漏块
        try {
          const aggregatedCount = (content.match(/\n/g) || []).length + 1;
          logger.llm(`聚合段落数（粗略）: ${aggregatedCount}`);
        } catch (e) {}
      } else {
        try {
          const jsonStr = JSON.stringify(content);
          logger.llm(`内容为非字符串，JSON长度: ${jsonStr.length}`);
          logger.llm(`内容预览(JSON): ${jsonStr.substring(0, 200)}...`);
          content = jsonStr; // 将非字符串内容安全转换为字符串返回
        } catch (e) {
          logger.llm('内容为非字符串，且无法JSON序列化，返回String(content)');
          content = String(content);
        }
      }
      return content;
    }
    
    // 添加调试信息
    logger.error(`无法解析${provider}的API响应:`, JSON.stringify(responseData, null, 2));
    throw new Error(`无法解析${provider}的API响应`);
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
          .replace('{{todayTodosCreated}}', (data.todayTodosCreated ?? 0).toString())
          .replace('{{todayTodosCompleted}}', (data.todayTodosCompleted ?? 0).toString())
          .replace('{{todayTodosPending}}', (data.todayTodosPending ?? 0).toString())
          .replace('{{totalPendingTodos}}', (data.totalPendingTodos ?? 0).toString())
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
          .replace('{{weekTodosCreated}}', (data.weekTodosCreated ?? 0).toString())
          .replace('{{weekTodosCompleted}}', (data.weekTodosCompleted ?? 0).toString())
          .replace('{{weekTodosPending}}', (data.weekTodosPending ?? 0).toString())
          .replace('{{totalPendingTodos}}', (data.totalPendingTodos ?? 0).toString())
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
          .replace('{{dailyWorkStats}}', this._formatDailyWorkStats(data.dailyWork))
          .replace('{{monthTodosCreated}}', (data.monthTodosCreated ?? 0).toString())
          .replace('{{monthTodosCompleted}}', (data.monthTodosCompleted ?? 0).toString())
          .replace('{{monthTodosPending}}', (data.monthTodosPending ?? 0).toString())
          .replace('{{totalPendingTodos}}', (data.totalPendingTodos ?? 0).toString())
          .replace('{{workDetails}}', data.workDetails || '');
        break;
        
      case 'yearly':
        filledTemplate = filledTemplate
          .replace('{{date}}', data.date.getFullYear())
          .replace('{{totalEntries}}', data.diaries.length)
          .replace('{{totalTime}}', data.totalWorkTime)
          .replace('{{averageTime}}', Math.floor(data.totalWorkTime / 12))
          .replace('{{monthlyWorkTrend}}', this._formatMonthlyWorkTrend(data.monthlyWork))
          .replace('{{tagDistribution}}', this._formatTagDistribution(data.tagDistribution))
          .replace('{{workDetails}}', data.workDetails || '');
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

module.exports = ExternalLLM;
