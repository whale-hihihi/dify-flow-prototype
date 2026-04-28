import { useState, useEffect } from 'react';
import { Card, Input, Button, Form, message, Spin, Select, Table, Tag, Modal, Dropdown, Popconfirm, Switch, Space } from 'antd';
import { getDifyConfig, upsertDifyConfig, testDifyConnection } from '../api/dify-config.api';
import { getMe, updateProfile, listUsers, createUser, updateUserRole, deleteUser, resetUserPassword } from '../api/auth.api';
import { listAgents } from '../api/agent.api';
import { useAuthStore } from '../stores/authStore';
import type { User, Agent } from '../types';

const AVATAR_COLORS: Record<string, string> = {
  admin: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  member: 'linear-gradient(135deg, #22c55e, #10b981)',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'blue',
  member: 'default',
};

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  member: '成员',
};

export function SettingsPage() {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>个人设置</h2>
      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <DifyConfigPanel />
        <ProfilePanel />
        <NotificationPanel />
        <TeamManagementPanel />
      </div>
    </div>
  );
}

/* ===== Dify Config ===== */
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
              width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
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
      <Button type="primary" loading={saving} onClick={handleSave}>保存配置</Button>
    </Card>
  );
}

/* ===== Profile ===== */
function ProfilePanel() {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    (async () => {
      const [user, agentList] = await Promise.all([getMe(), listAgents()]);
      form.setFieldsValue({ username: user.username, email: user.email, defaultAgentId: user.defaultAgentId || undefined });
      setAgents(agentList);
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
          <Form.Item label="用户名" name="username"><Input /></Form.Item>
          <Form.Item label="邮箱" name="email"><Input type="email" /></Form.Item>
        </div>
        <Form.Item label="默认智能体" name="defaultAgentId" tooltip="新建任务时自动使用该智能体">
          <Select allowClear placeholder="选择默认智能体" options={agents.map((a) => ({ label: a.name, value: a.id }))} />
        </Form.Item>
        <Button type="primary" loading={saving} onClick={handleSave}>保存</Button>
      </Form>
    </Card>
  );
}

/* ===== Notifications ===== */
function NotificationPanel() {
  const STORAGE_KEY = 'difyflow_notifications';
  const [prefs, setPrefs] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { taskDone: true, taskFailed: true, difyDisconnected: false };
  });

  const toggle = (key: string, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    message.success('通知偏好已保存');
  };

  const items = [
    { key: 'taskDone', label: '任务完成通知', desc: '当任务处理完成时发送通知' },
    { key: 'taskFailed', label: '任务失败通知', desc: '当任务处理失败时发送通知' },
    { key: 'difyDisconnected', label: 'Dify 断连通知', desc: '当 Dify 服务连接中断时发送通知' },
  ];

  return (
    <Card style={{ borderRadius: 14 }}>
      <h3 style={{ marginBottom: 4 }}>通知偏好</h3>
      <p style={{ fontSize: 12, color: '#5F6B80', marginBottom: 18 }}>管理系统通知方式</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map((item) => (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#5F6B80' }}>{item.desc}</div>
            </div>
            <Switch checked={prefs[item.key]} onChange={(v) => toggle(item.key, v)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ===== Team Management ===== */
function TeamManagementPanel() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [inviteForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  if (currentUser?.role !== 'admin') return null;

  const loadUsers = async () => {
    try {
      setUsers(await listUsers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleInvite = async () => {
    try {
      const values = await inviteForm.validateFields();
      await createUser(values);
      message.success('成员邀请成功');
      setInviteOpen(false);
      inviteForm.resetFields();
      loadUsers();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.error || '邀请失败');
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateUserRole(userId, role);
      message.success('角色已更新');
      loadUsers();
    } catch {
      message.error('更新角色失败');
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await deleteUser(userId);
      message.success('成员已移除');
      loadUsers();
    } catch {
      message.error('移除失败');
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    try {
      const values = await resetForm.validateFields();
      await resetUserPassword(resetTarget.id, values.newPassword);
      message.success('密码已重置');
      setResetOpen(false);
      resetForm.resetFields();
      setResetTarget(null);
    } catch {
      message.error('重置失败');
    }
  };

  const columns = [
    {
      title: '成员',
      key: 'member',
      render: (_: any, record: User) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: AVATAR_COLORS[record.role] || AVATAR_COLORS.member,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 600, fontSize: 14, flexShrink: 0,
          }}>
            {record.username[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{record.username}</div>
            <div style={{ fontSize: 12, color: '#5F6B80' }}>{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role] || role}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: User) => (
        <Space>
          <Dropdown
            menu={{
              items: [
                { key: 'admin', label: '管理员', onClick: () => handleRoleChange(record.id, 'admin') },
                { key: 'member', label: '成员', onClick: () => handleRoleChange(record.id, 'member') },
              ],
            }}
          >
            <Button size="small">切换角色</Button>
          </Dropdown>
          <Button size="small" onClick={() => { setResetTarget(record); setResetOpen(true); }}>重置密码</Button>
          {record.id !== currentUser?.id && (
            <Popconfirm title="确定移除该成员？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
              <Button size="small" danger>移除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card style={{ borderRadius: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>团队管理</h3>
          <p style={{ fontSize: 12, color: '#5F6B80' }}>管理团队成员和权限</p>
        </div>
        <Button type="primary" onClick={() => setInviteOpen(true)}>邀请成员</Button>
      </div>
      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
      />

      <Modal title="邀请新成员" open={inviteOpen} onOk={handleInvite} onCancel={() => { setInviteOpen(false); inviteForm.resetFields(); }} okText="邀请" cancelText="取消">
        <Form form={inviteForm} layout="vertical">
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="角色" name="role" initialValue="member">
            <Select options={[{ label: '管理员', value: 'admin' }, { label: '成员', value: 'member' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`重置密码 - ${resetTarget?.username}`} open={resetOpen} onOk={handleResetPassword} onCancel={() => { setResetOpen(false); resetForm.resetFields(); setResetTarget(null); }} okText="确认重置" cancelText="取消">
        <Form form={resetForm} layout="vertical">
          <Form.Item label="新密码" name="newPassword" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少 6 位' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
