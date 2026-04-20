import { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Form, Input, Select, Tag, message, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, RedoOutlined, PauseOutlined, EyeOutlined } from '@ant-design/icons';
import { listTasks, createTask, retryTask, cancelTask, deleteTask } from '../api/task.api';
import { listAgents } from '../api/agent.api';
import { listAssets } from '../api/asset.api';
import { getAsset } from '../api/asset.api';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Task, Agent, Asset } from '../types';

const STATUS_CONFIG: Record<string, { color: string; label: string; dotColor: string }> = {
  pending: { color: '#9CA3B8', label: '等待中', dotColor: '#9CA3B8' },
  running: { color: '#D97706', label: '运行中', dotColor: '#D97706' },
  completed: { color: '#059669', label: '已完成', dotColor: '#059669' },
  failed: { color: '#DC2626', label: '已失败', dotColor: '#DC2626' },
  canceled: { color: '#9CA3B8', label: '已取消', dotColor: '#9CA3B8' },
};

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'running', label: '运行中' },
  { key: 'completed', label: '已完成' },
  { key: 'scheduled', label: '定时' },
];

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [form] = Form.useForm();
  const [taskType, setTaskType] = useState('immediate');

  const fetchTasks = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setTasks(await listTasks(activeTab));
    } catch {
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // WebSocket for real-time progress
  const handleMessage = useCallback((msg: any) => {
    if (msg.type === 'task:progress') {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === msg.data.taskId
            ? { ...t, status: msg.data.status, _wsProgress: msg.data.progress }
            : t
        )
      );
    }
  }, []);

  useWebSocket(handleMessage);

  // Polling fallback: auto-refresh every 3s when tasks are running
  useEffect(() => {
    const hasRunning = tasks.some((t) => t.status === 'running');
    if (!hasRunning) return;
    const timer = setInterval(() => fetchTasks(false), 3000);
    return () => clearInterval(timer);
  }, [tasks, fetchTasks]);

  const handleOpenCreate = async () => {
    form.resetFields();
    setTaskType('immediate');
    try {
      const [agentList, assetList] = await Promise.all([
        listAgents(),
        listAssets({ status: 'ready', pageSize: 100 }),
      ]);
      setAgents(agentList);
      setAssets(assetList.items || []);
      setCreateOpen(true);
    } catch (err) {
      console.error('Failed to load data:', err);
      message.error('加载数据失败，请刷新页面重试');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createTask({
        name: values.name,
        type: taskType,
        agentId: values.agentId,
        assetIds: values.assetIds,
        prompt: values.prompt,
        cronExpression: values.cronExpression,
      });
      message.success('任务创建成功');
      setCreateOpen(false);
      fetchTasks();
    } catch (err: any) {
      if (err?.response?.data?.error) message.error(err.response.data.error);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryTask(id);
      message.success('任务已重试');
      fetchTasks();
    } catch { message.error('重试失败'); }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelTask(id);
      message.success('任务已取消');
      fetchTasks();
    } catch { message.error('取消失败'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除该任务吗？')) return;
    try {
      await deleteTask(id);
      message.success('已删除');
      fetchTasks();
    } catch (err: any) {
      message.error(err?.response?.data?.error || '删除失败');
    }
  };

  const filteredTasks = tasks;
  const runningCount = tasks.filter((t) => t.status === 'running').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>任务管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>新建任务</Button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #E3E6ED' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#D97706' : '#5F6B80',
              borderBottom: activeTab === tab.key ? '2px solid #D97706' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.2s',
            }}
          >
            {tab.label}
            {tab.key === 'running' && runningCount > 0 && (
              <span style={{ marginLeft: 6, background: '#D97706', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{runningCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <Spin style={{ display: 'block', margin: '80px auto' }} />
      ) : filteredTasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3B8' }}>
          {activeTab === 'all' ? '暂无任务，点击"新建任务"开始' : '该分类下暂无任务'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} onRetry={handleRetry} onCancel={handleCancel} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        title="新建任务"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        okText="创建任务"
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="任务名称" name="name" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="输入任务名称..." />
          </Form.Item>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>任务类型</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setTaskType('immediate'); form.setFieldsValue({ cronExpression: undefined }); }}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${taskType === 'immediate' ? '#D97706' : '#E3E6ED'}`,
                  background: taskType === 'immediate' ? '#FFFBEB' : '#fff', cursor: 'pointer', fontSize: 13,
                  color: taskType === 'immediate' ? '#D97706' : '#5F6B80',
                }}
              >即时任务</button>
              <button
                onClick={() => setTaskType('scheduled')}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${taskType === 'scheduled' ? '#D97706' : '#E3E6ED'}`,
                  background: taskType === 'scheduled' ? '#FFFBEB' : '#fff', cursor: 'pointer', fontSize: 13,
                  color: taskType === 'scheduled' ? '#D97706' : '#5F6B80',
                }}
              >定时任务</button>
            </div>
          </div>

          {taskType === 'scheduled' && (
            <Form.Item label="触发时间" name="cronExpression">
              <Input placeholder="Cron 表达式，如 0 8 * * *（每天8点）" />
            </Form.Item>
          )}

          <Form.Item label="选择智能体" name="agentId" rules={[{ required: true, message: '请选择智能体' }]}>
            <Select placeholder="选择智能体" options={agents.map((a) => ({ label: `${a.name} (${a.mode})`, value: a.id }))} />
          </Form.Item>

          <Form.Item label="任务指令" name="prompt" rules={[{ required: true, message: '请输入任务指令' }]}>
            <Input.TextArea rows={2} placeholder="告诉智能体要做什么，如：总结以下文档的核心内容" />
          </Form.Item>

          <Form.Item label="选择文件" name="assetIds" rules={[{ required: true, message: '请选择文件' }]}>
            <Select
              mode="multiple"
              placeholder="选择已上传的文件"
              options={assets.map((a) => ({ label: a.originalName, value: a.id }))}
              maxTagCount={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/* ===== Task Card ===== */
function TaskCard({ task, onRetry, onCancel, onDelete }: {
  task: Task;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const isScheduled = task.type === 'scheduled';
  const progress = task.totalFiles > 0 ? Math.round((task.completedFiles / task.totalFiles) * 100) : 0;
  const timeAgo = getTimeAgo(task.createdAt);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultText, setResultText] = useState('');
  const [resultLoading, setResultLoading] = useState(false);

  const handleViewResult = async () => {
    setResultOpen(true);
    setResultLoading(true);
    try {
      const resultItems = (task.items || []).filter((item) => item.resultAssetId);
      if (resultItems.length === 0) {
        setResultText('暂无结果');
        setResultLoading(false);
        return;
      }
      // Show task info header
      let header = `📋 任务指令：${(task as any).prompt || '无'}\n`;
      header += `🤖 智能体：${task.agent?.name || '未知'}\n`;
      header += `📄 处理文件：${resultItems.map((i) => i.sourceAsset?.originalName || '未知').join('、')}\n`;
      header += '─'.repeat(40) + '\n\n';

      const texts: string[] = [];
      for (const item of resultItems) {
        if (item.resultAssetId) {
          const asset = await getAsset(item.resultAssetId);
          texts.push(`【${item.sourceAsset?.originalName || '文件'}】\n${asset.parsedText || '无内容'}`);
        }
      }
      setResultText(header + texts.join('\n\n---\n\n'));
    } catch {
      setResultText('加载结果失败');
    } finally {
      setResultLoading(false);
    }
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: 18,
        background: '#fff', borderRadius: 14, border: '1px solid #E3E6ED',
        borderLeft: isScheduled ? '3px solid #2563EB' : undefined,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: cfg.dotColor,
          boxShadow: task.status === 'running' ? `0 0 6px ${cfg.dotColor}40` : 'none',
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            {isScheduled && <span>⏰</span>}
            {task.name}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#5F6B80' }}>
            <span>🤖 {task.agent?.name || '未知'}</span>
            <span>📄 {task.totalFiles} 个文件</span>
            <span>🕐 {timeAgo}</span>
            {isScheduled && task.cronExpression && <span>⏰ {task.cronExpression}</span>}
          </div>
        </div>

        {task.status === 'running' || task.status === 'completed' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ width: 140, height: 4, borderRadius: 2, background: '#F3F4F6', overflow: 'hidden' }}>
              <div style={{
                width: `${progress}%`, height: '100%', borderRadius: 2,
                background: task.status === 'completed' ? '#059669' : '#D97706',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: task.status === 'completed' ? '#059669' : '#D97706', width: 36 }}>
              {progress}%
            </span>
          </div>
        ) : task.status === 'failed' ? (
          <Tag color="error">失败</Tag>
        ) : isScheduled ? (
          <Tag color="blue">定时任务</Tag>
        ) : null}

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {task.status === 'completed' && (
            <Button size="small" icon={<EyeOutlined />} onClick={handleViewResult}>查看结果</Button>
          )}
          {task.status === 'failed' && (
            <Button size="small" icon={<RedoOutlined />} onClick={() => onRetry(task.id)}>重试</Button>
          )}
          {task.status === 'running' && (
            <Button size="small" icon={<PauseOutlined />} onClick={() => onCancel(task.id)}>取消</Button>
          )}
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(task.id)}>删除</Button>
        </div>
      </div>

      {/* Result Modal */}
      <Modal
        title={`任务结果 — ${task.name}`}
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        footer={<Button type="primary" onClick={() => setResultOpen(false)}>关闭</Button>}
        width={700}
      >
        {resultLoading ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : (
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: '#F9FAFB', padding: 16, borderRadius: 10,
            border: '1px solid #E3E6ED', maxHeight: 500, overflow: 'auto',
            fontSize: 13, lineHeight: 1.6, margin: 0,
          }}>
            {resultText}
          </pre>
        )}
      </Modal>
    </>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}
