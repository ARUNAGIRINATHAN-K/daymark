import { db } from '../db/database';
import type { Note, Task } from '../types';

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

export class DashboardService {
  private getLocalDayBounds() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const sevenDaysFromNow = endOfToday + 7 * 86400000;
    return { startOfToday, endOfToday, sevenDaysFromNow };
  }

  async getMetrics(): Promise<DashboardMetrics> {
    const { startOfToday, endOfToday, sevenDaysFromNow } = this.getLocalDayBounds();

    const activeNotes = await db.notes
      .filter((n) => n.deletedAt === null)
      .reverse()
      .sortBy('updatedAt');

    const activeTasks = await db.tasks
      .filter((t) => t.deletedAt === null)
      .toArray();

    const completedTasks = activeTasks.filter((t) => t.isCompleted);
    const pendingTasks = activeTasks.filter((t) => !t.isCompleted);

    const overdueTasks = pendingTasks.filter(
      (t) => t.dueDate !== null && t.dueDate !== undefined && t.dueDate < startOfToday
    );

    const completionRate =
      activeTasks.length > 0 ? Math.round((completedTasks.length / activeTasks.length) * 100) : 0;

    const todayTasks = activeTasks.filter(
      (t) =>
        t.dueDate !== null &&
        t.dueDate !== undefined &&
        t.dueDate >= startOfToday &&
        t.dueDate <= endOfToday
    );

    const urgentPendingTasks = pendingTasks.filter(
      (t) => t.priority === 'urgent' || t.priority === 'high'
    ).sort((a, b) => {
      const pDiff = (b.priority === 'urgent' ? 2 : 1) - (a.priority === 'urgent' ? 2 : 1);
      if (pDiff !== 0) return pDiff;
      return (a.dueDate ?? Number.MAX_SAFE_INTEGER) - (b.dueDate ?? Number.MAX_SAFE_INTEGER);
    });

    const upcomingDeadlines = pendingTasks
      .filter(
        (t) =>
          t.dueDate !== null &&
          t.dueDate !== undefined &&
          t.dueDate > endOfToday &&
          t.dueDate <= sevenDaysFromNow
      )
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));

    const recentNotes = activeNotes.slice(0, 5);

    return {
      totalNotes: activeNotes.length,
      totalTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      pendingTasks: pendingTasks.length,
      overdueTasks: overdueTasks.length,
      completionRate,
      todayTasks,
      urgentPendingTasks,
      upcomingDeadlines,
      recentNotes,
    };
  }
}

export const dashboardService = new DashboardService();
