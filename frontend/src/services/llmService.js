import api from '../utils/api';

/**
 * LLM服务类
 * 处理与LLM相关的API调用，支持本地LLM和外部LLM
 */
class LLMService {
  /**
   * 获取LLM设置
   * @returns {Promise<Object>} LLM设置对象
   */
  static async getSettings() {
    try {
      const response = await api.get('/settings/llm');
      return response.data;
    } catch (error) {
      console.error('获取LLM设置失败:', error);
      throw error;
    }
  }

  /**
   * 保存LLM设置
   * @param {Object} settings - LLM设置对象
   * @returns {Promise<Object>} 保存结果
   */
  static async saveSettings(settings) {
    try {
      const response = await api.post('/settings/llm', settings);
      return response.data;
    } catch (error) {
      console.error('保存LLM设置失败:', error);
      throw error;
    }
  }

  /**
   * 测试LLM连接
   * @param {Object} settings - LLM设置对象
   * @returns {Promise<Object>} 测试结果
   */
  static async testConnection(settings) {
    try {
      const response = await api.post('/settings/llm/test', settings);
      return response.data;
    } catch (error) {
      console.error('测试LLM连接失败:', error);
      throw error;
    }
  }

  /**
   * 生成工作总结
   * @param {string} type - 总结类型 (daily, monthly, yearly)
   * @param {Object} data - 总结数据
   * @returns {Promise<Object>} 生成的总结
   */
  static async generateSummary(type, data) {
    try {
      const response = await api.post(`/summaries/generate/${type}`, data);
      return response.data;
    } catch (error) {
      console.error(`生成${type}总结失败:`, error);
      throw error;
    }
  }
}

export default LLMService;