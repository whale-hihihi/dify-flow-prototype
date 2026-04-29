import { useState } from 'react';
import { Input, Button, Tag } from 'antd';
import { SendOutlined, CopyOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';

const STEPS = [
  { label: '智能体类型', ai: '你好！我是 DifyFlow 智能体生成助手。请选择你想要创建的智能体类型：', options: ['Chat 对话型', 'Completion 补全型', 'Workflow 工作流型'] },
  { label: '功能描述', ai: '请描述这个智能体的主要功能，例如"将中文文档翻译成英文"', free: true },
  { label: '输入格式', ai: '智能体需要接收什么格式的输入？', options: ['纯文本', '文件上传', '文本 + 文件'] },
  { label: '输出格式', ai: '你希望智能体输出什么格式？', options: ['纯文本', 'JSON', 'Markdown'] },
  { label: '模型选择', ai: '请选择要使用的模型：', options: ['GPT-4o', 'Claude 3.5', '通义千问', 'DeepSeek'] },
  { label: '生成', ai: '配置完成！正在为你生成 DSL 模板...', generate: true },
];

export function GeneratorPage() {
  const [step, setStep] = useState(-1);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [yamlOutput, setYamlOutput] = useState('');

  const startGenerator = () => {
    setStep(0);
    setMessages([{ role: 'ai', text: STEPS[0].ai }]);
    setYamlOutput('');
  };

  const handleSelect = (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', text }]);
    const next = step + 1;
    if (next < STEPS.length) {
      setTimeout(() => {
        setStep(next);
        setMessages((prev) => [...prev, { role: 'ai', text: STEPS[next].ai }]);
        if (STEPS[next].generate) {
          setYamlOutput(`app:\n  description: '由 DifyFlow 智能体生成器创建'\n  icon: '\\u{1F916}'\n  mode: workflow\n  name: my-agent\nkind: app\nversion: 0.1.0\nworkflow:\n  graph:\n    edges: []\n    nodes:\n      - data:\n          title: Start\n          type: start\n        id: '1'\n        position:\n          x: 80\n          y: 200\n      - data:\n          model:\n            provider: openai\n          title: LLM\n          type: llm\n        id: '2'\n        position:\n          x: 400\n          y: 200\n      - data:\n          title: End\n          type: end\n        id: '3'\n        position:\n          x: 720\n          y: 200\n`);
        }
      }, 500);
    }
  };

  const resetGenerator = () => {
    setStep(-1);
    setMessages([]);
    setInput('');
    setYamlOutput('');
  };

  const copyYaml = () => {
    navigator.clipboard.writeText(yamlOutput);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>智能体生成器</h2>
        <Button icon={<ReloadOutlined />} onClick={resetGenerator}>重新开始</Button>
      </div>

      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
        {/* Left: Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, border: '1px solid #E3E6ED', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E3E6ED', display: 'flex', alignItems: 'center', gap: 8 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i <= step ? '#D97706' : '#E3E6ED', transition: 'all 0.3s' }} />
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {step === -1 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9CA3B8' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
                <p style={{ fontSize: 14, marginBottom: 16 }}>AI 引导式智能体创建向导</p>
                <Button type="primary" size="large" onClick={startGenerator}>开始创建</Button>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px', borderRadius: 12,
                    background: msg.role === 'user' ? '#D97706' : '#F3F4F6',
                    color: msg.role === 'user' ? '#fff' : '#1F2937',
                    fontSize: 13, lineHeight: 1.6,
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))
            )}
          </div>

          {step >= 0 && step < STEPS.length && !STEPS[step].generate && (
            <div style={{ padding: 12, borderTop: '1px solid #E3E6ED' }}>
              {STEPS[step].options && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {STEPS[step].options!.map((opt) => (
                    <Button key={opt} onClick={() => handleSelect(opt)}>{opt}</Button>
                  ))}
                </div>
              )}
              {STEPS[step].free && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入你的描述..." onPressEnter={() => { if (input.trim()) { handleSelect(input); setInput(''); } }} />
                  <Button type="primary" icon={<SendOutlined />} onClick={() => { if (input.trim()) { handleSelect(input); setInput(''); } }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: YAML Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, border: '1px solid #E3E6ED', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E3E6ED', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>DSL 预览</span>
            {yamlOutput && (
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="small" icon={<CopyOutlined />} onClick={copyYaml}>复制</Button>
                <Tag color="green">YAML</Tag>
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {yamlOutput ? (
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#1E1E2E', color: '#CDD6F4', padding: 16, borderRadius: 10, fontSize: 12, lineHeight: 1.5, margin: 0, height: '100%' }}>
                {yamlOutput}
              </pre>
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: '#9CA3B8' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
                <p>完成左侧对话后，生成的 DSL 将在此预览</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
