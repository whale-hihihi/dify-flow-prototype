import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Avatar } from 'antd';
import type { MenuProps } from 'antd';
import {
  FolderOutlined,
  RobotOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import '../styles/global.css';

const menuItems: MenuProps['items'] = [
  {
    key: '/assets',
    icon: <FolderOutlined />,
    label: '资产管理',
  },
  {
    key: '/tasks',
    icon: <UnorderedListOutlined />,
    label: '任务管理',
  },
  {
    key: '/agents',
    icon: <RobotOutlined />,
    label: 'Dify 智能体',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '个人设置',
  },
];

const viewTitles: Record<string, string> = {
  '/assets': '资产管理',
  '/tasks': '任务管理',
  '/agents': 'Dify 智能体管理',
  '/settings': '个人设置',
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #E3E6ED' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 32,
                height: 32,
                background: 'linear-gradient(135deg, #D97706, #F59E0B)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 16,
              }}
            >
              <ThunderboltOutlined />
            </span>
            Dify<span style={{ color: '#D97706' }}>Flow</span>
          </h1>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ border: 'none', background: 'transparent' }}
          />
        </nav>
        <div style={{ padding: 12, borderTop: '1px solid #E3E6ED' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, cursor: 'pointer' }}>
            <Avatar style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>管</Avatar>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>管理员</div>
              <div style={{ fontSize: 11, color: '#5F6B80' }}>admin</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <div className="app-topbar">
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>
            {viewTitles[location.pathname] || 'DifyFlow'}
          </div>
        </div>
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
