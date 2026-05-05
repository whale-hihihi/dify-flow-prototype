import { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Input, Select, Tag, message, Space, Spin, App } from 'antd';
import { PlusOutlined, LinkOutlined, EditOutlined, DeleteOutlined, ApiOutlined, MessageOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { listAgents, createAgent, updateAgent, deleteAgent, testAgentConnection, checkAgentsOnline, chatTest } from '../api/agent.api';
import { getDifyConfig, testDifyConnection } from '../api/dify-config.api';
import { useStaggerChildren } from '../hooks/usePageAnimation';
import type { Agent } from '../types';

const modeLabels: Record<string, string> = {
  chat: 'Chat',
  completion: 'Completion',
  workflow: 'Workflow',
  'advanced-chat': 'Advanced Chat',
  'agent-chat': 'Agent Chat',
};

const AGENT_ICONS = ['📝', '🎯', '🌐', '📊', '🤖', '🔬', '💡', '🧠'];

export function AgentsPage() {
  const { modal } = App.useApp();
  const staggerRef = useStaggerChildren('.ant-card');

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOnline, setCheckingOnline] = useState(false);
  const [difyStatus, setDifyStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [difyUrl, setDifyUrl] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);

  // I/O test state
  const [ioAgent, setIoAgent] = useState<Agent | null>(null);
  const [ioModalOpen, setIoModalOpen] = useState(false);
  const [ioMessage, setIoMessage] = useState('');
  const [ioAnswer, setIoAnswer] = useState('');
  const [ioLoading, setIoLoading] = useState(false);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setAgents(await listAgents());
    } catch {
      message.error('获取智能体列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDifyStatus = async () => {
    try {
      const config = await getDifyConfig();
      const url = config?.difyUrl || 'http://localhost/v1';
      setDifyUrl(url);
      const result = await testDifyConnection(url);
      setDifyStatus(result.success ? 'connected' : 'disconnected');
    } catch {
      setDifyStatus('unknown');
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchDifyStatus();
  }, []);

  const handleCheckOnline = async () => {
    setCheckingOnline(true);
    try {
      const updated = await checkAgentsOnline();
      setAgents(updated);
      message.success('在线状态已刷新');
    } catch {
      message.error('状态探测失败');
    } finally {
      setCheckingOnline(false);
    }
  };

  const handleAdd = () => {
    setEditingAgent(null);
    form.resetFields();
    form.setFieldsValue({ endpoint: difyUrl || 'http://localhost/v1', mode: 'chat' });
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
      const errMsg = err.response?.data?.error || err.message || '操作失败';
      if (!err.response?.data?.error && err.errorFields) return; // form validation, already shown
      message.error(errMsg);
    }
  };

  const handleDelete = async (id: string) => {
    modal.confirm({
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

  const handleIOOpen = (agent: Agent) => {
    setIoAgent(agent);
    setIoMessage('');
    setIoAnswer('');
    setIoModalOpen(true);
  };

  const handleIOSend = async () => {
    if (!ioAgent || !ioMessage.trim()) return;
    setIoLoading(true);
    setIoAnswer('');
    try {
      const result = await chatTest(ioAgent.id, ioMessage);
      setIoAnswer(result.answer);
      // Re-fetch agent in case mode was auto-corrected
      const updated = await listAgents();
      setAgents(updated);
      const refreshed = updated.find(a => a.id === ioAgent.id);
      if (refreshed) setIoAgent(refreshed);
    } catch (err: any) {
      setIoAnswer(`错误: ${err.response?.data?.error || err.message}`);
    } finally {
      setIoLoading(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const onlineCount = agents.filter((a) => a.isOnline).length;

  return (
    <div ref={staggerRef}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title">Dify 智能体管理</h2>
        <Space>
          <a href="http://localhost/apps" target="_blank" rel="noreferrer">
            <Button icon={<LinkOutlined />}>进入 Dify 工作室</Button>
          </a>
          <Button icon={<PlusOutlined />} onClick={handleAdd}>添加 Dify 智能体</Button>
        </Space>
      </div>

      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
        padding: '10px 16px', background: '#F9FAFB', borderRadius: 10, fontSize: 13, color: '#5F6B80',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
          background: difyStatus === 'connected' ? '#059669' : '#DC2626',
          boxShadow: difyStatus === 'connected' ? '0 0 6px rgba(5,150,105,0.4)' : 'none',
        }} />
        <span style={{ color: difyStatus === 'connected' ? '#059669' : '#DC2626' }}>
          {difyStatus === 'connected' ? 'Dify 服务已连接' : 'Dify 服务未连接'}
        </span>
        {difyUrl && <span>— {difyUrl}</span>}
        <span style={{ borderLeft: '1px solid #E3E6ED', height: 14, margin: '0 4px' }} />
        <span>已接入 {agents.length} 个智能体</span>
        <Button size="small" loading={checkingOnline} onClick={handleCheckOnline} style={{ marginLeft: 'auto' }}>
          刷新状态
        </Button>
      </div>

      {/* Agent cards */}
      {agents.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#9CA3B8' }}>暂无智能体，点击"添加 Dify 智能体"开始接入</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
          {agents.map((agent, idx) => (
            <Card key={agent.id} hoverable style={{ borderRadius: 14, overflow: 'hidden', borderTop: agent.isOnline ? '3px solid #059669' : '3px solid #D0D4DE' }}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{
                      width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, #F5E8EA, #FDF2F3)', border: '1px solid #E0C5C8', fontSize: 22,
                    }}>
                      {AGENT_ICONS[idx % AGENT_ICONS.length]}
                    </span>
                    <Tag color={agent.isOnline ? 'success' : 'default'}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                        background: 'currentColor', marginRight: 4,
                        animation: agent.isOnline ? 'pulse 2s infinite' : 'none',
                      }} />
                      {agent.isOnline ? '在线' : '离线'}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{agent.name}</div>
                  <div style={{ fontSize: 12, color: '#5F6B80', lineHeight: 1.5, marginBottom: 14 }}>
                    {agent.description || '暂无描述'}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: 11, color: '#9CA3B8' }}>
                    <span>{modeLabels[agent.mode] || agent.mode}</span>
                    <span>{agent.callCount} 次调用</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #E3E6ED', paddingTop: 14 }}>
                  <Button size="small" style={{ flex: 1, minWidth: 0 }} icon={<ApiOutlined />} onClick={() => handleTest(agent)}>
                    连通测试
                  </Button>
                  <Button size="small" style={{ flex: 1, minWidth: 0 }} icon={<MessageOutlined />} onClick={() => handleIOOpen(agent)}>
                    I/O 测试
                  </Button>
                  <Button size="small" style={{ flex: 1, minWidth: 0 }} icon={<EditOutlined />} onClick={() => handleEdit(agent)}>
                    编辑
                  </Button>
                  <Button size="small" danger style={{ flex: 1, minWidth: 0 }} icon={<DeleteOutlined />} onClick={() => handleDelete(agent.id)}>
                    删除
                  </Button>
                </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="智能体名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
              <Input placeholder="输入名称..." />
            </Form.Item>
            <Form.Item label="模式" name="mode" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="chat">Chat (对话型)</Select.Option>
                <Select.Option value="completion">Completion (补全型)</Select.Option>
                <Select.Option value="workflow">Workflow (工作流型)</Select.Option>
	                <Select.Option value="advanced-chat">Advanced Chat (高级对话)</Select.Option>
	                <Select.Option value="agent-chat">Agent Chat (智能体对话)</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="简要描述智能体功能..." rows={2} />
          </Form.Item>
          <Form.Item label="API Key" name="apiKey" rules={editingAgent ? [] : [{ required: true, message: '请输入 API Key' }]}>
            <Input.Password placeholder="从 Dify 应用的「API 访问」页面获取，格式 app-xxx" visibilityToggle />
          </Form.Item>
          <Form.Item label="App ID" name="appId">
            <Input placeholder="选填，Dify 应用的 App ID" />
          </Form.Item>
          <Form.Item label="API 端点" name="endpoint">
            <Input placeholder="http://localhost/v1" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Connectivity Test Modal */}
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

      {/* I/O Test Modal */}
      <Modal
        title={<span>I/O 测试 — {ioAgent?.name || ''} <Tag color="blue" style={{ fontSize: 11, marginLeft: 8 }}>{modeLabels[ioAgent?.mode || 'chat'] || ioAgent?.mode}</Tag></span>}
        open={ioModalOpen}
        onCancel={() => setIoModalOpen(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 12 }}>
          <Input.TextArea
            rows={3}
            value={ioMessage}
            onChange={(e) => setIoMessage(e.target.value)}
            placeholder="输入测试文本..."
            onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleIOSend(); } }}
          />
        </div>
        <Button type="primary" icon={<ThunderboltOutlined />} loading={ioLoading} onClick={handleIOSend} block>
          发送测试
        </Button>
        {ioAnswer && (
          <div style={{
            marginTop: 16, padding: 14, background: '#F9FAFB', borderRadius: 10,
            border: '1px solid #E3E6ED', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6,
          }}>
            <div style={{ fontSize: 11, color: '#9CA3B8', marginBottom: 6, fontWeight: 600 }}>智能体返回：</div>
            {ioAnswer}
          </div>
        )}
      </Modal>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
