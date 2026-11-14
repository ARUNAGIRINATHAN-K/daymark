import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/db/database';
import { dashboardService } from '../src/services/dashboard.service';
import { notesService } from '../src/services/notes.service';
import { tasksService } from '../src/services/tasks.service';
import { outboxService } from '../src/services/outboxService';

describe('Master Prompt 05: Task Management & Dashboard Metrics', () => {
  beforeEach(async () => {
    await db.notes.clear();
    await db.tasks.clear();
    await db.folders.clear();
    await db.tags.clear();
    await db.outbox.clear();
  });

  describe('Tasks Service CRUD & Outbox Integration', () => {
    it('creates a task with valid schema defaults, status, priority, and atomic outbox create event', async () => {
      const task = await tasksService.createTask({
        title: 'Implement Dexie task storage',
        description: 'Store tasks with atomic outbox records.',
        priority: 'high',
        status: 'todo',
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Implement Dexie task storage');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('todo');
      expect(task.isCompleted).toBe(false);
      expect(task.completedAt).toBeNull();
      expect(task.version).toBe(1);
      expect(task.syncStatus).toBe('pending');

      const outbox = await db.outbox.where('entityId').equals(task.id).toArray();
      expect(outbox.length).toBe(1);
      expect(outbox[0].action).toBe('create');
      expect(outbox[0].entityType).toBe('task');
    });

    it('updates task properties, increments version, and logs outbox update event', async () => {
      const task = await tasksService.createTask({
        title: 'Initial Task Title',
        priority: 'low',
      });

      const updated = await tasksService.updateTask(task.id, {
        title: 'Updated Task Title',
        priority: 'urgent',
      });

      expect(updated.title).toBe('Updated Task Title');
      expect(updated.priority).toBe('urgent');
      expect(updated.version).toBe(2);

      const outbox = await db.outbox.where('entityId').equals(task.id).sortBy('timestamp');
      expect(outbox.length).toBe(2);
      expect(outbox[1].action).toBe('update');
    });

    it('persists a reordered subtask checklist without changing its items', async () => {
      const task = await tasksService.createTask({
        title: 'Reorder checklist',
        subtasks: [
          { id: 'first', title: 'First item', isCompleted: true },
          { id: 'second', title: 'Second item', isCompleted: false },
          { id: 'third', title: 'Third item', isCompleted: false },
        ],
      });

      await tasksService.updateTask(task.id, {
        subtasks: [task.subtasks![2], task.subtasks![0], task.subtasks![1]],
      });

      const reopenedTask = await tasksService.getTaskById(task.id);
      expect(reopenedTask?.subtasks?.map((subtask) => subtask.id)).toEqual([
        'third',
        'first',
        'second',
      ]);
      expect(reopenedTask?.subtasks?.[1]).toEqual({
        id: 'first',
        title: 'First item',
        isCompleted: true,
      });
    });
  });

  describe('Status Transitions & Completion Timestamps', () => {
    it('automatically marks isCompleted true and records completedAt when transitioning status to completed', async () => {
      const task = await tasksService.createTask({
        title: 'Kanban status move test',
        status: 'todo',
      });

      expect(task.isCompleted).toBe(false);
      expect(task.completedAt).toBeNull();

      // Transition to completed (e.g. Kanban move)
      const completedTask = await tasksService.updateTaskStatus(task.id, 'completed');

      expect(completedTask.status).toBe('completed');
      expect(completedTask.isCompleted).toBe(true);
      expect(completedTask.completedAt).toBeTypeOf('number');
    });

    it('unsets isCompleted and completedAt when moving out of completed status back to in_progress or todo', async () => {
      const task = await tasksService.createTask({
        title: 'Reopen task',
        status: 'completed',
      });

      expect(task.isCompleted).toBe(true);
      expect(task.completedAt).toBeTypeOf('number');

      // Move back to in_progress
      const reopenedTask = await tasksService.updateTaskStatus(task.id, 'in_progress');

      expect(reopenedTask.status).toBe('in_progress');
      expect(reopenedTask.isCompleted).toBe(false);
      expect(reopenedTask.completedAt).toBeNull();
    });

    it('toggles completion using toggleCompletion shortcut', async () => {
      const task = await tasksService.createTask({
        title: 'Toggle completion',
      });

      const isCompleted = await tasksService.toggleCompletion(task.id);
      expect(isCompleted).toBe(true);

      const stored = (await db.tasks.get(task.id))!;
      expect(stored.isCompleted).toBe(true);
      expect(stored.status).toBe('completed');
      expect(stored.completedAt).toBeTypeOf('number');
    });

    it('reopens a completed task and records the change in the outbox', async () => {
      const task = await tasksService.createTask({
        title: 'Reopen with confirmation',
        status: 'completed',
      });

      const reopenedTask = await tasksService.updateTask(task.id, { isCompleted: false });

      expect(reopenedTask.status).toBe('todo');
      expect(reopenedTask.isCompleted).toBe(false);
      expect(reopenedTask.completedAt).toBeNull();
      expect((await tasksService.getTasks({ includeCompleted: false })).some((item) => item.id === task.id))
        .toBe(true);
      expect(await db.outbox.where('entityId').equals(task.id).toArray()).toHaveLength(2);
    });

    it('completes tasks in All Tasks while excluding them from active-only queries', async () => {
      const task = await tasksService.createTask({ title: 'Confirm task completion' });

      const completedTask = await tasksService.updateTask(task.id, { isCompleted: true });

      expect(completedTask.status).toBe('completed');
      expect(completedTask.isCompleted).toBe(true);
      expect((await tasksService.getTasks()).some((item) => item.id === task.id)).toBe(true);
      expect(
        (await tasksService.getTasks({ includeCompleted: false })).some((item) => item.id === task.id)
      ).toBe(false);
      expect((await db.outbox.where('entityId').equals(task.id).toArray())).toHaveLength(2);
      expect((await dashboardService.getMetrics()).completedTasks).toBe(1);
    });

    it('allows completion when every subtask is already complete', async () => {
      const task = await tasksService.createTask({
        title: 'All subtasks complete',
        subtasks: [
          { id: 'login', title: 'Implement login', isCompleted: true },
          { id: 'tests', title: 'Add tests', isCompleted: true },
        ],
      });

      const completedTask = await tasksService.updateTask(task.id, { isCompleted: true });

      expect(completedTask.isCompleted).toBe(true);
      expect(completedTask.status).toBe('completed');
      expect((await dashboardService.getMetrics()).completedTasks).toBe(1);
    });

    it.each([1, 2])(
      'rejects completion with %i incomplete subtasks without writing an outbox event',
      async (incompleteCount) => {
        const subtasks = Array.from({ length: 3 }, (_, index) => ({
          id: `subtask-${index}`,
          title: `Subtask ${index + 1}`,
          isCompleted: index >= incompleteCount,
        }));
        const task = await tasksService.createTask({
          title: `${incompleteCount} incomplete subtasks`,
          subtasks,
        });
        const subtaskLabel = incompleteCount === 1 ? 'subtask' : 'subtasks';

        await expect(tasksService.updateTask(task.id, { isCompleted: true })).rejects.toThrow(
          `(${incompleteCount} incomplete ${subtaskLabel}.)`
        );

        expect(await db.tasks.get(task.id)).toMatchObject({
          isCompleted: false,
          status: 'todo',
          completedAt: null,
          version: 1,
        });
        expect(await db.outbox.where('entityId').equals(task.id).toArray()).toHaveLength(1);
      }
    );

    it('allows retrying completion after all subtasks are completed', async () => {
      const task = await tasksService.createTask({
        title: 'Retry parent completion',
        subtasks: [
          { id: 'first', title: 'First', isCompleted: false },
          { id: 'second', title: 'Second', isCompleted: false },
        ],
      });

      await expect(tasksService.updateTask(task.id, { isCompleted: true })).rejects.toThrow(
        'Complete all subtasks before marking this task as completed.'
      );
      await tasksService.updateTask(task.id, {
        subtasks: (task.subtasks ?? []).map((subtask) => ({ ...subtask, isCompleted: true })),
      });
      const completedTask = await tasksService.updateTask(task.id, { isCompleted: true });

      expect(completedTask.isCompleted).toBe(true);
      expect(completedTask.subtasks?.every((subtask) => subtask.isCompleted)).toBe(true);
      expect(await db.outbox.where('entityId').equals(task.id).toArray()).toHaveLength(3);
    });

    it('serializes subtask edits against parent completion to preserve the invariant', async () => {
      const task = await tasksService.createTask({
        title: 'Concurrent parent update',
        subtasks: [{ id: 'required', title: 'Required work', isCompleted: true }],
      });

      const results = await Promise.allSettled([
        tasksService.updateTask(task.id, { isCompleted: true }),
        tasksService.updateTask(task.id, {
          subtasks: [{ id: 'required', title: 'Required work', isCompleted: false }],
        }),
      ]);
      const stored = await db.tasks.get(task.id);

      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(stored?.isCompleted && stored.subtasks?.some((subtask) => !subtask.isCompleted)).toBe(false);
      expect(await db.outbox.where('entityId').equals(task.id).toArray()).toHaveLength(2);
    });

    it('rejects creating an already-completed task with incomplete subtasks', async () => {
      await expect(
        tasksService.createTask({
          title: 'Invalid completed parent',
          status: 'completed',
          subtasks: [{ id: 'pending', title: 'Pending work', isCompleted: false }],
        })
      ).rejects.toThrow('Complete all subtasks before marking this task as completed.');

      expect(await db.tasks.count()).toBe(0);
      expect(await db.outbox.count()).toBe(0);
    });

    it('preserves task state and outbox when recording completion fails', async () => {
      const task = await tasksService.createTask({ title: 'Completion transaction failure' });
      const createOperationSpy = vi
        .spyOn(outboxService, 'createOperationRecord')
        .mockRejectedValue(new Error('Outbox write failed'));

      try {
        await expect(tasksService.updateTask(task.id, { isCompleted: true })).rejects.toThrow(
          'Outbox write failed'
        );
      } finally {
        createOperationSpy.mockRestore();
      }

      expect(await db.tasks.get(task.id)).toMatchObject({
        isCompleted: false,
        status: 'todo',
        version: 1,
      });
      expect(await db.outbox.where('entityId').equals(task.id).toArray()).toHaveLength(1);
    });
  });

  describe('Date Calculations & Timezone Boundaries (Today, Upcoming, Overdue)', () => {
    it('correctly categorizes tasks into Today, Upcoming, and Overdue based on local calendar dates', async () => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

      const yesterdayTs = startOfToday - 86400000 + 3600000; // yesterday noon
      const todayTs = startOfToday + 3600000; // today 1:00 AM
      const tomorrowTs = endOfToday + 3600000; // tomorrow 1:00 AM

      // 1. Overdue task (due yesterday, not completed)
      const overdueTask = await tasksService.createTask({
        title: 'Overdue task',
        dueDate: yesterdayTs,
      });

      // 2. Today task (due today)
      const todayTask = await tasksService.createTask({
        title: 'Today task',
        dueDate: todayTs,
      });

      // 3. Upcoming task (due tomorrow)
      const upcomingTask = await tasksService.createTask({
        title: 'Upcoming task',
        dueDate: tomorrowTs,
      });

      // 4. Unscheduled task (no due date)
      const unscheduledTask = await tasksService.createTask({
        title: 'Unscheduled task',
        dueDate: null,
      });

      // Query Overdue
      const overdueList = await tasksService.getTasks({ dateFilter: 'overdue' });
      expect(overdueList.map((t) => t.id)).toEqual([overdueTask.id]);

      // Query Today
      const todayList = await tasksService.getTasks({ dateFilter: 'today' });
      expect(todayList.map((t) => t.id)).toEqual([todayTask.id]);

      // Query Upcoming
      const upcomingList = await tasksService.getTasks({ dateFilter: 'upcoming' });
      expect(upcomingList.map((t) => t.id)).toEqual([upcomingTask.id]);

      // Verify unscheduled task is excluded from all date-filtered queries
      expect(overdueList.some((t) => t.id === unscheduledTask.id)).toBe(false);
      expect(todayList.some((t) => t.id === unscheduledTask.id)).toBe(false);
      expect(upcomingList.some((t) => t.id === unscheduledTask.id)).toBe(false);

      // Verify unscheduled task is returned in All Tasks query
      const allTasks = await tasksService.getTasks();
      expect(allTasks.some((t) => t.id === unscheduledTask.id)).toBe(true);
    });

    it('filters scheduled tasks by a selected local date, including completed tasks but excluding undated tasks', async () => {
      const selectedDate = new Date(2026, 2, 8, 12);
      const startOfSelectedDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      ).getTime();
      const endOfSelectedDate =
        new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate() + 1
        ).getTime() - 1;
      const beforeDate = await tasksService.createTask({
        title: 'Due before selected date',
        dueDate: startOfSelectedDate - 1,
      });
      const startsOnDate = await tasksService.createTask({
        title: 'Due at start of selected date',
        dueDate: startOfSelectedDate,
      });
      const endsOnDate = await tasksService.createTask({
        title: 'Completed on selected date',
        dueDate: endOfSelectedDate,
        status: 'completed',
      });
      const afterDate = await tasksService.createTask({
        title: 'Due after selected date',
        dueDate: endOfSelectedDate + 1,
      });
      const undated = await tasksService.createTask({ title: 'No scheduled date' });

      const scheduledTasks = await tasksService.getTasks({ scheduledDate: startOfSelectedDate });

      expect(scheduledTasks.map((task) => task.id)).toEqual(
        expect.arrayContaining([startsOnDate.id, endsOnDate.id])
      );
      expect(scheduledTasks).toHaveLength(2);
      expect(scheduledTasks.map((task) => task.id)).not.toEqual(
        expect.arrayContaining([beforeDate.id, afterDate.id, undated.id])
      );
    });
  });

  describe('Soft Deletion & Recovery', () => {
    it('soft deletes a task, preserving the record and removing it from active queries', async () => {
      const task = await tasksService.createTask({
        title: 'Soft delete task',
      });

      await tasksService.softDeleteTask(task.id);

      // Raw IndexedDB record preserved with deletedAt timestamp
      const rawStored = await db.tasks.get(task.id);
      expect(rawStored).toBeDefined();
      expect(rawStored?.deletedAt).toBeTypeOf('number');

      // Excluded from standard getTasks query
      const activeTasks = await tasksService.getTasks();
      expect(activeTasks.some((t) => t.id === task.id)).toBe(false);

      // Outbox delete record logged
      const outbox = await db.outbox.where('entityId').equals(task.id).sortBy('timestamp');
      expect(outbox.length).toBe(2);
      expect(outbox[1].action).toBe('delete');
    });

    it('restores a soft-deleted task, setting deletedAt back to null', async () => {
      const task = await tasksService.createTask({
        title: 'Accidentally deleted task',
      });

      await tasksService.softDeleteTask(task.id);
      expect((await db.tasks.get(task.id))?.deletedAt).not.toBeNull();

      const restored = await tasksService.restoreTask(task.id);
      expect(restored.deletedAt).toBeNull();
      expect(restored.version).toBe(3);

      const activeTasks = await tasksService.getTasks();
      expect(activeTasks.some((t) => t.id === task.id)).toBe(true);
    });
  });

  describe('Dashboard Service Metrics Accuracy', () => {
    it('accurately computes metrics from IndexedDB task and note records', async () => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

      // Seed notes
      await notesService.createNote({ title: 'Note 1' });
      await notesService.createNote({ title: 'Note 2' });

      // Seed tasks
      // 1. Completed task
      await tasksService.createTask({
        title: 'Done task',
        status: 'completed',
      });

      // 2. Urgent pending task
      await tasksService.createTask({
        title: 'Urgent pending',
        priority: 'urgent',
        status: 'todo',
      });

      // 3. Overdue task
      await tasksService.createTask({
        title: 'Overdue task',
        dueDate: startOfToday - 86400000 + 3600000,
        status: 'todo',
      });

      // 4. Upcoming deadline task (next 3 days)
      await tasksService.createTask({
        title: 'Upcoming task',
        dueDate: endOfToday + 86400000 * 2,
        status: 'todo',
      });

      const metrics = await dashboardService.getMetrics();

      expect(metrics.totalNotes).toBe(2);
      expect(metrics.totalTasks).toBe(4);
      expect(metrics.completedTasks).toBe(1);
      expect(metrics.pendingTasks).toBe(3);
      expect(metrics.overdueTasks).toBe(1);
      expect(metrics.completionRate).toBe(25); // 1 out of 4 = 25%
      expect(metrics.urgentPendingTasks.length).toBe(1);
      expect(metrics.upcomingDeadlines.length).toBe(1);
      expect(metrics.recentNotes.length).toBe(2);
    });

    it('excludes archived and trashed records and counts upcoming tasks by local calendar date', async () => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      await notesService.createNote({ title: 'Active note' });
      await notesService.createNote({ title: 'Archived note', isArchived: true });
      const trashedNote = await notesService.createNote({ title: 'Trashed note' });
      await notesService.softDeleteNote(trashedNote.id);

      await tasksService.createTask({
        title: 'Due today',
        dueDate: startOfToday + 12 * 60 * 60 * 1000,
      });
      await tasksService.createTask({
        title: 'Due within seven days',
        dueDate: startOfToday + 7 * 86400000 + 12 * 60 * 60 * 1000,
      });
      await tasksService.createTask({
        title: 'Due after seven days',
        dueDate: startOfToday + 8 * 86400000,
      });
      const trashedTask = await tasksService.createTask({ title: 'Trashed task' });
      await tasksService.softDeleteTask(trashedTask.id);

      const metrics = await dashboardService.getMetrics();

      expect(metrics.totalNotes).toBe(1);
      expect(metrics.totalTasks).toBe(3);
      expect(metrics.upcomingDeadlines.map((task) => task.title)).toEqual([
        'Due today',
        'Due within seven days',
      ]);
    });

    it('reflects task completion and note edits in fresh dashboard metrics', async () => {
      const task = await tasksService.createTask({ title: 'Update dashboard metrics' });
      const note = await notesService.createNote({ title: 'Initial dashboard note' });

      const beforeCompletion = await dashboardService.getMetrics();
      expect(beforeCompletion.pendingTasks).toBe(1);
      expect(beforeCompletion.completedTasks).toBe(0);
      expect(beforeCompletion.recentNotes[0].title).toBe('Initial dashboard note');

      await tasksService.toggleCompletion(task.id);
      await notesService.updateNote(note.id, { title: 'Edited dashboard note' });

      const afterUpdates = await dashboardService.getMetrics();
      expect(afterUpdates.pendingTasks).toBe(0);
      expect(afterUpdates.completedTasks).toBe(1);
      expect(afterUpdates.completionRate).toBe(100);
      expect(afterUpdates.recentNotes[0].title).toBe('Edited dashboard note');
    });

    it('builds chart data from actual, non-trashed task timestamps', async () => {
      const completedTask = await tasksService.createTask({
        title: 'Completed task',
        status: 'completed',
      });
      const trashedTask = await tasksService.createTask({
        title: 'Trashed completion',
        status: 'completed',
      });
      await tasksService.softDeleteTask(trashedTask.id);

      const tasks = await db.tasks.toArray();
      const now = new Date();
      const performance = dashboardService.getTaskPerformance(tasks, 7, now);
      const todayPerformance = performance.find(
        (point) =>
          point.date.getFullYear() === now.getFullYear() &&
          point.date.getMonth() === now.getMonth() &&
          point.date.getDate() === now.getDate()
      );

      expect(todayPerformance).toMatchObject({ created: 1, completed: 1 });
      expect((await db.tasks.get(completedTask.id))?.isCompleted).toBe(true);
    });

    it('returns unique dated tasks due on the selected local day, including completed tasks', async () => {
      const selectedDate = new Date(2025, 5, 12);
      const startOfSelectedDate = selectedDate.getTime();
      const endOfSelectedDate = new Date(2025, 5, 12, 23, 59, 59, 999).getTime();
      const dueAtStart = await tasksService.createTask({
        title: 'Due at start of day',
        dueDate: startOfSelectedDate,
      });
      const dueAtEnd = await tasksService.createTask({
        title: 'Completed due at end of day',
        status: 'completed',
        dueDate: endOfSelectedDate,
      });
      const dueNextDay = await tasksService.createTask({
        title: 'Due next day',
        dueDate: new Date(2025, 5, 13).getTime(),
      });
      const noDeadline = await tasksService.createTask({ title: 'No deadline' });
      const trashedDueTask = await tasksService.createTask({
        title: 'Trashed due task',
        dueDate: startOfSelectedDate,
      });
      await tasksService.softDeleteTask(trashedDueTask.id);

      const tasks = await db.tasks.toArray();
      const dueOnDate = dashboardService.getTasksDueOnDate([...tasks, dueAtStart], selectedDate);

      expect(dueOnDate.map((task) => task.id)).toEqual(
        expect.arrayContaining([dueAtStart.id, dueAtEnd.id])
      );
      expect(dueOnDate.map((task) => task.id)).not.toContain(dueNextDay.id);
      expect(dueOnDate.map((task) => task.id)).not.toContain(noDeadline.id);
      expect(dueOnDate.map((task) => task.id)).not.toContain(trashedDueTask.id);
    });

    it('surfaces archive actions from the currently retained local operations', async () => {
      const note = await notesService.createNote({ title: 'Reference note' });
      await notesService.toggleArchive(note.id);

      const operations = await db.outbox.orderBy('timestamp').reverse().toArray();
      const activity = dashboardService.getRecentActivity(
        operations,
        await db.notes.toArray(),
        await db.tasks.toArray()
      );

      expect(activity[0]).toMatchObject({
        title: 'Note archived',
        itemTitle: 'Reference note',
        entityId: note.id,
      });
    });
  });
});
