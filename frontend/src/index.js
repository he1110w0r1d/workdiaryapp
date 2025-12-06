import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';  // 确保这行存在
import App from './App';
import reportWebVitals from './reportWebVitals';

// 全局错误捕获，便于定位移动端异常
window.addEventListener('error', (e) => {
  try {
    const msg = e?.message || 'Unknown error';
    const src = e?.filename || '';
    const line = e?.lineno || 0;
    const col = e?.colno || 0;
    const stack = e?.error?.stack || '';
    console.error('GlobalError:', { msg, src, line, col, stack });
  } catch (_) {}
});

window.addEventListener('unhandledrejection', (e) => {
  try {
    const reason = e?.reason;
    const msg = (reason && (reason.message || reason.toString())) || 'Unhandled rejection';
    const stack = reason?.stack || '';
    console.error('UnhandledRejection:', { msg, stack });
  } catch (_) {}
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
