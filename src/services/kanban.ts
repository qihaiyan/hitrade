import { Task, TaskStatus, TaskPriority, AgentConfig, AgentType } from '../types/kanban';

export class KanbanService {
  private static instance: KanbanService;
  private storageKey = 'kanban-tasks';

  private constructor() {}

  static getInstance(): KanbanService {
    if (!KanbanService.instance) {
      KanbanService.instance = new KanbanService();
    }
    return KanbanService.instance;
  }

  // Task Management
  getTasks(): Task[] {
    const data = localStorage.getItem(this.storageKey);
    if (!data) return this.getDefaultTasks();
    
    const tasks = JSON.parse(data);
    // Convert string dates back to Date objects
    return tasks.map((task: any) => ({
      ...task,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined
    }));
  }

  saveTasks(tasks: Task[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(tasks));
  }

  createTask(taskData: Partial<Task>): Task {
    const task: Task = {
      id: crypto.randomUUID(),
      title: taskData.title || 'New Task',
      description: taskData.description,
      status: taskData.status || TaskStatus.TODO,
      priority: taskData.priority || TaskPriority.MEDIUM,
      assignee: taskData.assignee,
      labels: taskData.labels || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: taskData.dueDate,
      agentType: taskData.agentType,
      agentConfig: taskData.agentConfig
    };

    const tasks = this.getTasks();
    tasks.push(task);
    this.saveTasks(tasks);
    return task;
  }

  updateTask(id: string, updates: Partial<Task>): Task | null {
    const tasks = this.getTasks();
    const index = tasks.findIndex(task => task.id === id);
    
    if (index === -1) return null;

    tasks[index] = {
      ...tasks[index],
      ...updates,
      updatedAt: new Date()
    };

    this.saveTasks(tasks);
    return tasks[index];
  }

  deleteTask(id: string): boolean {
    const tasks = this.getTasks();
    const filteredTasks = tasks.filter(task => task.id !== id);
    
    if (filteredTasks.length === tasks.length) return false;

    this.saveTasks(filteredTasks);
    return true;
  }

  moveTask(id: string, newStatus: TaskStatus): Task | null {
    return this.updateTask(id, { status: newStatus });
  }

  // OpenCode Integration (Mock Implementation)
  async executeTaskWithOpenCode(task: Task): Promise<{ success: boolean; output?: string; error?: string }> {
    if (!task.agentConfig || task.agentConfig.agentType !== AgentType.OPENCODE) {
      return { success: false, error: 'Task not configured for OpenCode' };
    }

    try {
      // Update task status to in_progress
      this.updateTask(task.id, { status: TaskStatus.IN_PROGRESS });

      // Simulate OpenCode execution
      const result = await this.callMockOpenCode(task);
      
      if (result.success) {
        this.updateTask(task.id, { 
          status: TaskStatus.DONE,
          description: task.description + '\n\n**OpenCode Output:**\n' + result.output
        });
      } else {
        this.updateTask(task.id, { status: TaskStatus.TODO });
      }

      return result;
    } catch (error) {
      this.updateTask(task.id, { status: TaskStatus.TODO });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async callMockOpenCode(task: Task): Promise<{ success: boolean; output?: string; error?: string }> {
    // Mock OpenCode execution with realistic simulation
    return new Promise((resolve) => {
      setTimeout(() => {
        const agentModel = task.agentConfig?.model || 'claude-3-5-sonnet-20241022';
        const systemPrompt = task.agentConfig?.systemPrompt || 'You are a helpful AI coding assistant.';
        
        resolve({
          success: true,
          output: `Task "${task.title}" completed successfully by OpenCode.

**Configuration Used:**
- Agent: ${task.agentConfig?.agentType || AgentType.OPENCODE}
- Model: ${agentModel}
- Temperature: ${task.agentConfig?.temperature || 0.1}
- System Prompt: "${systemPrompt}"

**Implementation Details:**
- Code generated following best practices
- Error handling implemented
- Unit tests added and passing
- Documentation updated
- Code reviewed for quality and security

**To enable real OpenCode integration:**
1. Install OpenCode CLI: npm install -g opencode-ai
2. Configure API keys: opencode connect anthropic
3. Start server: opencode serve --cors http://localhost:3000
4. Restart this application

**Current Status:** Mock Mode (Simulation)
`
        });
      }, 2000 + Math.random() * 1000); // 2-3 seconds
    });
  }

  // Agent Configuration
  saveAgentConfig(taskId: string, config: AgentConfig): boolean {
    return this.updateTask(taskId, { agentConfig: config }) !== null;
  }

  getAgentConfig(taskId: string): AgentConfig | null {
    const task = this.getTasks().find(t => t.id === taskId);
    return task?.agentConfig || null;
  }

  // Utility methods
  private getDefaultTasks(): Task[] {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Set up project structure',
        description: 'Create basic project directory structure and configuration files',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        assignee: 'Developer',
        labels: ['setup', 'infrastructure'],
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 86400000),
        agentType: AgentType.OPENCODE,
        agentConfig: {
          agentType: AgentType.OPENCODE,
          model: 'claude-3-5-sonnet-20241022',
          temperature: 0.1,
          maxTokens: 4000
        }
      },
      {
        id: crypto.randomUUID(),
        title: 'Implement authentication system',
        description: 'Add user authentication with JWT tokens and login/logout functionality',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        assignee: 'Backend Developer',
        labels: ['backend', 'security'],
        createdAt: new Date(Date.now() - 43200000),
        updatedAt: new Date(),
        agentType: AgentType.OPENCODE,
        agentConfig: {
          agentType: AgentType.OPENCODE,
          model: 'claude-3-5-sonnet-20241022',
          temperature: 0.2
        }
      },
      {
        id: crypto.randomUUID(),
        title: 'Design dashboard UI',
        description: 'Create wireframes and mockups for main dashboard interface',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        assignee: 'UI Designer',
        labels: ['frontend', 'design'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  // Filter and search
  filterTasks(filter: {
    status?: TaskStatus;
    assignee?: string;
    labels?: string[];
    priority?: string;
  }): Task[] {
    const tasks = this.getTasks();
    
    return tasks.filter(task => {
      if (filter.status && task.status !== filter.status) return false;
      if (filter.assignee && task.assignee !== filter.assignee) return false;
      if (filter.priority && task.priority !== filter.priority) return false;
      if (filter.labels && filter.labels.length > 0) {
        const hasAllLabels = filter.labels.every(label => 
          task.labels.includes(label)
        );
        if (!hasAllLabels) return false;
      }
      return true;
    });
  }
}