import { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Input, Select, Tag, message, Space, Spin } from 'antd';
import { PlusOutlined, LinkOutlined, EditOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons';
import { listAgents, createAgent, updateAgent, deleteAgent, testAgentConnection } from '../api/agent.api';
import type { Agent } from '../types';

const modeLabels: Record<string, string> = {
  chat: 'Chat',
  completion: 'Completion',
  workflow: 'Workflow',
};

export function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const data = await listAgents();
      setAgents(data);
    } catch {
      message.error('获取智能体列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleAdd = () => {
    setEditingAgent(null);
    form.resetFields();
    form.setFieldsValue({ endpoint: 'http://localhost/v1', mode: 'chat' });
    setModalOpen(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    form.setFieldsValue({
      name: agent.name,
      mode: agent.mode,
      description: agent.description,
      appId: agent.appId,
      endpoint: agent.endpoint,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingAgent) {
        await updateAgent(editingAgent.id, values);
        message.success('智能体更新成功');
      } else {
        await createAgent(values);
        message.success('智能体添加成功');
      }
      setModalOpen(false);
      fetchAgents();
    } catch (err: any) {
      if (err.response?.data?.error) {
        message.error(err.response.data.error);
      }
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该智能体吗？此操作不可撤销。',
      okType: 'danger',
      onOk: async () => {
        await deleteAgent(id);
        message.success('删除成功');
        fetchAgents();
      },
    });
  };

  const handleTest = async (agent: Agent) => {
    try {
      const result = await testAgentConnection(agent.id);
      setTestResult(result);
      setTestModalOpen(true);
      fetchAgents();
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
      setTestModalOpen(true);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Dify 智能体管理</h2>
        <Space>
          <a href="http://localhost/apps" target="_blank" rel="noreferrer">
            <Button icon={<LinkOutlined />}>进入 Dify 工作室</Button>
          </a>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加 Dify 智能体
          </Button>
        </Space>
      </div>

      {agents.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#9CA3B8' }}>暂无智能体，点击"添加 Dify 智能体"开始接入</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {agents.map((agent) => (
            <Card key={agent.id} hoverable style={{ borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>🤖</span>
                <Tag color={agent.isOnline ? 'success' : 'default'}>
                  {agent.isOnline ? '在线' : '离线'}
                </Tag>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{agent.name}</div>
              <div style={{ fontSize: 12, color: '#5F6B80', lineHeight: 1.5, marginBottom: 14 }}>
                {agent.description || '暂无描述'}
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: 11, color: '#9CA3B8' }}>
                <span>{modeLabels[agent.mode]}</span>
                <span>{agent.callCount} 次调用</span>
              </div>
              <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #E3E6ED', paddingTop: 14 }}>
                <Button size="small" icon={<ApiOutlined />} onClick={() => handleTest(agent)}>
                  连通测试
                </Button>
                <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(agent)}>
                  编辑
                </Button>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(agent.id)}>
                  删除
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        title={editingAgent ? '编辑智能体' : '添加 Dify 智能体'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingAgent ? '保存' : '添加'}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="智能体名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="输入名称..." />
          </Form.Item>
          <Form.Item label="模式" name="mode" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="chat">Chat (对话型)</Select.Option>
              <Select.Option value="completion">Completion (补全型)</Select.Option>
              <Select.Option value="workflow">Workflow (工作流型)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="简要描述智能体功能..." rows={2} />
          </Form.Item>
          <Form.Item label="Dify App ID" name="appId" rules={[{ required: true, message: '请输入 App ID' }]}>
            <Input placeholder="从 Dify 工作室获取" />
          </Form.Item>
          <Form.Item label="API Key" name="apiKey" rules={editingAgent ? [] : [{ required: true, message: '请输入 API Key' }]}>
            <Input.Password placeholder="app-..." visibilityToggle />
          </Form.Item>
          <Form.Item label="API 端点" name="endpoint">
            <Input placeholder="http://localhost/v1" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Test Result Modal */}
      <Modal
        title="连通性测试"
        open={testModalOpen}
        onCancel={() => setTestModalOpen(false)}
        footer={<Button type="primary" onClick={() => setTestModalOpen(false)}>确定</Button>}
      >
        <div style={{ textAlign: 'center', padding: 20 }}>
          {testResult?.success ? (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>连接成功</div>
              <div style={{ color: '#5F6B80' }}>智能体响应正常，延迟 {testResult.latencyMs}ms</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>连接失败</div>
              <div style={{ color: '#DC2626' }}>{testResult?.error || '未知错误'}</div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
