const fs = require('fs');
const path = require('path');

/**
 * 清理调试代码脚本
 * 将console.log替换为适当的logger调用
 */

// 定义替换规则
const replacementRules = [
  // 系统级日志
  {
    pattern: /console\.log\('开始.*?'\);/g,
    replacement: (match) => match.replace('console.log', 'logger.system')
  },
  {
    pattern: /console\.log\('.*?完成.*?'\);/g,
    replacement: (match) => match.replace('console.log', 'logger.system')
  },
  // LLM相关日志
  {
    pattern: /console\.log\('.*?LLM.*?'\);/g,
    replacement: (match) => match.replace('console.log', 'logger.llm')
  },
  {
    pattern: /console\.log\('使用.*?LLM.*?'\);/g,
    replacement: (match) => match.replace('console.log', 'logger.llm')
  },
  // 用户操作日志
  {
    pattern: /console\.log\('.*?用户.*?'\);/g,
    replacement: (match) => match.replace('console.log', 'logger.user')
  },
  // 错误和警告日志
  {
    pattern: /console\.log\('.*?失败.*?'\);/g,
    replacement: (match) => match.replace('console.log', 'logger.warn')
  },
  {
    pattern: /console\.error\(/g,
    replacement: 'logger.error('
  },
  // 调试日志（删除详细的调试输出）
  {
    pattern: /console\.log\('=== .*? ===.*?'\);\s*console\.log\(.*?\);\s*console\.log\('=== .*? ===.*?'\);/gs,
    replacement: '// 调试代码已清理'
  },
  // 其他一般日志
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.info('
  }
];

/**
 * 清理文件中的调试代码
 */
function cleanupFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // 检查是否已经导入logger
    if (!content.includes("require('../utils/logger')") && !content.includes("require('./utils/logger')")) {
      // 添加logger导入
      const requirePattern = /(const .* = require\('.*'\);\s*)+/;
      const match = content.match(requirePattern);
      if (match) {
        const insertPos = match.index + match[0].length;
        const loggerImport = "const logger = require('../utils/logger');\n";
        content = content.slice(0, insertPos) + loggerImport + content.slice(insertPos);
        modified = true;
      }
    }
    
    // 应用替换规则
    replacementRules.forEach(rule => {
      const newContent = content.replace(rule.pattern, rule.replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    // 如果有修改，写回文件
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ 已清理: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`✗ 清理失败 ${filePath}:`, error.message);
    return false;
  }
}

/**
 * 递归扫描目录
 */
function scanDirectory(dirPath, extensions = ['.js']) {
  const files = [];
  
  function scan(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    items.forEach(item => {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 跳过node_modules和logs目录
        if (!['node_modules', 'logs', '.git'].includes(item)) {
          scan(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    });
  }
  
  scan(dirPath);
  return files;
}

/**
 * 主函数
 */
function main() {
  console.log('开始清理调试代码...');
  
  const backendDir = path.join(__dirname, '..');
  const jsFiles = scanDirectory(backendDir, ['.js']);
  
  let cleanedCount = 0;
  
  jsFiles.forEach(file => {
    // 跳过当前脚本和logger文件
    if (file.includes('cleanup-debug-logs.js') || file.includes('logger.js')) {
      return;
    }
    
    if (cleanupFile(file)) {
      cleanedCount++;
    }
  });
  
  console.log(`\n清理完成！共处理 ${jsFiles.length} 个文件，修改了 ${cleanedCount} 个文件。`);
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { cleanupFile, scanDirectory };