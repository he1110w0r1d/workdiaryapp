const { spawn } = require('child_process');
const path = require('path');

console.log('启动React前端服务器...');

// 使用react-scripts启动开发服务器
const reactScripts = spawn('npx', ['react-scripts', 'start'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
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