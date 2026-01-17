import React, { useState } from 'react';
import { KanbanBoard } from '../components/KanbanBoard';
import { TaskForm } from '../components/TaskForm';
import { Task, TaskStatus } from '../types/kanban';
import { KanbanService } from '../services/kanban';
import { Settings, Bot, Plus } from 'lucide-react';
import Navbar from '../components/Navbar';

export const KanbanPage: React.FC = () => {
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [initialStatus, setInitialStatus] = useState<TaskStatus | undefined>();
  const [isExecuting, setIsExecuting] = useState(false);
  
  const kanbanService = KanbanService.getInstance();

  const handleTaskAdd = (status: TaskStatus) => {
    setSelectedTask(undefined);
    setInitialStatus(status);
    setShowTaskForm(true);
  };

  const handleTaskEdit = (task: Task) => {
    setSelectedTask(task);
    setInitialStatus(undefined);
    setShowTaskForm(true);
  };

  const handleTaskSave = (taskData: Partial<Task>) => {
    if (selectedTask) {
      kanbanService.updateTask(selectedTask.id, taskData);
    } else {
      kanbanService.createTask(taskData);
    }
    
    setShowTaskForm(false);
    setSelectedTask(undefined);
    setInitialStatus(undefined);
    // Force a re-render of the board
    window.location.reload();
  };

  const handleTaskCancel = () => {
    setShowTaskForm(false);
    setSelectedTask(undefined);
    setInitialStatus(undefined);
  };

  const handleTaskExecute = async (task: Task) => {
    if (!task.agentConfig) {
      alert('Please configure an AI agent for this task first.');
      handleTaskEdit(task);
      return;
    }

    setIsExecuting(true);
    try {
      const result = await kanbanService.executeTaskWithOpenCode(task);
      
      if (result.success) {
        alert('Task executed successfully by AI agent!');
      } else {
        alert(`Task execution failed: ${result.error}`);
      }
      
      // Force a re-render to show updated status
      window.location.reload();
    } catch (error) {
      alert(`Error executing task: ${error}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar />
      <div className="p-1 sm:p-2 md:p-4 lg:p-6">
        <div className="max-w-full">
          <header className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-white">Vibe Kanban</h1>
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                  <Bot className="w-4 h-4" />
                  OpenCode Integration
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTaskAdd(TaskStatus.TODO)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Task
                </button>
                
                <button 
                  onClick={() => alert('OpenCode Setup:\n\n1. Install: npm install -g opencode-ai\n2. Start: opencode serve --cors http://localhost:3000\n3. Configure API keys: opencode connect anthropic\n4. Refresh this page\n\nWithout OpenCode server, tasks run in mock mode.')}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  title="OpenCode Setup Help"
                >
                  <Settings className="w-5 h-5 text-gray-300" />
                </button>
              </div>
            </div>
          </header>

          <main className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-xl overflow-hidden flex-1 min-h-[600px]">
            <KanbanBoard
              onTaskEdit={handleTaskEdit}
              onTaskAdd={handleTaskAdd}
              onTaskExecute={handleTaskExecute}
            />
          </main>

          {showTaskForm && (
            <TaskForm
              task={selectedTask}
              initialStatus={initialStatus}
              onSave={handleTaskSave}
              onCancel={handleTaskCancel}
            />
          )}

          {isExecuting && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 flex items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <div>
                  <p className="font-medium text-white">Executing task with AI agent...</p>
                  <p className="text-sm text-gray-300">This may take a moment.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};