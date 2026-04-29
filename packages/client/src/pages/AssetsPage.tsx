import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Upload, Button, Card, Tag, Modal, Input, Tabs, Spin, Empty, Dropdown, Select, App, Checkbox } from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, DownloadOutlined,
  FolderOutlined, MoreOutlined, EyeOutlined, SearchOutlined,
  DeleteRowOutlined, UndoOutlined,
} from '@ant-design/icons';
import { listAssets, uploadAssets, deleteAsset, downloadAsset, getAsset, moveAsset, moveAssetWithOverride, copyAsset, copyAssetWithOverride, getAssetFolders, addToFolder, removeFromFolder, moveToTrash, restoreAssets, permanentlyDeleteAssets, listTrashAssets, checkBatchDuplicateFiles } from '../api/asset.api';
import { listFolders, createFolder, renameFolder, deleteFolder, emptyTrash } from '../api/folder.api';
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
  const { modal, message } = App.useApp();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [fileTypeFilter, setFileTypeFilter] = useState<string[]>([]);
  const [fileTypeDropdownOpen, setFileTypeDropdownOpen] = useState(false);
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

  // Copy to folder state
  const [copyTarget, setCopyTarget] = useState<Asset | null>(null);
  const [copyFolderId, setCopyFolderId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [duplicateFile, setDuplicateFile] = useState<any>(null);
  const [overrideType, setOverrideType] = useState<'copy' | 'move' | null>(null);
  const [moveOverrideAssetId, setMoveOverrideAssetId] = useState<string | null>(null);
  const [moveOverrideFolderId, setMoveOverrideFolderId] = useState<string | null>(null);

  // Asset folders state
  const [assetFolders, setAssetFolders] = useState<any[]>([]);
  const [showFoldersModal, setShowFoldersModal] = useState(false);
  const [currentAssetForFolders, setCurrentAssetForFolders] = useState<Asset | null>(null);

  // Trash state
  const [emptyingTrash, setEmptyingTrash] = useState(false);

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectAllChecked, setSelectAllChecked] = useState(false);

  // Batch operation state
  const [batchCopyOpen, setBatchCopyOpen] = useState(false);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const [batchCopyFolderId, setBatchCopyFolderId] = useState<string | null>(null);
  const [batchMoveFolderId, setBatchMoveFolderId] = useState<string | null>(null);

  // Batch duplicate files warning state
  const [batchDuplicateFiles, setBatchDuplicateFiles] = useState<any[]>([]);
  const [batchOverrideType, setBatchOverrideType] = useState<'copy' | 'move' | null>(null);
  const [batchOverrideFolderId, setBatchOverrideFolderId] = useState<string | null>(null);

  // Folder switch warning state
  const [pendingFolder, setPendingFolder] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    const data = await listFolders();
    setFolders(data);
  }, []);

  // 检查当前是否在回收站
  const isInTrash = useMemo(() => {
    const trashFolder = folders.find(f => f.isTrash);
    return selectedFolder && trashFolder && selectedFolder === trashFolder.id;
  }, [selectedFolder, folders]);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      // 检查是否选中的是回收站文件夹
      const trashFolder = folders.find(f => f.isTrash);
      if (selectedFolder && trashFolder && selectedFolder === trashFolder.id) {
        // 获取回收站中的文件，应用文件类型筛选
        const result = await listTrashAssets({
          status: statusFilter,
          fileType: fileTypeFilter.length > 0 ? fileTypeFilter : undefined,
          search: searchText || undefined,
        });
        setAssets(result.items || result);
        setTotal(result.total || result.length);
      } else {
        // 普通文件夹或全部文件
        const result = await listAssets({
          folderId: selectedFolder || undefined,
          status: statusFilter,
          fileType: fileTypeFilter.length > 0 ? fileTypeFilter : undefined,
          search: searchText || undefined,
          page,
          pageSize: 20,
        });
        setAssets(result.items);
        setTotal(result.total);

        // 更新全选状态
        if (selectAllChecked && assets.length !== result.items.length) {
          setSelectAllChecked(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, statusFilter, fileTypeFilter, searchText, page, folders]);

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

  const handleUpload = useCallback(async (files: File[]) => {
    try {
      await uploadAssets(files, selectedFolder || undefined);
      message.success(`${files.length} 个文件上传成功`);
      fetchAssets();
      fetchFolders();
    } catch (err: any) {
      message.error(err.response?.data?.error || '上传失败');
    }
  }, [selectedFolder, fetchAssets, fetchFolders]);

  // 修复重复上传问题：使用防抖确保只上传一次
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUploadingRef = useRef(false);

  const handleUploadWithDebounce = useCallback((files: File[]) => {
    // 如果正在上传，跳过
    if (isUploadingRef.current) return;

    // 清除之前的定时器
    if (uploadTimeoutRef.current) {
      clearTimeout(uploadTimeoutRef.current);
    }

    // 设置新的定时器，100ms后执行上传
    uploadTimeoutRef.current = setTimeout(async () => {
      isUploadingRef.current = true;
      try {
        await handleUpload(files);
      } finally {
        isUploadingRef.current = false;
        uploadTimeoutRef.current = null;
      }
    }, 100);
  }, [handleUpload]);

  const confirmDeleteAsset = (asset: Asset) => {
    setDeleteTarget(asset);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await moveToTrash([deleteTarget.id]);
      message.success('文件已移至回收站');
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

    const folderName = newFolderName.trim();

    // 检查是否尝试创建名为"回收站"的文件夹
    if (folderName === '回收站') {
      modal.warning({
        title: '创建失败',
        content: '无法创建名为"回收站"的文件夹',
        okText: '关闭',
      });
      return;
    }

    // 检查是否有重复文件夹名称
    const duplicateFolder = folders.find(f =>
      f.name.trim() === folderName && !f.isTrash
    );

    if (duplicateFolder) {
      // 显示警告对话框
      modal.warning({
        title: '创建失败',
        content: `文件夹'${folderName}'已存在`,
        okText: '关闭',
      });
      return; // 退出创建流程
    }

    try {
      await createFolder(folderName);
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

    const newName = renamingValue.trim();

    // 检查是否尝试重命名为"回收站"
    if (newName === '回收站') {
      modal.warning({
        title: '重命名失败',
        content: '无法重命名为"回收站"',
        okText: '关闭',
      });
      return;
    }

    try {
      await renameFolder(renameFolderOpen.id, newName);
      message.success('重命名成功');
      setRenameFolderOpen(null);
      fetchFolders();
    } catch (err: any) {
      message.error(err.response?.data?.error || '重命名失败');
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    console.log('[FRONTEND] handleDeleteFolder called for folder:', folder.name, folder.id);

    try {
      modal.confirm({
        title: '删除文件夹',
        content: `确定要删除文件夹"${folder.name}"吗？文件夹内的所有文件将被移至回收站。`,
        okType: 'danger',
        okText: '删除',
        cancelText: '取消',
        onOk: async () => {
          console.log(`[FRONTEND] User confirmed delete for folder: ${folder.id}`);
          try {
            console.log('[FRONTEND] Calling deleteFolder API...');
            await deleteFolder(folder.id);
            console.log(`[FRONTEND] Folder deleted successfully`);
            message.success('文件夹已删除，文件已移至回收站');
            if (selectedFolder === folder.id) setSelectedFolder(null);
            fetchFolders();
            fetchAssets();
          } catch (err: any) {
            console.error('[FRONTEND] Delete folder error:', err);
            console.error('[FRONTEND] Error response:', err.response);
            const errorMessage = err.response?.data?.error || err.message || '删除失败';
            message.error(errorMessage);
          }
        },
        onCancel: () => {
          console.log('[FRONTEND] User cancelled delete');
        },
      });
      console.log('[FRONTEND] Modal.confirm called successfully');
    } catch (error) {
      console.error('[FRONTEND] Error calling modal.confirm:', error);
    }
  };

  // Trash-related handlers
  const handleEmptyTrash = async () => {
    try {
      modal.confirm({
        title: '清空回收站',
        content: '确定要清空回收站吗？此操作将永久删除所有文件，无法恢复。',
        okType: 'danger',
        okText: '清空',
        cancelText: '取消',
        onOk: async () => {
          setEmptyingTrash(true);
          try {
            await emptyTrash();
            message.success('回收站已清空');
            fetchFolders();
            fetchAssets();
          } catch (err: any) {
            message.error(err.response?.data?.error || '清空失败');
          } finally {
            setEmptyingTrash(false);
          }
        },
      });
    } catch (error) {
      console.error('[FRONTEND] Error calling modal.confirm:', error);
    }
  };

  const handleRestoreAsset = async (asset: Asset) => {
    try {
      await restoreAssets([asset.id]);
      message.success('文件已恢复');
      fetchAssets();
      fetchFolders();
    } catch (err: any) {
      message.error(err.response?.data?.error || '恢复失败');
    }
  };

  const handlePermanentlyDeleteAsset = async (asset: Asset) => {
    try {
      modal.confirm({
        title: '永久删除',
        content: `确定要永久删除文件"${asset.originalName}"吗？此操作不可恢复。`,
        okType: 'danger',
        okText: '永久删除',
        cancelText: '取消',
        onOk: async () => {
          try {
            await permanentlyDeleteAssets([asset.id]);
            message.success('文件已永久删除');
            fetchAssets();
            fetchFolders();
          } catch (err: any) {
            message.error(err.response?.data?.error || '删除失败');
          }
        },
      });
    } catch (error) {
      console.error('[FRONTEND] Error calling modal.confirm:', error);
    }
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
      // 检查是否是重复文件错误
      if (err.response?.status === 409 && err.response?.data?.code === 'DUPLICATE_FILE') {
        setDuplicateFile(err.response.data);
        setOverrideType('move');
        setMoveOverrideAssetId(moveTarget.id);
        setMoveOverrideFolderId(moveFolderId);
        setMoveTarget(null); // 关闭移动对话框
        setMoveFolderId(null);
      } else {
        message.error(err.response?.data?.error || '移动失败');
      }
    } finally {
      setMoving(false);
    }
  };

  const handleMoveOverride = async () => {
    if (!moveOverrideAssetId || !moveOverrideFolderId) return;
    setMoving(true);
    try {
      await moveAssetWithOverride(moveOverrideAssetId, moveOverrideFolderId);
      message.success('覆盖成功');
      setDuplicateFile(null);
      setOverrideType(null);
      setMoveOverrideAssetId(null);
      setMoveOverrideFolderId(null);
      fetchAssets();
      fetchFolders();
    } catch (err: any) {
      message.error(err.response?.data?.error || '覆盖失败');
    } finally {
      setMoving(false);
    }
  };

  const handleCopyToFolder = async () => {
    if (!copyTarget) return;
    setCopying(true);
    try {
      await copyAsset(copyTarget.id, copyFolderId);
      message.success('复制成功');
      setCopyTarget(null);
      setCopyFolderId(null);
      fetchAssets();
      fetchFolders();
    } catch (err: any) {
      // 检查是否是重复文件错误
      if (err.response?.status === 409 && err.response?.data?.code === 'DUPLICATE_FILE') {
        setDuplicateFile(err.response.data);
        setOverrideType('copy');
      } else {
        message.error(err.response?.data?.error || '复制失败');
      }
    } finally {
      setCopying(false);
    }
  };

  const handleConfirmOverride = async () => {
    setCopying(true);
    try {
      if (overrideType === 'copy' && copyTarget && copyFolderId) {
        await copyAssetWithOverride(copyTarget.id, copyFolderId);
        setCopyTarget(null);
        setCopyFolderId(null);
      } else if (overrideType === 'move' && moveOverrideAssetId && moveOverrideFolderId) {
        await moveAssetWithOverride(moveOverrideAssetId, moveOverrideFolderId);
        setMoveOverrideAssetId(null);
        setMoveOverrideFolderId(null);
      }
      message.success('覆盖成功');
      setDuplicateFile(null);
      setOverrideType(null);
      fetchAssets();
      fetchFolders();
    } catch (err: any) {
      message.error(err.response?.data?.error || '覆盖失败');
    } finally {
      setCopying(false);
    }
  };

  // 批量复制处理函数
  const handleBatchCopy = async () => {
    if (!batchCopyFolderId || selectedAssets.length === 0) return;

    setCopying(true);
    try {
      // 先检查重复文件
      const duplicateCheck = await checkBatchDuplicateFiles(selectedAssets, batchCopyFolderId);

      if (duplicateCheck.duplicateFiles && duplicateCheck.duplicateFiles.length > 0) {
        // 有重复文件，显示警告
        setBatchDuplicateFiles(duplicateCheck.duplicateFiles);
        setBatchOverrideType('copy');
        setBatchOverrideFolderId(batchCopyFolderId);
        return; // 等待用户确认
      }

      // 没有重复文件，直接执行批量复制
      const copyPromises = selectedAssets.map(assetId =>
        copyAsset(assetId, batchCopyFolderId)
      );
      await Promise.all(copyPromises);

      message.success(`成功复制 ${selectedAssets.length} 个文件`);
      setBatchCopyOpen(false);
      setBatchCopyFolderId(null);
      setIsMultiSelectMode(false);
      setSelectedAssets([]);
      setSelectAllChecked(false);
      fetchAssets();
      fetchFolders();
    } catch (err: any) {
      message.error(`批量复制失败: ${err.response?.data?.error || '未知错误'}`);
    } finally {
      setCopying(false);
    }
  };

  // 批量移动处理函数
  const handleBatchMove = async () => {
    if (!batchMoveFolderId || selectedAssets.length === 0) return;

    setMoving(true);
    try {
      // 先检查重复文件
      const duplicateCheck = await checkBatchDuplicateFiles(selectedAssets, batchMoveFolderId);

      if (duplicateCheck.duplicateFiles && duplicateCheck.duplicateFiles.length > 0) {
        // 有重复文件，显示警告
        setBatchDuplicateFiles(duplicateCheck.duplicateFiles);
        setBatchOverrideType('move');
        setBatchOverrideFolderId(batchMoveFolderId);
        return; // 等待用户确认
      }

      // 没有重复文件，直接执行批量移动
      const movePromises = selectedAssets.map(assetId =>
        moveAsset(assetId, batchMoveFolderId)
      );
      await Promise.all(movePromises);

      message.success(`成功移动 ${selectedAssets.length} 个文件`);
      setBatchMoveOpen(false);
      setBatchMoveFolderId(null);
      setIsMultiSelectMode(false);
      setSelectedAssets([]);
      setSelectAllChecked(false);
      fetchAssets();
      fetchFolders();
    } catch (err: any) {
      message.error(`批量移动失败: ${err.response?.data?.error || '未知错误'}`);
    } finally {
      setMoving(false);
    }
  };

  const handleCancelOverride = () => {
    setDuplicateFile(null);
    setOverrideType(null);
    setMoveOverrideAssetId(null);
    setMoveOverrideFolderId(null);
  };

  // 处理批量覆盖确认
  const handleBatchOverride = async () => {
    if (!batchOverrideFolderId || selectedAssets.length === 0) return;

    const loadingSetter = batchOverrideType === 'copy' ? setCopying : setMoving;
    loadingSetter(true);

    try {
      // 执行批量覆盖操作
      const operationFunc = batchOverrideType === 'copy' ? copyAssetWithOverride : moveAssetWithOverride;
      const operationPromises = selectedAssets.map(assetId =>
        operationFunc(assetId, batchOverrideFolderId)
      );
      await Promise.all(operationPromises);

      message.success(`成功${batchOverrideType === 'copy' ? '复制' : '移动'} ${selectedAssets.length} 个文件`);

      // 清理状态
      setBatchDuplicateFiles([]);
      setBatchOverrideType(null);
      setBatchOverrideFolderId(null);
      setBatchCopyOpen(false);
      setBatchMoveOpen(false);
      setBatchCopyFolderId(null);
      setBatchMoveFolderId(null);
      setIsMultiSelectMode(false);
      setSelectedAssets([]);
      setSelectAllChecked(false);
      fetchAssets();
      fetchFolders();
    } catch (err: any) {
      message.error(`批量${batchOverrideType === 'copy' ? '复制' : '移动'}失败: ${err.response?.data?.error || '未知错误'}`);
    } finally {
      loadingSetter(false);
    }
  };

  // 取消批量覆盖
  const handleCancelBatchOverride = () => {
    setBatchDuplicateFiles([]);
    setBatchOverrideType(null);
    setBatchOverrideFolderId(null);
  };

  // 处理文件夹切换
  const handleFolderSwitch = (folderId: string | null) => {
    // 检查是否在多选模式下且有选中文件
    if (isMultiSelectMode && selectedAssets.length > 0) {
      modal.confirm({
        title: '切换文件夹',
        content: '切换文件夹将退出多选模式，之前勾选的文件将不再被勾选。是否继续切换？',
        okText: '继续切换',
        cancelText: '取消',
        onOk: () => {
          // 退出多选模式，切换文件夹
          setIsMultiSelectMode(false);
          setSelectedAssets([]);
          setSelectAllChecked(false);
          setSelectedFolder(folderId);
        },
      });
    } else {
      // 直接切换文件夹
      setSelectedFolder(folderId);
    }
  };

  const handleShowFolders = async (asset: Asset) => {
    try {
      setCurrentAssetForFolders(asset);
      const folders = await getAssetFolders(asset.id);
      setAssetFolders(folders);
      setShowFoldersModal(true);
    } catch (err: any) {
      message.error(err.response?.data?.error || '获取文件夹信息失败');
    }
  };

  // 批量操作函数
  const handleBatchAction = async (action: string) => {
    if (selectedAssets.length === 0) {
      message.warning('请先选择要操作的文件');
      return;
    }

    try {
      switch (action) {
        case 'batch-delete':
          modal.confirm({
            title: '批量删除',
            content: `确定要将这 ${selectedAssets.length} 个文件移至回收站吗？`,
            okType: 'danger',
            okText: '删除',
            cancelText: '取消',
            onOk: async () => {
              try {
                await moveToTrash(selectedAssets);
                message.success(`已将 ${selectedAssets.length} 个文件移至回收站`);
                setIsMultiSelectMode(false);
                setSelectedAssets([]);
                setSelectAllChecked(false);
                fetchAssets();
                fetchFolders();
              } catch (err: any) {
                message.error(`批量删除失败: ${err.response?.data?.error || '未知错误'}`);
              }
            },
          });
          return;
        case 'batch-restore':
          modal.confirm({
            title: '批量恢复',
            content: `确定要恢复这 ${selectedAssets.length} 个文件吗？`,
            okText: '恢复',
            cancelText: '取消',
            onOk: async () => {
              try {
                await restoreAssets(selectedAssets);
                message.success(`已恢复 ${selectedAssets.length} 个文件`);
                setIsMultiSelectMode(false);
                setSelectedAssets([]);
                setSelectAllChecked(false);
                fetchAssets();
                fetchFolders();
              } catch (err: any) {
                message.error(`批量恢复失败: ${err.response?.data?.error || '未知错误'}`);
              }
            },
          });
          return;
        case 'batch-permanent-delete':
          modal.confirm({
            title: '批量彻底删除',
            content: `确定要永久删除这 ${selectedAssets.length} 个文件吗？此操作不可恢复。`,
            okType: 'danger',
            okText: '永久删除',
            cancelText: '取消',
            onOk: async () => {
              try {
                await permanentlyDeleteAssets(selectedAssets);
                message.success(`已永久删除 ${selectedAssets.length} 个文件`);
                setIsMultiSelectMode(false);
                setSelectedAssets([]);
                setSelectAllChecked(false);
                fetchAssets();
                fetchFolders();
              } catch (err: any) {
                message.error(`批量彻底删除失败: ${err.response?.data?.error || '未知错误'}`);
              }
            },
          });
          return;
        case 'batch-copy':
          // 打开批量复制对话框
          setBatchCopyOpen(true);
          return;
        case 'batch-move':
          // 打开批量移动对话框
          setBatchMoveOpen(true);
          return;
        default:
          return;
      }
    } catch (err: any) {
      message.error(`批量操作失败: ${err.response?.data?.error || '未知错误'}`);
    }
  };

  // 处理文件卡片点击事件
  const handleAssetClick = (asset: Asset) => {
    if (!isMultiSelectMode) {
      // 非多选模式下，点击文件进行预览
      if (asset.status === 'ready') {
        handlePreview(asset);
      }
      return;
    }

    // 多选模式下，点击选中/取消选中文件
    if (selectedAssets.includes(asset.id)) {
      setSelectedAssets(selectedAssets.filter(id => id !== asset.id));
    } else {
      setSelectedAssets([...selectedAssets, asset.id]);
    }
  };

  // 处理文件卡片悬停效果
  const handleAssetHover = (e: React.MouseEvent<HTMLDivElement>, assetId: string, isHovering: boolean) => {
    e.currentTarget.style.cursor = isMultiSelectMode ? 'pointer' : (isHovering ? 'pointer' : 'default');
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
          onClick={() => handleFolderSwitch(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            borderRadius: 6, cursor: 'pointer', fontSize: 13,
            background: !selectedFolder ? 'rgba(217,119,6,0.07)' : 'transparent',
            color: !selectedFolder ? '#D97706' : '#5F6B80',
          }}
        >
          📁 全部文件
        </div>
        {folders.filter((f) => !f.isDefault).map((folder) => {
          const isTrashFolder = folder.isTrash;
          return (
            <Dropdown
              key={folder.id}
              menu={{
                items: isTrashFolder ? [
                  {
                    key: 'empty',
                    icon: <DeleteOutlined />,
                    label: '清空回收站',
                    danger: true,
                    onClick: handleEmptyTrash,
                  },
                ] : [
                  {
                    key: 'rename',
                    icon: <EditOutlined />,
                    label: '重命名',
                    onClick: () => {
                      setRenameFolderOpen(folder);
                      setRenamingValue(folder.name);
                    }
                  },
                  {
                    key: 'delete',
                    icon: <DeleteOutlined />,
                    label: '删除',
                    danger: true,
                    onClick: () => {
                      console.log('[FRONTEND] Delete menu item clicked for folder:', folder.name);
                      handleDeleteFolder(folder);
                    }
                  },
                ],
              }}
              trigger={['contextMenu']}
            >
              <div
                onClick={() => handleFolderSwitch(folder.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13,
                  background: selectedFolder === folder.id ? (isTrashFolder ? 'rgba(239,68,68,0.07)' : 'rgba(217,119,6,0.07)') : 'transparent',
                  color: selectedFolder === folder.id ? (isTrashFolder ? '#EF4444' : '#D97706') : '#5F6B80',
                }}
              >
                {isTrashFolder ? '🗑️' : '📂'} {folder.name}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3B8' }}>{folder.assetCount}</span>
              </div>
            </Dropdown>
          );
        })}
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
          <Dropdown
            open={fileTypeDropdownOpen}
            onOpenChange={setFileTypeDropdownOpen}
            dropdownRender={() => (
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12), 0 3px 6px -4px rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e8e8e8',
                minWidth: '200px',
                maxHeight: '400px',
                zIndex: 1000,
                overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', backgroundColor: '#fafafa' }}>
                  <Checkbox
                    checked={fileTypeFilter.length === Object.keys(fileTypeLabels).length}
                    indeterminate={fileTypeFilter.length > 0 && fileTypeFilter.length < Object.keys(fileTypeLabels).length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFileTypeFilter(Object.keys(fileTypeLabels));
                      } else {
                        setFileTypeFilter([]);
                      }
                    }}
                  >
                    <span style={{ fontWeight: 500, fontSize: '14px' }}>全选</span>
                  </Checkbox>
                </div>
                <div style={{ maxHeight: '280px', overflowY: 'auto', backgroundColor: '#ffffff' }}>
                  {Object.entries(fileTypeLabels).map(([value, label]) => (
                    <div
                      key={value}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                        ':hover': {
                          backgroundColor: '#f5f5f5'
                        }
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Checkbox
                        checked={fileTypeFilter.includes(value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFileTypeFilter([...fileTypeFilter, value]);
                          } else {
                            setFileTypeFilter(fileTypeFilter.filter(t => t !== value));
                          }
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>{label}</span>
                      </Checkbox>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', backgroundColor: '#fafafa', textAlign: 'right' }}>
                  <Button size="small" onClick={() => setFileTypeDropdownOpen(false)}>
                    取消
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      setFileTypeDropdownOpen(false);
                      setPage(1);
                    }}
                    style={{ marginLeft: 8 }}
                  >
                    确定
                  </Button>
                </div>
              </div>
            )}
            trigger={['click']}
            placement="bottomLeft"
          >
            <Button
              style={{
                width: 130,
                backgroundColor: '#ffffff',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
              }}
            >
              {fileTypeFilter.length === 0 ? '文件类型' :
               fileTypeFilter.length === Object.keys(fileTypeLabels).length ? '全部' :
               `已选 ${fileTypeFilter.length} 项`}
            </Button>
          </Dropdown>
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

          {/* Multi-select controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              type={isMultiSelectMode ? "primary" : "default"}
              style={{
                minWidth: 80,
                background: isMultiSelectMode ? '#D97706' : 'transparent',
                borderColor: '#D97706',
                color: isMultiSelectMode ? '#fff' : '#D97706'
              }}
              onClick={() => {
                if (isMultiSelectMode) {
                  if (selectedAssets.length > 0) {
                    modal.confirm({
                      title: '退出多选',
                      content: '确定要退出多选模式吗？已选择的文件将取消选中。',
                      okText: '确定',
                      cancelText: '取消',
                      onOk: () => {
                        setIsMultiSelectMode(false);
                        setSelectedAssets([]);
                        setSelectAllChecked(false);
                      }
                    });
                  } else {
                    setIsMultiSelectMode(false);
                    setSelectedAssets([]);
                    setSelectAllChecked(false);
                  }
                } else {
                  setIsMultiSelectMode(true);
                  setSelectAllChecked(false);
                }
              }}
            >
              {isMultiSelectMode ? `已选 (${selectedAssets.length})` : '多选'}
            </Button>

            {isMultiSelectMode && (
              <Button
                type="primary"
                danger={selectAllChecked}
                disabled={assets.length === 0}
                onClick={() => {
                  if (selectAllChecked) {
                    setSelectedAssets([]);
                    setSelectAllChecked(false);
                  } else {
                    setSelectedAssets(assets.map(a => a.id));
                    setSelectAllChecked(true);
                  }
                }}
              >
                {selectAllChecked ? `取消全选 (${assets.length})` : '全选'}
              </Button>
            )}
          </div>
        </div>

        {/* Upload Zone - 在回收站模式下不显示 */}
        {!isInTrash && (
          <Dragger
            multiple
            showUploadList={false}
            beforeUpload={(_file, fileList) => {
              handleUploadWithDebounce(fileList);
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
        )}

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
                  style={{
                    borderRadius: 14,
                    border: selectedAssets.includes(asset.id) ? '2px solid #D97706' : '1px solid #E3E6ED',
                    background: selectedAssets.includes(asset.id) ? 'rgba(217,119,6,0.05)' : '#fff',
                    transform: selectedAssets.includes(asset.id) ? 'scale(1.02)' : 'scale(1)',
                    transition: 'all 0.2s ease'
                  }}
                  styles={{ body: { padding: '14px 16px' } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {/* 选中指示器 */}
                    {isMultiSelectMode && (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 3,
                          border: selectedAssets.includes(asset.id) ? '2px solid #D97706' : '1px solid #d9d9d9',
                          background: selectedAssets.includes(asset.id) ? '#D97706' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssetClick(asset);
                        }}
                      >
                        {selectedAssets.includes(asset.id) && (
                          <div style={{
                            width: 8,
                            height: 8,
                            background: 'white',
                            borderRadius: 1,
                          }} />
                        )}
                      </div>
                    )}

                    <span
                      style={{ fontSize: 28, cursor: isMultiSelectMode ? 'pointer' : (asset.status === 'ready' ? 'pointer' : 'default') }}
                      onClick={() => {
                        if (isMultiSelectMode) {
                          handleAssetClick(asset);
                        } else {
                          handlePreview(asset);
                        }
                      }}
                    >
                      {fileTypeIcons[asset.fileType] || '📄'}
                    </span>
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: isMultiSelectMode ? 'pointer' : (asset.status === 'ready' ? 'pointer' : 'default') }}
                      onClick={() => {
                        if (isMultiSelectMode) {
                          handleAssetClick(asset);
                        } else {
                          handlePreview(asset);
                        }
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {asset.originalName}
                      </div>
                      <div style={{ fontSize: 11, color: '#5F6B80', display: 'flex', gap: 12, alignItems: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ flexShrink: 0 }}>{formatSize(asset.fileSize)}</span>
                        <span style={{ flexShrink: 0 }}>{formatTime(asset.createdAt)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0}}>
                      <Tag color={st.color}>{st.label}</Tag>
                      <Dropdown
                        trigger={['click']}
                        menu={{
                          items: (() => {
                            const trashFolder = folders.find(f => f.isTrash);
                            const isInTrash = selectedFolder && trashFolder && selectedFolder === trashFolder.id;
                            const isInAllFiles = selectedFolder === null; // 是否在全部文件中
                            const hasSelectedAssets = selectedAssets.length > 0;

                            // 批量操作项
                            const batchItems = [];
                            if (hasSelectedAssets) {
                              if (isInTrash) {
                                // 回收站批量操作
                                batchItems.push(
                                  { key: 'batch-restore', icon: <UndoOutlined />, label: `批量恢复 (${selectedAssets.length})` },
                                  { key: 'batch-permanent-delete', icon: <DeleteRowOutlined />, label: `批量彻底删除 (${selectedAssets.length})`, danger: true },
                                );
                              } else {
                                // 普通文件批量操作
                                batchItems.push(
                                  { key: 'batch-delete', icon: <DeleteOutlined />, label: `批量删除 (${selectedAssets.length})`, danger: true },
                                );
                                if (isInAllFiles) {
                                  batchItems.push(
                                    { key: 'batch-copy', icon: <FolderOutlined />, label: `批量复制到 (${selectedAssets.length})` },
                                  );
                                } else {
                                  batchItems.push(
                                    { key: 'batch-move', icon: <FolderOutlined />, label: `批量移动到 (${selectedAssets.length})` },
                                    { key: 'batch-copy', icon: <FolderOutlined />, label: `批量复制到 (${selectedAssets.length})` },
                                  );
                                }
                              }

                              batchItems.push({ type: 'divider' as const });
                            }

                            // 单个文件操作项
                            const singleItems = [];
                            if (isInTrash) {
                              // 回收站中的文件操作
                              singleItems.push(
                                { key: 'restore', icon: <UndoOutlined />, label: '恢复' },
                                { key: 'permanent-delete', icon: <DeleteRowOutlined />, label: '永久删除', danger: true },
                              );
                            } else if (isInAllFiles) {
                              // 全部文件中的操作
                              singleItems.push(
                                { key: 'preview', icon: <EyeOutlined />, label: '预览', disabled: asset.status !== 'ready' },
                                { key: 'download', icon: <DownloadOutlined />, label: '下载' },
                                { key: 'show-folders', icon: <FolderOutlined />, label: '所在文件夹' },
                                { key: 'copy', icon: <FolderOutlined />, label: '复制到' },
                                { type: 'divider' as const },
                                { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
                              );
                            } else {
                              // 普通文件夹中的操作
                              singleItems.push(
                                { key: 'preview', icon: <EyeOutlined />, label: '预览', disabled: asset.status !== 'ready' },
                                { key: 'download', icon: <DownloadOutlined />, label: '下载' },
                                { key: 'show-folders', icon: <FolderOutlined />, label: '所在文件夹' },
                                { key: 'move', icon: <FolderOutlined />, label: '移动到' },
                                { key: 'copy', icon: <FolderOutlined />, label: '复制到' },
                                { type: 'divider' as const },
                                { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
                              );
                            }

                            return [...batchItems, ...singleItems];
                          })(),
                          onClick: ({ key }) => {
                            if (key.startsWith('batch-')) {
                              handleBatchAction(key);
                            } else {
                              // 单个文件操作
                              if (key === 'preview') handlePreview(asset);
                              else if (key === 'download') handleDownload(asset);
                              else if (key === 'show-folders') handleShowFolders(asset);
                              else if (key === 'move') { setMoveTarget(asset); setMoveFolderId(asset.folderId || null); }
                              else if (key === 'copy') { setCopyTarget(asset); setCopyFolderId(null); }
                              else if (key === 'delete') confirmDeleteAsset(asset);
                              else if (key === 'restore') handleRestoreAsset(asset);
                              else if (key === 'permanent-delete') handlePermanentlyDeleteAsset(asset);
                            }
                          },
                        }}
                      >
                        <Button type="text" size="small" icon={<MoreOutlined />} />
                      </Dropdown>
                    </div>
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
        <p style={{ color: '#999', fontSize: 12 }}>文件将被移至回收站，可在回收站中恢复或永久删除。</p>
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
          {/* 只有从全部文件中操作时才显示"全部文件（不归类）"选项 */}
          {selectedFolder === null && (
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
          )}
          {folders.filter((f) => !f.isDefault && !f.isTrash).map((folder) => (
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

      {/* Copy to Folder Modal */}
      <Modal
        title={`复制到 — ${copyTarget?.originalName || ''}`}
        open={!!copyTarget}
        onOk={handleCopyToFolder}
        onCancel={() => { setCopyTarget(null); setCopyFolderId(null); }}
        okText="复制"
        confirmLoading={copying}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {folders.filter((f) => !f.isDefault && !f.isTrash).map((folder) => (
            <div
              key={folder.id}
              onClick={() => setCopyFolderId(folder.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                border: copyFolderId === folder.id ? '1.5px solid #10B981' : '1px solid #E3E6ED',
                background: copyFolderId === folder.id ? 'rgba(16,185,129,0.05)' : 'transparent',
              }}
            >
              <span>📂</span>
              <span style={{ fontSize: 13, fontWeight: copyFolderId === folder.id ? 600 : 400, color: copyFolderId === folder.id ? '#10B981' : '#5F6B80' }}>
                {folder.name}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3B8' }}>{folder.assetCount} 个文件</span>
            </div>
          ))}
        </div>
      </Modal>

      {/* Override Confirmation Modal */}
      <Modal
        title={overrideType === 'move' ? '移动覆盖确认' : '已有文件'}
        open={!!duplicateFile}
        onOk={handleConfirmOverride}
        onCancel={handleCancelOverride}
        okText={overrideType === 'move' ? '移动并覆盖' : '覆盖'}
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={copying}
      >
        <div style={{ marginTop: 16 }}>
          <p>目标文件夹中已存在同名文件：</p>
          <div style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            marginTop: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📄</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                {duplicateFile?.duplicateAsset?.originalName}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>
              {overrideType === 'move'
                ? '是否要移动并覆盖此文件？被覆盖的文件将直接删除，不会进入回收站。'
                : '是否要覆盖此文件？被覆盖的文件将直接删除，不会进入回收站。'}
            </div>
          </div>
        </div>
      </Modal>

      {/* Asset Folders Modal */}
      <Modal
        title={`${currentAssetForFolders?.originalName || ''} 所在文件夹`}
        open={showFoldersModal}
        onCancel={() => { setShowFoldersModal(false); setCurrentAssetForFolders(null); }}
        footer={[
          <Button key="close" onClick={() => { setShowFoldersModal(false); setCurrentAssetForFolders(null); }}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        <div style={{ marginTop: 16 }}>
          {assetFolders.length === 0 ? (
            <Empty description="暂未归类" style={{ marginTop: 20 }} />
          ) : (
            assetFolders.map((af) => (
              <div
                key={af.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 8,
                  background: '#f8f9fa',
                }}
              >
                <span>📂</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{af.folder.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {af.folder.isDefault ? '默认文件夹' : '自定义文件夹'}
                  </div>
                </div>
                {!af.folder.isDefault && (
                  <Button
                    type="link"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      modal.confirm({
                        title: '确认移除',
                        content: `确定要将文件从"${af.folder.name}"文件夹中移除吗？`,
                        okText: '移除',
                        cancelText: '取消',
                        okType: 'danger',
                        onOk: async () => {
                          try {
                            if (currentAssetForFolders) {
                              await removeFromFolder(af.id);
                              message.success('文件已移至回收站');
                              // 重新获取文件夹数据以确保数据一致性
                              const updatedFolders = await getAssetFolders(currentAssetForFolders.id);
                              setAssetFolders(updatedFolders);
                              fetchAssets();
                              fetchFolders();
                            }
                          } catch (err: any) {
                            message.error(err.response?.data?.error || '移除失败');
                          }
                        }
                      });
                    }}
                  >
                    移除
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Batch Copy Modal */}
      <Modal
        title="批量复制"
        open={batchCopyOpen}
        onOk={handleBatchCopy}
        onCancel={() => { setBatchCopyOpen(false); setBatchCopyFolderId(null); }}
        okText="复制"
        confirmLoading={copying}
        width={500}
      >
        <div style={{ marginTop: 16 }}>
          <p style={{ marginBottom: 16 }}>
            已选择 {selectedAssets.length} 个文件
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {folders.filter((f) => !f.isDefault && !f.isTrash).map((folder) => (
              <div
                key={folder.id}
                onClick={() => setBatchCopyFolderId(folder.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  border: batchCopyFolderId === folder.id ? '1.5px solid #10B981' : '1px solid #E3E6ED',
                  background: batchCopyFolderId === folder.id ? 'rgba(16,185,129,0.05)' : 'transparent',
                }}
              >
                <span>📂</span>
                <span style={{ fontSize: 13, fontWeight: batchCopyFolderId === folder.id ? 600 : 400, color: batchCopyFolderId === folder.id ? '#10B981' : '#5F6B80' }}>
                  {folder.name}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3B8' }}>{folder.assetCount} 个文件</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Batch Move Modal */}
      <Modal
        title="批量移动"
        open={batchMoveOpen}
        onOk={handleBatchMove}
        onCancel={() => { setBatchMoveOpen(false); setBatchMoveFolderId(null); }}
        okText="移动"
        confirmLoading={moving}
        width={500}
      >
        <div style={{ marginTop: 16 }}>
          <p style={{ marginBottom: 16 }}>
            已选择 {selectedAssets.length} 个文件
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {folders.filter((f) => !f.isDefault && !f.isTrash).map((folder) => (
              <div
                key={folder.id}
                onClick={() => setBatchMoveFolderId(folder.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  border: batchMoveFolderId === folder.id ? '1.5px solid #D97706' : '1px solid #E3E6ED',
                  background: batchMoveFolderId === folder.id ? 'rgba(217,119,6,0.05)' : 'transparent',
                }}
              >
                <span>📂</span>
                <span style={{ fontSize: 13, fontWeight: batchMoveFolderId === folder.id ? 600 : 400, color: batchMoveFolderId === folder.id ? '#D97706' : '#5F6B80' }}>
                  {folder.name}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3B8' }}>{folder.assetCount} 个文件</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Batch Duplicate Files Warning Modal */}
      <Modal
        title={batchOverrideType === 'move' ? '移动覆盖确认' : '复制覆盖确认'}
        open={batchDuplicateFiles.length > 0}
        onOk={handleBatchOverride}
        onCancel={handleCancelBatchOverride}
        okText={batchOverrideType === 'move' ? '移动并覆盖' : '复制并覆盖'}
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={batchOverrideType === 'copy' ? copying : moving}
        width={600}
      >
        <div style={{ marginTop: 16 }}>
          <p>目标文件夹中已存在以下重复文件：</p>
          <div style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            marginTop: 12,
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {batchDuplicateFiles.map((duplicate, index) => (
              <div key={index} style={{
                marginBottom: index < batchDuplicateFiles.length - 1 ? 12 : 0,
                paddingBottom: index < batchDuplicateFiles.length - 1 ? 12 : 0,
                borderBottom: index < batchDuplicateFiles.length - 1 ? '1px solid #FECACA' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {duplicate.duplicateAsset.originalName}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>
                  {batchOverrideType === 'move'
                    ? '此文件将被新文件覆盖，原文件将被永久删除，不会进入回收站。'
                    : '此文件将被新文件覆盖，原文件将被永久删除，不会进入回收站。'}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, fontSize: 13, color: '#5F6B80' }}>
            共 <strong>{batchDuplicateFiles.length}</strong> 个文件会被覆盖，
            <strong>{selectedAssets.length - batchDuplicateFiles.length}</strong> 个文件将正常{batchOverrideType === 'move' ? '移动' : '复制'}
          </div>
        </div>
      </Modal>
    </div>
  );
}
