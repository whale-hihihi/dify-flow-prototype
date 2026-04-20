export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  defaultAgentId?: string | null;
  createdAt?: string;
}

export interface Agent {
  id: string;
  name: string;
  mode: 'chat' | 'completion' | 'workflow';
  description?: string;
  appId: string;
  endpoint: string;
  callCount: number;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentFormData {
  name: string;
  mode: string;
  description?: string;
  appId: string;
  apiKey: string;
  endpoint?: string;
}

export interface DifyConfig {
  id: string;
  difyUrl: string;
  connectionStatus: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  isDefault: boolean;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  filename: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  status: 'uploading' | 'parsing' | 'ready' | 'failed';
  folderId: string | null;
  parsedText?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchResult extends Asset {
  snippet?: string;
}

export interface TaskItem {
  id: string;
  sourceAssetId: string;
  resultAssetId?: string | null;
  status: string;
  progress: number;
  result?: string | null;
  error?: string | null;
  sourceAsset?: Asset;
}

export interface Task {
  id: string;
  name: string;
  type: 'immediate' | 'scheduled';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  agentId: string;
  totalFiles: number;
  completedFiles: number;
  prompt?: string | null;
  cronExpression?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  agent?: { id: string; name: string };
  items?: TaskItem[];
}
