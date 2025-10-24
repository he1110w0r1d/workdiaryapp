const { spawn } = require('child_process');
const path = require('path');

console.log('启动React前端服务器...');

// 使用本地 react-scripts 启动开发服务器，避免依赖 npx 在不同环境的 PATH
const startScript = path.join(__dirname, 'node_modules', 'react-scripts', 'scripts', 'start.js');
const reactScripts = spawn(process.execPath, [startScript], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: false,
  windowsHide: true
});

reactScripts.on('error', (error) => {
  console.error('启动失败:', error);
  process.exit(1);
});

reactScripts.on('close', (code) => {
  console.log(`React服务器退出，代码: ${code}`);
  process.exit(code);
});

// 处理退出信号
process.on('SIGINT', () => {
  console.log('收到SIGINT信号，关闭服务器...');
  reactScripts.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，关闭服务器...');
  reactScripts.kill('SIGTERM');
});