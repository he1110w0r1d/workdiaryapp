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
const ragController = require('./ragController');

// 动态创建LLM实例以获取最新配置
const createLLMInstances = async (userId = null) => {
  // 如果提供了用户ID，尝试获取用户的LLM配置
  if (userId) {
    const userConfig = await getUserDefaultLLMConfig(userId);
    if (userConfig) {
      // 记录使用的用户默认LLM配置
      try {
        logger.llm('使用用户默认LLM配置', {
          userId,
          provider: userConfig.provider,
          apiUrl: userConfig.apiUrl,
          model: userConfig.model,
          isExternal: userConfig.provider !== 'local'
        });
      } catch (_) {}
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
            maxTokens: userConfig.maxTokens,
            enabled: true,  // 确保启用外部LLM
            provider: userConfig.provider  // 确保设置提供商类型
          })
        };
      }
    } else {
      try {
        logger.llm('未找到用户默认LLM配置，回退到全局', { userId });
      } catch (_) {}
    }
  }
  
  // 回退到全局配置
  const useExternal = process.env.LLM_TYPE === 'external';
  try {
    logger.llm('使用全局LLM配置', {
      useExternal,
      externalProvider: process.env.EXTERNAL_LLM_PROVIDER,
      externalModel: process.env.EXTERNAL_LLM_MODEL,
      localEnabled: process.env.USE_LOCAL_LLM === 'true',
      localModel: process.env.LOCAL_LLM_MODEL
    });
  } catch (_) {}
  return {
    localLLM: new LocalLLM(),
    externalLLM: new ExternalLLM({
      enabled: useExternal  // 根据环境变量设置启用状态
    })
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

// ===== LLM 待办建议辅助函数 =====
// 构建每日待办建议提示词（严格JSON输出）
const buildDailyTodoSuggestionPrompt = (user, diaries, date) => {
  const dateStr = date.toLocaleDateString('zh-CN');
  const diaryItems = diaries.map(d => ({
    id: String(d._id),
    startTime: new Date(d.startTime).toISOString(),
    endTime: new Date(d.endTime).toISOString(),
    durationMin: Math.floor((new Date(d.endTime) - new Date(d.startTime)) / (1000 * 60)),
    content: d.content,
    tags: d.tags || [],
    priority: d.workPriority || '中'
  }));

  return [
    '你是一位严谨的工作助理。根据当天工作日记，判断是否需要新增待办。',
    `日期: ${dateStr}`,
    `用户级别: ${(user.level || '中级')}`,
    '工作日记(JSON):',
    JSON.stringify(diaryItems, null, 2),
    '',
    '请仅输出合法JSON（不要任何解释文字），遵循此数据结构：',
    '{',
    '  "shouldCreateTodo": true|false,',
    '  "todos": [',
    '    {',
    '      "content": "字符串，清晰可执行的待办项",',
    '      "dueDate": "YYYY-MM-DD",',
    '      "priority": "高|中|低",',
    '      "relatedDiaryIds": ["日记ID", "可选更多"]',
    '    }',
    '  ]',
    '}',
    '',
    '规则：',
    '1) 若不需要待办，shouldCreateTodo=false，todos=[]。',
    '2) 最多给出3条，必须具体可执行；不写泛泛而谈。',
    '3) 默认截止日期为次日；如确有紧急度可适当安排更早日期。',
    '4) priority 合理分配：紧急且重要为高，常规为中，非紧急为低。',
    '5) relatedDiaryIds 参考涉及的日记。',
  ].join('\n');
};

// 从总结文本构建严格JSON提取提示词（两步法第二步）
// 作用：给LLM一段已生成的“工作总结”，要求仅提取其中“待办判断与建议”部分为严格JSON
// 输出结构：
// {
//   "shouldCreateTodo": true|false,
//   "todos": [
//     { "content": "...", "dueDate": "YYYY-MM-DD", "priority": "高|中|低", "relatedDiaryIds": ["..."] }
//   ]
// }
function buildTodoJSONFromSummaryPrompt(summaryText, user, date) {
  const dateStr = new Date(date).toLocaleDateString('zh-CN');
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  return [
    '你是一位严谨的工作助理。下面是一段“工作总结”文本，请专注从其中的“待办判断与建议”部分提取结构化JSON。',
    `日期: ${dateStr}`,
    `用户级别: ${(user && user.level) ? user.level : '中级'}`,
    '',
    '仅输出合法JSON（不要任何代码块标记、不要额外解释文字），数据结构严格如下：',
    '{',
    '  "shouldCreateTodo": true|false,',
    '  "todos": [',
    '    {',
    '      "content": "字符串，清晰可执行的待办项",',
    '      "dueDate": "YYYY-MM-DD",',
    '      "priority": "高|中|低",',
    '      "relatedDiaryIds": ["可选的相关日记ID"]',
    '    }',
    '  ]',
    '}',
    '',
    '规则：',
    '1) 若不需要待办，shouldCreateTodo=false，todos=[]。',
    '2) 最多给出3条，必须具体可执行，不要泛泛而谈。',
    `3) 若总结未明确截止日期，默认使用翌日：${tomorrowStr}。`,
    '4) 优先级：紧急且重要为高，常规为中，非紧急为低。',
    '5) relatedDiaryIds 可为空；如总结中提到具体日记ID，则保留。',
    '',
    '待解析的工作总结文本：',
    summaryText || '',
  ].join('\n');
}

// 安全解析LLM返回的JSON
const safeParseTodoJSON = (text) => {
  if (!text || typeof text !== 'string') return null;

  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  };

  let candidate = text.trim();
  // 1) 直接解析
  let parsed = tryParse(candidate);
  if (parsed) return parsed;

  // 2) 提取首尾大括号包裹的对象
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    candidate = candidate.slice(start, end + 1);
    parsed = tryParse(candidate);
    if (parsed) return parsed;
  }

  // 3) 清理常见噪音：代码块标记、列表短横线、尾随逗号、全角引号
  let cleaned = candidate
    // 去掉所有围栏代码块标记（不局限开头/结尾）
    .replace(/```[a-zA-Z]*\s*|```/g, '')
    // 移除数组/对象项前的短横线（LLM常将列表项用“- ”表示）
    .replace(/\n\s*-\s*([\[{])/g, '\n$1')
    // 去掉紧跟闭括的尾随逗号（半角）
    .replace(/,\s*([}\]])/g, '$1')
    // 去掉紧跟闭括的尾随逗号（全角）
    .replace(/，\s*([}\]])/g, '$1')
    // 统一全角引号为半角双引号
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, '"')
    // 统一全角冒号为半角冒号
    .replace(/：/g, ':')
    // 去除省略号（ASCII ... 与全角 …）
    .replace(/\u2026/g, '')
    .replace(/\.{3}/g, '')
    // 去除只包含省略号的整行（可能带逗号）
    .replace(/^\s*\.{3}\s*,?\s*$/gm, '')
    // 清理布尔取值模板管道（true|false -> 取第一个布尔值）
    .replace(/\b(true|false)\s*\|\s*(true|false)\b/g, '$1')
    // 去除行首注释
    .replace(/^\s*#.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

  parsed = tryParse(cleaned);
  if (parsed) return parsed;

  // 4) 兜底：再次尝试在清理后的文本中提取最外层对象
  const s2 = cleaned.indexOf('{');
  const e2 = cleaned.lastIndexOf('}');
  if (s2 >= 0 && e2 > s2) {
    const jsonStr2 = cleaned.slice(s2, e2 + 1);
    parsed = tryParse(jsonStr2);
    if (parsed) return parsed;
  }

  // 5) 半结构化兜底解析：容忍轻微格式错误，提取关键字段并构造对象
  try {
    const textAll = cleaned;
    // 提取 shouldCreateTodo（默认 false）
    let shouldCreate = false;
    const mBool = textAll.match(/"shouldCreateTodo"\s*:\s*(true|false)/i);
    if (mBool) {
      shouldCreate = mBool[1].toLowerCase() === 'true';
    }

    // 提取 todos 数组片段
    const mTodos = textAll.match(/"todos"\s*:\s*\[([\s\S]*?)\]/i);
    const todosRaw = mTodos ? mTodos[1] : '';

    const objMatches = todosRaw.match(/\{[\s\S]*?\}/g) || [];
    const todos = [];
    for (const om of objMatches) {
      // 针对每个对象片段做小清理后尝试解析
      const oClean = om
        .replace(/```[a-zA-Z]*\s*|```/g, '')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/，\s*([}\]])/g, '$1')
        .replace(/[“”‘’]/g, '"')
        .replace(/：/g, ':')
        .replace(/\u2026/g, '')
        .replace(/\.{3}/g, '')
        .replace(/^\s*#.*$/gm, '')
        .replace(/\/\/.*$/gm, '');

      let oParsed = tryParse(oClean);
      if (!oParsed) {
        // 直接用正则提取关键字段
        const content = (oClean.match(/"content"\s*:\s*"([\s\S]*?)"/) || [])[1] || '';
        const dueDate = (oClean.match(/"dueDate"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2})"/) || [])[1] || '';
        const priority = (oClean.match(/"priority"\s*:\s*"([^"]+)"/) || [])[1] || '';
        const idsMatch = oClean.match(/"relatedDiaryIds"\s*:\s*\[([\s\S]*?)\]/);
        let relatedDiaryIds = [];
        if (idsMatch && idsMatch[1]) {
          const idStr = idsMatch[1].replace(/\s+/g, '');
          relatedDiaryIds = (idStr.match(/"([^"]+)"/g) || []).map(s => s.replace(/"/g, ''));
        }
        oParsed = { content, dueDate, priority, relatedDiaryIds };
      }

      // 基本校验，过滤空content
      if (oParsed && (oParsed.content || '').trim()) {
        todos.push({
          content: oParsed.content.trim(),
          dueDate: oParsed.dueDate || '',
          priority: oParsed.priority || '中',
          relatedDiaryIds: Array.isArray(oParsed.relatedDiaryIds) ? oParsed.relatedDiaryIds : []
        });
      }
    }

    return { shouldCreateTodo: shouldCreate, todos };
  } catch (_) {}

  return null;
};

// 创建待办（去重与校验）
const createTodosFromSuggestions = async (userId, suggestions, diaries) => {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return { created: 0 };

  const MAX_PER_DAY = 3;
  const created = [];

  // 今天的时间范围用于去重
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  for (const s of suggestions.slice(0, MAX_PER_DAY)) {
    const content = (s && s.content || '').trim();
    if (!content) continue;

    // 重复检测：同一用户、同一内容、当天已存在
    const dup = await Todo.findOne({
      user: userId,
      content,
      createdAt: { $gte: todayStart, $lte: todayEnd },
      isDeleted: false
    });
    if (dup) continue;

    // 解析截止日期
    let dueDate = null;
    if (s && s.dueDate) {
      const parsed = new Date(s.dueDate);
      if (!isNaN(parsed.getTime())) dueDate = parsed;
    }
    if (!dueDate) {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      dueDate.setHours(18, 0, 0, 0);
    }

    // 优先级
    const priority = ['高', '中', '低'].includes(s.priority) ? s.priority : '中';

    // 关联日记（取第一个合法ID）
    let relatedDiary = null;
    if (Array.isArray(s.relatedDiaryIds) && s.relatedDiaryIds.length > 0) {
      const idSet = new Set(diaries.map(d => String(d._id)));
      const chosen = s.relatedDiaryIds.find(id => idSet.has(String(id)));
      if (chosen) relatedDiary = chosen;
    }

    const todo = new Todo({
      user: userId,
      content,
      priority,
      dueDate,
      relatedDiary: relatedDiary || null
    });
    await todo.save();

    // 若有关联日记，同步标记
    if (relatedDiary) {
      try {
        await Diary.findByIdAndUpdate(relatedDiary, {
          isTodo: true,
          relatedTodo: todo._id,
          todoStatus: '待办'
        });
      } catch (_) {}
    }

    created.push(todo);
  }

  return { created: created.length };
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
    
    // 如果生成内容为空或过短，或缺少关键闭合标签，则回退默认模板，避免保存空白文件
    if (!cleanedHtmlContent || cleanedHtmlContent.length < 500 || !/<\/html>/i.test(cleanedHtmlContent)) {
      logger.warn('HTML生成结果不完整，回退默认模板');
      return generateDefaultHTML(summaryData, type);
    }
    
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
        
        // 准备基础总结内容（无LLM回退为占位符模板，后续进行替换）
        const baseContent = `
# {{date}} 工作总结

## 工作概览
- 工作条目数量: {{totalEntries}}
- 总工作时长: {{totalTime}}

## 工作详情
{{workDetails}}

## 待办统计
- 昨日新增: {{todayTodosCreated}}
- 昨日完成: {{todayTodosCompleted}}
- 昨日未完成: {{todayTodosPending}}
- 当前总未完成: {{totalPendingTodos}}
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
        let llmName = null;
        let llmUsed = 'none';
        
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

        // 如果使用LLM生成内容，直接使用LLM内容
        if (llmSummary) {
          summaryContent = llmSummary;
        } else {
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

        // 每日总结后，按“昨日”范围同步到 Dify（避免全量同步）
        try {
          const difyCtrl = require('./difyController');
          const startDate = new Date(yesterday);
          const endDate = new Date(tomorrow);
          const result = await difyCtrl.syncUserDiariesForDate(user._id, startDate, endDate);
          if (result && result.success) {
            logger.llm('每日总结后已按日期同步到Dify', { user: user.username, created: result.created, updated: result.updated });
          } else {
            logger.warn('每日总结后按日期同步到Dify失败', { user: user.username, message: result && result.message });
          }
        } catch (err) {
          logger.warn('每日总结后触发Dify同步异常', { user: user.username, message: err.message });
        }

        // 在每日总结完成后，自动重建该用户的RAG索引
        try {
          const stats = await ragController.reindexForUser(user._id);
          logger.system(`已为用户 ${user.username} 自动重建RAG索引：日记${stats.indexedDiaries}，片段${stats.indexedChunks}`);
        } catch (error) {
          logger.warn('每日总结后自动重建索引失败', { error: error.message });
        }

        // 生成LLM待办建议并创建待办（昨日，增强两步与救援解析）
        try {
          const { localLLM, externalLLM } = await createLLMInstances(user._id);
          const prompt = buildTodoJSONFromSummaryPrompt(summary.content || summaryContent, user, yesterday);
          const strictPrompt = `${prompt}\n\n注意：只输出纯JSON，不要使用任何代码块标记，不要任何解释文本。`;
          let suggestionText = null;

          // 1) 优先尝试外部LLM，提升maxTokens避免截断
          if (externalLLM) {
            try {
              suggestionText = await externalLLM.generateText(prompt, { temperature: 0.1, maxTokens: 3000 }, user._id);
            } catch (err) {
              logger.warn('外部LLM待办建议失败，尝试其他策略', { error: err.message });
            }
          }

          // 2) 如果首次结果为空，尝试本地LLM
          if (!suggestionText && localLLM) {
            try {
              suggestionText = await localLLM.generateText(prompt, { temperature: 0.1, maxTokens: 3000 }, user._id);
            } catch (err) {
              logger.warn('本地LLM待办建议失败', { error: err.message });
            }
          }

          // 3) 解析与救援：先用安全解析，失败则尝试提取首尾大括号内的JSON
          let parsed = safeParseTodoJSON(suggestionText);
          if (!parsed && typeof suggestionText === 'string') {
            try {
              const start = suggestionText.indexOf('{');
              const end = suggestionText.lastIndexOf('}');
              if (start !== -1 && end !== -1 && end > start) {
                const jsonStr = suggestionText.slice(start, end + 1);
                parsed = JSON.parse(jsonStr);
              }
            } catch (e) {
              logger.warn('待办建议JSON救援解析失败', { error: e.message });
            }
          }

          // 4) 若仍解析失败，使用更严格提示重试（优先外部，回退本地）
          if ((!parsed || !parsed.shouldCreateTodo || !Array.isArray(parsed.todos) || parsed.todos.length === 0)) {
            let retryText = null;
            // 外部严格重试
            if (externalLLM) {
              try {
                retryText = await externalLLM.generateText(strictPrompt, { temperature: 0.1, maxTokens: 4000 }, user._id);
              } catch (err) {
                logger.warn('外部LLM严格重试失败', { error: err.message });
              }
            }
            // 本地严格重试
            if (!retryText && localLLM) {
              try {
                retryText = await localLLM.generateText(strictPrompt, { temperature: 0.1, maxTokens: 4000 }, user._id);
              } catch (err) {
                logger.warn('本地LLM严格重试失败', { error: err.message });
              }
            }
            // 重试解析
            if (retryText) {
              parsed = safeParseTodoJSON(retryText);
              if (!parsed && typeof retryText === 'string') {
                try {
                  const s = retryText.indexOf('{');
                  const e = retryText.lastIndexOf('}');
                  if (s !== -1 && e !== -1 && e > s) {
                    const jsonStr2 = retryText.slice(s, e + 1);
                    parsed = JSON.parse(jsonStr2);
                  }
                } catch (e2) {
                  logger.warn('待办建议JSON严格重试救援解析失败', { error: e2.message });
                }
              }
            }
          }

          // 5) 创建待办或记录无需创建
          logger.llm(`待办解析结果: shouldCreateTodo=${parsed ? parsed.shouldCreateTodo : undefined}, todos_len=${parsed && Array.isArray(parsed.todos) ? parsed.todos.length : 0}`);
          if (parsed && parsed.shouldCreateTodo && Array.isArray(parsed.todos) && parsed.todos.length > 0) {
            const result = await createTodosFromSuggestions(user._id, parsed.todos, diaries);
            logger.info(`为用户 ${user.username} 自动创建待办 ${result.created} 条`);
          } else {
            logger.info(`用户 ${user.username} 今日无需自动待办或建议为空`);
          }
        } catch (error) {
          logger.warn('自动待办生成流程异常', { error: error.message });
        }
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
    // 计算本周的时间范围（周一到周日，周一为起点；周日为0需特殊处理）
    const day = now.getDay(); // 0=周日,1=周一,...6=周六
    const mondayOffset = -((day + 6) % 7); // 距离本周周一的偏移量
    const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const thisWeekEnd = new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() + 6);
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

      // 在调用LLM之前统计周度待办事项，确保模板占位符可用
      const weekStart = new Date(thisWeekStart);
      const weekEnd = new Date(thisWeekEnd);
      const weekTodosCreated = await Todo.countDocuments({
        user: user._id,
        createdAt: { $gte: weekStart, $lt: weekEnd }
      });
      const weekTodosCompleted = await Todo.countDocuments({
        user: user._id,
        status: '已完成',
        'statusHistory': {
          $elemMatch: {
            status: '已完成',
            changedAt: { $gte: weekStart, $lt: weekEnd }
          }
        }
      });
      const weekTodosPending = await Todo.countDocuments({
        user: user._id,
        createdAt: { $gte: weekStart, $lt: weekEnd },
        status: { $ne: '已完成' }
      });
      const totalPendingTodos = await Todo.countDocuments({
        user: user._id,
        status: { $in: ['待办'] }
      });

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
        user: user,
        weekTodosCreated,
        weekTodosCompleted,
        weekTodosPending,
        totalPendingTodos
      };
      
      // 尝试使用LLM生成总结
      let summaryContent = baseContent;
      let llmSummary = null;
      // 记录LLM使用来源：external/local/none，并记录具体模型名称
      let llmUsed = 'none';
      let llmName = null;
      
      // 动态创建LLM实例以获取最新配置
      const { localLLM, externalLLM } = await createLLMInstances(user._id);
      
      // 首先尝试使用外部LLM（如果可用）
      if (externalLLM) {
        try {
          llmSummary = await externalLLM.generateSummary(llmData, 'weekly', {}, user._id);
          if (llmSummary) {
            logger.llm('使用外部LLM生成的每周总结内容');
            summaryContent = llmSummary;
            llmUsed = 'external';
            try { llmName = externalLLM.config?.model || null; } catch (_) {}
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
            llmUsed = 'local';
            try { llmName = localLLM.config?.model || null; } catch (_) {}
          }
        } catch (error) {
          logger.info('本地LLM生成每周总结失败:', error.message);
        }
      }
      
      // 如果所有LLM都失败，使用默认模板
      if (!llmSummary) {
        logger.info('使用默认模板生成的每周总结内容');
        llmUsed = 'none';
        llmName = null;
      }
      
      // 周度待办统计已在LLM调用前计算并加入llmData

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

      // 只有在没有使用LLM生成内容时，才使用默认模板并进行占位符替换
      if (!llmSummary) {
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
        },
        meta: {
          rangeType: 'this_week',
          rangeLabel: '本周',
          rangeStart: thisWeekStart,
          rangeEnd: thisWeekEnd,
          generatedBy: 'manual',
          llmUsed: llmUsed,
          llmName: llmName
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

        // 在调用LLM之前统计月度待办事项，以支持模板占位符
        const monthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        const monthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthTodosCreated = await Todo.countDocuments({
          user: user._id,
          createdAt: { $gte: monthStart, $lt: monthEnd }
        });
        const monthTodosCompleted = await Todo.countDocuments({
          user: user._id,
          status: '已完成',
          'statusHistory': {
            $elemMatch: {
              status: '已完成',
              changedAt: { $gte: monthStart, $lt: monthEnd }
            }
          }
        });
        const monthTodosPending = await Todo.countDocuments({
          user: user._id,
          createdAt: { $gte: monthStart, $lt: monthEnd },
          status: { $ne: '已完成' }
        });
        const totalPendingTodos = await Todo.countDocuments({
          user: user._id,
          status: { $in: ['待办'] }
        });

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
          user: user,
          monthTodosCreated,
          monthTodosCompleted,
          monthTodosPending,
          totalPendingTodos
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
        
        // 月度待办统计已在LLM调用前计算并加入llmData

        // 只有在没有使用LLM生成内容时，才使用默认模板并进行占位符替换
        if (!llmSummary) {
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

        // 在调用LLM之前统计当月待办事项，以支持模板占位符
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthTodosCreated = await Todo.countDocuments({
          user: user._id,
          createdAt: { $gte: monthStart, $lt: monthEnd }
        });
        const monthTodosCompleted = await Todo.countDocuments({
          user: user._id,
          status: '已完成',
          'statusHistory': {
            $elemMatch: {
              status: '已完成',
              changedAt: { $gte: monthStart, $lt: monthEnd }
            }
          }
        });
        const monthTodosPending = await Todo.countDocuments({
          user: user._id,
          createdAt: { $gte: monthStart, $lt: monthEnd },
          status: { $ne: '已完成' }
        });
        const totalPendingTodos = await Todo.countDocuments({
          user: user._id,
          status: { $in: ['待办'] }
        });

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
          user: user,
          monthTodosCreated,
          monthTodosCompleted,
          monthTodosPending,
          totalPendingTodos
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

        // 只有在没有使用LLM生成内容时，才使用默认模板并进行占位符替换
        if (!llmSummary) {
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

    const summariesDocs = await Summary.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    // 兼容旧数据：为weekly类型补充meta信息
    const summaries = summariesDocs.map(doc => {
      const s = doc.toObject();
      if (s.type === 'weekly') {
        if (!s.meta) {
          const start = new Date(s.date);
          const end = new Date(start);
          end.setDate(end.getDate() + 6);
          // 根据创建时间判断是本周还是上周（手动生成通常为本周）
          const created = new Date(s.createdAt);
          const createdWeekMonday = new Date(created);
          const d = createdWeekMonday.getDay();
          const offset = d === 0 ? -6 : (1 - d);
          createdWeekMonday.setDate(created.getDate() + offset);
          createdWeekMonday.setHours(0, 0, 0, 0);
          const rangeType = start.getTime() === createdWeekMonday.getTime() ? 'this_week' : 'last_week';
          s.meta = {
            rangeType,
            rangeLabel: rangeType === 'this_week' ? '本周' : '上一周',
            rangeStart: start,
            rangeEnd: end,
            generatedBy: rangeType === 'this_week' ? 'manual' : 'auto'
          };
        }
      }
      return s;
    });

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

    // 兼容旧数据：为weekly类型补充meta信息
    let s = summary.toObject();
    if (s.type === 'weekly' && !s.meta) {
      const start = new Date(s.date);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const created = new Date(s.createdAt);
      const createdWeekMonday = new Date(created);
      const d = createdWeekMonday.getDay();
      const offset = d === 0 ? -6 : (1 - d);
      createdWeekMonday.setDate(created.getDate() + offset);
      createdWeekMonday.setHours(0, 0, 0, 0);
      const rangeType = start.getTime() === createdWeekMonday.getTime() ? 'this_week' : 'last_week';
      s.meta = {
        rangeType,
        rangeLabel: rangeType === 'this_week' ? '本周' : '上一周',
        rangeStart: start,
        rangeEnd: end,
        generatedBy: rangeType === 'this_week' ? 'manual' : 'auto'
      };
    }

    res.json(s);
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
    
    // 生成基础总结内容（无LLM回退为占位符模板，后续进行替换）
    const baseContent = `
# {{date}} 工作总结

## 工作概览
- 工作条目数量: {{totalEntries}}
- 总工作时长: {{totalTime}}

## 工作详情
{{workDetails}}
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
    
    // 只有在没有使用LLM生成内容时，才使用默认模板并进行占位符替换
    if (!llmSummary) {
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

    // 生成LLM待办建议并创建待办（昨日）
    try {
      const user = await User.findById(req.user.id);
      const { localLLM, externalLLM } = await createLLMInstances(req.user.id);
      const prompt = buildTodoJSONFromSummaryPrompt(summary.content || summaryContent, user || {}, yesterday);
      const strictPrompt = `${prompt}\n\n注意：只输出纯JSON，不要使用任何代码块标记，不要任何解释文本。`;
      let suggestionText = null;

      // 1) 优先尝试外部LLM，提升maxTokens避免截断
      if (externalLLM) {
        try {
          suggestionText = await externalLLM.generateText(prompt, { temperature: 0.1, maxTokens: 3000 }, req.user.id);
        } catch (err) {
          logger.warn('外部LLM待办建议失败，尝试其他策略', { error: err.message });
        }
      }

      // 2) 如果首次结果为空，尝试本地LLM
      if (!suggestionText && localLLM) {
        try {
          suggestionText = await localLLM.generateText(prompt, { temperature: 0.1, maxTokens: 3000 }, req.user.id);
        } catch (err) {
          logger.warn('本地LLM待办建议失败', { error: err.message });
        }
      }

      // 3) 解析与救援：先用安全解析，失败则尝试提取首尾大括号内的JSON
      let parsed = safeParseTodoJSON(suggestionText);
      if (!parsed && typeof suggestionText === 'string') {
        try {
          const start = suggestionText.indexOf('{');
          const end = suggestionText.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end > start) {
            const jsonStr = suggestionText.slice(start, end + 1);
            parsed = JSON.parse(jsonStr);
          }
        } catch (e) {
          logger.warn('待办建议JSON救援解析失败', { error: e.message });
        }
      }

      // 4) 若仍解析失败，使用更严格提示重试（优先外部，回退本地）
      if ((!parsed || !parsed.shouldCreateTodo || !Array.isArray(parsed.todos) || parsed.todos.length === 0)) {
        let retryText = null;
        // 外部严格重试
        if (externalLLM) {
          try {
            retryText = await externalLLM.generateText(strictPrompt, { temperature: 0.1, maxTokens: 4000 }, req.user.id);
          } catch (err) {
            logger.warn('外部LLM严格重试失败', { error: err.message });
          }
        }
        // 本地严格重试
        if (!retryText && localLLM) {
          try {
            retryText = await localLLM.generateText(strictPrompt, { temperature: 0.1, maxTokens: 4000 }, req.user.id);
          } catch (err) {
            logger.warn('本地LLM严格重试失败', { error: err.message });
          }
        }
        // 重试解析
        if (retryText) {
          parsed = safeParseTodoJSON(retryText);
          if (!parsed && typeof retryText === 'string') {
            try {
              const s = retryText.indexOf('{');
              const e = retryText.lastIndexOf('}');
              if (s !== -1 && e !== -1 && e > s) {
                const jsonStr2 = retryText.slice(s, e + 1);
                parsed = JSON.parse(jsonStr2);
              }
            } catch (e2) {
              logger.warn('待办建议JSON严格重试救援解析失败', { error: e2.message });
            }
          }
        }
      }

      // 5) 创建待办或记录无需创建
      logger.llm(`待办解析结果: shouldCreateTodo=${parsed ? parsed.shouldCreateTodo : undefined}, todos_len=${parsed && Array.isArray(parsed.todos) ? parsed.todos.length : 0}`);
      if (parsed && parsed.shouldCreateTodo && Array.isArray(parsed.todos) && parsed.todos.length > 0) {
        const result = await createTodosFromSuggestions(req.user.id, parsed.todos, diaries);
        logger.info(`为用户 ${req.user.username || req.user.id} 自动创建待办 ${result.created} 条`);
      } else {
        logger.info(`用户 ${req.user.username || req.user.id} 昨日无需自动待办或建议为空`);
      }
    } catch (error) {
      logger.warn('自动待办生成流程异常', { error: error.message });
    }

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
    
    // 生成基础总结内容（无LLM回退为占位符模板，后续进行替换）
    const baseContent = `
# {{date}} 工作总结

## 工作概览
- 工作条目数量: {{totalEntries}}
- 总工作时长: {{totalTime}}

## 工作详情
{{workDetails}}

## 待办统计
- 今日新增: {{todayTodosCreated}}
- 今日完成: {{todayTodosCompleted}}
- 今日未完成: {{todayTodosPending}}
- 当前总未完成: {{totalPendingTodos}}
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
    
    // 统计待办事项数据（在调用LLM之前计算并传入提示词占位符）
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const todayTodosCreated = await Todo.countDocuments({
      user: req.user.id,
      createdAt: {
        $gte: todayStart,
        $lt: todayEnd
      }
    });

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

    const todayTodosPending = await Todo.countDocuments({
      user: req.user.id,
      createdAt: {
        $gte: todayStart,
        $lt: todayEnd
      },
      status: { $ne: '已完成' }
    });

    const totalPendingTodos = await Todo.countDocuments({
      user: req.user.id,
      status: { $in: ['待办'] }
    });

    // 将待办统计加入LLM数据，使模板占位符可被替换
    llmData.todayTodosCreated = todayTodosCreated;
    llmData.todayTodosCompleted = todayTodosCompleted;
    llmData.todayTodosPending = todayTodosPending;
    llmData.totalPendingTodos = totalPendingTodos;

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

    // 只有在没有使用LLM生成内容时，才使用默认模板并进行占位符替换
    if (!llmSummary) {
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

    // 生成LLM待办建议并创建待办（今日）
    try {
      const { localLLM, externalLLM } = await createLLMInstances(req.user.id);
      const prompt = buildTodoJSONFromSummaryPrompt(summary.content || summaryContent, user, today);
      const strictPrompt = `${prompt}\n\n注意：只输出纯JSON，不要使用任何代码块标记，不要任何解释文本。`;
      let suggestionText = null;

      // 1) 优先尝试外部LLM，提升maxTokens避免截断
      if (externalLLM) {
        try {
          suggestionText = await externalLLM.generateText(prompt, { temperature: 0.1, maxTokens: 3000 });
        } catch (err) {
          logger.warn('外部LLM待办建议失败，尝试其他策略', { error: err.message });
        }
      }

      // 2) 如果首次结果为空，尝试本地LLM
      if (!suggestionText && localLLM) {
        try {
          suggestionText = await localLLM.generateText(prompt, { temperature: 0.1, maxTokens: 3000 });
        } catch (err) {
          logger.warn('本地LLM待办建议失败', { error: err.message });
        }
      }

      // 3) 解析与救援：先用安全解析，失败则尝试提取首尾大括号内的JSON
      let parsed = safeParseTodoJSON(suggestionText);
      if (!parsed && typeof suggestionText === 'string') {
        try {
          const start = suggestionText.indexOf('{');
          const end = suggestionText.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end > start) {
            const jsonStr = suggestionText.slice(start, end + 1);
            parsed = JSON.parse(jsonStr);
          }
        } catch (e) {
          logger.warn('待办建议JSON救援解析失败', { error: e.message });
        }
      }

      // 4) 若仍解析失败，使用更严格提示重试（优先外部，回退本地）
      if ((!parsed || !parsed.shouldCreateTodo || !Array.isArray(parsed.todos) || parsed.todos.length === 0)) {
        let retryText = null;
        // 外部严格重试
        if (externalLLM) {
          try {
            retryText = await externalLLM.generateText(strictPrompt, { temperature: 0.1, maxTokens: 4000 });
          } catch (err) {
            logger.warn('外部LLM严格重试失败', { error: err.message });
          }
        }
        // 本地严格重试
        if (!retryText && localLLM) {
          try {
            retryText = await localLLM.generateText(strictPrompt, { temperature: 0.1, maxTokens: 4000 });
          } catch (err) {
            logger.warn('本地LLM严格重试失败', { error: err.message });
          }
        }
        // 重试解析
        if (retryText) {
          parsed = safeParseTodoJSON(retryText);
          if (!parsed && typeof retryText === 'string') {
            try {
              const s = retryText.indexOf('{');
              const e = retryText.lastIndexOf('}');
              if (s !== -1 && e !== -1 && e > s) {
                const jsonStr2 = retryText.slice(s, e + 1);
                parsed = JSON.parse(jsonStr2);
              }
            } catch (e2) {
              logger.warn('待办建议JSON严格重试救援解析失败', { error: e2.message });
            }
          }
        }
      }

      // 5) 创建待办或记录无需创建
      logger.llm(`待办解析结果: shouldCreateTodo=${parsed ? parsed.shouldCreateTodo : undefined}, todos_len=${parsed && Array.isArray(parsed.todos) ? parsed.todos.length : 0}`);
      if (parsed && parsed.shouldCreateTodo && Array.isArray(parsed.todos) && parsed.todos.length > 0) {
        const result = await createTodosFromSuggestions(req.user.id, parsed.todos, diaries);
        logger.info(`为用户 ${user.username} 自动创建待办 ${result.created} 条`);
      } else {
        logger.info(`用户 ${user.username} 今日无需自动待办或建议为空`);
      }
    } catch (error) {
      logger.warn('自动待办生成流程异常', { error: error.message });
    }
    
    res.json({ message: '今日总结生成成功', summary });
  } catch (error) {
    logger.error('生成今日总结失败:', error);
    res.status(500).json({ message: '生成失败: ' + error.message });
  }
};

// 重新生成上周每周总结（当前登录用户）
exports.regenerateLastWeeklySummary = async (req, res) => {
  try {
    logger.system('开始重新生成上周每周总结...');

    const now = new Date();
    // 计算上周的时间范围（周一到周日）
    const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 6);
    const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    lastWeekStart.setHours(0, 0, 0, 0);
    lastWeekEnd.setHours(23, 59, 59, 999);

    // 查找上周的工作日记（当前登录用户）
    const diaries = await Diary.find({
      user: req.user.id,
      startTime: {
        $gte: lastWeekStart,
        $lt: lastWeekEnd
      }
    });

    if (diaries.length === 0) {
      return res.status(404).json({ message: '上周没有工作日记记录' });
    }

    // 删除已存在的上周每周总结（以开始日期作为唯一键）
    await Summary.deleteOne({
      user: req.user.id,
      type: 'weekly',
      date: lastWeekStart
    });

    // 计算总工作时长与每日统计
    let totalWorkTime = 0;
    const dailyWork = {};
    diaries.forEach(diary => {
      const minutes = calculateWorkTime(diary.startTime, diary.endTime);
      totalWorkTime += minutes;
      const dateKey = new Date(diary.startTime).toDateString();
      dailyWork[dateKey] = (dailyWork[dateKey] || 0) + minutes;
    });

    // 准备基础总结内容
    const baseContent = `
# {{date}} 工作总结（上周）

## 周度概览
- 工作天数: {{workDays}}
- 工作条目数量: {{totalEntries}}
- 总工作时长: {{totalTime}}
- 平均每日工作时长: {{avgDailyTime}}

## 工作内容分析
{{workDetails}}
    `.trim();

    // 构建工作详情
    const workDetails = diaries.map(diary => {
      const workTime = calculateWorkTime(diary.startTime, diary.endTime);
      return `**工作内容**\n- 时间: ${new Date(diary.startTime).toLocaleDateString('zh-CN')} ${new Date(diary.startTime).toLocaleTimeString('zh-CN')} - ${new Date(diary.endTime).toLocaleTimeString('zh-CN')} (${workTime}分钟)\n- 描述: ${diary.content}\n- 标签: ${diary.tags.join(', ')}`;
    }).join('\n\n');

    // 在调用LLM前统计周度待办事项
    const weekStart = new Date(lastWeekStart);
    const weekEnd = new Date(lastWeekEnd);
    const weekTodosCreated = await Todo.countDocuments({
      user: req.user.id,
      createdAt: { $gte: weekStart, $lt: weekEnd }
    });
    const weekTodosCompleted = await Todo.countDocuments({
      user: req.user.id,
      status: '已完成',
      'statusHistory': {
        $elemMatch: {
          status: '已完成',
          changedAt: { $gte: weekStart, $lt: weekEnd }
        }
      }
    });
    const weekTodosPending = await Todo.countDocuments({
      user: req.user.id,
      createdAt: { $gte: weekStart, $lt: weekEnd },
      status: { $ne: '已完成' }
    });
    const totalPendingTodos = await Todo.countDocuments({
      user: req.user.id,
      status: { $in: ['待办'] }
    });

    // 获取用户信息
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 准备LLM所需数据
    const tagDistribution = generateTagDistribution(diaries);
    const llmData = {
      date: lastWeekStart,
      diaries,
      totalWorkTime,
      totalEntries: diaries.length,
      workDetails,
      dailyWork,
      tagDistribution,
      user,
      weekTodosCreated,
      weekTodosCompleted,
      weekTodosPending,
      totalPendingTodos
    };

    // 尝试使用LLM生成总结
    let summaryContent = baseContent;
    let llmSummary = null;
    let llmUsed = 'none';
    let llmName = null;

    // 动态创建LLM实例以获取最新配置
    const { localLLM, externalLLM } = await createLLMInstances(req.user.id);

    // 优先外部LLM
    if (externalLLM) {
      try {
        llmSummary = await externalLLM.generateSummary(llmData, 'weekly', {}, req.user.id);
        if (llmSummary) {
          summaryContent = llmSummary;
          llmUsed = 'external';
          try { llmName = externalLLM.config?.model || null; } catch (_) {}
        }
      } catch (error) {
        logger.info('外部LLM生成上周每周总结失败，尝试本地LLM:', error.message);
      }
    }

    // 回退本地LLM
    if (!llmSummary && localLLM) {
      try {
        llmSummary = await localLLM.generateSummary(llmData, 'weekly', {}, req.user.id);
        if (llmSummary) {
          summaryContent = llmSummary;
          llmUsed = 'local';
          try { llmName = localLLM.config?.model || null; } catch (_) {}
        }
      } catch (error) {
        logger.info('本地LLM生成上周每周总结失败:', error.message);
      }
    }

    // 如果所有LLM都失败，使用默认模板并进行占位符替换
    if (!llmSummary) {
      const workDays = Object.keys(dailyWork).length;
      const avgMinutes = workDays > 0 ? Math.floor(totalWorkTime / workDays) : 0;
      const avgDailyTime = `${Math.floor(avgMinutes / 60)}小时${avgMinutes % 60}分钟`;
      summaryContent = summaryContent
        .replace(/\{\{date\}\}/g, `${lastWeekStart.toLocaleDateString('zh-CN')} 到 ${lastWeekEnd.toLocaleDateString('zh-CN')}`)
        .replace(/\{\{workDays\}\}/g, workDays)
        .replace(/\{\{totalEntries\}\}/g, diaries.length)
        .replace(/\{\{totalTime\}\}/g, `${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟`)
        .replace(/\{\{avgDailyTime\}\}/g, avgDailyTime)
        .replace(/\{\{workDetails\}\}/g, workDetails)
        .concat(`\n\n## 待办统计\n- 新建待办: ${weekTodosCreated}\n- 完成待办: ${weekTodosCompleted}\n- 未完成待办: ${weekTodosPending}\n- 当前待办总数: ${totalPendingTodos}`);
      llmUsed = 'none';
      llmName = null;
    }

    // 生成HTML网页
    let htmlFilePath = null;
    try {
      logger.system('开始生成上周每周总结HTML网页...');
      const htmlData = {
        date: lastWeekStart,
        diaries,
        totalWorkTime,
        dailyWork,
        tagDistribution
      };
      const htmlContent = await generateHTMLPage(htmlData, 'weekly', summaryContent, req.user.id);
      htmlFilePath = await saveHTMLFile(htmlContent, req.user.id, 'weekly', lastWeekStart);
      logger.info('上周每周总结HTML网页生成成功:', htmlFilePath);
    } catch (error) {
      logger.error('生成上周每周总结HTML网页失败:', error);
    }

    // 保存总结
    const summary = new Summary({
      user: req.user.id,
      type: 'weekly',
      date: lastWeekStart,
      content: summaryContent,
      htmlFilePath,
      statistics: {
        totalEntries: diaries.length,
        totalTime: totalWorkTime,
        tagDistribution
      },
      meta: {
        rangeType: 'last_week',
        rangeLabel: '上周',
        rangeStart: lastWeekStart,
        rangeEnd: lastWeekEnd,
        generatedBy: 'regenerate',
        llmUsed,
        llmName
      }
    });

    await summary.save();

    res.json({
      message: '上周工作总结重新生成成功',
      summary
    });
  } catch (error) {
    logger.error('重新生成上周每周总结失败:', error);
    res.status(500).json({ message: '重新生成上周每周总结失败: ' + error.message });
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
        
        // 在调用LLM前统计周度待办事项
        const weekStart = new Date(lastWeekStart);
        const weekEnd = new Date(lastWeekEnd);
        const weekTodosCreated = await Todo.countDocuments({
          user: user._id,
          createdAt: { $gte: weekStart, $lt: weekEnd }
        });
        const weekTodosCompleted = await Todo.countDocuments({
          user: user._id,
          status: '已完成',
          'statusHistory': {
            $elemMatch: {
              status: '已完成',
              changedAt: { $gte: weekStart, $lt: weekEnd }
            }
          }
        });
        const weekTodosPending = await Todo.countDocuments({
          user: user._id,
          createdAt: { $gte: weekStart, $lt: weekEnd },
          status: { $ne: '已完成' }
        });
        const totalPendingTodos = await Todo.countDocuments({
          user: user._id,
          status: { $in: ['待办'] }
        });

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
          user: user,
          weekTodosCreated,
          weekTodosCompleted,
          weekTodosPending,
          totalPendingTodos
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
              llmUsed = 'external';
              llmName = externalLLM.config?.model || null;
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
              llmUsed = 'local';
              llmName = localLLM.config?.model || null;
            }
          } catch (error) {
            logger.info('本地LLM生成周报总结失败:', error.message);
          }
        }
        
        // 如果所有LLM都失败，使用默认模板
        if (!llmSummary) {
          logger.info('使用默认模板生成的周报总结内容');
          llmUsed = 'none';
          llmName = null;
        }
        
        // 周度待办统计已在LLM调用前计算并加入llmData
        
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
        
        // 如果未生成LLM内容，才进行默认模板的占位符替换（当前默认模板不含周待办占位符）
        if (!llmSummary) {
          summaryContent = summaryContent
            .replace(/\{\{date\}\}/g, `${lastWeekStart.toLocaleDateString('zh-CN')} 到 ${lastWeekEnd.toLocaleDateString('zh-CN')}`)
            .replace(/\{\{totalEntries\}\}/g, diaries.length)
            .replace(/\{\{totalTime\}\}/g, `${Math.floor(totalWorkTime / 60)}小时${totalWorkTime % 60}分钟`);
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
          },
          meta: {
            rangeType: 'last_week',
            rangeLabel: '上一周',
            rangeStart: lastWeekStart,
            rangeEnd: lastWeekEnd,
            generatedBy: 'auto',
            llmUsed: llmUsed,
            llmName: llmName
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
        
        // 在调用LLM之前准备数据（包含标签分布与待办统计）
        const tagDistribution = generateTagDistribution(diaries);
        const monthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        const monthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthTodosCreated = await Todo.countDocuments({
          user: user._id,
          createdAt: { $gte: monthStart, $lt: monthEnd }
        });
        const monthTodosCompleted = await Todo.countDocuments({
          user: user._id,
          status: '已完成',
          'statusHistory': {
            $elemMatch: {
              status: '已完成',
              changedAt: { $gte: monthStart, $lt: monthEnd }
            }
          }
        });
        const monthTodosPending = await Todo.countDocuments({
          user: user._id,
          createdAt: { $gte: monthStart, $lt: monthEnd },
          status: { $ne: '已完成' }
        });
        const totalPendingTodos = await Todo.countDocuments({
          user: user._id,
          status: { $in: ['待办'] }
        });

        const llmData = {
          date: lastMonth,
          diaries: diaries,
          totalWorkTime: totalWorkTime,
          dailyWork: dailyWork,
          tagDistribution: tagDistribution,
          user: user,
          monthTodosCreated,
          monthTodosCompleted,
          monthTodosPending,
          totalPendingTodos
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

// 确保并生成总结的HTML文件，返回可访问URL
exports.ensureSummaryHTML = async (req, res) => {
  try {
    const summaryId = req.params.id;
    const summary = await Summary.findById(summaryId);
    if (!summary) {
      return res.status(404).json({ success: false, message: '未找到总结记录' });
    }
    if (String(summary.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: '无权访问该总结' });
    }

    const type = summary.type;
    const date = new Date(summary.date);
    const userId = summary.user;

    const path = require('path');
    const fs = require('fs');

    // 计算期望文件名
    const year = date.getFullYear();
    const monthPart = type === 'monthly' ? String(date.getMonth() + 1).padStart(2, '0') : '';
    const expectedFilename = `${userId}_${type}_${year}${monthPart ? '_' + monthPart : ''}.html`;
    const uploadsDir = path.join(__dirname, '../uploads/summaries');
    const expectedFilePath = path.join(uploadsDir, expectedFilename);

    // 如果已有路径且文件存在，直接返回
    if (summary.htmlFilePath) {
      const relative = summary.htmlFilePath.replace('/uploads/summaries/', '');
      const actualPath = path.join(uploadsDir, relative);
      if (fs.existsSync(actualPath)) {
        return res.json({ success: true, url: summary.htmlFilePath });
      }
    }

    // 构建数据（根据类型获取对应时间范围内的diaries）
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    let end = new Date(start);
    if (type === 'weekly') {
      end.setDate(start.getDate() + 7);
    } else if (type === 'monthly') {
      start.setDate(1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    } else if (type === 'yearly') {
      start.setMonth(0, 1);
      end = new Date(start.getFullYear() + 1, 0, 1);
    } else { // daily
      end.setDate(start.getDate() + 1);
    }

    const diaries = await Diary.find({
      user: userId,
      startTime: { $gte: start, $lt: end }
    }).exec();

    // 计算统计数据
    let totalWorkTime = 0;
    const dailyWork = {};
    diaries.forEach(diary => {
      totalWorkTime += Math.floor((new Date(diary.endTime) - new Date(diary.startTime)) / (1000 * 60));
      const dateKey = new Date(diary.startTime).toDateString();
      dailyWork[dateKey] = (dailyWork[dateKey] || 0) + Math.floor((new Date(diary.endTime) - new Date(diary.startTime)) / (1000 * 60));
    });
    const tagDistribution = (function (ds) {
      const map = new Map();
      ds.forEach(d => (d.tags || []).forEach(t => map.set(t, (map.get(t) || 0) + 1)));
      return Object.fromEntries(map);
    })(diaries);

    const htmlData = {
      date: start,
      diaries,
      totalWorkTime,
      dailyWork,
      tagDistribution
    };

    // 生成并保存HTML
    try {
      const htmlContent = await generateHTMLPage(htmlData, type, summary.content, userId);
      const htmlFilePath = await saveHTMLFile(htmlContent, userId, type, start);
      summary.htmlFilePath = htmlFilePath;
      await summary.save();
      return res.json({ success: true, url: htmlFilePath });
    } catch (err) {
      return res.status(500).json({ success: false, message: '生成HTML失败', error: err.message });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: '处理请求失败', error: error.message });
  }
};