import { createGlobalStyle } from 'styled-components';

const GlobalStyles = createGlobalStyle`
  body {
    background-color: ${props => props.theme.colors.background};
    color: ${props => props.theme.colors.text};
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.5;
  }

  code {
    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
      monospace;
  }

  /* 移除不必要的动画效果 */
  .pulse,
  .float,
  .gradient-bg {
    transition: none !important;
    animation: none !important;
  }

  /* 简化滚动条 */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: ${props => props.theme.colors.background};
  }

  ::-webkit-scrollbar-thumb {
    background: ${props => props.theme.colors.border};
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${props => props.theme.colors.textSecondary};
  }

  /* 简化卡片样式 */
  .ant-card {
    border-radius: 8px;
    border: 1px solid ${props => props.theme.colors.border};
    background: ${props => props.theme.colors.surface};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .ant-card:hover {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* 简化按钮样式 */
  .ant-btn {
    border-radius: 6px;
    border: 1px solid ${props => props.theme.colors.border};
    font-weight: 500;
  }

  .ant-btn:hover {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .ant-btn-primary {
    background: ${props => props.theme.colors.primary};
    border-color: ${props => props.theme.colors.primary};
  }

  .ant-btn-primary:hover {
    background: ${props => props.theme.colors.secondary};
    border-color: ${props => props.theme.colors.secondary};
  }

  /* 简化输入框样式 */
  .ant-input,
  .ant-select-selector,
  .ant-picker {
    border-radius: 6px !important;
    border: 1px solid ${props => props.theme.colors.border} !important;
  }

  /* 简化表格样式 */
  .ant-table {
    background: ${props => props.theme.colors.surface};
    border-radius: 8px;
    border: 1px solid ${props => props.theme.colors.border};
  }

  .ant-table-tbody > tr:hover {
    background: ${props => props.theme.colors.background};
  }

  /* 简化统计数字样式 */
  .ant-statistic-content {
    font-weight: 600;
  }

  /* 简化标签样式 */
  .ant-tag {
    border-radius: 4px;
    margin-right: 8px;
    margin-bottom: 4px;
    border: 1px solid ${props => props.theme.colors.border};
    font-size: 12px;
  }

  /* 移除所有脉冲、浮动等动画类 */
  .pulse,
  .float,
  .gradient-bg {
    animation: none !important;
    transform: none !important;
    background: none !important;
  }

  /* 布局优化 */
  .ant-layout-content {
    min-height: calc(100vh - 64px);
    padding: 24px;
  }

  /* 标题样式优化 */
  .ant-typography {
    color: ${props => props.theme.colors.text};
  }

  h1, h2, h3, h4, h5, h6 {
    color: ${props => props.theme.colors.text};
    font-weight: 600;
    margin-bottom: 16px;
  }
`;

export default GlobalStyles;