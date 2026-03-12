export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Snapshot {
  id: string;
  projectId: string;
  storagePath: string;
  originalFileName: string;
  fileSizeBytes: number;
  fileCount: number;
  createdAt: Date;
}

export interface Template {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  promptText: string;
  variablesSchema: TemplateVariable[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  label: string;
  description?: string;
  defaultValue?: string;
  required: boolean;
}

export interface TddDocument {
  id: string;
  projectId: string;
  snapshotId: string;
  templateId: string;
  title: string;
  description: string | null;
  tags: string[];
  markdownContent: string;
  generationNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TddRevision {
  id: string;
  tddDocumentId: string;
  markdownContent: string;
  message: string | null;
  createdAt: Date;
}

export type GenerationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface GenerationJob {
  id: string;
  tddDocumentId: string | null;
  projectId: string;
  snapshotId: string;
  templateId: string;
  status: GenerationStatus;
  generationNotes: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  createdAt: Date;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
}

export interface CodebaseSummary {
  fileTree: FileTreeNode[];
  totalFiles: number;
  totalSize: number;
  keyFiles: { path: string; content: string }[];
  languages: string[];
}

export interface GenerateRequest {
  projectId: string;
  snapshotId: string;
  templateId: string;
  generationNotes?: string;
  variables?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}
