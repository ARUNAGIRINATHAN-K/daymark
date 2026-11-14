import { addDays, startOfDay, startOfWeek, subDays } from 'date-fns';
import { db } from '../db/database';
import type { Note, SyncOperation, Task } from '../types';

export interface DashboardMetrics {
  totalNotes: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completionRate: number;
  todayTasks: Task[];
  urgentPendingTasks: Task[];
  upcomingDeadlines: Task[];
  recentNotes: Note[];
}

export interface TaskPerformancePoint {
  date: Date;
  completed: number;
  created: number;
}

export interface CompletionActivityDay {
  date: Date;
  count: number;
}

export interface DashboardActivity {
  id: string;
  entityId: string;
  title: string;
  itemTitle: string;
  timestamp: number;
  itemType: 'note' | 'task';
  entityAvailable: boolean;
}

export class DashboardService {
  calculateMetrics(notes: Note[], tasks: Task[], now = new Date()): DashboardMetrics {
    const activeNotes = notes
      .filter((note) => note.deletedAt === null && !note.isArchived)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const activeTasks = tasks.filter((task) => task.deletedAt === null);

    const startOfToday = startOfDay(now).getTime();
    const endOfToday = addDays(startOfToday, 1).getTime() - 1;
    const sevenDaysFromNow = addDays(startOfToday, 8).getTime() - 1;
    const completedTasks = activeTasks.filter((task) => task.isCompleted);
    const pendingTasks = activeTasks.filter((task) => !task.isCompleted);
    const overdueTasks = pendingTasks.filter(
      (task) => task.dueDate != null && task.dueDate < startOfToday
    );
    const todayTasks = activeTasks.filter(
      (task) =>
        task.dueDate != null &&
        task.dueDate >= startOfToday &&
        task.dueDate <= endOfToday
    );
    const urgentPendingTasks = pendingTasks
      .filter((task) => task.priority === 'urgent' || task.priority === 'high')
      .sort((a, b) => {
        const priorityDifference =
          (b.priority === 'urgent' ? 2 : 1) - (a.priority === 'urgent' ? 2 : 1);
        if (priorityDifference !== 0) return priorityDifference;
        return (a.dueDate ?? Number.MAX_SAFE_INTEGER) - (b.dueDate ?? Number.MAX_SAFE_INTEGER);
      });
    const upcomingDeadlines = pendingTasks
      .filter(
        (task) =>
          task.dueDate != null &&
          task.dueDate >= startOfToday &&
          task.dueDate <= sevenDaysFromNow
      )
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));

    return {
      totalNotes: activeNotes.length,
      totalTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      pendingTasks: pendingTasks.length,
      overdueTasks: overdueTasks.length,
      completionRate:
        activeTasks.length > 0
          ? Math.round((completedTasks.length / activeTasks.length) * 100)
          : 0,
      todayTasks,
      urgentPendingTasks,
      upcomingDeadlines,
      recentNotes: activeNotes.slice(0, 5),
    };
  }

  getTaskPerformance(tasks: Task[], days: number, now = new Date()): TaskPerformancePoint[] {
    const activeTasks = tasks.filter((task) => task.deletedAt === null);
    const firstDay = startOfDay(subDays(now, days - 1));
    const createdCounts = new Map<number, number>();
    const completedCounts = new Map<number, number>();

    for (const task of activeTasks) {
      const createdDay = startOfDay(task.createdAt).getTime();
      createdCounts.set(createdDay, (createdCounts.get(createdDay) ?? 0) + 1);

      if (task.isCompleted && task.completedAt != null) {
        const completedDay = startOfDay(task.completedAt).getTime();
        completedCounts.set(completedDay, (completedCounts.get(completedDay) ?? 0) + 1);
      }
    }

    return Array.from({ length: days }, (_, index) => {
      const date = addDays(firstDay, index);
      const day = date.getTime();
      return {
        date,
        created: createdCounts.get(day) ?? 0,
        completed: completedCounts.get(day) ?? 0,
      };
    });
  }

  getCompletionActivity(tasks: Task[], now = new Date()): CompletionActivityDay[] {
    const today = startOfDay(now);
    const firstDay = subDays(startOfWeek(today, { weekStartsOn: 1 }), 77);
    const activeTasks = tasks.filter((task) => task.deletedAt === null && task.isCompleted);
    const completedCounts = new Map<number, number>();

    for (const task of activeTasks) {
      if (task.completedAt == null) continue;
      const completedDay = startOfDay(task.completedAt).getTime();
      completedCounts.set(completedDay, (completedCounts.get(completedDay) ?? 0) + 1);
    }

    return Array.from({ length: 84 }, (_, index) => {
      const date = addDays(firstDay, index);
      return {
        date,
        count: completedCounts.get(date.getTime()) ?? 0,
      };
    });
  }

  getRecentActivity(
    operations: SyncOperation[],
    notes: Note[],
    tasks: Task[],
    limit = 6
  ): DashboardActivity[] {
    const noteTitles = new Map(notes.map((note) => [note.id, note.title || 'Untitled note']));
    const taskTitles = new Map(tasks.map((task) => [task.id, task.title || 'Untitled task']));

    return operations
      .filter((operation) => operation.entityType === 'note' || operation.entityType === 'task')
      .map((operation) => {
        const itemType: 'note' | 'task' = operation.entityType === 'note' ? 'note' : 'task';
        const payload = operation.payload;
        let title: string;

        if (operation.action === 'create') {
          title = `${itemType === 'note' ? 'Note' : 'Task'} created`;
        } else if (itemType === 'note' && payload.isArchived === true) {
          title = 'Note archived';
        } else if (itemType === 'task' && (payload.isCompleted === true || payload.status === 'completed')) {
          title = 'Task completed';
        } else if (operation.action === 'delete') {
          title = `${itemType === 'note' ? 'Note' : 'Task'} moved to trash`;
        } else {
          title = `${itemType === 'note' ? 'Note' : 'Task'} updated`;
        }

        return {
          id: operation.id,
          entityId: operation.entityId,
          title,
          itemTitle: (itemType === 'note' ? noteTitles : taskTitles).get(operation.entityId) ??
            (itemType === 'note' ? 'Note' : 'Task'),
          timestamp: operation.timestamp,
          itemType,
          entityAvailable: (itemType === 'note' ? noteTitles : taskTitles).has(operation.entityId),
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getMetrics(): Promise<DashboardMetrics> {
    const [notes, tasks] = await Promise.all([db.notes.toArray(), db.tasks.toArray()]);
    return this.calculateMetrics(notes, tasks);
  }
}

export const dashboardService = new DashboardService();
