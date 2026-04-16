import { useState, useEffect, useCallback } from 'react';
import { Upload, Button, Card, Tag, Modal, Input, message, Tabs, Spin, Empty, Dropdown, Select } from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, DownloadOutlined,
  FolderOutlined, MoreOutlined, EyeOutlined, SearchOutlined,
} from '@ant-design/icons';
import { listAssets, uploadAssets, deleteAsset, downloadAsset, getAsset, moveAsset } from '../api/asset.api';
import { listFolders, createFolder, renameFolder, deleteFolder } from '../api/folder.api';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Asset, Folder } from '../types';

const { Dragger } = Upload;

const fileTypeIcons: Record<string, string> = {
  pdf: '📄',
  docx: '📝',
  xlsx: '📊',
  txt: '📃',
  md: '📑',
  csv: '📋',
};

const fileTypeLabels: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  xlsx: 'Excel',
  txt: 'TXT',
  md: 'Markdown',
  csv: 'CSV',
};

const statusConfig: Record<string, { color: string; label: string }> = {
  uploading: { color: 'default', label: '上传中' },
  parsing: { color: 'processing', label: '解析中' },
  ready: { color: 'success', label: '已解析' },
  failed: { color: 'error', label: '解析失败' },
};

export function AssetsPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [fileTypeFilter, setFileTypeFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Delete confirmation state (state-driven instead of Modal.confirm static API)
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Folder modals
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameFolderOpen, setRenameFolderOpen] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingValue, setRenamingValue] = useState('');

  // Move to folder state
  const [moveTarget, setMoveTarget] = useState<Asset | null>(null);
  const [moveFolderId, setMoveFolderId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const fetchFolders = useCallback(async () => {
    const data = await listFolders();
    setFolders(data);
  }, []);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAssets({
        folderId: selectedFolder || undefined,
        status: statusFilter,
        fileType: fileTypeFilter,
        search: searchText || undefined,
        page,
        pageSize: 20,
      });
      setAssets(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, statusFilter, fileTypeFilter, searchText, page]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // WebSocket for real-time status updates
  useWebSocket((data) => {
    if (data.type === 'asset:status') {
      setAssets((prev) =>
        prev.map((a) =>
          a.id === data.payload.id ? { ...a, status: data.payload.status } : a
        )
      );
    }
  });

  const handleUpload = async (files: File[]) => {
    try {
      await uploadAssets(files, selectedFolder || undefined);
      message.success(`${files.length} 个文件上传成功`);
      fetchAssets();
      fetchFolders();
    } catch (err: any) {
      message.error(err.response?.data?.error || '上传失败');
    }
  };

  const confirmDeleteAsset = (asset: Asset) => {
    setDeleteTarget(asset);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAsset(deleteTarget.id);
      message.success('删除成功');
      setDeleteTarget(null);
      fetchAssets();
      fetchFolders();
    } catch (err: any) {
      message.error(err.response?.data?.error || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (asset: Asset) => {
    try {
      await downloadAsset(asset.id, asset.originalName);
      message.success('下载成功');
    } catch (err: any) {
      message.error(err.response?.data?.error || '下载失败');
    }
  };

  const handlePreview = async (asset: Asset) => {
    if (asset.status !== 'ready') {
      message.warning('文件尚未解析完成，无法预览');
      return;
    }
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewAsset(null);
    try {
      const full = await getAsset(asset.id);
      setPreviewAsset(full);
    } catch {
      message.error('获取文件内容失败');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim());
      message.success('文件夹创建成功');
      setCreateFolderOpen(false);
      setNewFolderName('');
      fetchFolders();
    } catch (err: any) {
      message.error(err.response?.data?.error || '创建失败');
    }
  };

  const handleRenameFolder = async () => {
    if (!renameFolderOpen || !renamingValue.trim()) return;
    try {
      await renameFolder(renameFolderOpen.id, renamingValue.trim());
      message.success('重命名成功');
      setRenameFolderOpen(null);
      fetchFolders();
    } catch (err: any) {
      message.error(err.response?.data?.error || '重命名失败');
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    Modal.confirm({
      title: '删除文件夹',
      content: `文件夹"${folder.name}"内的文件将移回"全部文件"，不会被删除。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteFolder(folder.id);
          message.success('文件夹已删除');
          if (selectedFolder === folder.id) setSelectedFolder(null);
          fetchFolders();
          fetchAssets();
        } catch (err: any) {
          message.error(err.response?.data?.error || '删除失败');
        }
      },
    });
  };

  const handleMoveToFolder = async () => {
    if (!moveTarget) return;
    setMoving(true);
    try {
      await moveAsset(moveTarget.id, moveFolderId);
      message.success('移动成功');
      setMoveTarget(null);
      setMoveFolderId(null);
      fetchAssets();
      fetchFolders();
    } catch (err: any) {
      message.error(err.response?.data?.error || '移动失败');
    } finally {
      setMoving(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 104px)' }}>
      {/* Folder Tree */}
      <Card
        style={{ width: 240, flexShrink: 0, borderRadius: 14, overflowY: 'auto' }}
        styles={{ body: { padding: 16 } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#5F6B80' }}>
            文件夹
          </span>
          <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => setCreateFolderOpen(true)} />
        </div>
        <div
          onClick={() => setSelectedFolder(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            borderRadius: 6, cursor: 'pointer', fontSize: 13,
            background: !selectedFolder ? 'rgba(217,119,6,0.07)' : 'transparent',
            color: !selectedFolder ? '#D97706' : '#5F6B80',
          }}
        >
          📁 全部文件
        </div>
        {folders.filter((f) => !f.isDefault).map((folder) => (
          <Dropdown
            key={folder.id}
            menu={{
              items: [
                { key: 'rename', icon: <EditOutlined />, label: '重命名' },
                { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
              ],
              onClick: ({ key }) => {
                if (key === 'rename') { setRenameFolderOpen(folder); setRenamingValue(folder.name); }
                if (key === 'delete') handleDeleteFolder(folder);
              },
            }}
            trigger={['contextMenu']}
          >
            <div
              onClick={() => setSelectedFolder(folder.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                borderRadius: 6, cursor: 'pointer', fontSize: 13,
                background: selectedFolder === folder.id ? 'rgba(217,119,6,0.07)' : 'transparent',
                color: selectedFolder === folder.id ? '#D97706' : '#5F6B80',
              }}
            >
              📂 {folder.name}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3B8' }}>{folder.assetCount}</span>
            </div>
          </Dropdown>
        ))}
      </Card>

      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Tabs
            activeKey={statusFilter || 'all'}
            onChange={(key) => { setStatusFilter(key === 'all' ? undefined : key); setPage(1); }}
            items={[
              { key: 'all', label: '全部' },
              { key: 'ready', label: '已解析' },
              { key: 'parsing', label: '解析中' },
              { key: 'failed', label: '解析失败' },
            ]}
            style={{ marginBottom: 0 }}
          />
          <Select
            allowClear
            placeholder="文件类型"
            style={{ width: 130 }}
            value={fileTypeFilter}
            onChange={(val) => { setFileTypeFilter(val); setPage(1); }}
            options={Object.entries(fileTypeLabels).map(([value, label]) => ({ value, label }))}
          />
          <Input
            placeholder="搜索文件名..."
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 200 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={() => { setPage(1); fetchAssets(); }}
            onBlur={() => { setPage(1); fetchAssets(); }}
          />
        </div>

        {/* Upload Zone */}
        <Dragger
          multiple
          showUploadList={false}
          beforeUpload={(_file, fileList) => {
            handleUpload(fileList);
            return false;
          }}
          style={{ borderRadius: 14, padding: '20px 0' }}
        >
          <p style={{ fontSize: 36, marginBottom: 12 }}>☁️</p>
          <p style={{ fontSize: 14, color: '#5F6B80' }}>
            拖拽文件到此处，或 <strong style={{ color: '#D97706' }}>点击上传</strong>
          </p>
          <p style={{ fontSize: 12, color: '#9CA3B8' }}>支持 PDF、Word、Excel、TXT、Markdown、CSV</p>
        </Dragger>

        {/* File Grid */}
        {loading ? (
          <Spin style={{ margin: '40px auto' }} />
        ) : assets.length === 0 ? (
          <Empty description="暂无文件" style={{ marginTop: 40 }} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {assets.map((asset) => {
              const st = statusConfig[asset.status] || statusConfig.uploading;
              return (
                <Card
                  key={asset.id}
                  hoverable
                  style={{ borderRadius: 14 }}
                  styles={{ body: { padding: '14px 16px' } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span
                      style={{ fontSize: 28, cursor: asset.status === 'ready' ? 'pointer' : 'default' }}
                      onClick={() => { if (asset.status === 'ready') handlePreview(asset); }}
                    >
                      {fileTypeIcons[asset.fileType] || '📄'}
                    </span>
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: asset.status === 'ready' ? 'pointer' : 'default' }}
                      onClick={() => { if (asset.status === 'ready') handlePreview(asset); }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {asset.originalName}
                      </div>
                      <div style={{ fontSize: 11, color: '#5F6B80', display: 'flex', gap: 12 }}>
                        <span>{formatSize(asset.fileSize)}</span>
                        <span>{formatTime(asset.createdAt)}</span>
                      </div>
                    </div>
                    <Tag color={st.color}>{st.label}</Tag>
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          { key: 'preview', icon: <EyeOutlined />, label: '预览', disabled: asset.status !== 'ready' },
                          { key: 'download', icon: <DownloadOutlined />, label: '下载' },
                          { key: 'move', icon: <FolderOutlined />, label: '移入文件夹' },
                          { type: 'divider' as const },
                          { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
                        ],
                        onClick: ({ key }) => {
                          if (key === 'preview') handlePreview(asset);
                          else if (key === 'download') handleDownload(asset);
                          else if (key === 'move') { setMoveTarget(asset); setMoveFolderId(asset.folderId || null); }
                          else if (key === 'delete') confirmDeleteAsset(asset);
                        },
                      }}
                    >
                      <Button type="text" size="small" icon={<MoreOutlined />} />
                    </Dropdown>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Delete Confirmation Modal (state-driven) ===== */}
      <Modal
        title="确认删除"
        open={!!deleteTarget}
        okText="删除"
        cancelText="取消"
        okType="danger"
        confirmLoading={deleting}
        onOk={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        <p>确定要删除文件 <strong>{deleteTarget?.originalName}</strong> 吗？</p>
        <p style={{ color: '#999', fontSize: 12 }}>此操作不可恢复。</p>
      </Modal>

      {/* Preview Modal */}
      <Modal
        title={
          previewAsset
            ? <span>{fileTypeIcons[previewAsset.fileType] || '📄'} {previewAsset.originalName}</span>
            : '文件预览'
        }
        open={previewOpen}
        onCancel={() => { setPreviewOpen(false); setPreviewAsset(null); }}
        width={720}
        footer={[
          <Button key="close" onClick={() => { setPreviewOpen(false); setPreviewAsset(null); }}>关闭</Button>,
          previewAsset ? (
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(previewAsset)}
            >
              下载原文件
            </Button>
          ) : null,
        ]}
        styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
      >
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin tip="加载中..." /></div>
        ) : previewAsset && previewAsset.parsedText != null && previewAsset.parsedText !== '' ? (
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 13,
            lineHeight: 1.8,
            background: '#f8f9fa',
            padding: 16,
            borderRadius: 8,
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
          }}>
            {previewAsset.parsedText}
          </pre>
        ) : (
          <Empty description="暂无解析内容" />
        )}
      </Modal>

      {/* Create Folder Modal */}
      <Modal
        title="新建文件夹"
        open={createFolderOpen}
        onOk={handleCreateFolder}
        onCancel={() => { setCreateFolderOpen(false); setNewFolderName(''); }}
        okText="创建"
      >
        <Input
          placeholder="输入文件夹名称..."
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={handleCreateFolder}
          autoFocus
        />
      </Modal>

      {/* Rename Folder Modal */}
      <Modal
        title="重命名文件夹"
        open={!!renameFolderOpen}
        onOk={handleRenameFolder}
        onCancel={() => setRenameFolderOpen(null)}
        okText="保存"
      >
        <Input
          value={renamingValue}
          onChange={(e) => setRenamingValue(e.target.value)}
          onPressEnter={handleRenameFolder}
          autoFocus
        />
      </Modal>

      {/* Move to Folder Modal */}
      <Modal
        title={`移入文件夹 — ${moveTarget?.originalName || ''}`}
        open={!!moveTarget}
        onOk={handleMoveToFolder}
        onCancel={() => { setMoveTarget(null); setMoveFolderId(null); }}
        okText="移动"
        confirmLoading={moving}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <div
            onClick={() => setMoveFolderId(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
              border: !moveFolderId ? '1.5px solid #D97706' : '1px solid #E3E6ED',
              background: !moveFolderId ? 'rgba(217,119,6,0.05)' : 'transparent',
            }}
          >
            <span>📁</span>
            <span style={{ fontSize: 13, fontWeight: !moveFolderId ? 600 : 400, color: !moveFolderId ? '#D97706' : '#5F6B80' }}>
              全部文件（不归类）
            </span>
          </div>
          {folders.filter((f) => !f.isDefault).map((folder) => (
            <div
              key={folder.id}
              onClick={() => setMoveFolderId(folder.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: moveFolderId === folder.id ? '1.5px solid #D97706' : '1px solid #E3E6ED',
                background: moveFolderId === folder.id ? 'rgba(217,119,6,0.05)' : 'transparent',
              }}
            >
              <span>📂</span>
              <span style={{ fontSize: 13, fontWeight: moveFolderId === folder.id ? 600 : 400, color: moveFolderId === folder.id ? '#D97706' : '#5F6B80' }}>
                {folder.name}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3B8' }}>{folder.assetCount} 个文件</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
