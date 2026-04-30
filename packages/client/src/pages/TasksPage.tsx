import { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Form, Input, Select, Tag, message, Spin, TimePicker, InputNumber, Checkbox } from 'antd';
import { PlusOutlined, DeleteOutlined, RedoOutlined, PauseOutlined, EyeOutlined, CaretRightOutlined } from '@ant-design/icons';
import { listTasks, createTask, retryTask, cancelTask, deleteTask, toggleScheduled, getTask } from '../api/task.api';
import { listAgents, getAgentParameters } from '../api/agent.api';
import { listAssets } from '../api/asset.api';
import { getAsset } from '../api/asset.api';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Task, Agent, Asset } from '../types';
import dayjs from 'dayjs';

const WEEKDAY_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 },
];

const FREQ_OPTIONS = [
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '自定义间隔', value: 'interval' },
];

function buildCron(freq: string, time: dayjs.Dayjs | null, weekdays: number[], monthDay: number | null, intervalVal: number | null, intervalUnit: string): string {
  const m = time ? time.minute() : 0;
  const h = time ? time.hour() : 8;
  switch (freq) {
    case 'daily': return `${m} ${h} * * *`;
    case 'weekly': {
      const days = weekdays.length > 0 ? weekdays.join(',') : '1';
      return `${m} ${h} * * ${days}`;
    }
    case 'monthly': return `${m} ${h} ${monthDay || 1} * *`;
    case 'interval': {
      if (!intervalVal || intervalVal < 1) return `*/30 * * * *`;
      if (intervalUnit === 'minute') return `*/${intervalVal} * * * *`;
      return `0 */${intervalVal} * * *`;
    }
    default: return `0 8 * * *`;
  }
}

function cronToLabel(cron: string): string {
  if (!cron) return '';
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;

  if (dow !== '*' && dom === '*' && mon === '*' && !min.startsWith('*/') && !hour.startsWith('*/')) {
    const dayMap: Record<string, string> = { '0': '周日', '1': '周一', '2': '周二', '3': '周三', '4': '周四', '5': '周五', '6': '周六' };
    const days = dow.split(',').map(d => dayMap[d] || d).join('、');
    return `每${days} ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  }
  if (dom !== '*' && dow === '*' && mon === '*' && !min.startsWith('*/') && !hour.startsWith('*/')) {
    return `每月 ${dom} 日 ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  }
  if (dom === '*' && dow === '*' && mon === '*' && !min.startsWith('*/') && !hour.startsWith('*/')) {
    return `每天 ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  }
  if (min.startsWith('*/') && hour === '*' && dom === '*' && dow === '*') {
    const v = min.replace('*/', '');
    return `每 ${v} 分钟`;
  }
  if (hour.startsWith('*/') && min === '0' && dom === '*' && dow === '*') {
    const v = hour.replace('*/', '');
    return `每 ${v} 小时`;
  }
  return cron;
}

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
  const [scheduleFreq, setScheduleFreq] = useState('daily');
  const [scheduleTime, setScheduleTime] = useState(dayjs('08:00', 'HH:mm'));
  const [scheduleWeekdays, setScheduleWeekdays] = useState<number[]>([1]);
  const [scheduleMonthDay, setScheduleMonthDay] = useState<number>(1);
  const [scheduleInterval, setScheduleInterval] = useState<number>(30);
  const [scheduleIntervalUnit, setScheduleIntervalUnit] = useState('minute');
  const [agentFields, setAgentFields] = useState<any[]>([]);
  const [agentFieldsLoading, setAgentFieldsLoading] = useState(false);
  const [sourceFields, setSourceFields] = useState<string[]>([]);

  const handleAgentChange = async (agentId: string) => {
    setAgentFields([]);
    setSourceFields([]);
    if (!agentId) return;
    setAgentFieldsLoading(true);
    try {
      const result = await getAgentParameters(agentId);
      const fields = (result.userInputForm || []).map((field: any) => {
        const typeKey = Object.keys(field)[0];
        const fieldDef = field[typeKey];
        const variable = fieldDef?.variable || typeKey;
        const fieldType = fieldDef?.type || typeKey;
        const label = fieldDef?.label || variable;
        return { typeKey, fieldDef, variable, fieldType, label };
      });
      setAgentFields(fields);
      // Set default values
      for (const f of fields) {
        if (f.fieldDef?.default != null) {
          form.setFieldValue(`input_${f.variable}`, f.fieldDef.default);
        }
      }
    } catch {
      setAgentFields([]);
    } finally {
      setAgentFieldsLoading(false);
    }
  };

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
      const { taskId, status, progress } = msg.data;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status, _wsProgress: progress }
            : t
        )
      );
      // When task finishes, do a full refresh to get items with resultAssetId
      if (status === 'completed' || status === 'failed') {
        setTimeout(() => fetchTasks(false), 500);
      }
    }
  }, [fetchTasks]);

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
    setScheduleFreq('daily');
    setScheduleTime(dayjs('08:00', 'HH:mm'));
    setScheduleWeekdays([1]);
    setScheduleMonthDay(1);
    setScheduleInterval(30);
    setScheduleIntervalUnit('minute');
    setAgentFields([]);
    setSourceFields([]);
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
      const cronExpression = taskType === 'scheduled'
        ? buildCron(scheduleFreq, scheduleTime, scheduleWeekdays, scheduleMonthDay, scheduleInterval, scheduleIntervalUnit)
        : undefined;

      // Collect all dynamic inputs
      const inputs: Record<string, any> = {};
      for (const f of agentFields) {
        const val = values[`input_${f.variable}`];
        if (val !== undefined && val !== null && val !== '') {
          inputs[f.variable] = val;
        }
      }

      // Extract prompt from the first non-source text/paragraph field for display purposes
      let prompt = '';
      for (const f of agentFields) {
        if (!sourceFields.includes(f.variable) && (f.fieldType === 'text-input' || f.fieldType === 'paragraph')) {
          const val = inputs[f.variable];
          if (val && typeof val === 'string') { prompt = val; break; }
        }
      }

      await createTask({
        name: values.name,
        type: taskType,
        agentId: values.agentId,
        assetIds: values.assetIds,
        prompt: prompt || undefined,
        cronExpression,
        inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
        sourceFields: sourceFields.length > 0 ? sourceFields : undefined,
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

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleScheduled(id, enabled);
      message.success(enabled ? '已启用' : '已暂停');
      fetchTasks();
    } catch { message.error('操作失败'); }
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
            <TaskCard key={task.id} task={task} onRetry={handleRetry} onCancel={handleCancel} onDelete={handleDelete} onToggle={handleToggle} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        title="新建任务"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        maskClosable={false}
        okText="创建任务"
        cancelButtonProps={{ style: { display: 'none' } }}
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
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>执行频率</div>
                <Select
                  value={scheduleFreq}
                  onChange={setScheduleFreq}
                  options={FREQ_OPTIONS}
                  style={{ width: '100%' }}
                />
              </div>

              {(scheduleFreq === 'daily' || scheduleFreq === 'weekly' || scheduleFreq === 'monthly') && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>执行时间</div>
                  <TimePicker
                    value={scheduleTime}
                    onChange={(t) => setScheduleTime(t)}
                    format="HH:mm"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {scheduleFreq === 'weekly' && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>选择星期</div>
                  <Checkbox.Group
                    value={scheduleWeekdays}
                    onChange={(v) => setScheduleWeekdays(v as number[])}
                    options={WEEKDAY_OPTIONS}
                  />
                </div>
              )}

              {scheduleFreq === 'monthly' && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>每月几号</div>
                  <InputNumber
                    value={scheduleMonthDay}
                    onChange={(v) => setScheduleMonthDay(v ?? 1)}
                    min={1} max={31}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {scheduleFreq === 'interval' && (
                <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                  <InputNumber
                    value={scheduleInterval}
                    onChange={(v) => setScheduleInterval(v ?? 30)}
                    min={1} max={999}
                    style={{ flex: 1 }}
                  />
                  <Select
                    value={scheduleIntervalUnit}
                    onChange={setScheduleIntervalUnit}
                    options={[{ label: '分钟', value: 'minute' }, { label: '小时', value: 'hour' }]}
                    style={{ width: 100 }}
                  />
                </div>
              )}

              <Form.Item name="cronExpression" hidden>
                <Input />
              </Form.Item>
            </>
          )}

          <Form.Item label="选择智能体" name="agentId" rules={[{ required: true, message: '请选择智能体' }]}>
            <Select
              placeholder="选择智能体"
              options={agents.map((a) => ({ label: `${a.name} (${a.mode})`, value: a.id }))}
              onChange={handleAgentChange}
            />
          </Form.Item>

          {agentFieldsLoading && (
            <div style={{ textAlign: 'center', padding: '8px 0', color: '#9CA3B8', fontSize: 13 }}>加载输入参数...</div>
          )}

          {agentFields.length > 0 && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #E3E6ED' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#374151' }}>工作流输入参数</div>
              {agentFields.map((f) => {
                const isSource = sourceFields.includes(f.variable);
                const required = !isSource && f.fieldDef?.required;

                // File fields: handled by file selector
                if (f.fieldType === 'file-list' || f.fieldType === 'single-file') {
                  return (
                    <div key={f.variable} style={{ marginBottom: 8, padding: '6px 10px', background: '#fff', borderRadius: 6, border: '1px solid #E3E6ED', fontSize: 12, color: '#5F6B80' }}>
                      📎 <b>{f.label}</b>：执行时自动上传所选文件
                    </div>
                  );
                }

                const toggleSource = () => {
                  setSourceFields((prev) =>
                    prev.includes(f.variable) ? prev.filter(v => v !== f.variable) : [...prev, f.variable]
                  );
                };

                const labelExtra = isSource ? (
                  <span style={{ fontSize: 11, color: '#D97706', fontWeight: 400, marginLeft: 6 }}>📎 将填入文件内容</span>
                ) : null;

                const fieldLabel = (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{f.label} {labelExtra}</span>
                    <Checkbox
                      checked={isSource}
                      onChange={toggleSource}
                      style={{ fontSize: 11 }}
                    >
                      <span style={{ fontSize: 11, color: '#9CA3B8' }}>文件内容</span>
                    </Checkbox>
                  </div>
                );

                if (f.fieldType === 'select') {
                  const options = Array.isArray(f.fieldDef?.options)
                    ? f.fieldDef.options.map((o: any) => ({ label: typeof o === 'string' ? o : o.label || o, value: typeof o === 'string' ? o : o.value || o }))
                    : [];
                  return (
                    <Form.Item key={f.variable} label={fieldLabel} name={`input_${f.variable}`} rules={required ? [{ required: true, message: `请选择${f.label}` }] : undefined} style={{ marginBottom: 8 }}>
                      <Select placeholder={`选择${f.label}...`} options={options} allowClear />
                    </Form.Item>
                  );
                }
                if (f.fieldType === 'number') {
                  return (
                    <Form.Item key={f.variable} label={fieldLabel} name={`input_${f.variable}`} style={{ marginBottom: 8 }}>
                      <InputNumber min={f.fieldDef?.min} max={f.fieldDef?.max} style={{ width: '100%' }} placeholder={`输入${f.label}...`} />
                    </Form.Item>
                  );
                }
                if (f.fieldType === 'paragraph') {
                  return (
                    <Form.Item key={f.variable} label={fieldLabel} name={`input_${f.variable}`} rules={required ? [{ required: true, message: `请输入${f.label}` }] : undefined} style={{ marginBottom: 8 }}>
                      <Input.TextArea rows={3} placeholder={isSource ? '执行时将填入文件内容...' : `输入${f.label}...`} />
                    </Form.Item>
                  );
                }
                // text-input and fallback
                return (
                  <Form.Item key={f.variable} label={fieldLabel} name={`input_${f.variable}`} rules={required ? [{ required: true, message: `请输入${f.label}` }] : undefined} style={{ marginBottom: 8 }}>
                    <Input placeholder={isSource ? '执行时将填入文件内容...' : `输入${f.label}...`} />
                  </Form.Item>
                );
              })}
            </div>
          )}

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
function TaskCard({ task, onRetry, onCancel, onDelete, onToggle }: {
  task: Task;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const isScheduled = task.type === 'scheduled';
  const fileProgress = task.totalFiles > 0 ? Math.round((task.completedFiles / task.totalFiles) * 100) : 0;
  const progress = (task as any)._wsProgress != null ? (task as any)._wsProgress : fileProgress;
  const timeAgo = getTimeAgo(task.createdAt);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultText, setResultText] = useState('');
  const [resultLoading, setResultLoading] = useState(false);

  const handleViewResult = async () => {
    setResultOpen(true);
    setResultLoading(true);
    try {
      let resultItems = (task.items || []).filter((item) => item.resultAssetId);

      // If no results yet but task is completed, items might be stale — refetch
      if (resultItems.length === 0 && task.status === 'completed') {
        const freshTask = await getTask(task.id);
        resultItems = (freshTask.items || []).filter((item: any) => item.resultAssetId);
      }

      if (resultItems.length === 0) {
        setResultText('暂无结果');
        setResultLoading(false);
        return;
      }

      // Show task info header
      let header = `🤖 智能体：${task.agent?.name || '未知'}\n`;
      if ((task as any).prompt) header += `📝 指令：${(task as any).prompt}\n`;
      // Show inputs
      const taskInputs = (task as any).inputs;
      if (taskInputs && typeof taskInputs === 'object') {
        const inputEntries = Object.entries(taskInputs);
        if (inputEntries.length > 0) {
          header += '⚙️ 输入参数：';
          header += inputEntries.map(([k, v]) => `${k}=${v}`).join(', ');
          header += '\n';
        }
      }
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
            {isScheduled && task.cronExpression && <span>⏰ {cronToLabel(task.cronExpression)}</span>}
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
          <Tag color={task.enabled ? 'blue' : 'default'}>{task.enabled ? '定时任务' : '已暂停'}</Tag>
        ) : null}

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {isScheduled && (
            task.enabled ? (
              <Button size="small" icon={<PauseOutlined />} onClick={() => onToggle(task.id, false)}>暂停</Button>
            ) : (
              <Button size="small" type="primary" icon={<CaretRightOutlined />} onClick={() => onToggle(task.id, true)}>启用</Button>
            )
          )}
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
