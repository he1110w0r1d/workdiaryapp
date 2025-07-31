const User = require('../models/User');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const LocalLLM = require('../utils/localLLM');
const ExternalLLM = require('../utils/externalLLM');

// 动态创建LLM实例以获取最新配置
const createLLMInstances = () => {
  return {
    localLLM: new LocalLLM(),
    externalLLM: new ExternalLLM()
  };
};

// 确保uploads目录存在
const uploadsDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 获取用户信息
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json(user);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 上传头像
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请选择要上传的图片' });
    }

    const userId = req.user.id;
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // 更新用户头像
    const user = await User.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({
      message: '头像上传成功',
      avatar: avatarUrl,
      user: user
    });
  } catch (error) {
    console.error('头像上传失败:', error);
    res.status(500).json({ message: '头像上传失败' });
  }
};

// 更新用户信息
const updateUserProfile = async (req, res) => {
  try {
    const { username, email, nickname, bio, password } = req.body;
    const userId = req.user.id;

    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 检查用户名和邮箱是否已被其他用户使用
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ message: '用户名已被使用' });
      }
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ message: '邮箱已被使用' });
      }
    }

    // 更新用户信息
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (nickname !== undefined) updateData.nickname = nickname;
    if (bio !== undefined) updateData.bio = bio;
    if (req.body.avatar !== undefined) updateData.avatar = req.body.avatar;

    // 如果提供了新密码，则加密后更新
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: '用户信息更新成功',
      user: updatedUser
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: '数据验证失败', errors: error.errors });
    }
    res.status(500).json({ message: '服务器错误' });
  }
};

// 更新工作信息配置
const updateWorkProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const workProfileData = req.body;

    console.log('收到工作信息更新请求:', {
      userId,
      workProfileData
    });

    const user = await User.findById(userId);
    if (!user) {
      console.error('用户不存在:', userId);
      return res.status(404).json({ message: '用户不存在' });
    }

    // 处理responsibilities字段：如果是字符串，按行分割成数组
    if (workProfileData.responsibilities && typeof workProfileData.responsibilities === 'string') {
      workProfileData.responsibilities = workProfileData.responsibilities
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }

    // 更新工作信息
    user.workProfile = {
      ...user.workProfile,
      ...workProfileData,
      isProfileCompleted: true
    };
    user.updatedAt = new Date();

    console.log('准备保存用户工作信息:', user.workProfile);
    await user.save();
    console.log('工作信息保存成功');

    res.json({
      message: '工作信息配置更新成功',
      workProfile: user.workProfile
    });
  } catch (error) {
    console.error('更新工作信息配置失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ 
      message: '服务器错误',
      error: error.message 
    });
  }
};

// 生成定制化提示词（支持进度回调）
const generateCustomPrompts = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    if (!user.workProfile.isProfileCompleted) {
      return res.status(400).json({ message: '请先完成工作信息配置' });
    }

    const { workProfile } = user;
    
    // 检查是否是进度查询请求
    if (req.query.progress === 'true') {
      // 返回当前进度状态（这里可以从缓存或数据库中获取）
      const progressStatus = global.promptGenerationProgress?.[userId] || {
        daily: { status: 'waiting', message: '等待开始' },
        monthly: { status: 'waiting', message: '等待开始' },
        yearly: { status: 'waiting', message: '等待开始' }
      };
      return res.json({ progress: progressStatus });
    }
    
    // 构建用户信息描述
    const userContext = `
用户基本信息：
- 所属行业：${workProfile.industry}
- 岗位名称：${workProfile.position}
- 职级经验：${workProfile.level}（${workProfile.experience}）
- 所在部门：${workProfile.department}

主要职责：
${workProfile.responsibilities.map((resp, index) => `${index + 1}. ${resp}`).join('\n')}

关键绩效指标/目标：
${workProfile.kpiGoals}

写作风格偏好：${workProfile.writingStyle}
总结用途：${workProfile.summaryPurpose}
希望避免的内容：${workProfile.avoidContent.join('、')}
`;

    // 生成每日总结提示词的模板
    const dailyPromptTemplate = `
请根据以下用户信息，为其生成专属的每日工作总结提示词模板。

${userContext}

重要说明：
这是一个工作记录应用，用户主要记录日常工作内容，很少填写具体的数据指标。因此生成的提示词应该：

核心要求：
1. 专注于统计和整理用户的工作内容，分析用户做了哪些事情
2. 根据用户描述的内容进行分类整理，关注工作状态与内容质量
3. 将用户工作内容与其职责进行关联性分析
4. 工作信息配置仅作为参考，帮助更好地理解用户工作职责
5. 避免要求统计达成率、回收率、检查情况等需要原始数据支撑的指标
6. 保留统计类功能的占位符：{{date}}、{{totalEntries}}、{{totalTime}}、{{workDetails}}
7. 体现用户的写作风格偏好和总结用途
8. 避免用户不希望出现的内容

特殊要求（每日总结专用）：
- 在每日工作总结的最后，需要对用户当日工作记录的填写质量进行评分（1-10分）
- 给出一句话提醒，指导用户如何优化工作内容的填写

请生成一个完整、具体的每日总结提示词，能够指导AI生成符合用户需求的每日工作总结。
`;

    // 生成月度总结提示词的模板
    const monthlyPromptTemplate = `
请根据以下用户信息，为其生成专属的月度工作总结提示词模板。

${userContext}

重要说明：
这是一个工作记录应用，用户主要记录日常工作内容，很少填写具体的数据指标。因此生成的提示词应该：

核心要求：
1. 专注于统计和整理用户的工作内容，分析用户做了哪些事情
2. 根据用户描述的内容进行分类整理，关注工作状态与内容质量
3. 将用户工作内容与其职责进行关联性分析
4. 工作信息配置仅作为参考，帮助更好地理解用户工作职责
5. 避免要求统计达成率、回收率、检查情况等需要原始数据支撑的指标
6. 保留统计类功能的占位符：{{date}}、{{workDays}}、{{totalEntries}}、{{totalTime}}、{{averageTime}}、{{tagDistribution}}、{{dailyWorkStats}}
7. 体现用户的写作风格偏好和总结用途
8. 避免用户不希望出现的内容

请生成一个完整、具体的月度总结提示词，能够指导AI生成符合用户需求的月度工作总结。
`;

    // 生成年度总结提示词的模板
    const yearlyPromptTemplate = `
请根据以下用户信息，为其生成专属的年度工作总结提示词模板。

${userContext}

重要说明：
这是一个工作记录应用，用户主要记录日常工作内容，很少填写具体的数据指标。因此生成的提示词应该：

核心要求：
1. 专注于统计和整理用户的工作内容，分析用户做了哪些事情
2. 根据用户描述的内容进行分类整理，关注工作状态与内容质量
3. 将用户工作内容与其职责进行关联性分析
4. 工作信息配置仅作为参考，帮助更好地理解用户工作职责
5. 避免要求统计达成率、回收率、检查情况等需要原始数据支撑的指标
6. 保留统计类功能的占位符：{{date}}、{{totalEntries}}、{{totalTime}}、{{averageTime}}、{{monthlyWorkTrend}}、{{tagDistribution}}
7. 体现用户的写作风格偏好和总结用途
8. 避免用户不希望出现的内容

请生成一个完整、具体的年度总结提示词，能够指导AI生成符合用户需求的年度工作总结。
`;

    // 创建LLM实例
    const { localLLM, externalLLM } = createLLMInstances();
    
    // 初始化全局进度状态
    if (!global.promptGenerationProgress) {
      global.promptGenerationProgress = {};
    }
    
    // 设置初始进度状态
    global.promptGenerationProgress[userId] = {
      daily: { status: 'waiting', message: '等待开始' },
      monthly: { status: 'waiting', message: '等待开始' },
      yearly: { status: 'waiting', message: '等待开始' }
    };
    
    // 分别生成三个提示词
    const prompts = {
      daily: null,
      monthly: null,
      yearly: null
    };
    
    try {
      // 生成每日总结提示词
      global.promptGenerationProgress[userId].daily = { status: 'active', message: '正在生成每日提示词...' };
      try {
        prompts.daily = await externalLLM.generateText(dailyPromptTemplate);
        if (prompts.daily) {
          console.log('使用外部LLM生成每日提示词成功');
          global.promptGenerationProgress[userId].daily = { status: 'finish', message: '每日提示词生成完成' };
        }
      } catch (error) {
        console.log('外部LLM生成每日提示词失败，尝试本地LLM:', error.message);
        prompts.daily = await localLLM.generateText(dailyPromptTemplate);
        if (prompts.daily) {
          console.log('使用本地LLM生成每日提示词成功');
          global.promptGenerationProgress[userId].daily = { status: 'finish', message: '每日提示词生成完成' };
        } else {
          global.promptGenerationProgress[userId].daily = { status: 'error', message: '每日提示词生成失败' };
        }
      }
      
      // 生成月度总结提示词
      global.promptGenerationProgress[userId].monthly = { status: 'active', message: '正在生成月度提示词...' };
      try {
        prompts.monthly = await externalLLM.generateText(monthlyPromptTemplate);
        if (prompts.monthly) {
          console.log('使用外部LLM生成月度提示词成功');
          global.promptGenerationProgress[userId].monthly = { status: 'finish', message: '月度提示词生成完成' };
        }
      } catch (error) {
        console.log('外部LLM生成月度提示词失败，尝试本地LLM:', error.message);
        prompts.monthly = await localLLM.generateText(monthlyPromptTemplate);
        if (prompts.monthly) {
          console.log('使用本地LLM生成月度提示词成功');
          global.promptGenerationProgress[userId].monthly = { status: 'finish', message: '月度提示词生成完成' };
        } else {
          global.promptGenerationProgress[userId].monthly = { status: 'error', message: '月度提示词生成失败' };
        }
      }
      
      // 生成年度总结提示词
      global.promptGenerationProgress[userId].yearly = { status: 'active', message: '正在生成年度提示词...' };
      try {
        prompts.yearly = await externalLLM.generateText(yearlyPromptTemplate);
        if (prompts.yearly) {
          console.log('使用外部LLM生成年度提示词成功');
          global.promptGenerationProgress[userId].yearly = { status: 'finish', message: '年度提示词生成完成' };
        }
      } catch (error) {
        console.log('外部LLM生成年度提示词失败，尝试本地LLM:', error.message);
        prompts.yearly = await localLLM.generateText(yearlyPromptTemplate);
        if (prompts.yearly) {
          console.log('使用本地LLM生成年度提示词成功');
          global.promptGenerationProgress[userId].yearly = { status: 'finish', message: '年度提示词生成完成' };
        } else {
          global.promptGenerationProgress[userId].yearly = { status: 'error', message: '年度提示词生成失败' };
        }
      }
    } catch (error) {
      console.error('LLM生成提示词失败:', error);
      // 标记所有未完成的步骤为错误
      Object.keys(global.promptGenerationProgress[userId]).forEach(key => {
        if (global.promptGenerationProgress[userId][key].status === 'active' || global.promptGenerationProgress[userId][key].status === 'waiting') {
          global.promptGenerationProgress[userId][key] = { status: 'error', message: '生成失败' };
        }
      });
      return res.status(500).json({ message: 'AI生成提示词失败，请稍后重试' });
    }
    
    // 处理生成失败的情况，使用默认模板
    const finalPrompts = getDefaultPrompts(prompts, userContext);

    // 保存到用户数据
    user.customPrompts = finalPrompts;
    user.updatedAt = new Date();
    await user.save();

    res.json({
      message: '定制化提示词生成成功',
      prompts: finalPrompts
    });
  } catch (error) {
    console.error('生成定制化提示词失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 处理生成的提示词，为失败的生成提供默认模板
const getDefaultPrompts = (prompts, userContext) => {
  // 基础模板，包含统计功能
  const baseTemplate = `
工作日期: {{date}}
工作条目数量: {{totalEntries}}
总工作时长: {{totalTime}}分钟

工作详情:
{{workDetails}}

`;

  // 默认模板
  const defaultTemplates = {
    daily: baseTemplate + `请根据以上工作记录，生成每日工作总结，要求：
1. 分析和整理用户完成的具体工作内容
2. 对工作内容进行分类梳理（如：核心任务、协调沟通、学习提升等）
3. 评估工作状态和内容质量
4. 分析工作内容与岗位职责的关联性
5. 避免统计无数据支撑的指标
6. 最后对工作记录填写质量评分（1-10分）并给出优化建议`,
    monthly: baseTemplate + `请根据以上工作记录，生成月度工作总结，要求：
1. 统计和分析本月完成的主要工作内容
2. 按工作类型和重要性进行分类整理
3. 分析工作内容与职责目标的匹配度
4. 总结工作状态和效率变化趋势
5. 识别工作模式和习惯
6. 避免统计无数据支撑的指标`,
    yearly: baseTemplate + `请根据以上工作记录，生成年度工作总结，要求：
1. 全面统计和分析全年工作内容
2. 按季度和月度梳理工作发展脉络
3. 分析工作能力和职责履行情况
4. 总结工作成长轨迹和状态变化
5. 评估工作内容的丰富度和深度
6. 避免统计无数据支撑的指标`
  };

  return {
    daily: prompts.daily && prompts.daily.trim() !== '' ? baseTemplate + prompts.daily : defaultTemplates.daily,
    monthly: prompts.monthly && prompts.monthly.trim() !== '' ? baseTemplate + prompts.monthly : defaultTemplates.monthly,
    yearly: prompts.yearly && prompts.yearly.trim() !== '' ? baseTemplate + prompts.yearly : defaultTemplates.yearly
  };
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  upload,
  updateWorkProfile,
  generateCustomPrompts
};