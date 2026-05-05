import { useState, useEffect } from 'react';
import { Input, Tag, Spin, Modal, Button, message } from 'antd';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { listTemplates, type Template } from '../api/template.api';
import { useStaggerChildren } from '../hooks/usePageAnimation';

function downloadYaml(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/yaml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const MODE_COLORS: Record<string, string> = {
  workflow: '#971E25',
  'advanced-chat': '#2563EB',
  chat: '#059669',
  completion: '#8B5CF6',
  'agent-chat': '#EC4899',
};

const MODE_LABELS: Record<string, string> = {
  workflow: 'Workflow',
  'advanced-chat': 'Chatflow',
  chat: 'Chat',
  completion: 'Completion',
  'agent-chat': 'Agent',
  unknown: '未知',
};

const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: '内容生成与创作', label: '内容创作' },
  { key: '文档处理与OCR', label: '文档处理' },
  { key: '参考示例', label: '参考示例' },
];

export function TemplatesPage() {
  const staggerRef = useStaggerChildren('.ant-card');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [previewTpl, setPreviewTpl] = useState<Template | null>(null);

  useEffect(() => {
    setLoading(true);
    listTemplates(activeCat === 'all' ? undefined : activeCat)
      .then(setTemplates)
      .catch(() => message.error('加载模板失败'))
      .finally(() => setLoading(false));
  }, [activeCat]);

  const filtered = search
    ? templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()))
    : templates;

  return (
    <div ref={staggerRef}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title">模板广场</h2>
        <Input.Search
          placeholder="搜索模板..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #E3E6ED' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCat(cat.key)}
            style={{
              padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: activeCat === cat.key ? 600 : 400,
              color: activeCat === cat.key ? '#971E25' : '#5F6B80',
              borderBottom: activeCat === cat.key ? '2px solid #971E25' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.2s',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spin style={{ display: 'block', margin: '80px auto' }} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3B8' }}>暂无模板</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => setPreviewTpl(tpl)}
              style={{
                padding: 18, background: '#fff', borderRadius: 14,
                border: '1px solid #E3E6ED', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 28 }}>{tpl.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.name}</div>
                  <Tag color={MODE_COLORS[tpl.mode] || '#9CA3B8'} style={{ fontSize: 11, marginTop: 2 }}>
                    {MODE_LABELS[tpl.mode] || tpl.mode}
                  </Tag>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#5F6B80', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 36 }}>
                {tpl.description || '暂无描述'}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#9CA3B8' }}>{tpl.category}</div>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={previewTpl ? `${previewTpl.icon} ${previewTpl.name}` : ''}
        open={!!previewTpl}
        onCancel={() => setPreviewTpl(null)}
        footer={null}
        width={680}
      >
        {previewTpl && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Tag color={MODE_COLORS[previewTpl.mode] || '#9CA3B8'}>{MODE_LABELS[previewTpl.mode] || previewTpl.mode}</Tag>
              <Tag>{previewTpl.category}</Tag>
            </div>
            {previewTpl.description && (
              <p style={{ fontSize: 13, color: '#5F6B80', margin: '0 0 12px' }}>{previewTpl.description}</p>
            )}
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: '#1E1E2E', color: '#CDD6F4', padding: 16, borderRadius: 10,
              maxHeight: 400, overflow: 'auto', fontSize: 12, lineHeight: 1.5, margin: 0,
            }}>
              {previewTpl.yamlContent}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(previewTpl.yamlContent); message.success('已复制到剪贴板'); }}>复制 DSL</Button>
              <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={() => downloadYaml(previewTpl.yamlContent, `${previewTpl.name}.yml`)}>下载 DSL 文件</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
