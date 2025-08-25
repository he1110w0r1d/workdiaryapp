const Diary = require('../models/Diary');
const Summary = require('../models/Summary');
const User = require('../models/User');
const Todo = require('../models/Todo');
const LocalLLM = require('../utils/localLLM');
const ExternalLLM = require('../utils/externalLLM');
const { getUserDefaultLLMConfig } = require('./settingsController');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// 动态创建LLM实例以获取最新配置
const createLLMInstances = async (userId = null) => {
  // 如果提供了用户ID，尝试获取用户的LLM配置
  if (userId) {
    const userConfig = await getUserDefaultLLMConfig(userId);
    if (userConfig) {
      // 根据用户配置创建LLM实例
      if (userConfig.provider === 'local') {
        return {
          localLLM: new LocalLLM({
            apiUrl: userConfig.apiUrl,
            model: userConfig.model,
            timeout: userConfig.timeout,
            temperature: userConfig.temperature
          }),
          externalLLM: null
        };
      } else {
        return {
          localLLM: null,
          externalLLM: new ExternalLLM({
            apiKey: userConfig.apiKey,
            apiUrl: userConfig.apiUrl,
            model: userConfig.model,
            timeout: userConfig.timeout,
            temperature: userConfig.temperature,
            maxTokens: userConfig.maxTokens
          })
        };
      }
    }
  }
  
  // 回退到全局配置
  return {
    localLLM: new LocalLLM(),
    externalLLM: new ExternalLLM()
  };
};

// 计算工作时长（分钟）
const calculateWorkTime = (startTime, endTime) => {
  return Math.floor((new Date(endTime) - new Date(startTime)) / (1000 * 60));
};

// 生成标签分布统计
const generateTagDistribution = (diaries) => {
  const tagDistribution = new Map();
  
  diaries.forEach(diary => {
    diary.tags.forEach(tag => {
      tagDistribution.set(tag, (tagDistribution.get(tag) || 0) + 1);
    });
  });
  
  return Object.fromEntries(tagDistribution);
};

// 清理LLM返回的HTML内容，提取纯HTML代码
const cleanHTMLContent = (rawContent) => {
  if (!rawContent) return '';
  
  // 去除markdown代码块标记
  let cleaned = rawContent.replace(/```html\s*/gi, '').replace(/```\s*$/gi, '');
  
  // 查找HTML文档的开始和结束
  const htmlStart = cleaned.indexOf('<!DOCTYPE html>');
  const htmlEnd = cleaned.lastIndexOf('</html>');
  
  if (htmlStart !== -1 && htmlEnd !== -1) {
    // 提取从<!DOCTYPE html>到</html>的内容
    cleaned = cleaned.substring(htmlStart, htmlEnd + 7);
  } else {
    // 如果没有找到完整的HTML结构，尝试查找<html>标签
    const htmlTagStart = cleaned.indexOf('<html');
    const htmlTagEnd = cleaned.lastIndexOf('</html>');
    
    if (htmlTagStart !== -1 && htmlTagEnd !== -1) {
      cleaned = cleaned.substring(htmlTagStart, htmlTagEnd + 7);
    }
  }
  
  // 去除开头和结尾的说明文字（通常在HTML标签之前或之后）
  cleaned = cleaned.replace(/^[^<]*(?=<!DOCTYPE|<html)/i, '');
  cleaned = cleaned.replace(/<\/html>[^<]*$/i, '</html>');
  
  return cleaned.trim();
};

// 生成HTML网页代码
const generateHTMLPage = async (summaryData, type, summaryContent = '', userId = null) => {
  const { externalLLM } = await createLLMInstances(userId);
  
  try {
    // 读取HTML生成提示词模板
    const templatePath = path.join(__dirname, '../templates/html_generation_prompt.txt');
    let htmlPrompt = '';
    
    if (fs.existsSync(templatePath)) {
      htmlPrompt = fs.readFileSync(templatePath, 'utf8')
        .replace('{{summaryData}}', JSON.stringify(summaryData, null, 2))
        .replace('{{summaryContent}}', summaryContent || '暂无总结内容');
    } else {
      // 如果模板文件不存在，使用原来的简单提示词
      const typeMap = {
        'daily': '每日',
        'weekly': '每周',
        'monthly': '月度',
        'yearly': '年度'
      };
      htmlPrompt = `请根据以下${typeMap[type] || '工作'}总结数据，生成一个美观的HTML网页来展示工作成果。要求：
1. 使用现代化的CSS样式，包含响应式设计
2. 使用图表库（如Chart.js）来可视化数据
3. 包含工作时长统计、标签分布等图表
4. 整体设计要专业美观，适合展示工作成果
5. 请直接返回完整的HTML代码，包含所有CSS和JavaScript

工作总结数据：
${JSON.stringify(summaryData, null, 2)}

请生成完整的HTML代码：`;
    }

    logger.llm('开始使用外部LLM生成HTML内容');

    const rawHtmlContent = await externalLLM._callExternalLLM(htmlPrompt);
    
    logger.llm('外部LLM HTML生成完成');
    
    // 清理HTML内容，去除markdown格式和说明文字
    const cleanedHtmlContent = cleanHTMLContent(rawHtmlContent);
    
    return cleanedHtmlContent;
  } catch (error) {
    logger.warn('生成HTML失败，使用默认模板', { error: error.message });
    return generateDefaultHTML(summaryData, type);
  }
};

// 默认HTML模板
const generateDefaultHTML = (summaryData, type) => {
  const { date, totalWorkTime, diaries, tagDistribution, monthlyWork } = summaryData;
  const year = date.getFullYear();
  const month = type === 'monthly' ? date.getMonth() + 1 : null;
  
  // 生成标题
  let title = '';
  if (type === 'daily') {
    title = `${year}年${date.getMonth() + 1}月${date.getDate()}日工作总结`;
  } else if (type === 'weekly') {
    title = `${year}年第${Math.ceil((date.getDate() + new Date(year, date.getMonth(), 1).getDay()) / 7)}周工作总结`;
  } else if (type === 'monthly') {
    title = `${year}年${month}月工作总结`;
  } else if (type === 'yearly') {
    title = `${year}年工作总结`;
  } else {
    title = `${year}年工作总结`;
  }
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Microsoft YaHei', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { font-size: 1.2em; opacity: 0.9; }
        .content { padding: 40px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: #f8f9fa; padding: 30px; border-radius: 15px; text-align: center; border-left: 5px solid #667eea; }
        .stat-card h3 { color: #333; margin-bottom: 10px; }
        .stat-card .number { font-size: 2em; font-weight: bold; color: #667eea; }
        .chart-container { background: #f8f9fa; padding: 30px; border-radius: 15px; margin-bottom: 30px; }
        .chart-container h3 { margin-bottom: 20px; color: #333; }
        canvas { max-height: 400px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${year}年${month ? month + '月' : ''}工作总结</h1>
            <p>工作成果展示</p>
        </div>
        <div class="content">
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>工作条目</h3>
                    <div class="number">${diaries.length}</div>
                </div>
                <div class="stat-card">
                    <h3>总工作时长</h3>
                    <div class="number">${Math.floor(totalWorkTime / 60)}h${totalWorkTime % 60}m</div>
                </div>
                <div class="stat-card">
                    <h3>工作标签</h3>
                    <div class="number">${Object.keys(tagDistribution).length}</div>
                </div>
            </div>
            <div class="chart-container">
                <h3>工作标签分布</h3>
                <canvas id="tagChart"></canvas>
            </div>
            ${monthlyWork ? `<div class="chart-container">
                <h3>月度工作趋势</h3>
                <canvas id="monthlyChart"></canvas>
            </div>` : ''}
        </div>
    </div>
    <script>
        // 标签分布图表
        const tagCtx = document.getElementById('tagChart').getContext('2d');
        new Chart(tagCtx, {
            type: 'doughnut',
            data: {
                labels: ${JSON.stringify(Object.keys(tagDistribution))},
                datasets: [{
                    data: ${JSON.stringify(Object.values(tagDistribution))},
                    backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
        ${monthlyWork ? `
        // 月度趋势图表
        const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
        new Chart(monthlyCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(Object.keys(monthlyWork))},
                datasets: [{
                    label: '工作时长(分钟)',
                    data: ${JSON.stringify(Object.values(monthlyWork))},
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });` : ''}
    </script>
</body>
</html>`;
};

// 保存HTML文件
const saveHTMLFile = async (htmlContent, userId, type, date) => {
  const uploadsDir = path.join(__dirname, '../uploads/summaries');
  
  // 确保目录存在
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const year = date.getFullYear();
  const month = type === 'monthly' ? String(date.getMonth() + 1).padStart(2, '0') : '';
  const filename = `${userId}_${type}_${year}${month ? '_' + month : ''}.html`;
  const filePath = path.join(uploadsDir, filename);
  
  fs.writeFileSync(filePath, htmlContent, 'utf8');
  
  // 返回相对路径用于存储在数据库中
  return `/uploads/summaries/${filename}`;
};

exports.generateDailySummary = async () => {
  try {
    logger.system('开始生成每日总结');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(yesterday);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const users = await User.find();
    
    for (const user of users) {
      const diaries = await Diary.find({
        user: user._id,
        startTime: {
          $gte: yesterday,
          $lt: tomorrow
        }
      });
      
      if (diaries.length > 0) {
        let totalWorkTime = 0;
        diaries.forEach(diary => {
          totalWorkTime += calculateWorkTime(diary.startTime, diary.endTime);
        });
        
        // 准备基础总结内容
        const baseContent = `
# ${yesterday.toLocaleDateString('zh-CN')} 工作总结

## 工作概览
- 工作条目数量: ${diaries.length}
- 总工作时长: ${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟

## 详细内容
${diaries.map((diary, index) => `
${index + 1}. ${diary.content}
   时间: ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')}
   ${diary.location ? `地点: ${diary.location}` : ''}
   ${diary.tags.length > 0 ? `标签: ${diary.tags.join(', ')}` : ''}
`).join('\n')}
        `.trim();
        
        // 准备LLM所需数据
        const llmData = {
          date: yesterday,
          diaries: diaries,
          totalWorkTime: totalWorkTime,
          user: user
        };
        
        // 尝试使用LLM生成总结
        let summaryContent = baseContent;
        let llmSummary = null;
        
        // 动态创建LLM实例以获取最新配置
        const { localLLM, externalLLM } = await createLLMInstances(user._id);
        
        // 首先尝试使用外部LLM（如果可用）
        if (externalLLM) {
          try {
            llmSummary = await externalLLM.generateSummary(llmData, 'daily', {}, user._id);
            if (llmSummary) {
              logger.llm('使用外部LLM生成总结成功');
            summaryContent = llmSummary;
          }
        } catch (error) {
          logger.warn('外部LLM生成失败，尝试本地LLM', { error: error.message });
          }
        }
        
        // 如果外部LLM失败或不可用，尝试本地LLM
        if (!llmSummary && localLLM) {
          try {
            llmSummary = await localLLM.generateSummary(llmData, 'daily', {}, user._id);
            if (llmSummary) {
              logger.llm('使用本地LLM生成总结成功');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.warn('本地LLM生成失败', { error: error.message });
          }
        }
        
        // 如果所有LLM都失败，使用默认模板
        if (!llmSummary) {
          logger.info('使用默认模板生成总结内容');
        }
        
        // 统计待办事项数据
        const yesterdayStart = new Date(yesterday);
        yesterdayStart.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);
        
        // 昨日新增的待办事项
        const todayTodosCreated = await Todo.countDocuments({
          user: user._id,
          createdAt: {
            $gte: yesterdayStart,
            $lt: yesterdayEnd
          }
        });
        
        // 昨日完成的待办事项
        const todayTodosCompleted = await Todo.countDocuments({
          user: user._id,
          status: '已完成',
          'statusHistory': {
            $elemMatch: {
              status: '已完成',
              changedAt: {
                $gte: yesterdayStart,
                $lt: yesterdayEnd
              }
            }
          }
        });
        
        // 昨日待完成的待办事项（昨日新增但未完成的）
        const todayTodosPending = await Todo.countDocuments({
          user: user._id,
          createdAt: {
            $gte: yesterdayStart,
            $lt: yesterdayEnd
          },
          status: { $ne: '已完成' }
        });
        
        // 数据库中所有未完成的待办事项
        const totalPendingTodos = await Todo.countDocuments({
          user: user._id,
          status: { $in: ['待办'] }
        });

        // 对LLM生成的内容进行占位符替换处理
        if (llmSummary) {
          const workDetails = diaries.map(diary => {
            const workTime = calculateWorkTime(diary.startTime, diary.endTime);
            return `**工作内容**\n- 时间: ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')} (${workTime}分钟)\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`;
          }).join('\n\n');
          
          summaryContent = summaryContent
            .replace(/\{\{date\}\}/g, yesterday.toLocaleDateString('zh-CN'))
            .replace(/\{\{totalEntries\}\}/g, diaries.length)
            .replace(/\{\{totalTime\}\}/g, `${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟`)
            .replace(/\{\{todayTodosCreated\}\}/g, todayTodosCreated)
            .replace(/\{\{todayTodosCompleted\}\}/g, todayTodosCompleted)
            .replace(/\{\{todayTodosPending\}\}/g, todayTodosPending)
            .replace(/\{\{totalPendingTodos\}\}/g, totalPendingTodos)
            .replace(/\{\{workDetails\}\}/g, workDetails);
        }
        
        const summary = new Summary({
          user: user._id,
          type: 'daily',
          date: yesterday,
          content: summaryContent,
          statistics: {
            totalEntries: diaries.length,
            totalTime: totalWorkTime,
            tagDistribution: generateTagDistribution(diaries)
          }
        });
        
        await summary.save();
      }
    }
    
    logger.system('每日总结生成完成');
  } catch (error) {
      logger.error('生成每日总结失败', { error: error.message, stack: error.stack });
    }
};

exports.generateWeeklySummary = async (req, res) => {
  try {
    logger.system('开始生成每周总结...');
    
    const now = new Date();
    // 计算本周的时间范围（周一到周日）
    const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);
    const thisWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 7);
    thisWeekStart.setHours(0, 0, 0, 0);
    thisWeekEnd.setHours(23, 59, 59, 999);
    
    // 只为当前登录用户生成总结
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    logger.info(`为用户 ${user.username} 生成每周总结`);
    
    const diaries = await Diary.find({
      user: user._id,
      startTime: {
        $gte: thisWeekStart,
        $lt: thisWeekEnd
      }
    });
    
    logger.info(`用户 ${user.username} 在 ${thisWeekStart.toLocaleDateString('zh-CN')} 到 ${thisWeekEnd.toLocaleDateString('zh-CN')} 有 ${diaries.length} 条日记`);
    
    if (diaries.length > 0) {
      let totalWorkTime = 0;
      const dailyWork = {};
      
      diaries.forEach(diary => {
        totalWorkTime += calculateWorkTime(diary.startTime, diary.endTime);
        
        const dateKey = new Date(diary.startTime).toDateString();
        dailyWork[dateKey] = (dailyWork[dateKey] || 0) + calculateWorkTime(diary.startTime, diary.endTime);
      });
      
      // 准备基础总结内容
      const baseContent = `
# ${thisWeekStart.toLocaleDateString('zh-CN')} 到 ${thisWeekEnd.toLocaleDateString('zh-CN')} 工作总结

## 周度概览
- 工作天数: ${Object.keys(dailyWork).length}
- 工作条目数量: ${diaries.length}
- 总工作时长: ${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟
- 日均工作时长: ${Math.floor(totalWorkTime / Object.keys(dailyWork).length / 60)}小时${Math.floor((totalWorkTime / Object.keys(dailyWork).length) % 60)}分钟

## 工作分布
${Object.entries(generateTagDistribution(diaries)).map(([tag, count]) => `- ${tag}: ${count}次`).join('\n')}

## 每日工作统计
${Object.entries(dailyWork).map(([date, minutes]) => `- ${new Date(date).toLocaleDateString('zh-CN')}: ${Math.floor(minutes / 60)}小时${minutes % 60}分钟`).join('\n')}
      `.trim();
      
      // 构建工作详情 - 按日期分组，提供更详细的结构化数据
      const workDetailsByDate = {};
      diaries.forEach(diary => {
        const dateKey = new Date(diary.startTime).toLocaleDateString('zh-CN');
        const workTime = calculateWorkTime(diary.startTime, diary.endTime);
        
        if (!workDetailsByDate[dateKey]) {
          workDetailsByDate[dateKey] = {
            date: dateKey,
            entries: [],
            totalTime: 0
          };
        }
        
        workDetailsByDate[dateKey].entries.push({
          content: diary.content,
          startTime: new Date(diary.startTime).toLocaleTimeString('zh-CN'),
          endTime: new Date(diary.endTime).toLocaleTimeString('zh-CN'),
          workTime: workTime,
          tags: diary.tags.join(', '),
          location: diary.location || '未记录地点',
          detailedContent: diary.content // 保留原始内容供LLM直接引用
        });
        workDetailsByDate[dateKey].totalTime += workTime;
      });
      
      // 格式化工作详情 - 提供更结构化的数据供LLM引用
      const workDetails = Object.values(workDetailsByDate)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(dateGroup => {
          const dateHeader = `### ${dateGroup.date} (总时长: ${Math.floor(dateGroup.totalTime / 60)}小时${dateGroup.totalTime % 60}分钟)`;
          const entries = dateGroup.entries.map((entry, index) => 
            `**工作条目 ${index + 1}**\n` +
            `- 具体工作内容: ${entry.detailedContent}\n` +
            `- 工作时间: ${entry.startTime} - ${entry.endTime} (${entry.workTime}分钟)\n` +
            `- 工作标签: ${entry.tags}\n` +
            `- 工作地点: ${entry.location}`
          ).join('\n\n');
          return `${dateHeader}\n\n${entries}`;
        }).join('\n\n');

      // 准备LLM所需数据
      const tagDistribution = generateTagDistribution(diaries);
      const llmData = {
        date: thisWeekStart,
        diaries: diaries,
        totalWorkTime: totalWorkTime,
        totalEntries: diaries.length,
        workDetails: workDetails,
        dailyWork: dailyWork,
        tagDistribution: tagDistribution,
        user: user
      };
      
      // 尝试使用LLM生成总结
      let summaryContent = baseContent;
      let llmSummary = null;
      
      // 动态创建LLM实例以获取最新配置
      const { localLLM, externalLLM } = await createLLMInstances(user._id);
      
      // 首先尝试使用外部LLM（如果可用）
      if (externalLLM) {
        try {
          llmSummary = await externalLLM.generateSummary(llmData, 'weekly', {}, user._id);
          if (llmSummary) {
            logger.llm('使用外部LLM生成的每周总结内容');
            summaryContent = llmSummary;
          }
        } catch (error) {
          logger.info('外部LLM生成每周总结失败，尝试本地LLM:', error.message);
        }
      }
      
      // 如果外部LLM失败或不可用，尝试本地LLM
      if (!llmSummary && localLLM) {
        try {
          llmSummary = await localLLM.generateSummary(llmData, 'weekly', {}, user._id);
          if (llmSummary) {
            logger.llm('使用本地LLM生成的每周总结内容');
            summaryContent = llmSummary;
          }
        } catch (error) {
          logger.info('本地LLM生成每周总结失败:', error.message);
        }
      }
      
      // 如果所有LLM都失败，使用默认模板
      if (!llmSummary) {
        logger.info('使用默认模板生成的每周总结内容');
      }
      
      // 统计周度待办事项数据
      const weekStart = new Date(thisWeekStart);
        const weekEnd = new Date(thisWeekEnd);
      
      // 本周新增的待办事项
      const weekTodosCreated = await Todo.countDocuments({
        user: user._id,
        createdAt: {
          $gte: weekStart,
          $lt: weekEnd
        }
      });
      
      // 本周完成的待办事项
      const weekTodosCompleted = await Todo.countDocuments({
        user: user._id,
        status: '已完成',
        'statusHistory': {
          $elemMatch: {
            status: '已完成',
            changedAt: {
              $gte: weekStart,
              $lt: weekEnd
            }
          }
        }
      });
      
      // 本周待完成的待办事项（本周新增但未完成的）
      const weekTodosPending = await Todo.countDocuments({
        user: user._id,
        createdAt: {
          $gte: weekStart,
          $lt: weekEnd
        },
        status: { $ne: '已完成' }
      });
      
      // 数据库中所有未完成的待办事项
      const totalPendingTodos = await Todo.countDocuments({
        user: user._id,
        status: { $in: ['待办'] }
      });

      // 构建summaryData对象用于嵌套占位符替换
      const workDetailsByDateArray = Object.values(workDetailsByDate).sort((a, b) => new Date(a.date) - new Date(b.date));
      const avgDailyHours = workDetailsByDateArray.length > 0 ? Math.round((totalWorkTime / 60) / workDetailsByDateArray.length * 10) / 10 : 0;
      
      // 找出最高效的工作日
      let mostProductiveDay = '无数据';
      let mostTasks = 0;
      workDetailsByDateArray.forEach(dayData => {
        if (dayData.entries.length > mostTasks) {
          mostTasks = dayData.entries.length;
          mostProductiveDay = dayData.date;
        }
      });
      
      // 统计高优先级任务数量（假设包含"重要"、"紧急"等标签的为高优先级）
      const highPriorityTasks = diaries.filter(diary => 
        diary.tags.some(tag => tag.includes('重要') || tag.includes('紧急') || tag.includes('优先'))
      ).length;
      
      const summaryData = {
        avgDailyHours: avgDailyHours,
        mostProductiveDay: mostProductiveDay,
        mostTasks: mostTasks,
        highPriorityTasks: highPriorityTasks
      };
      
      // 构建workDetails嵌套对象
      const workDetailsObj = {};
      workDetailsByDateArray.forEach((dayData, index) => {
        const dayKey = `day${index + 1}`;
        workDetailsObj[dayKey] = {
          date: dayData.date,
          task1: dayData.entries[0]?.detailedContent || '无工作记录',
          time1: dayData.entries[0] ? `${dayData.entries[0].workTime}分钟` : '0分钟',
          task2: dayData.entries[1]?.detailedContent || '',
          issue1: dayData.entries.find(e => e.detailedContent.includes('问题') || e.detailedContent.includes('困难'))?.detailedContent || '',
          deliverable1: dayData.entries.find(e => e.detailedContent.includes('完成') || e.detailedContent.includes('提交'))?.detailedContent || '',
          meeting1: dayData.entries.find(e => e.detailedContent.includes('会议') || e.detailedContent.includes('讨论'))?.detailedContent || '',
          decision1: dayData.entries.find(e => e.detailedContent.includes('决定') || e.detailedContent.includes('决议'))?.detailedContent || ''
        };
      });

      // 对LLM生成的内容进行占位符替换处理
      if (llmSummary) {
        summaryContent = summaryContent
          .replace(/\{\{date\}\}/g, `${thisWeekStart.toLocaleDateString('zh-CN')} 到 ${thisWeekEnd.toLocaleDateString('zh-CN')}`)
          .replace(/\{\{totalEntries\}\}/g, diaries.length)
          .replace(/\{\{totalTime\}\}/g, `${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟`)
          .replace(/\{\{weekTodosCreated\}\}/g, weekTodosCreated)
          .replace(/\{\{weekTodosCompleted\}\}/g, weekTodosCompleted)
          .replace(/\{\{weekTodosPending\}\}/g, weekTodosPending)
          .replace(/\{\{totalPendingTodos\}\}/g, totalPendingTodos)
          .replace(/\{\{workDetails\}\}/g, workDetails)
          .replace(/\{\{userName\}\}/g, user.profile?.name || user.username)
          .replace(/\{\{userPosition\}\}/g, user.workProfile?.position || '未设置')
          .replace(/\{\{userDepartment\}\}/g, user.workProfile?.department || '未设置')
          .replace(/\{\{userLevel\}\}/g, user.workProfile?.level || '未设置')
          .replace(/\{\{userIndustry\}\}/g, user.workProfile?.industry || '未设置')
          .replace(/\{\{userResponsibilities\}\}/g, user.workProfile?.responsibilities || '未设置')
          // 处理summaryData嵌套占位符
          .replace(/\{\{summaryData\.avgDailyHours\}\}/g, summaryData.avgDailyHours)
          .replace(/\{\{summaryData\.mostProductiveDay\}\}/g, summaryData.mostProductiveDay)
          .replace(/\{\{summaryData\.mostTasks\}\}/g, summaryData.mostTasks)
          .replace(/\{\{summaryData\.highPriorityTasks\}\}/g, summaryData.highPriorityTasks);
          
        // 处理workDetails嵌套占位符
        Object.keys(workDetailsObj).forEach(dayKey => {
          const dayData = workDetailsObj[dayKey];
          Object.keys(dayData).forEach(field => {
            const placeholder = `\{\{workDetails\.${dayKey}\.${field}\}\}`;
            const regex = new RegExp(placeholder, 'g');
            summaryContent = summaryContent.replace(regex, dayData[field]);
          });
        });
      }
      
      // 生成HTML网页
      let htmlFilePath = null;
      try {
        logger.system('开始生成每周总结HTML网页...');
        const htmlData = {
          date: thisWeekStart,
          diaries: diaries,
          totalWorkTime: totalWorkTime,
          dailyWork: dailyWork,
          tagDistribution: tagDistribution
        };
        
        const htmlContent = await generateHTMLPage(htmlData, 'weekly', summaryContent, user._id);
        htmlFilePath = await saveHTMLFile(htmlContent, user._id, 'weekly', thisWeekStart);
        logger.info('每周总结HTML网页生成成功:', htmlFilePath);
      } catch (error) {
        logger.error('生成每周总结HTML网页失败:', error);
      }
      
      const summary = new Summary({
        user: user._id,
        type: 'weekly',
        date: thisWeekStart,
        content: summaryContent,
        htmlFilePath: htmlFilePath,
        statistics: {
          totalEntries: diaries.length,
          totalTime: totalWorkTime,
          tagDistribution: tagDistribution
        }
      });
      
      await summary.save();
      logger.info(`为用户 ${user.username} 生成每周总结完成`);
      
      res.json({ 
        success: true, 
        message: `每周总结生成成功`,
        summary: summary
      });
    } else {
      res.status(404).json({ success: false, message: '指定周没有日记数据' });
    }
  } catch (error) {
    logger.error('生成每周总结失败:', error);
    res.status(500).json({ success: false, message: '生成每周总结失败', error: error.message });
  }
};

exports.generateMonthlySummary = async (req, res) => {
  try {
    logger.system('开始生成月度总结...');
    
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // 只为当前登录用户生成总结
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    logger.info(`为用户 ${user.username} 生成月度总结`);
    
    let totalSummariesGenerated = 0;
      const diaries = await Diary.find({
        user: user._id,
        startTime: {
          $gte: lastMonth,
          $lt: currentMonth
        }
      });
      
      logger.info(`用户 ${user.username} 在 ${lastMonth.getFullYear()}年${lastMonth.getMonth() + 1}月 有 ${diaries.length} 条日记`);
      
      if (diaries.length > 0) {
        let totalWorkTime = 0;
        const dailyWork = {};
        
        diaries.forEach(diary => {
          totalWorkTime += calculateWorkTime(diary.startTime, diary.endTime);
          
          const dateKey = new Date(diary.startTime).toDateString();
          dailyWork[dateKey] = (dailyWork[dateKey] || 0) + calculateWorkTime(diary.startTime, diary.endTime);
        });
        
        // 准备基础总结内容
        const baseContent = `
# ${lastMonth.getFullYear()}年${lastMonth.getMonth() + 1}月 工作总结

## 月度概览
- 工作天数: ${Object.keys(dailyWork).length}
- 工作条目数量: ${diaries.length}
- 总工作时长: ${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟
- 日均工作时长: ${Math.floor(totalWorkTime / Object.keys(dailyWork).length / 60)}小时${Math.floor((totalWorkTime / Object.keys(dailyWork).length) % 60)}分钟

## 工作分布
${Object.entries(generateTagDistribution(diaries)).map(([tag, count]) => `- ${tag}: ${count}次`).join('\n')}

## 每日工作统计
${Object.entries(dailyWork).map(([date, minutes]) => `- ${new Date(date).toLocaleDateString('zh-CN')}: ${Math.floor(minutes / 60)}小时${minutes % 60}分钟`).join('\n')}
        `.trim();
        
        // 构建工作详情
        const workDetails = diaries.map(diary => {
          const workTime = calculateWorkTime(diary.startTime, diary.endTime);
          return `**工作内容**\n- 时间: ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')} (${workTime}分钟)\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`;
        }).join('\n\n');

        // 准备LLM所需数据
        const tagDistribution = generateTagDistribution(diaries);
        const llmData = {
          date: lastMonth,
          diaries: diaries,
          totalWorkTime: totalWorkTime,
          totalEntries: diaries.length,
          workDetails: workDetails,
          dailyWork: dailyWork,
          tagDistribution: tagDistribution,
          user: user
        };
        
        // 尝试使用LLM生成总结
        let summaryContent = baseContent;
        let llmSummary = null;
        
        // 动态创建LLM实例以获取最新配置
        const { localLLM, externalLLM } = await createLLMInstances(user._id);
        
        // 首先尝试使用外部LLM（如果可用）
        if (externalLLM) {
          try {
            llmSummary = await externalLLM.generateSummary(llmData, 'monthly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用外部LLM生成的月度总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('外部LLM生成月度总结失败，尝试本地LLM:', error.message);
          }
        }
        
        // 如果外部LLM失败或不可用，尝试本地LLM
        if (!llmSummary && localLLM) {
          try {
            llmSummary = await localLLM.generateSummary(llmData, 'monthly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用本地LLM生成的月度总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('本地LLM生成月度总结失败:', error.message);
          }
        }
        
        // 如果所有LLM都失败，使用默认模板
        if (!llmSummary) {
          logger.info('使用默认模板生成的月度总结内容');
        }
        
        // 统计月度待办事项数据
        const monthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        const monthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        
        // 本月新增的待办事项
        const monthTodosCreated = await Todo.countDocuments({
          user: user._id,
          createdAt: {
            $gte: monthStart,
            $lt: monthEnd
          }
        });
        
        // 本月完成的待办事项
        const monthTodosCompleted = await Todo.countDocuments({
          user: user._id,
          status: '已完成',
          'statusHistory': {
            $elemMatch: {
              status: '已完成',
              changedAt: {
                $gte: monthStart,
                $lt: monthEnd
              }
            }
          }
        });
        
        // 本月待完成的待办事项（本月新增但未完成的）
        const monthTodosPending = await Todo.countDocuments({
          user: user._id,
          createdAt: {
            $gte: monthStart,
            $lt: monthEnd
          },
          status: { $ne: '已完成' }
        });
        
        // 数据库中所有未完成的待办事项
        const totalPendingTodos = await Todo.countDocuments({
          user: user._id,
          status: { $in: ['待办'] }
        });

        // 对LLM生成的内容进行占位符替换处理
        if (llmSummary) {
          summaryContent = summaryContent
            .replace(/\{\{date\}\}/g, `${lastMonth.getFullYear()}年${lastMonth.getMonth() + 1}月`)
            .replace(/\{\{totalEntries\}\}/g, diaries.length)
            .replace(/\{\{totalTime\}\}/g, `${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟`)
            .replace(/\{\{monthTodosCreated\}\}/g, monthTodosCreated)
            .replace(/\{\{monthTodosCompleted\}\}/g, monthTodosCompleted)
            .replace(/\{\{monthTodosPending\}\}/g, monthTodosPending)
            .replace(/\{\{totalPendingTodos\}\}/g, totalPendingTodos)
            .replace(/\{\{workDetails\}\}/g, workDetails)
            .replace(/\{\{userName\}\}/g, user.profile?.name || user.username)
            .replace(/\{\{userPosition\}\}/g, user.workProfile?.position || '未设置')
            .replace(/\{\{userDepartment\}\}/g, user.workProfile?.department || '未设置')
            .replace(/\{\{userLevel\}\}/g, user.workProfile?.level || '未设置')
            .replace(/\{\{userIndustry\}\}/g, user.workProfile?.industry || '未设置')
            .replace(/\{\{userResponsibilities\}\}/g, user.workProfile?.responsibilities || '未设置');
        }
        
        // 生成HTML网页
        let htmlFilePath = null;
        try {
          logger.system('开始生成月度总结HTML网页...');
          const htmlData = {
            date: lastMonth,
            diaries: diaries,
            totalWorkTime: totalWorkTime,
            dailyWork: dailyWork,
            tagDistribution: tagDistribution
          };
          
          const htmlContent = await generateHTMLPage(htmlData, 'monthly', summaryContent, user._id);
          htmlFilePath = await saveHTMLFile(htmlContent, user._id, 'monthly', lastMonth);
          logger.info('月度总结HTML网页生成成功:', htmlFilePath);
        } catch (error) {
          logger.error('生成月度总结HTML网页失败:', error);
        }
        
        const summary = new Summary({
          user: user._id,
          type: 'monthly',
          date: lastMonth,
          content: summaryContent,
          htmlFilePath: htmlFilePath,
          statistics: {
            totalEntries: diaries.length,
            totalTime: totalWorkTime,
            tagDistribution: tagDistribution
          }
        });
        
        await summary.save();
        totalSummariesGenerated++;
        logger.info(`为用户 ${user.username} 生成月度总结完成`);
        
        res.json({ 
          success: true, 
          message: `月度总结生成成功`,
          summary: summary
        });
      } else {
        res.status(404).json({ success: false, message: '指定月份没有日记数据' });
      }
  } catch (error) {
    logger.error('生成月度总结失败:', error);
    res.status(500).json({ success: false, message: '生成月度总结失败', error: error.message });
  }
};

exports.generateCurrentMonthlySummary = async (req, res) => {
  try {
    logger.system('开始生成当月总结...');
    
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    // 只为当前登录用户生成总结
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    logger.info(`为用户 ${user.username} 生成当月总结`);
    
    let totalSummariesGenerated = 0;
      const diaries = await Diary.find({
        user: user._id,
        startTime: {
          $gte: currentMonth,
          $lt: nextMonth
        }
      });
      
      logger.info(`用户 ${user.username} 在 ${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月 有 ${diaries.length} 条日记`);
      
      if (diaries.length > 0) {
        let totalWorkTime = 0;
        const dailyWork = {};
        
        diaries.forEach(diary => {
          totalWorkTime += calculateWorkTime(diary.startTime, diary.endTime);
          
          const dateKey = new Date(diary.startTime).toDateString();
          dailyWork[dateKey] = (dailyWork[dateKey] || 0) + calculateWorkTime(diary.startTime, diary.endTime);
        });
        
        // 准备基础总结内容
        const baseContent = `
# ${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月 工作总结（当月）

## 月度概览
- 工作天数: ${Object.keys(dailyWork).length}
- 工作条目数量: ${diaries.length}
- 总工作时长: ${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟
- 日均工作时长: ${Math.floor(totalWorkTime / Object.keys(dailyWork).length / 60)}小时${Math.floor((totalWorkTime / Object.keys(dailyWork).length) % 60)}分钟

## 工作分布
${Object.entries(generateTagDistribution(diaries)).map(([tag, count]) => `- ${tag}: ${count}次`).join('\n')}

## 每日工作统计
${Object.entries(dailyWork).map(([date, minutes]) => `- ${new Date(date).toLocaleDateString('zh-CN')}: ${Math.floor(minutes / 60)}小时${minutes % 60}分钟`).join('\n')}
        `.trim();
        
        // 构建工作详情
        const workDetails = diaries.map(diary => {
          const workTime = calculateWorkTime(diary.startTime, diary.endTime);
          return `**工作内容**\n- 时间: ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')} (${workTime}分钟)\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`;
        }).join('\n\n');

        // 准备LLM所需数据
        const tagDistribution = generateTagDistribution(diaries);
        const llmData = {
          date: currentMonth,
          diaries: diaries,
          totalWorkTime: totalWorkTime,
          totalEntries: diaries.length,
          workDetails: workDetails,
          dailyWork: dailyWork,
          tagDistribution: tagDistribution,
          user: user
        };
        
        // 尝试使用LLM生成总结
        let summaryContent = baseContent;
        let llmSummary = null;
        
        // 动态创建LLM实例以获取最新配置
        const { localLLM, externalLLM } = await createLLMInstances(user._id);
        
        // 首先尝试使用外部LLM（如果可用）
        if (externalLLM) {
          try {
            llmSummary = await externalLLM.generateSummary(llmData, 'monthly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用外部LLM生成的当月总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('外部LLM生成当月总结失败，尝试本地LLM:', error.message);
          }
        }
        
        // 如果外部LLM失败或不可用，尝试本地LLM
        if (!llmSummary && localLLM) {
          try {
            llmSummary = await localLLM.generateSummary(llmData, 'monthly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用本地LLM生成的当月总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('本地LLM生成当月总结失败:', error.message);
          }
        }
        
        // 如果所有LLM都失败，使用默认模板
        if (!llmSummary) {
          logger.info('使用默认模板生成的当月总结内容');
        }
        
        // 生成HTML网页
        let htmlFilePath = null;
        try {
          logger.system('开始生成当月总结HTML网页...');
          const htmlData = {
            date: currentMonth,
            diaries: diaries,
            totalWorkTime: totalWorkTime,
            dailyWork: dailyWork,
            tagDistribution: tagDistribution
          };
          
          const htmlContent = await generateHTMLPage(htmlData, 'monthly', summaryContent, user._id);
          htmlFilePath = await saveHTMLFile(htmlContent, user._id, 'current_monthly', currentMonth);
          logger.info('当月总结HTML网页生成成功:', htmlFilePath);
        } catch (error) {
          logger.error('生成当月总结HTML网页失败:', error);
        }
        
        const summary = new Summary({
          user: user._id,
          type: 'monthly',
          date: currentMonth,
          content: summaryContent,
          htmlFilePath: htmlFilePath,
          statistics: {
            totalEntries: diaries.length,
            totalTime: totalWorkTime,
            tagDistribution: tagDistribution
          }
        });
        
        await summary.save();
        totalSummariesGenerated++;
        logger.info(`为用户 ${user.username} 生成当月总结完成`);
        
        res.json({ 
          success: true, 
          message: `当月总结生成成功`,
          summary: summary
        });
      } else {
        res.status(404).json({ success: false, message: '当月没有日记数据' });
      }
  } catch (error) {
    logger.error('生成当月总结失败:', error);
    res.status(500).json({ success: false, message: '生成当月总结失败', error: error.message });
  }
};

exports.generateYearlySummary = async (req, res) => {
  try {
    logger.system('开始生成年度总结...');
    
    const now = new Date();
    // 获取请求参数中的年份，如果没有则默认为当前年份
    const targetYear = req.query.year ? parseInt(req.query.year) : now.getFullYear();
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear + 1, 0, 1);
    
    // 只为当前登录用户生成总结
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    logger.info(`为用户 ${user.username} 生成${targetYear}年度总结`);
      const diaries = await Diary.find({
        user: user._id,
        startTime: {
          $gte: yearStart,
          $lt: yearEnd
        }
      });
      
      if (diaries.length > 0) {
        let totalWorkTime = 0;
        const monthlyWork = {};
        const tagStats = generateTagDistribution(diaries);
        
        diaries.forEach(diary => {
          totalWorkTime += calculateWorkTime(diary.startTime, diary.endTime);
          
          const monthKey = `${new Date(diary.startTime).getFullYear()}-${String(new Date(diary.startTime).getMonth() + 1).padStart(2, '0')}`;
          monthlyWork[monthKey] = (monthlyWork[monthKey] || 0) + calculateWorkTime(diary.startTime, diary.endTime);
        });
        
        // 准备基础总结内容
        const baseContent = `
# ${targetYear}年 工作总结

## 年度概览
- 工作条目数量: ${diaries.length}
- 总工作时长: ${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟
- 月均工作时长: ${Math.floor(totalWorkTime / 12 / 60)}小时${Math.floor((totalWorkTime / 12) % 60)}分钟

## 月度工作趋势
${Object.entries(monthlyWork).map(([month, minutes]) => `- ${month}: ${Math.floor(minutes / 60)}小时${minutes % 60}分钟`).join('\n')}

## 工作类型分布
${Object.entries(tagStats).map(([tag, count]) => `- ${tag}: ${count}次`).join('\n')}

## 总结与反思
(此处可添加年度工作总结和个人反思)
        `.trim();
        
        // 构建工作详情
        const workDetails = diaries.map(diary => {
          const workTime = calculateWorkTime(diary.startTime, diary.endTime);
          return `**工作内容**\n- 时间: ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')} (${workTime}分钟)\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`;
        }).join('\n\n');

        // 准备LLM所需数据
        const llmData = {
          date: new Date(targetYear, 0, 1),
          diaries: diaries,
          totalWorkTime: totalWorkTime,
          totalEntries: diaries.length,
          workDetails: workDetails,
          monthlyWork: monthlyWork,
          tagDistribution: tagStats,
          user: user
        };
        
        // 尝试使用LLM生成总结
        let summaryContent = baseContent;
        let llmSummary = null;
        
        // 动态创建LLM实例以获取最新配置
        const { localLLM, externalLLM } = await createLLMInstances(user._id);
        
        // 首先尝试使用外部LLM（如果可用）
        if (externalLLM) {
          try {
            llmSummary = await externalLLM.generateSummary(llmData, 'yearly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用外部LLM生成的年度总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('外部LLM生成年度总结失败，尝试本地LLM:', error.message);
          }
        }
        
        // 如果外部LLM失败或不可用，尝试本地LLM
        if (!llmSummary && localLLM) {
          try {
            llmSummary = await localLLM.generateSummary(llmData, 'yearly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用本地LLM生成的年度总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('本地LLM生成年度总结失败:', error.message);
          }
        }
        
        // 如果所有LLM都失败，使用默认模板
        if (!llmSummary) {
          logger.info('使用默认模板生成的年度总结内容');
        }
        
        // 统计年度待办事项数据
        const yearStart = new Date(targetYear, 0, 1);
        const yearEnd = new Date(targetYear, 11, 31, 23, 59, 59, 999);
        
        // 本年新增的待办事项
        const yearTodosCreated = await Todo.countDocuments({
          user: user._id,
          createdAt: {
            $gte: yearStart,
            $lt: yearEnd
          }
        });
        
        // 本年完成的待办事项
        const yearTodosCompleted = await Todo.countDocuments({
          user: user._id,
          status: '已完成',
          'statusHistory': {
            $elemMatch: {
              status: '已完成',
              changedAt: {
                $gte: yearStart,
                $lt: yearEnd
              }
            }
          }
        });
        
        // 本年待完成的待办事项（本年新增但未完成的）
        const yearTodosPending = await Todo.countDocuments({
          user: user._id,
          createdAt: {
            $gte: yearStart,
            $lt: yearEnd
          },
          status: { $ne: '已完成' }
        });
        
        // 数据库中所有未完成的待办事项
        const totalPendingTodos = await Todo.countDocuments({
          user: user._id,
          status: { $in: ['待办'] }
        });

        // 对LLM生成的内容进行占位符替换处理
        if (llmSummary) {
          summaryContent = summaryContent
            .replace(/\{\{date\}\}/g, `${targetYear}年`)
            .replace(/\{\{totalEntries\}\}/g, diaries.length)
            .replace(/\{\{totalTime\}\}/g, `${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟`)
            .replace(/\{\{yearTodosCreated\}\}/g, yearTodosCreated)
            .replace(/\{\{yearTodosCompleted\}\}/g, yearTodosCompleted)
            .replace(/\{\{yearTodosPending\}\}/g, yearTodosPending)
            .replace(/\{\{totalPendingTodos\}\}/g, totalPendingTodos)
            .replace(/\{\{workDetails\}\}/g, workDetails)
            .replace(/\{\{userName\}\}/g, user.profile?.name || user.username)
            .replace(/\{\{userPosition\}\}/g, user.workProfile?.position || '未设置')
            .replace(/\{\{userDepartment\}\}/g, user.workProfile?.department || '未设置')
            .replace(/\{\{userLevel\}\}/g, user.workProfile?.level || '未设置')
            .replace(/\{\{userIndustry\}\}/g, user.workProfile?.industry || '未设置')
            .replace(/\{\{userResponsibilities\}\}/g, user.workProfile?.responsibilities || '未设置');
        }
        
        // 生成HTML网页
        let htmlFilePath = null;
        try {
          logger.system('开始生成年度总结HTML网页...');
          const htmlData = {
            date: new Date(targetYear, 0, 1),
            diaries: diaries,
            totalWorkTime: totalWorkTime,
            monthlyWork: monthlyWork,
            tagDistribution: tagStats
          };
          
          const htmlContent = await generateHTMLPage(htmlData, 'yearly', summaryContent, user._id);
          htmlFilePath = await saveHTMLFile(htmlContent, user._id, 'yearly', new Date(targetYear, 0, 1));
          logger.info('年度总结HTML网页生成成功:', htmlFilePath);
        } catch (error) {
          logger.error('生成年度总结HTML网页失败:', error);
        }
        
        const summary = new Summary({
          user: user._id,
          type: 'yearly',
          date: new Date(targetYear, 0, 1),
          content: summaryContent,
          htmlFilePath: htmlFilePath,
          statistics: {
            totalEntries: diaries.length,
            totalTime: totalWorkTime,
            tagDistribution: tagStats
          }
        });
        
        await summary.save();
        logger.info(`为用户 ${user.username} 生成年度总结完成`);
        
        res.json({ 
          success: true, 
          message: `年度总结生成成功`,
          summary: summary
        });
      } else {
        res.status(404).json({ success: false, message: '指定年份没有日记数据' });
      }
  } catch (error) {
    logger.error('生成年度总结失败:', error);
    res.status(500).json({ success: false, message: '生成年度总结失败', error: error.message });
  }
};

// API路由处理函数
exports.getSummaries = async (req, res) => {
  try {
    const { type, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    let query = { user: req.user.id };
    
    if (type) {
      query.type = type;
    }
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const summaries = await Summary.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Summary.countDocuments(query);

    res.json({
      summaries,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSummaryById = async (req, res) => {
  try {
    const summary = await Summary.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!summary) {
      return res.status(404).json({ message: '总结未找到' });
    }

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 删除总结
exports.deleteSummary = async (req, res) => {
  try {
    logger.info('删除总结请求:', {
      summaryId: req.params.id,
      userId: req.user.id
    });
    
    const summary = await Summary.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!summary) {
      logger.info('总结未找到:', req.params.id);
      return res.status(404).json({ message: '总结未找到' });
    }

    await Summary.deleteOne({ _id: req.params.id });
    logger.info('总结删除成功:', req.params.id);
    res.json({ message: '总结删除成功' });
  } catch (error) {
    logger.error('生成今日总结失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 获取提示词模板
exports.getPromptTemplate = async (req, res) => {
  try {
    const { type } = req.params; // daily, monthly, yearly, html_generation
    
    const validTypes = ['daily', 'weekly', 'monthly', 'yearly', 'html_generation'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: '无效的提示词类型' });
    }
    
    // 特殊处理HTML生成提示词
    if (type === 'html_generation') {
      const htmlTemplatePath = path.join(__dirname, '../templates', 'html_generation_prompt.txt');
      if (fs.existsSync(htmlTemplatePath)) {
        const content = fs.readFileSync(htmlTemplatePath, 'utf8');
        return res.json({ type, content });
      }
    }
    
    // 优先返回用户的定制化提示词
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (user && user.customPrompts && user.customPrompts[type]) {
      const content = user.customPrompts[type];
      return res.json({ type, content });
    }
    
    // 如果没有定制化提示词，返回默认模板
    const templatePath = path.join(__dirname, '../templates', `${type}_summary_prompt.txt`);
    
    if (fs.existsSync(templatePath)) {
      const content = fs.readFileSync(templatePath, 'utf8');
      res.json({ type, content });
    } else {
      res.status(404).json({ message: '提示词模板不存在' });
    }
  } catch (error) {
    logger.error('获取提示词模板失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 更新提示词模板
exports.updatePromptTemplate = async (req, res) => {
  try {
    const { type } = req.params;
    const { content } = req.body;
    
    const validTypes = ['daily', 'weekly', 'monthly', 'yearly', 'html_generation'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: '无效的提示词类型' });
    }
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: '提示词内容不能为空' });
    }
    
    // 特殊处理HTML生成提示词 - 保存到文件系统
    if (type === 'html_generation') {
      const htmlTemplatePath = path.join(__dirname, '../templates', 'html_generation_prompt.txt');
      fs.writeFileSync(htmlTemplatePath, content, 'utf8');
      return res.json({ message: 'HTML生成提示词更新成功' });
    }
    
    // 对于其他类型的提示词，保存到用户的数据库记录中
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 初始化customPrompts对象（如果不存在）
    if (!user.customPrompts) {
      user.customPrompts = {};
    }
    
    // 保存用户的自定义提示词
    user.customPrompts[type] = content;
    await user.save();
    
    res.json({ message: '提示词模板更新成功' });
  } catch (error) {
    logger.error('更新提示词模板失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 重新生成昨日总结
exports.regenerateDailySummary = async (req, res) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(yesterday);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 查找昨日的工作日记
    const diaries = await Diary.find({
      user: req.user.id,
      startTime: {
        $gte: yesterday,
        $lt: tomorrow
      }
    });
    
    if (diaries.length === 0) {
      return res.status(404).json({ message: '昨日没有工作日记记录' });
    }
    
    // 删除已存在的昨日总结
    await Summary.deleteOne({
      user: req.user.id,
      type: 'daily',
      date: yesterday
    });
    
    // 计算总工作时长
    const totalWorkTime = diaries.reduce((total, diary) => {
      return total + calculateWorkTime(diary.startTime, diary.endTime);
    }, 0);
    
    // 生成基础总结内容
    const baseContent = `
# ${yesterday.toLocaleDateString('zh-CN')} 工作总结

## 工作概览
- 工作条目数量: ${diaries.length}
- 总工作时长: ${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟

## 工作详情
${diaries.map(diary => `### 工作内容\n- 开始时间: ${new Date(diary.startTime).toLocaleTimeString('zh-CN')}\n- 结束时间: ${new Date(diary.endTime).toLocaleTimeString('zh-CN')}\n- 工作时长: ${calculateWorkTime(diary.startTime, diary.endTime)}分钟\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`).join('\n\n')}

## 工作分布
${Object.entries(generateTagDistribution(diaries)).map(([tag, count]) => `- ${tag}: ${count}次`).join('\n')}
    `.trim();
    
    // 获取用户信息
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 准备LLM所需数据
    const llmData = {
      date: yesterday,
      diaries: diaries,
      totalWorkTime: totalWorkTime,
      user: user
    };
    
    // 尝试使用LLM生成总结
    let summaryContent = baseContent;
    let llmSummary = null;
    
    // 动态创建LLM实例以获取最新配置
    const { localLLM, externalLLM } = await createLLMInstances(req.user.id);
    
    // 首先尝试使用外部LLM（如果可用）
    if (externalLLM) {
      try {
        logger.llm('尝试使用外部LLM生成总结...');
        llmSummary = await externalLLM.generateSummary(llmData, 'daily');
        if (llmSummary) {
          logger.llm('使用外部LLM重新生成的总结内容');
          summaryContent = llmSummary;
        }
      } catch (error) {
        logger.info('外部LLM生成失败，尝试本地LLM:', error.message);
        logger.error('外部LLM错误详情:', error);
      }
    }
    
    // 如果外部LLM失败或不可用，尝试本地LLM
    if (!llmSummary && localLLM) {
      try {
        logger.llm('尝试使用本地LLM生成总结...');
        llmSummary = await localLLM.generateSummary(llmData, 'daily', {}, req.user.id);
        if (llmSummary) {
          logger.llm('使用本地LLM重新生成的总结内容');
          summaryContent = llmSummary;
        }
      } catch (error) {
        logger.info('本地LLM生成失败:', error.message);
        logger.error('本地LLM错误详情:', error);
      }
    }
    
    // 如果所有LLM都失败，使用默认模板
    if (!llmSummary) {
      logger.info('使用默认模板重新生成的总结内容');
    }
    
    // 对LLM生成的内容进行占位符替换处理
    if (llmSummary) {
      const workDetails = diaries.map(diary => {
          const workTime = calculateWorkTime(diary.startTime, diary.endTime);
          return `**工作内容**\n- 时间: ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')} (${workTime}分钟)\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`;
        }).join('\n\n');
      
      summaryContent = summaryContent
        .replace(/\{\{date\}\}/g, yesterday.toLocaleDateString('zh-CN'))
        .replace(/\{\{totalEntries\}\}/g, diaries.length)
        .replace(/\{\{totalTime\}\}/g, `${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟`)
        .replace(/\{\{workDetails\}\}/g, workDetails);
    }
    
    // 创建新的总结
    const summary = new Summary({
      user: req.user.id,
      type: 'daily',
      date: yesterday,
      content: summaryContent,
      statistics: {
        totalEntries: diaries.length,
        totalTime: totalWorkTime,
        tagDistribution: generateTagDistribution(diaries)
      }
    });
    
    await summary.save();
    
    res.json({
      message: '昨日工作总结重新生成成功',
      summary: summary
    });
    
  } catch (error) {
    logger.error('重新生成昨日总结失败:', error);
    logger.error('错误堆栈:', error.stack);
    res.status(500).json({ message: '重新生成总结失败: ' + error.message });
  }
};

// 生成今日总结
exports.generateTodaySummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 查找今日的工作日记
    const diaries = await Diary.find({
      user: req.user.id,
      startTime: {
        $gte: today,
        $lt: tomorrow
      }
    });
    
    if (diaries.length === 0) {
      return res.status(404).json({ message: '今日暂无工作日记记录' });
    }
    
    // 删除已存在的今日总结
    await Summary.deleteOne({
      user: req.user.id,
      type: 'daily',
      date: today
    });
    
    // 计算总工作时长
    const totalWorkTime = diaries.reduce((total, diary) => {
      return total + calculateWorkTime(diary.startTime, diary.endTime);
    }, 0);
    
    // 生成基础总结内容
    const baseContent = `
# ${today.toLocaleDateString('zh-CN')} 工作总结

## 工作概览
- 工作条目数量: ${diaries.length}
- 总工作时长: ${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟

## 工作详情
${diaries.map(diary => `### 工作内容\n- 开始时间: ${new Date(diary.startTime).toLocaleTimeString('zh-CN')}\n- 结束时间: ${new Date(diary.endTime).toLocaleTimeString('zh-CN')}\n- 工作时长: ${calculateWorkTime(diary.startTime, diary.endTime)}分钟\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`).join('\n\n')}

## 工作分布
${Object.entries(generateTagDistribution(diaries)).map(([tag, count]) => `- ${tag}: ${count}次`).join('\n')}
    `.trim();
    
    // 获取用户信息
    const user = await User.findById(req.user.id);
    
    // 构建工作详情
    const workDetails = diaries.map(diary => {
      const workTime = calculateWorkTime(diary.startTime, diary.endTime);
      return `**工作内容**\n- 时间: ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')} (${workTime}分钟)\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`;
    }).join('\n\n');

    // 准备LLM所需数据
    const llmData = {
      date: today,
      diaries: diaries,
      totalWorkTime: totalWorkTime,
      totalEntries: diaries.length,
      workDetails: workDetails,
      user: user
    };
    
    // 尝试使用LLM生成总结
    let summaryContent = baseContent;
    let llmSummary = null;
    
    const { externalLLM, localLLM } = await createLLMInstances(req.user.id);
    
    // 首先尝试外部LLM（如果可用）
    if (!llmSummary && externalLLM) {
      try {
        logger.llm('尝试使用外部LLM生成今日总结...');
        llmSummary = await externalLLM.generateSummary(llmData, 'daily', {}, req.user.id);
        if (llmSummary) {
          logger.llm('使用外部LLM生成的今日总结内容');
          summaryContent = llmSummary;
        }
      } catch (error) {
        logger.info('外部LLM生成今日总结失败，尝试本地LLM:', error.message);
        logger.error('外部LLM错误详情:', error);
      }
    }

    // 如果外部LLM失败或不可用，尝试本地LLM
    if (!llmSummary && localLLM) {
      try {
        logger.llm('尝试使用本地LLM生成今日总结...');
        llmSummary = await localLLM.generateSummary(llmData, 'daily', {}, req.user.id);
        if (llmSummary) {
          logger.llm('使用本地LLM生成的今日总结内容');
          summaryContent = llmSummary;
        }
      } catch (error) {
        logger.info('本地LLM生成失败:', error.message);
        logger.error('本地LLM错误详情:', error);
      }
    }
    
    // 如果所有LLM都失败，使用默认模板
    if (!llmSummary) {
      logger.info('使用默认模板生成的今日总结内容');
    }
    
    // 统计待办事项数据
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    // 今日新增的待办事项
    const todayTodosCreated = await Todo.countDocuments({
      user: req.user.id,
      createdAt: {
        $gte: todayStart,
        $lt: todayEnd
      }
    });
    
    // 今日完成的待办事项
    const todayTodosCompleted = await Todo.countDocuments({
      user: req.user.id,
      status: '已完成',
      'statusHistory': {
        $elemMatch: {
          status: '已完成',
          changedAt: {
            $gte: todayStart,
            $lt: todayEnd
          }
        }
      }
    });
    
    // 今日待完成的待办事项（今日新增但未完成的）
    const todayTodosPending = await Todo.countDocuments({
      user: req.user.id,
      createdAt: {
        $gte: todayStart,
        $lt: todayEnd
      },
      status: { $ne: '已完成' }
    });
    
    // 数据库中所有未完成的待办事项
    const totalPendingTodos = await Todo.countDocuments({
      user: req.user.id,
      status: { $in: ['待办'] }
    });

    // 对LLM生成的内容进行占位符替换处理
    if (llmSummary) {
      const workDetails = diaries.map(diary => {
          const workTime = calculateWorkTime(diary.startTime, diary.endTime);
          return `**工作内容**\n- 时间: ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')} (${workTime}分钟)\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`;
        }).join('\n\n');
      
      summaryContent = summaryContent
        .replace(/\{\{date\}\}/g, today.toLocaleDateString('zh-CN'))
        .replace(/\{\{totalEntries\}\}/g, diaries.length)
        .replace(/\{\{totalTime\}\}/g, `${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟`)
        .replace(/\{\{todayTodosCreated\}\}/g, todayTodosCreated)
        .replace(/\{\{todayTodosCompleted\}\}/g, todayTodosCompleted)
        .replace(/\{\{todayTodosPending\}\}/g, todayTodosPending)
        .replace(/\{\{totalPendingTodos\}\}/g, totalPendingTodos)
        .replace(/\{\{workDetails\}\}/g, workDetails);
    }
    
    // 创建新的总结
    const summary = new Summary({
      user: req.user.id,
      type: 'daily',
      date: today,
      content: summaryContent,
      statistics: {
        totalEntries: diaries.length,
        totalTime: totalWorkTime,
        tagDistribution: generateTagDistribution(diaries)
      }
    });
    
    await summary.save();
    
    res.json({ message: '今日总结生成成功', summary });
  } catch (error) {
    logger.error('生成今日总结失败:', error);
    res.status(500).json({ message: '生成失败: ' + error.message });
  }
};

// ==================== 定时任务专用批量处理函数 ====================

// 批量生成所有用户的周报总结（定时任务专用）
exports.batchGenerateWeeklySummary = async () => {
  try {
    logger.system('开始批量生成周报总结...');
    
    const now = new Date();
    // 计算上周的时间范围（周一到周日）
    const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 6);
    const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    lastWeekStart.setHours(0, 0, 0, 0);
    lastWeekEnd.setHours(23, 59, 59, 999);
    
    const users = await User.find();
    logger.info(`找到 ${users.length} 个用户`);
    
    let totalSummariesGenerated = 0;
    
    for (const user of users) {
      const diaries = await Diary.find({
        user: user._id,
        startTime: {
          $gte: lastWeekStart,
          $lt: lastWeekEnd
        }
      });
      
      logger.info(`用户 ${user.username} 在 ${lastWeekStart.toLocaleDateString('zh-CN')} 到 ${lastWeekEnd.toLocaleDateString('zh-CN')} 有 ${diaries.length} 条日记`);
      
      if (diaries.length > 0) {
        let totalWorkTime = 0;
        const dailyWork = {};
        
        diaries.forEach(diary => {
          totalWorkTime += calculateWorkTime(diary.startTime, diary.endTime);
          
          const dateKey = new Date(diary.startTime).toDateString();
          dailyWork[dateKey] = (dailyWork[dateKey] || 0) + calculateWorkTime(diary.startTime, diary.endTime);
        });
        
        // 准备基础总结内容
        const baseContent = `
# ${lastWeekStart.toLocaleDateString('zh-CN')} 到 ${lastWeekEnd.toLocaleDateString('zh-CN')} 工作总结

## 周度概览
- 工作天数: ${Object.keys(dailyWork).length}
- 工作条目数量: ${diaries.length}
- 总工作时长: ${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟
- 平均每日工作时长: ${Math.floor(totalWorkTime / Object.keys(dailyWork).length / 60)}小时${Math.floor((totalWorkTime / Object.keys(dailyWork).length) % 60)}分钟

## 工作内容分析
${diaries.map(diary => {
  const workTime = calculateWorkTime(diary.startTime, diary.endTime);
  return `**工作内容**\n- 时间: ${new Date(diary.startTime).toLocaleDateString('zh-CN')} ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')} (${workTime}分钟)\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`;
}).join('\n\n')}
        `.trim();
        
        let summaryContent = baseContent;
        
        // 准备LLM所需数据
        const tagDistribution = generateTagDistribution(diaries);
        const llmData = {
          date: lastWeekStart,
          diaries: diaries,
          totalWorkTime: totalWorkTime,
          totalEntries: diaries.length,
          workDetails: diaries.map(diary => {
            const workTime = calculateWorkTime(diary.startTime, diary.endTime);
            return {
              date: new Date(diary.startTime).toLocaleDateString('zh-CN'),
              time: `${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')}`,
              duration: `${workTime}分钟`,
              content: diary.content,
              tags: diary.tags,
              priority: diary.workPriority || '中',
              location: diary.location || ''
            };
          }),
          dailyWork: dailyWork,
          tagDistribution: tagDistribution,
          user: user
        };
        
        let llmSummary = null;
        
        // 动态创建LLM实例以获取最新配置
        const { localLLM, externalLLM } = await createLLMInstances(user._id);
        
        // 首先尝试使用外部LLM（如果可用）
        if (externalLLM) {
          try {
            llmSummary = await externalLLM.generateSummary(llmData, 'weekly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用外部LLM生成的周报总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('外部LLM生成周报总结失败，尝试本地LLM:', error.message);
          }
        }
        
        // 如果外部LLM失败或不可用，尝试本地LLM
        if (!llmSummary && localLLM) {
          try {
            llmSummary = await localLLM.generateSummary(llmData, 'weekly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用本地LLM生成的周报总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('本地LLM生成周报总结失败:', error.message);
          }
        }
        
        // 如果所有LLM都失败，使用默认模板
        if (!llmSummary) {
          logger.info('使用默认模板生成的周报总结内容');
        }
        
        // 统计周度待办事项数据
        const weekStart = new Date(lastWeekStart);
        const weekEnd = new Date(lastWeekEnd);
        
        // 本周新增的待办事项
        const weekTodosCreated = await Todo.countDocuments({
          user: user._id,
          createdAt: {
            $gte: weekStart,
            $lt: weekEnd
          }
        });
        
        // 本周完成的待办事项
        const weekTodosCompleted = await Todo.countDocuments({
          user: user._id,
          status: '已完成',
          'statusHistory': {
            $elemMatch: {
              status: '已完成',
              changedAt: {
                $gte: weekStart,
                $lt: weekEnd
              }
            }
          }
        });
        
        // 本周待处理的待办事项
        const weekTodosPending = await Todo.countDocuments({
          user: user._id,
          status: { $in: ['待处理', '进行中'] },
          createdAt: {
            $gte: weekStart,
            $lt: weekEnd
          }
        });
        
        // 总待处理待办事项
        const totalPendingTodos = await Todo.countDocuments({
          user: user._id,
          status: { $in: ['待处理', '进行中'] }
        });
        
        // 构建summaryData和workDetails对象用于占位符替换
        const summaryData = {
          avgDailyHours: Object.keys(dailyWork).length > 0 ? (totalWorkTime / Object.keys(dailyWork).length / 60).toFixed(1) : '0',
          mostProductiveDay: Object.keys(dailyWork).reduce((a, b) => dailyWork[a] > dailyWork[b] ? a : b, Object.keys(dailyWork)[0] || ''),
          highPriorityTasks: diaries.filter(d => d.workPriority === '高').length
        };
        
        // 按日期分组构建workDetails对象
        const workDetailsObj = {};
        const weekDays = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(lastWeekStart);
          currentDate.setDate(currentDate.getDate() + i);
          const dateStr = currentDate.toLocaleDateString('zh-CN');
          const dayDiaries = diaries.filter(d => new Date(d.startTime).toLocaleDateString('zh-CN') === dateStr);
          
          workDetailsObj[weekDays[i]] = {
            date: dateStr,
            tasks: dayDiaries.length,
            hours: dayDiaries.reduce((sum, d) => sum + calculateWorkTime(d.startTime, d.endTime), 0) / 60
          };
        }
        
        // 替换占位符
        if (llmSummary) {
          summaryContent = summaryContent
            .replace(/\{\{date\}\}/g, `${lastWeekStart.toLocaleDateString('zh-CN')} 到 ${lastWeekEnd.toLocaleDateString('zh-CN')}`)
            .replace(/\{\{totalEntries\}\}/g, diaries.length)
            .replace(/\{\{totalTime\}\}/g, `${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟`)
            .replace(/\{\{weekTodosCreated\}\}/g, weekTodosCreated)
            .replace(/\{\{weekTodosCompleted\}\}/g, weekTodosCompleted)
            .replace(/\{\{weekTodosPending\}\}/g, weekTodosPending)
            .replace(/\{\{totalPendingTodos\}\}/g, totalPendingTodos)
            .replace(/\{\{userName\}\}/g, user.username || '')
            .replace(/\{\{userPosition\}\}/g, user.position || '')
            .replace(/\{\{userDepartment\}\}/g, user.department || '');
          
          // 替换summaryData嵌套占位符
          Object.keys(summaryData).forEach(key => {
            const regex = new RegExp(`\\{\\{summaryData\\.${key}\\}\\}`, 'g');
            summaryContent = summaryContent.replace(regex, summaryData[key]);
          });
          
          // 替换workDetails嵌套占位符
          Object.keys(workDetailsObj).forEach(day => {
            Object.keys(workDetailsObj[day]).forEach(prop => {
              const regex = new RegExp(`\\{\\{workDetails\\.${day}\\.${prop}\\}\\}`, 'g');
              summaryContent = summaryContent.replace(regex, workDetailsObj[day][prop]);
            });
          });
        }
        
        // 生成HTML网页
        let htmlFilePath = null;
        try {
          logger.system('开始生成周报总结HTML网页...');
          const htmlData = {
            date: lastWeekStart,
            diaries: diaries,
            totalWorkTime: totalWorkTime,
            dailyWork: dailyWork,
            tagDistribution: tagDistribution
          };
          
          const htmlContent = await generateHTMLPage(htmlData, 'weekly', summaryContent, user._id);
          htmlFilePath = await saveHTMLFile(htmlContent, user._id, 'weekly', lastWeekStart);
          logger.info('周报总结HTML网页生成成功:', htmlFilePath);
        } catch (error) {
          logger.error('生成周报总结HTML网页失败:', error);
        }
        
        const summary = new Summary({
          user: user._id,
          type: 'weekly',
          date: lastWeekStart,
          content: summaryContent,
          htmlFilePath: htmlFilePath,
          statistics: {
            totalEntries: diaries.length,
            totalTime: totalWorkTime,
            tagDistribution: tagDistribution
          }
        });
        
        await summary.save();
        totalSummariesGenerated++;
        logger.info(`为用户 ${user.username} 生成周报总结完成`);
      } else {
        logger.info(`用户 ${user.username} 在指定周没有日记数据，跳过生成`);
      }
    }
    
    logger.info(`周报总结生成完成，共生成 ${totalSummariesGenerated} 个总结`);
  } catch (error) {
    logger.error('批量生成周报总结失败:', error);
  }
};

// 批量生成所有用户的月度总结（定时任务专用）
exports.batchGenerateMonthlySummary = async () => {
  try {
    logger.system('开始批量生成月度总结...');
    
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const users = await User.find();
    logger.info(`找到 ${users.length} 个用户`);
    
    let totalSummariesGenerated = 0;
    
    for (const user of users) {
      const diaries = await Diary.find({
        user: user._id,
        startTime: {
          $gte: lastMonth,
          $lt: currentMonth
        }
      });
      
      logger.info(`用户 ${user.username} 在 ${lastMonth.getFullYear()}年${lastMonth.getMonth() + 1}月 有 ${diaries.length} 条日记`);
      
      if (diaries.length > 0) {
        let totalWorkTime = 0;
        const dailyWork = {};
        
        diaries.forEach(diary => {
          totalWorkTime += calculateWorkTime(diary.startTime, diary.endTime);
          
          const dateKey = new Date(diary.startTime).toDateString();
          dailyWork[dateKey] = (dailyWork[dateKey] || 0) + calculateWorkTime(diary.startTime, diary.endTime);
        });
        
        // 准备基础总结内容
        const baseContent = `
# ${lastMonth.getFullYear()}年${lastMonth.getMonth() + 1}月 工作总结

## 月度概览
- 工作天数: ${Object.keys(dailyWork).length}
- 工作条目数量: ${diaries.length}
- 总工作时长: ${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟
- 平均每日工作时长: ${Math.floor(totalWorkTime / Object.keys(dailyWork).length / 60)}小时${Math.floor((totalWorkTime / Object.keys(dailyWork).length) % 60)}分钟

## 工作内容分析
${diaries.map(diary => {
  const workTime = calculateWorkTime(diary.startTime, diary.endTime);
  return `**工作内容**\n- 时间: ${new Date(diary.startTime).toLocaleDateString('zh-CN')} ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')} (${workTime}分钟)\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`;
}).join('\n\n')}
        `.trim();
        
        let summaryContent = baseContent;
        
        // 准备LLM所需数据
        const llmData = {
          date: lastMonth,
          diaries: diaries,
          totalWorkTime: totalWorkTime,
          dailyWork: dailyWork,
          user: user
        };
        
        let llmSummary = null;
        
        // 动态创建LLM实例以获取最新配置
        const { localLLM, externalLLM } = await createLLMInstances(user._id);
        
        // 首先尝试使用外部LLM（如果可用）
        if (externalLLM) {
          try {
            llmSummary = await externalLLM.generateSummary(llmData, 'monthly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用外部LLM生成的月度总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('外部LLM生成月度总结失败，尝试本地LLM:', error.message);
          }
        }
        
        // 如果外部LLM失败或不可用，尝试本地LLM
        if (!llmSummary && localLLM) {
          try {
            llmSummary = await localLLM.generateSummary(llmData, 'monthly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用本地LLM生成的月度总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('本地LLM生成月度总结失败:', error.message);
          }
        }
        
        // 如果所有LLM都失败，使用默认模板
        if (!llmSummary) {
          logger.info('使用默认模板生成的月度总结内容');
        }
        
        // 生成HTML网页
        let htmlFilePath = null;
        try {
          logger.system('开始生成月度总结HTML网页...');
          const tagDistribution = generateTagDistribution(diaries);
          const htmlData = {
            date: lastMonth,
            diaries: diaries,
            totalWorkTime: totalWorkTime,
            dailyWork: dailyWork,
            tagDistribution: tagDistribution
          };
          
          const htmlContent = await generateHTMLPage(htmlData, 'monthly', summaryContent);
          htmlFilePath = await saveHTMLFile(htmlContent, user._id, 'monthly', lastMonth);
          logger.info('月度总结HTML网页生成成功:', htmlFilePath);
        } catch (error) {
          logger.error('生成月度总结HTML网页失败:', error);
        }
        
        const summary = new Summary({
          user: user._id,
          type: 'monthly',
          date: lastMonth,
          content: summaryContent,
          htmlFilePath: htmlFilePath,
          statistics: {
            totalEntries: diaries.length,
            totalTime: totalWorkTime,
            tagDistribution: generateTagDistribution(diaries)
          }
        });
        
        await summary.save();
        totalSummariesGenerated++;
        logger.info(`为用户 ${user.username} 生成月度总结完成`);
      } else {
        logger.info(`用户 ${user.username} 在指定月份没有日记数据，跳过生成`);
      }
    }
    
    logger.info(`月度总结生成完成，共生成 ${totalSummariesGenerated} 个总结`);
  } catch (error) {
    logger.error('批量生成月度总结失败:', error);
  }
};

// 批量生成所有用户的年度总结（定时任务专用）
exports.batchGenerateYearlySummary = async () => {
  try {
    logger.system('开始批量生成年度总结...');
    
    const now = new Date();
    const lastYear = new Date(now.getFullYear() - 1, 0, 1);
    const currentYear = new Date(now.getFullYear(), 0, 1);
    
    const users = await User.find();
    
    for (const user of users) {
      const diaries = await Diary.find({
        user: user._id,
        startTime: {
          $gte: lastYear,
          $lt: currentYear
        }
      });
      
      if (diaries.length > 0) {
        let totalWorkTime = 0;
        const monthlyWork = {};
        const tagStats = {};
        
        diaries.forEach(diary => {
          totalWorkTime += calculateWorkTime(diary.startTime, diary.endTime);
          
          const monthKey = `${new Date(diary.startTime).getFullYear()}年${new Date(diary.startTime).getMonth() + 1}月`;
          monthlyWork[monthKey] = (monthlyWork[monthKey] || 0) + calculateWorkTime(diary.startTime, diary.endTime);
          
          diary.tags.forEach(tag => {
            tagStats[tag] = (tagStats[tag] || 0) + 1;
          });
        });
        
        // 准备基础总结内容
        const baseContent = `
# ${lastYear.getFullYear()}年 工作总结

## 年度概览
- 工作条目数量: ${diaries.length}
- 总工作时长: ${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟
- 月均工作时长: ${Math.floor(totalWorkTime / 12 / 60)}小时${Math.floor((totalWorkTime / 12) % 60)}分钟

## 月度工作趋势
${Object.entries(monthlyWork).map(([month, minutes]) => `- ${month}: ${Math.floor(minutes / 60)}小时${minutes % 60}分钟`).join('\n')}

## 工作类型分布
${Object.entries(tagStats).map(([tag, count]) => `- ${tag}: ${count}次`).join('\n')}

## 总结与反思
(此处可添加年度工作总结和个人反思)
        `.trim();
        
        // 准备LLM所需数据
        const llmData = {
          date: lastYear,
          diaries: diaries,
          totalWorkTime: totalWorkTime,
          monthlyWork: monthlyWork,
          tagStats: tagStats,
          user: user
        };
        
        let summaryContent = baseContent;
        let llmSummary = null;
        
        // 动态创建LLM实例以获取最新配置
        const { localLLM, externalLLM } = await createLLMInstances(user._id);
        
        // 首先尝试使用外部LLM（如果可用）
        if (externalLLM) {
          try {
            llmSummary = await externalLLM.generateSummary(llmData, 'yearly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用外部LLM生成的年度总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('外部LLM生成年度总结失败，尝试本地LLM:', error.message);
          }
        }
        
        // 如果外部LLM失败或不可用，尝试本地LLM
        if (!llmSummary && localLLM) {
          try {
            llmSummary = await localLLM.generateSummary(llmData, 'yearly', {}, user._id);
            if (llmSummary) {
              logger.llm('使用本地LLM生成的年度总结内容');
              summaryContent = llmSummary;
            }
          } catch (error) {
            logger.info('本地LLM生成年度总结失败:', error.message);
          }
        }
        
        // 如果所有LLM都失败，使用默认模板
        if (!llmSummary) {
          logger.info('使用默认模板生成的年度总结内容');
        }
        
        // 生成HTML网页
        let htmlFilePath = null;
        try {
          logger.system('开始生成年度总结HTML网页...');
          const htmlData = {
            date: lastYear,
            diaries: diaries,
            totalWorkTime: totalWorkTime,
            monthlyWork: monthlyWork,
            tagStats: tagStats
          };
          
          const htmlContent = await generateHTMLPage(htmlData, 'yearly', summaryContent);
          htmlFilePath = await saveHTMLFile(htmlContent, user._id, 'yearly', lastYear);
          logger.info('年度总结HTML网页生成成功:', htmlFilePath);
        } catch (error) {
          logger.error('生成年度总结HTML网页失败:', error);
        }
        
        const summary = new Summary({
          user: user._id,
          type: 'yearly',
          date: lastYear,
          content: summaryContent,
          htmlFilePath: htmlFilePath,
          statistics: {
            totalEntries: diaries.length,
            totalTime: totalWorkTime,
            tagDistribution: tagStats
          }
        });
        
        await summary.save();
      }
    }
    
    logger.system('年度总结生成完成');
  } catch (error) {
    logger.error('批量生成年度总结失败:', error);
  }
};

// 标记总结为已读
exports.markSummaryAsRead = async (req, res) => {
  try {
    const summary = await Summary.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!summary) {
      return res.status(404).json({ message: '总结未找到' });
    }

    summary.isRead = true;
    summary.readAt = new Date();
    await summary.save();

    res.json({ message: '已标记为已读', summary });
  } catch (error) {
    logger.error('标记总结已读失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 获取未读总结数量统计
exports.getUnreadSummariesCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 统计各类型未读总结数量
    const dailyUnreadCount = await Summary.countDocuments({
      user: userId,
      type: 'daily',
      isRead: false
    });
    
    const weeklyUnreadCount = await Summary.countDocuments({
      user: userId,
      type: 'weekly',
      isRead: false
    });
    
    const monthlyUnreadCount = await Summary.countDocuments({
      user: userId,
      type: 'monthly',
      isRead: false
    });
    
    const yearlyUnreadCount = await Summary.countDocuments({
      user: userId,
      type: 'yearly',
      isRead: false
    });
    
    const totalUnreadCount = dailyUnreadCount + weeklyUnreadCount + monthlyUnreadCount + yearlyUnreadCount;
    
    res.json({
      total: totalUnreadCount,
      daily: dailyUnreadCount,
      weekly: weeklyUnreadCount,
      monthly: monthlyUnreadCount,
      yearly: yearlyUnreadCount
    });
  } catch (error) {
    logger.error('获取未读总结数量失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 批量标记总结为已读
exports.markAllSummariesAsRead = async (req, res) => {
  try {
    const { type } = req.body; // 可选：指定类型，如果不指定则标记所有
    const userId = req.user.id;
    
    let query = { user: userId, isRead: false };
    if (type) {
      query.type = type;
    }
    
    const result = await Summary.updateMany(query, {
      isRead: true,
      readAt: new Date()
    });
    
    res.json({ 
      message: '批量标记已读成功', 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    logger.error('批量标记总结已读失败:', error);
    res.status(500).json({ message: error.message });
  }
};