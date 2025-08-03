const mongoose = require('mongoose');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 读取当前全局LLM配置
const getGlobalLLMConfig = () => {
  try {
    const settingsFilePath = path.join(__dirname, '../config/llm-settings.json');
    if (fs.existsSync(settingsFilePath)) {
      const settingsData = fs.readFileSync(settingsFilePath, 'utf8');
      return JSON.parse(settingsData);
    }
  } catch (error) {
    console.error('读取全局LLM配置失败:', error);
  }
  return null;
};

// 为用户创建默认LLM配置
const createDefaultLLMConfig = (globalConfig) => {
  const defaultConfig = {
    name: '默认配置',
    provider: 'custom',
    apiKey: globalConfig?.externalApiKey || '',
    apiUrl: globalConfig?.externalApiUrl || 'https://api.siliconflow.cn/v1/chat/completions',
    model: globalConfig?.externalModel || 'deepseek-ai/DeepSeek-V3',
    timeout: globalConfig?.externalTimeout || 600000,
    temperature: globalConfig?.externalTemperature || 0.7,
    maxTokens: globalConfig?.externalMaxTokens || 8000,
    isDefault: true,
    isActive: true
  };

  return defaultConfig;
};

// 迁移函数
const migrateUserLLMConfigs = async () => {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workdiary');
    console.log('数据库连接成功');

    // 读取全局配置
    const globalConfig = getGlobalLLMConfig();
    console.log('全局LLM配置:', globalConfig);

    // 查找所有没有LLM配置的用户
    const users = await User.find({
      $or: [
        { llmConfigs: { $exists: false } },
        { llmConfigs: { $size: 0 } }
      ]
    });

    console.log(`找到 ${users.length} 个需要迁移的用户`);

    let migratedCount = 0;
    for (const user of users) {
      try {
        // 为用户创建默认LLM配置
        const defaultConfig = createDefaultLLMConfig(globalConfig);
        
        // 如果用户没有llmConfigs字段，初始化为空数组
        if (!user.llmConfigs) {
          user.llmConfigs = [];
        }

        // 添加默认配置
        user.llmConfigs.push(defaultConfig);
        
        // 保存用户
        await user.save();
        migratedCount++;
        
        console.log(`✓ 用户 ${user.username} 迁移成功`);
      } catch (error) {
        console.error(`✗ 用户 ${user.username} 迁移失败:`, error.message);
      }
    }

    console.log(`\n迁移完成！成功迁移 ${migratedCount} 个用户`);
    
    // 关闭数据库连接
    await mongoose.connection.close();
    console.log('数据库连接已关闭');
    
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
    process.exit(1);
  }
};

// 如果直接运行此脚本
if (require.main === module) {
  console.log('开始迁移用户LLM配置...');
  migrateUserLLMConfigs();
}

module.exports = { migrateUserLLMConfigs };