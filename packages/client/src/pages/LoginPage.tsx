import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/');
    } catch (err: any) {
      message.error(err.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left: brand panel with gate photo */}
      <div className="login-brand">
        <div className="login-brand-content">
          <img className="login-brand-logo" src="/nudt-logo-full.svg" alt="NUDT" />
          <h1 className="login-brand-school">国防科技大学</h1>
          <p className="login-brand-motto">厚德博学 · 强军兴国</p>
          <div className="login-xiaoxun-wrap">
            <div className="login-xiaoxun-left">
              <img src="/xiaoxun01.png" alt="厚德博学" />
            </div>
            <div className="login-xiaoxun-right">
              <img src="/xiaoxun02.png" alt="强军兴国" />
            </div>
          </div>
        </div>
      </div>

      {/* Right: login form */}
      <div className="login-form-side">
        <div className="login-form-box">
          <div className="login-form-header">
            <h2>Dify<span>Flow</span></h2>
            <p>智能文本处理平台</p>
          </div>
          <Form onFinish={onFinish} size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                登 录
              </Button>
            </Form.Item>
          </Form>
          <div style={{ textAlign: 'center', color: '#9CA3B8', fontSize: 12 }}>
            默认账号: admin / admin123
          </div>
        </div>
      </div>
    </div>
  );
}
