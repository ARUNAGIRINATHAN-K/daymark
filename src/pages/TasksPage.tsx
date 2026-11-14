import React, { useEffect, useState } from 'react';
import { Kanban, List, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { KanbanBoard } from '../components/tasks/KanbanBoard';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskFilters } from '../components/tasks/TaskFilters';
import { TaskForm } from '../components/tasks/TaskForm';
import { TaskList } from '../components/tasks/TaskList';
import { TaskCompletionDialog } from '../components/tasks/TaskCompletionDialog';
import { useFolders } from '../hooks/useData';
import { useTasks } from '../hooks/useTasks';
import { useTaskCompletionConfirmation } from '../hooks/useTaskCompletionConfirmation';
import type { Task, TaskPriority, TaskStatus } from '../types';
import { settingsService } from '../services/settings.service';
import type { TaskSortBy } from '../schemas/settings.schema';

export const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const folders = useFolders();

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | 'all'>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<TaskSortBy>('createdAt');

  useEffect(() => {
    let active = true;
    void settingsService.getDefaultTaskSort().then((defaultSort) => {
      if (active) setSortBy(defaultSort);
    });
    return () => { active = false; };
  }, []);

  // Modal form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatusForNew, setDefaultStatusForNew] = useState<TaskStatus>('todo');

  const { tasks, createTask, updateTask, updateTaskStatus, toggleCompletion, softDeleteTask } =
    useTasks({
      searchQuery: searchQuery.trim() || undefined,
      status: selectedStatus === 'all' ? undefined : selectedStatus,
      priority: selectedPriority === 'all' ? undefined : selectedPriority,
      folderId: selectedFolderId || undefined,
      sortBy,
    });
  const completion = useTaskCompletionConfirmation();

  const handleCreateTask = async (data: any) => {
    if (editingTask) {
      await updateTask(editingTask.id, data);
    } else {
      await createTask(data);
    }
    setEditingTask(null);
  };

  const handleOpenCreateModal = (initialStatus: TaskStatus = 'todo') => {
    setEditingTask(null);
    setDefaultStatusForNew(initialStatus);
    setIsFormOpen(true);
  };

  const handleOpenEditModal = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleToggleCompletion = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (!task.isCompleted) {
      completion.requestCompletion(task);
      return;
    }
    await toggleCompletion(task.id);
  };

  const handleDeleteTask = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    await softDeleteTask(task.id);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedPriority('all');
    setSelectedFolderId(null);
    setSortBy('createdAt');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--color-border-primary)] pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            All Tasks
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-card)] p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                viewMode === 'list'
                  ? 'bg-[var(--color-accent)] text-white shadow-2xs font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                viewMode === 'kanban'
                  ? 'bg-[var(--color-accent)] text-white shadow-2xs font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              Kanban
            </button>
          </div>

          <button
            onClick={() => handleOpenCreateModal('todo')}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <TaskFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedPriority={selectedPriority}
        onPriorityChange={setSelectedPriority}
        selectedFolderId={selectedFolderId}
        onFolderChange={setSelectedFolderId}
        sortBy={sortBy}
        onSortChange={setSortBy}
        folders={folders}
        onReset={handleResetFilters}
      />

      {/* Main View: List or Kanban */}
      {viewMode === 'list' ? (
        <TaskList
          tasks={tasks}
          onSelectTask={(task) => navigate(`/tasks/${task.id}`)}
          onToggleCompletion={handleToggleCompletion}
          onEditTask={handleOpenEditModal}
          onDeleteTask={handleDeleteTask}
          onCreateTask={() => handleOpenCreateModal('todo')}
        />
      ) : (
        <KanbanBoard
          tasks={tasks}
          onUpdateStatus={async (id, status) => {
            const task = tasks.find((item) => item.id === id);
            if (status === 'completed' && task && !task.isCompleted) {
              completion.requestCompletion(task);
              return;
            }
            await updateTaskStatus(id, status);
          }}
          onSelectTask={(task) => navigate(`/tasks/${task.id}`)}
          onToggleCompletion={handleToggleCompletion}
          onEditTask={handleOpenEditModal}
          onDeleteTask={handleDeleteTask}
          onCreateTaskInStatus={(status) => handleOpenCreateModal(status)}
        />
      )}

      {/* Modal Task Form */}
      <TaskForm
        task={editingTask}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleCreateTask}
        defaultFolderId={selectedFolderId}
      />
      <TaskCompletionDialog
        task={completion.task}
        isProcessing={completion.isProcessing}
        error={completion.error}
        onConfirm={() => void completion.confirm()}
        onCancel={completion.cancel}
      />
    </div>
  );
};

export default TasksPage;
