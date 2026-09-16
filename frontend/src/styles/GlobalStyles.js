import { createGlobalStyle } from 'styled-components';
const GlobalStyles = createGlobalStyle`
  body { background: ${p => p.theme.colors.background}; color: ${p => p.theme.colors.text}; }
  .ant-btn-primary { box-shadow: none; }
  .ant-card { box-shadow: none; border-color: ${p => p.theme.colors.border}; }
  .ant-table { background: ${p => p.theme.colors.surface}; }
  .ant-typography { color: ${p => p.theme.colors.text}; }
`;
export default GlobalStyles;
