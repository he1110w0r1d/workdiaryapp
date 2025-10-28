const axios = require('axios');
const logger = require('./logger');

/**
 * Dify 数据集（知识库）API 客户端
 * 仅实现基于文本的文档创建与更新，用于同步日记数据。
 */
class DifyClient {
  constructor(config = {}) {
    this.baseUrl = (process.env.DIFY_BASE_URL || config.baseUrl || '').replace(/\/$/, '');
    this.apiKey = process.env.DIFY_DATASET_API_KEY || config.apiKey || '';
    this.datasetId = process.env.DIFY_DATASET_ID || config.datasetId || '';
    this.datasetName = process.env.DIFY_DATASET_NAME || config.datasetName || '';
    this.timeout = parseInt(process.env.DIFY_TIMEOUT || '60000', 10);

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey ? `Bearer ${this.apiKey}` : undefined,
      },
      proxy: false,
    });
  }

  ensureBaseAuth() {
    if (!this.baseUrl) throw new Error('DIFY_BASE_URL 未配置');
    if (!this.apiKey) throw new Error('DIFY_DATASET_API_KEY 未配置');
  }

  ensureDataset() {
    if (!this.datasetId) throw new Error('DIFY_DATASET_ID 未配置');
  }

  /**
   * 创建文档（按文本）
   * @param {string} name 文档名称（可用于可视化识别）
   * @param {string} text 文档正文
   * @param {object} options 额外选项，如 { indexing_technique: 'high_quality' }
   * @returns {Promise<{id: string}>}
   */
  async createByText(name, text, options = {}) {
    this.ensureBaseAuth();
    this.ensureDataset();
    const url = `/v1/datasets/${this.datasetId}/document/create_by_text`;
    const body = {
      name: name || '未命名日记',
      text: String(text || ''),
      indexing_technique: options.indexing_technique || 'high_quality',
      process_rule: options.process_rule || {
        mode: 'automatic'
      }
    };
    const resp = await this.client.post(url, body);
    const docId = resp.data?.document?.id || resp.data?.id;
    if (!docId) throw new Error('Dify创建文档响应缺少id');
    return { id: docId };
  }

  /**
   * 更新文档（按文本）
   * @param {string} documentId Dify文档ID
   * @param {string} name 文档名称（可选）
   * @param {string} text 文档正文
   * @param {object} options 额外选项
   */
  async updateByText(documentId, name, text, options = {}) {
    this.ensureBaseAuth();
    this.ensureDataset();
    if (!documentId) throw new Error('缺少documentId');
    const url = `/v1/datasets/${this.datasetId}/documents/${documentId}/update_by_text`;
    const body = {
      name: name || undefined,
      text: String(text || ''),
      indexing_technique: options.indexing_technique || 'high_quality',
      process_rule: options.process_rule || {
        mode: 'automatic'
      }
    };
    await this.client.post(url, body);
    return true;
  }

  /** 删除文档 */
  async deleteDocument(documentId) {
    this.ensureBaseAuth();
    this.ensureDataset();
    if (!documentId) throw new Error('缺少documentId');
    const url = `/v1/datasets/${this.datasetId}/documents/${documentId}`;
    await this.client.delete(url);
    return true;
  }

  /** 列出数据集（知识库） */
  async listDatasets(page = 1, limit = 50) {
    this.ensureBaseAuth();
    const url = `/v1/datasets?page=${page}&limit=${limit}`;
    const resp = await this.client.get(url);
    const items = resp.data?.data || resp.data?.items || resp.data || [];
    return Array.isArray(items) ? items : [];
  }

  /** 通过名称解析数据集ID（精确匹配名称） */
  async resolveDatasetIdByName(name) {
    const list = await this.listDatasets(1, 200);
    const hit = list.find(d => String(d.name || '').trim() === String(name || '').trim());
    if (!hit) throw new Error(`未找到名称为 "${name}" 的知识库`);
    this.datasetId = hit.id || hit.uid || hit.dataset_id || this.datasetId;
    if (!this.datasetId) throw new Error('解析知识库ID失败');
    return this.datasetId;
  }
}

module.exports = DifyClient;