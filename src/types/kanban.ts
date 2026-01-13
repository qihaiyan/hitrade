export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  agentType?: AgentType;
  agentConfig?: AgentConfig;
}

export interface AgentConfig {
  agentType: AgentType;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  customSettings?: Record<string, any>;
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress', 
  REVIEW = 'review',
  DONE = 'done'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AgentType {
  OPENCODE = 'opencode',
  CLAUDE_CODE = 'claude_code',
  GITHUB_COPILOT = 'github_copilot',
  GEMINI_CLI = 'gemini_cli',
  OPENAI_CODEX = 'openai_codex'
}

export interface KanbanColumn {
  id: string;
  title: string;
  status: TaskStatus;
  tasks: Task[];
  color?: string;
  maxTasks?: number;
}

export interface KanbanBoard {
  id: string;
  title: string;
  description?: string;
  columns: KanbanColumn[];
  createdAt: Date;
  updatedAt: Date;
  settings: BoardSettings;
}

export interface BoardSettings {
  allowDragDrop: boolean;
  showAssignee: boolean;
  showPriority: boolean;
  showLabels: boolean;
  compactMode: boolean;
  autoSave: boolean;
}

export interface OpenCodeSession {
  id: string;
  taskId: string;
  status: SessionStatus;
  startTime: Date;
  endTime?: Date;
  messages: SessionMessage[];
  output?: string;
  error?: string;
}

export enum SessionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  error?: string;
}