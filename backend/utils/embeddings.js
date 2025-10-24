const axios = require('axios');
const crypto = require('crypto');
const logger = require('./logger');

/**
 * 统一的嵌入生成工具：优先外部Embedding API，失败时回退到简易本地哈希嵌入
 */
class Embeddings {
  constructor(config = {}) {
    this.config = {
      provider: process.env.EXTERNAL_EMBEDDINGS_PROVIDER || 'openrouter',
      apiKey: process.env.EXTERNAL_LLM_API_KEY || process.env.EXTERNAL_EMBEDDINGS_API_KEY || '',
      apiUrl: process.env.EXTERNAL_EMBEDDINGS_API_URL || '',
      model: process.env.EXTERNAL_EMBEDDINGS_MODEL || 'text-embedding-3-large',
      timeout: parseInt(process.env.EXTERNAL_EMBEDDINGS_TIMEOUT || '60000', 10),
      ...config
    };
    this.client = axios.create({
      timeout: this.config.timeout,
      headers: { 'Content-Type': 'application/json' },
      proxy: false,
    });
  }

  /**
   * 生成文本嵌入
   * @param {string} text 
   * @returns {Promise<number[]>}
   */
  async embed(text) {
    const t = String(text || '').trim();
    if (!t) return [];

    // 首选外部服务
    try {
      const provider = String(this.config.provider || '').toLowerCase().trim();
      if (!this.config.apiKey) throw new Error('Embedding apiKey未配置');

      let url = this.config.apiUrl;
      let body = {};
      let headers = {};

      switch (provider) {
        case 'openrouter':
          url = url || 'https://openrouter.ai/api/v1/embeddings';
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          body = { model: this.config.model, input: t };
          break;
        case 'openai':
          url = url || 'https://api.openai.com/v1/embeddings';
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          body = { model: this.config.model, input: t };
          break;
        case 'siliconflow':
          url = url || 'https://api.siliconflow.cn/v1/embeddings';
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          body = { model: this.config.model, input: t };
          break;
        default:
          // 其他提供商可在此扩展
          throw new Error('不支持的Embedding提供商');
      }

      const resp = await this.client.post(url, body, { headers });
      const vec = resp.data?.data?.[0]?.embedding || resp.data?.data?.[0]?.vector;
      if (Array.isArray(vec)) return vec;
      throw new Error('Embedding响应不含向量');
    } catch (err) {
      logger.warn('外部Embedding失败，回退到本地哈希嵌入', { message: err.message });
      return this._hashEmbed(t);
    }
  }

  /**
   * 简易本地哈希嵌入：对词进行哈希并归一化，保证可用
   */
  _hashEmbed(text) {
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);
    const dim = 256;
    const vec = new Array(dim).fill(0);
    for (const w of words) {
      const h = crypto.createHash('md5').update(w).digest();
      const idx = h[0];
      vec[idx] += 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map(v => v / norm);
  }
}

module.exports = Embeddings;