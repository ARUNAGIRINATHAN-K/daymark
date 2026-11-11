import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  Folder as FolderIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFolders, useTags } from '../hooks/useData';
import { useNote } from '../hooks/useNotes';
import { useTask, useTasks } from '../hooks/useTasks';
import type { TaskPriority, TaskStatus } from '../types';

export const TaskDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { task, isLoading } = useTask(id);
  const { updateTask, toggleCompletion, softDeleteTask } = useTasks();
  const folders = useFolders();
  const tags = useTags();

  const linkedNote = useNote(task?.noteId || undefined).note;
  const folder = task?.folderId ? folders.find((f) => f.id === task.folderId) : null;

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Loading task details...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Task Not Found</h3>
        <p className="mt-1 text-xs text-slate-500">
          This task may have been deleted or does not exist.
        </p>
        <button
          onClick={() => navigate('/tasks')}
          className="mt-4 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Tasks
        </button>
      </div>
    );
  }

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((s) => s.isCompleted).length;

  const handleToggleSubtask = async (subtaskId: string) => {
    const updatedSubtasks = subtasks.map((s) =>
      s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
    );
    await updateTask(task.id, { subtasks: updatedSubtasks });
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const newSubtask = {
      id: `subtask_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newSubtaskTitle.trim(),
      isCompleted: false,
    };
    await updateTask(task.id, { subtasks: [...subtasks, newSubtask] });
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = async (subtaskId: string) => {
    const updatedSubtasks = subtasks.filter((s) => s.id !== subtaskId);
    await updateTask(task.id, { subtasks: updatedSubtasks });
  };

  const handleDeleteTask = async () => {
    if (window.confirm(`Delete task "${task.title}"?`)) {
      await softDeleteTask(task.id);
      navigate('/tasks');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950">
      {/* Top Breadcrumb Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-slate-800">
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Tasks</span>
        </button>

        <button
          onClick={handleDeleteTask}
          className="flex items-center gap-1 rounded-lg p-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Task
        </button>
      </div>

      {/* Main Task Detail Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6 dark:border-slate-800 dark:bg-slate-900/60">
        {/* Title & Checkbox */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={task.isCompleted}
            onChange={() => toggleCompletion(task.id)}
            className="mt-1 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer dark:border-slate-700 dark:bg-slate-900"
          />
          <div className="flex-1">
            <h1
              className={`text-xl font-bold tracking-tight ${
                task.isCompleted
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {task.title}
            </h1>
            {task.completedAt && (
              <p className="mt-1 text-xs font-mono text-emerald-600 dark:text-emerald-400">
                Completed on {format(task.completedAt, 'MMM d, yyyy HH:mm')}
              </p>
            )}
          </div>
        </div>

        {/* Status, Priority & Folder Attributes Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-slate-100 py-4 dark:border-slate-800/80">
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Status
            </label>
            <select
              value={task.status || (task.isCompleted ? 'completed' : 'todo')}
              onChange={(e) => updateTask(task.id, { status: e.target.value as TaskStatus })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 outline-none cursor-pointer dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Priority
            </label>
            <select
              value={task.priority}
              onChange={(e) => updateTask(task.id, { priority: e.target.value as TaskPriority })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 outline-none cursor-pointer dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={
                task.dueDate
                  ? new Date(task.dueDate).toISOString().split('T')[0]
                  : ''
              }
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  const dt = new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
                  updateTask(task.id, { dueDate: dt });
                } else {
                  updateTask(task.id, { dueDate: null });
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 outline-none cursor-pointer dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Description
            </h3>
            <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap dark:text-slate-300">
              {task.description}
            </p>
          </div>
        )}

        {/* Subtasks Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4 text-indigo-500" /> Subtasks Checklist
            </h3>
            {subtasks.length > 0 && (
              <span className="font-mono text-xs text-slate-400">
                {completedSubtasks} of {subtasks.length} completed
              </span>
            )}
          </div>

          <div className="space-y-2">
            {subtasks.map((st) => (
              <div
                key={st.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/50"
              >
                <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={st.isCompleted}
                    onChange={() => handleToggleSubtask(st.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span
                    className={
                      st.isCompleted
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-200'
                    }
                  >
                    {st.title}
                  </span>
                </label>
                <button
                  onClick={() => handleRemoveSubtask(st.id)}
                  className="p-1 text-slate-400 hover:text-red-500"
                  title="Remove subtask"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Add a new subtask..."
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </form>
        </div>

        {/* Linked Note Section */}
        {linkedNote && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-indigo-500" /> Linked Note
            </h3>
            <div
              onClick={() => navigate(`/notes/${linkedNote.id}`)}
              className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-indigo-400 transition dark:border-slate-800 dark:bg-slate-950/40"
            >
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                {linkedNote.title}
              </h4>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {linkedNote.content.replace(/[#*`_>-]/g, '').trim()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskDetailsPage;
