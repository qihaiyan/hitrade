import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority, AgentType } from '../types/kanban';
import { KanbanService } from '../services/kanban';
import { Plus, Clock, User, Tag, AlertCircle, Bot, Play, Settings } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onExecuteWithAgent: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete, onExecuteWithAgent }) => {
  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.CRITICAL: return 'bg-red-100 text-red-800 border-red-200';
      case TaskPriority.HIGH: return 'bg-orange-100 text-orange-800 border-orange-200';
      case TaskPriority.MEDIUM: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case TaskPriority.LOW: return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO: return <Clock className="w-4 h-4" />;
      case TaskStatus.IN_PROGRESS: return <Play className="w-4 h-4" />;
      case TaskStatus.REVIEW: return <AlertCircle className="w-4 h-4" />;
      case TaskStatus.DONE: return <div className="w-4 h-4 rounded-full bg-green-500" />;
      default: return null;
    }
  };

  const getAgentIcon = (agentType?: AgentType) => {
    if (!agentType) return null;
    return <Bot className="w-4 h-4 text-blue-600" />;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900 text-sm flex-1">{task.title}</h3>
        <div className="flex items-center gap-1">
          {getAgentIcon(task.agentType)}
          {getStatusIcon(task.status)}
        </div>
      </div>

      {task.description && (
        <p className="text-gray-600 text-xs mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
          {task.priority}
        </span>
      </div>

      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.labels.map((label, index) => (
            <span key={index} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
              <Tag className="w-3 h-3" />
              {label}
            </span>
          ))}
        </div>
      )}

      {task.assignee && (
        <div className="flex items-center gap-1 mb-3 text-xs text-gray-500">
          <User className="w-3 h-3" />
          {task.assignee}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {task.updatedAt instanceof Date ? task.updatedAt.toLocaleDateString() : new Date(task.updatedAt).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-1">
          {task.agentType && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExecuteWithAgent(task);
              }}
              className="p-1 hover:bg-gray-100 rounded"
              title="Execute with AI Agent"
            >
              <Play className="w-3 h-3 text-green-600" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Edit task"
          >
            <Settings className="w-3 h-3 text-gray-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Delete task"
          >
            <div className="w-3 h-3 text-red-600">×</div>
          </button>
        </div>
      </div>
    </div>
  );
};

interface KanbanColumnProps {
  title: string;
  status: TaskStatus;
  tasks: Task[];
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskExecute: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  status,
  tasks,
  onTaskEdit,
  onTaskDelete,
  onTaskExecute,
  onAddTask
}) => {
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO: return 'bg-gray-50 border-gray-200';
      case TaskStatus.IN_PROGRESS: return 'bg-blue-50 border-blue-200';
      case TaskStatus.REVIEW: return 'bg-purple-50 border-purple-200';
      case TaskStatus.DONE: return 'bg-green-50 border-green-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`flex-1 min-w-80 border-2 rounded-lg p-4 ${getStatusColor(status)}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="bg-white px-2 py-1 rounded text-sm font-medium text-gray-600">
            {tasks.length}
          </span>
          <button
            onClick={() => onAddTask(status)}
            className="p-1 hover:bg-white rounded transition-colors"
            title="Add new task"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="space-y-3 min-h-[200px]">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onTaskEdit}
            onDelete={onTaskDelete}
            onExecuteWithAgent={onTaskExecute}
          />
        ))}
        
        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No tasks in this column
          </div>
        )}
      </div>
    </div>
  );
};

interface KanbanBoardProps {
  onTaskEdit: (task: Task) => void;
  onTaskAdd: (status: TaskStatus) => void;
  onTaskExecute: (task: Task) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  onTaskEdit,
  onTaskAdd,
  onTaskExecute
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const kanbanService = KanbanService.getInstance();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = () => {
    setLoading(true);
    const allTasks = kanbanService.getTasks();
    setTasks(allTasks);
    setLoading(false);
  };

  const handleTaskDelete = (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      kanbanService.deleteTask(taskId);
      loadTasks();
    }
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter(task => task.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading kanban board...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-100 p-6">
      <div className="flex gap-6 h-full overflow-x-auto">
        <KanbanColumn
          title="To Do"
          status={TaskStatus.TODO}
          tasks={getTasksByStatus(TaskStatus.TODO)}
          onTaskEdit={onTaskEdit}
          onTaskDelete={handleTaskDelete}
          onTaskExecute={onTaskExecute}
          onAddTask={onTaskAdd}
        />
        
        <KanbanColumn
          title="In Progress"
          status={TaskStatus.IN_PROGRESS}
          tasks={getTasksByStatus(TaskStatus.IN_PROGRESS)}
          onTaskEdit={onTaskEdit}
          onTaskDelete={handleTaskDelete}
          onTaskExecute={onTaskExecute}
          onAddTask={onTaskAdd}
        />
        
        <KanbanColumn
          title="Review"
          status={TaskStatus.REVIEW}
          tasks={getTasksByStatus(TaskStatus.REVIEW)}
          onTaskEdit={onTaskEdit}
          onTaskDelete={handleTaskDelete}
          onTaskExecute={onTaskExecute}
          onAddTask={onTaskAdd}
        />
        
        <KanbanColumn
          title="Done"
          status={TaskStatus.DONE}
          tasks={getTasksByStatus(TaskStatus.DONE)}
          onTaskEdit={onTaskEdit}
          onTaskDelete={handleTaskDelete}
          onTaskExecute={onTaskExecute}
          onAddTask={onTaskAdd}
        />
      </div>
    </div>
  );
};