import type { ThemeConfig } from 'antd';

export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#971E25',
    borderRadius: 12,
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    colorBgContainer: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  },
  components: {
    Button: {
      primaryShadow: '0 4px 12px rgba(151, 30, 37, 0.35)',
    },
    Card: {
      boxShadowTertiary: '0 2px 6px rgba(0,0,0,0.05), 0 6px 20px rgba(0,0,0,0.04)',
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Table: {
      borderRadius: 12,
    },
  },
};
