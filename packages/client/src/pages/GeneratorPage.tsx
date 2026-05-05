import { useState, useRef, useEffect } from 'react';
import { Input, Button, message } from 'antd';
import { SendOutlined, CopyOutlined, DownloadOutlined, ReloadOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { usePageEnter } from '../hooks/usePageAnimation';
import { useGeneratorStore } from '../stores/generatorStore';
import { sendChat } from '../api/generator.api';

export function GeneratorPage() {
  const pageRef = usePageEnter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  const sessionId = useGeneratorStore((s) => s.sessionId);
  const messages = useGeneratorStore((s) => s.messages);
  const dsl = useGeneratorStore((s) => s.dsl);
  const loading = useGeneratorStore((s) => s.loading);
  const options = useGeneratorStore((s) => s.options);
  const chatState = useGeneratorStore((s) => s.chatState);
  const store = useGeneratorStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (msg?: string) => {
    const text = msg || input.trim();
    if (!text || loading) return;
    setInput('');
    store.addMessage({ role: 'user', text });
    store.setLoading(true);

    try {
      const res = await sendChat(text, sessionId, '');
      store.setSessionId(res.session_id);
      store.setChatState(res.state);
      store.setOptions(res.options || []);
      store.addMessage({ role: 'ai', text: res.reply, options: res.options });
      if (res.dsl) store.setDsl(res.dsl);
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err.message || '请求失败';
      store.addMessage({ role: 'ai', text: `错误：${errMsg}` });
    } finally {
      store.setLoading(false);
    }
  };

  const handleOption = async (action: string) => {
    if (loading) return;
    store.addMessage({ role: 'user', text: action === 'confirm' ? '确认该规划' : '修改规划' });
    store.setLoading(true);

    try {
      const res = await sendChat(action === 'modify' ? '' : '', sessionId, action);
      store.setSessionId(res.session_id);
      store.setChatState(res.state);
      store.setOptions(res.options || []);
      store.addMessage({ role: 'ai', text: res.reply, options: res.options });
      if (res.dsl) store.setDsl(res.dsl);
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err.message || '请求失败';
      store.addMessage({ role: 'ai', text: `错误：${errMsg}` });
    } finally {
      store.setLoading(false);
    }
  };

  const handleReset = () => {
    store.reset();
    setInput('');
  };

  const copyDsl = () => {
    if (!dsl) return;
    navigator.clipboard.writeText(dsl).then(() => message.success('已复制'));
  };

  const downloadDsl = () => {
    if (!dsl) return;
    const blob = new Blob([dsl], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.dify.yml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const placeholder =
    chatState === 'need_urls'
      ? '请提供 URL，格式：节点描述: https://...'
      : '描述您想要的工作流...';

  return (
    <div ref={pageRef}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title">智能体生成器</h2>
        <Button icon={<ReloadOutlined />} onClick={handleReset}>重新开始</Button>
      </div>

      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
        {/* Left: Chat Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, border: '1px solid #E3E6ED', overflow: 'hidden' }}>
          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(197,153,62,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <RobotOutlined style={{ color: '#C5993E' }} />
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 12, borderTopLeftRadius: 4, background: '#F3F4F6', fontSize: 13, lineHeight: 1.7, maxWidth: '85%' }}>
                  您好！我是智能体生成器。请用自然语言描述您想要的工作流，例如：{'\n\n'}• 请为我生成一个抓取网页内容并提取关键情报的工作流{'\n'}• 请为我生成一个客服分流工作流（退款/技术/一般）{'\n\n'}我将为您生成可直接导入 Dify 的 DSL 文件。
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'ai' && (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(197,153,62,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <RobotOutlined style={{ color: '#C5993E', fontSize: 14 }} />
                  </div>
                )}
                <div>
                  <div style={{
                    maxWidth: 420, padding: '10px 14px', borderRadius: 12,
                    background: msg.role === 'user' ? 'linear-gradient(135deg, #971E25, #6B1417)' : '#F3F4F6',
                    color: msg.role === 'user' ? '#fff' : '#1F2937',
                    fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    ...(msg.role === 'user' ? { borderTopRightRadius: 4 } : { borderTopLeftRadius: 4 }),
                  }} dangerouslySetInnerHTML={{
                    __html: msg.text
                      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                  }} />
                  {/* Option buttons for AI messages */}
                  {msg.role === 'ai' && msg.options && msg.options.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {msg.options.includes('confirm') && (
                        <Button size="small" type="primary" onClick={() => handleOption('confirm')}>确认</Button>
                      )}
                      {msg.options.includes('modify') && (
                        <Button size="small" onClick={() => handleOption('modify')}>修改</Button>
                      )}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#971E25', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserOutlined style={{ color: '#fff', fontSize: 14 }} />
                  </div>
                )}
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(197,153,62,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <RobotOutlined style={{ color: '#C5993E', fontSize: 14 }} />
                </div>
                <div style={{ padding: '12px 16px', borderRadius: 12, borderTopLeftRadius: 4, background: '#F3F4F6' }}>
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', animation: 'genBounce 1.4s infinite both' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', animation: 'genBounce 1.4s 0.2s infinite both' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', animation: 'genBounce 1.4s 0.4s infinite both' }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #E3E6ED', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              autoSize={{ minRows: 1, maxRows: 4 }}
              onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={loading}
              style={{ borderRadius: 10, fontSize: 13 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSend()}
              loading={loading}
              style={{ borderRadius: 10, minWidth: 44, height: 40 }}
            />
          </div>
        </div>

        {/* Right: DSL Panel */}
        <div style={{ width: 460, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, border: '1px solid #E3E6ED', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E3E6ED', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#5F6B80' }}>生成的 DSL</span>
            {dsl && (
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="small" icon={<CopyOutlined />} onClick={copyDsl}>复制</Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={downloadDsl}>下载 .yml</Button>
              </div>
            )}
          </div>
          {dsl ? (
            <pre style={{
              flex: 1, overflow: 'auto', margin: 0, padding: 16,
              background: '#1E1E2E', color: '#CDD6F4',
              fontFamily: "'Fira Code', Consolas, Monaco, monospace",
              fontSize: 12, lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {dsl}
            </pre>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E1E2E', color: '#6C7086', fontSize: 13 }}>
              DSL 将在此处显示
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes genBounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
