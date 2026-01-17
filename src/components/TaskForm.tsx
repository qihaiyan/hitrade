import React, { useState } from 'react';
import { Task, TaskStatus, TaskPriority, AgentType, AgentConfig } from '../types/kanban';
import { X, Save, Bot } from 'lucide-react';

interface TaskFormProps {
  task?: Task;
  initialStatus?: TaskStatus;
  onSave: (taskData: Partial<Task>) => void;
  onCancel: () => void;
}

interface AgentConfigFormProps {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
}

const AgentConfigForm: React.FC<AgentConfigFormProps> = ({ config, onChange }) => {
  const handleFieldChange = (field: keyof AgentConfig, value: any) => {
    onChange({
      ...config,
      [field]: value
    });
  };

  return (
    <div className="space-y-4 bg-gray-700/50 p-4 rounded-lg border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="w-5 h-5 text-blue-400" />
        <h3 className="font-medium text-white">AI Agent Configuration</h3>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Agent Type
        </label>
        <select
          value={config.agentType}
          onChange={(e) => handleFieldChange('agentType', e.target.value as AgentType)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Agent</option>
          <option value={AgentType.OPENCODE}>OpenCode</option>
          <option value={AgentType.CLAUDE_CODE}>Claude Code</option>
          <option value={AgentType.GITHUB_COPILOT}>GitHub Copilot</option>
          <option value={AgentType.GEMINI_CLI}>Gemini CLI</option>
          <option value={AgentType.OPENAI_CODEX}>OpenAI Codex</option>
        </select>
      </div>

      {config.agentType && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Model
            </label>
            <input
              type="text"
              value={config.model || ''}
              onChange={(e) => handleFieldChange('model', e.target.value)}
              placeholder="e.g., gpt-4, claude-3"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              API Key (optional)
            </label>
            <input
              type="password"
              value={config.apiKey || ''}
              onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              placeholder="Enter API key if needed"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Temperature (0-1)
              </label>
              <input
                type="number"
                value={config.temperature || 0.1}
                onChange={(e) => handleFieldChange('temperature', parseFloat(e.target.value))}
                min="0"
                max="1"
                step="0.1"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Max Tokens
              </label>
              <input
                type="number"
                value={config.maxTokens || 4000}
                onChange={(e) => handleFieldChange('maxTokens', parseInt(e.target.value))}
                min="100"
                max="32000"
                step="100"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              System Prompt (optional)
            </label>
            <textarea
              value={config.systemPrompt || ''}
              onChange={(e) => handleFieldChange('systemPrompt', e.target.value)}
              placeholder="Custom instructions for the AI agent"
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
          </div>
        </>
      )}
    </div>
  );
};

export const TaskForm: React.FC<TaskFormProps> = ({
  task,
  initialStatus,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || initialStatus || TaskStatus.TODO,
    priority: task?.priority || TaskPriority.MEDIUM,
    assignee: task?.assignee || '',
    labels: task?.labels?.join(', ') || '',
    dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
    agentType: task?.agentType || '',
  });

  const [agentConfig, setAgentConfig] = useState<AgentConfig>(
    task?.agentConfig || {
      agentType: task?.agentType || AgentType.OPENCODE,
      model: 'gpt-4',
      temperature: 0.1,
      maxTokens: 4000
    }
  );

  const [showAgentConfig, setShowAgentConfig] = useState(!!task?.agentConfig);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const taskData: Partial<Task> = {
      title: formData.title,
      description: formData.description || undefined,
      status: formData.status,
      priority: formData.priority,
      assignee: formData.assignee || undefined,
      labels: formData.labels ? formData.labels.split(',').map(label => label.trim()).filter(Boolean) : [],
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      agentType: agentConfig.agentType || undefined,
      agentConfig: agentConfig.agentType ? agentConfig : undefined
    };

    onSave(taskData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {task ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                placeholder="Enter task title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value as TaskStatus)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={TaskStatus.TODO}>To Do</option>
                <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                <option value={TaskStatus.REVIEW}>Review</option>
                <option value={TaskStatus.DONE}>Done</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', e.target.value as TaskPriority)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={TaskPriority.LOW}>Low</option>
                <option value={TaskPriority.MEDIUM}>Medium</option>
                <option value={TaskPriority.HIGH}>High</option>
                <option value={TaskPriority.CRITICAL}>Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Assignee
              </label>
              <input
                type="text"
                value={formData.assignee}
                onChange={(e) => handleInputChange('assignee', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                placeholder="Assign to..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleInputChange('dueDate', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                placeholder="Describe the task..."
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Labels
              </label>
              <input
                type="text"
                value={formData.labels}
                onChange={(e) => handleInputChange('labels', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                placeholder="frontend, backend, bug (comma separated)"
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAgentConfig(!showAgentConfig)}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium"
            >
              <Bot className="w-4 h-4 text-blue-400" />
              {showAgentConfig ? 'Hide' : 'Configure'} AI Agent
            </button>
          </div>

          {showAgentConfig && (
            <AgentConfigForm
              config={agentConfig}
              onChange={setAgentConfig}
            />
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {task ? 'Update' : 'Create'} Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};