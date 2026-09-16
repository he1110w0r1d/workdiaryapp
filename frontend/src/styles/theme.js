export const colors = {
  primary: '#315d4e', secondary: '#447764', accent: '#638875',
  background: '#f7f8f5', surface: '#ffffff', text: '#242d28',
  textSecondary: '#707971', border: '#e3e7df', success: '#38765b',
  warning: '#a6752c', error: '#b94a45', info: '#527b71'
};
export const workTheme = { name: '松间', colors };
export const antdTheme = {
  token: {
    colorPrimary: colors.primary, colorInfo: colors.info,
    colorSuccess: colors.success, colorWarning: colors.warning, colorError: colors.error,
    colorText: colors.text, colorTextSecondary: colors.textSecondary,
    colorBorder: colors.border, colorBgLayout: colors.background,
    borderRadius: 8, controlHeight: 36, fontSize: 14,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
  },
  components: {
    Button: { primaryShadow: 'none' }, Card: { headerFontSize: 16 },
    Table: { headerBg: '#f5f7f3', rowHoverBg: '#f7f9f5', cellPaddingBlock: 18 },
    Menu: { itemSelectedBg: '#e7eee6', itemSelectedColor: colors.primary },
    Tabs: { titleFontSize: 14 }
  }
};
