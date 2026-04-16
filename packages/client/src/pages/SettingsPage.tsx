import { useState, useEffect } from 'react';
import { Card, Input, Button, Form, message, Spin } from 'antd';
import { getDifyConfig, upsertDifyConfig, testDifyConnection } from '../api/dify-config.api';
import { getMe, updateProfile } from '../api/auth.api';
import { useAuthStore } from '../stores/authStore';

export function SettingsPage() {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>个人设置</h2>
      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <DifyConfigPanel />
        <ProfilePanel />
      </div>
    </div>
  );
}

function DifyConfigPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [difyUrl, setDifyUrl] = useState('http://localhost/v1');
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const config = await getDifyConfig();
        if (config) {
          setDifyUrl(config.difyUrl);
          setConnectionStatus(config.connectionStatus);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertDifyConfig(difyUrl);
      message.success('Dify 配置保存成功');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await testDifyConnection(difyUrl);
      setConnectionStatus(result.success ? 'connected' : 'disconnected');
      if (result.success) {
        message.success(`连接成功，延迟 ${result.latencyMs}ms`);
      } else {
        message.error(`连接失败: ${result.error}`);
      }
    } catch {
      setConnectionStatus('disconnected');
      message.error('连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <Spin />;

  return (
    <Card style={{ borderRadius: 14 }}>
      <h3 style={{ marginBottom: 4 }}>Dify 连接配置</h3>
      <p style={{ fontSize: 12, color: '#5F6B80', marginBottom: 18 }}>配置本地部署的 Dify 服务地址</p>
      <Form.Item label="Dify API 地址" style={{ marginBottom: 16 }}>
        <Input value={difyUrl} onChange={(e) => setDifyUrl(e.target.value)} placeholder="http://your-dify-host/v1" />
      </Form.Item>
      <Form.Item label="连接状态" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              display: 'inline-block',
              background: connectionStatus === 'connected' ? '#059669' : '#DC2626',
              boxShadow: connectionStatus === 'connected' ? '0 0 6px rgba(5,150,105,0.4)' : 'none',
            }}
          />
          <span style={{ color: connectionStatus === 'connected' ? '#059669' : '#DC2626' }}>
            {connectionStatus === 'connected' ? '已连接' : '未连接'}
          </span>
          <Button size="small" loading={testing} onClick={handleTest} style={{ marginLeft: 'auto' }}>
            测试连接
          </Button>
        </div>
      </Form.Item>
      <Button type="primary" loading={saving} onClick={handleSave}>
        保存配置
      </Button>
    </Card>
  );
}

function ProfilePanel() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    (async () => {
      const user = await getMe();
      form.setFieldsValue({ username: user.username, email: user.email });
    })();
  }, [form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const user = await updateProfile(values);
      setUser(user);
      message.success('个人信息更新成功');
    } catch {
      message.error('更新失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ borderRadius: 14 }}>
      <h3 style={{ marginBottom: 4 }}>个人信息</h3>
      <p style={{ fontSize: 12, color: '#5F6B80', marginBottom: 18 }}>管理你的账户信息</p>
      <Form form={form} layout="vertical">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item label="用户名" name="username">
            <Input />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input type="email" />
          </Form.Item>
        </div>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
      </Form>
    </Card>
  );
}
