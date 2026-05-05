import { useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Avatar } from 'antd';
import type { MenuProps } from 'antd';
import {
  FolderOutlined,
  RobotOutlined,
  SettingOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { animate } from 'animejs';
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
    children: [
      { key: '/agents', icon: <RobotOutlined />, label: '智能体管理' },
      { key: '/agents/templates', icon: <AppstoreOutlined />, label: '模板广场' },
      { key: '/agents/generator', icon: <BulbOutlined />, label: '智能体生成器' },
    ],
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
  '/agents': '智能体管理',
  '/agents/templates': '模板广场',
  '/agents/generator': '智能体生成器',
  '/settings': '个人设置',
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  useEffect(() => {
    if (contentRef.current) {
      animate(contentRef.current, {
        opacity: [0, 1],
        translateY: [16, 0],
        duration: 500,
        ease: 'out(3)',
      });
    }
    if (titleRef.current) {
      animate(titleRef.current, {
        opacity: [0, 1],
        translateX: [-12, 0],
        duration: 400,
        ease: 'out(3)',
      });
    }
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand" style={{ background: 'linear-gradient(135deg, #FDE8E8 0%, #F5D0D0 100%)' }}>
          <div className="sidebar-brand-inner" style={{ justifyContent: 'flex-start', padding: '8px 10px', gap: 10 }}>
            <img src="/nudt-emblem.png" alt="NUDT" style={{ height: 40, objectFit: 'contain', flex: '0 0 30%' }} />
            <div style={{ width: 1, height: 26, background: 'rgba(151,30,37,0.2)', flexShrink: 0 }} />
            <img src="/project-logo.png" alt="智文坊" style={{ height: 36, objectFit: 'contain', flex: '0 0 60%' }} />
          </div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[location.pathname]}
            defaultOpenKeys={['/agents']}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ border: 'none', background: 'transparent' }}
          />
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-inner">
            <Avatar size={36} style={{ background: 'linear-gradient(135deg, var(--nudt-sunrise), var(--nudt-gold))', color: '#5A3E0A', fontWeight: 700 }}>管</Avatar>
            <div>
              <div className="sidebar-user-name">管理员</div>
              <div className="sidebar-user-role">admin</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <div className="app-topbar">
          <div ref={titleRef} className="app-topbar-title" key={location.pathname} style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>
            {viewTitles[location.pathname] || '智文坊'}
          </div>
        </div>
        <div className="app-content" ref={contentRef} key={location.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
