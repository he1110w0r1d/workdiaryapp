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
      timeout: parseInt(process.env.EXTERNAL_EMBEDDINGS_TIMEOUT || '3600000', 10),
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
      // Configured external failures must remain visible; mixing vector models corrupts retrieval.
      if (this.config.strict && this.config.apiKey) throw err;
      logger.warn('外部Embedding失败，回退到本地哈希嵌入', { message: err.message });
      return this._hashEmbed(t);
    }
  }

  /**
   * 简易本地哈希嵌入：对词进行哈希并归一化，保证可用
   */
  _hashEmbed(text) {
    const dim = 256;
    const vec = new Array(dim).fill(0);

    const lower = String(text || '').toLowerCase();
    // 提取拉丁/数字token
    const latinTokens = lower.match(/[a-z0-9]+/g) || [];
    for (const tok of latinTokens) {
      const h = crypto.createHash('md5').update(tok).digest();
      for (let i = 0; i < 4; i++) {
        const idx = h[i] % dim;
        vec[idx] += 1;
      }
      const lenIdx = (tok.length * 17) % dim;
      vec[lenIdx] += 0.5;
    }

    // 中文及其他Unicode字符，使用字符n-gram（2-gram/3-gram）
    const chars = Array.from(lower);
    const grams = [];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      // 跳过空白
      if (/[\s]/.test(ch)) continue;
      grams.push(ch);
      if (i + 1 < chars.length) grams.push(ch + chars[i + 1]);
      if (i + 2 < chars.length) grams.push(ch + chars[i + 1] + chars[i + 2]);
    }
    for (const g of grams) {
      const h = crypto.createHash('md5').update(g).digest();
      const idx = h[0] % dim;
      vec[idx] += 1;
    }

    // 文本长度的全局特征
    const textLenIdx = (chars.length * 23) % dim;
    vec[textLenIdx] += 0.3;

    // 防止全零
    if (vec.every(v => v === 0)) vec[0] = 1;

    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map(v => v / norm);
  }
}

module.exports = Embeddings;
