import Dexie, { type Table } from 'dexie';
import { registerMigrations } from './migrations';
import { DATABASE_NAME } from './schema';
import { seedDatabase } from './seed';
import type { AppSetting, Conflict, Folder, Note, SyncOperation, Tag, Task } from '../types';

export interface DatabaseHealthResult {
  status: 'healthy' | 'degraded' | 'error';
  databaseName: string;
  version: number;
  isOpen: boolean;
  tables: {
    notes: number;
    tasks: number;
    folders: number;
    tags: number;
    syncOperations: number;
    conflicts: number;
    settings: number;
  };
  diagnostics?: string;
}

export class DaymarkDatabase extends Dexie {
  notes!: Table<Note, string>;
  tasks!: Table<Task, string>;
  folders!: Table<Folder, string>;
  tags!: Table<Tag, string>;
  syncOperations!: Table<SyncOperation, string>;
  outbox!: Table<SyncOperation, string>; // Backwards-compatible alias
  conflicts!: Table<Conflict, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super(DATABASE_NAME);

    // Apply versioned migrations registry
    registerMigrations(this);

    // Populate initial default data on database creation
    this.on('populate', () => {
      // Use internal promise to seed
      this.seedInitialData();
    });
  }

  /**
   * Internal initial populate handler
   */
  async seedInitialData(): Promise<void> {
    await seedDatabase(this, { force: false });
  }

  /**
   * Diagnostic health check verifying stores, indexes, and connection status
   */
  async checkDatabaseHealth(): Promise<DatabaseHealthResult> {
    try {
      if (!this.isOpen()) {
        await this.open();
      }

      const [notes, tasks, folders, tags, syncOps, conflicts, settings] = await Promise.all([
        this.notes.count(),
        this.tasks.count(),
        this.folders.count(),
        this.tags.count(),
        this.syncOperations.count().catch(() => 0),
        this.conflicts.count().catch(() => 0),
        this.settings.count().catch(() => 0),
      ]);

      return {
        status: 'healthy',
        databaseName: this.name,
        version: this.verno,
        isOpen: this.isOpen(),
        tables: {
          notes,
          tasks,
          folders,
          tags,
          syncOperations: syncOps,
          conflicts,
          settings,
        },
      };
    } catch (err: unknown) {
      return {
        status: 'error',
        databaseName: this.name,
        version: this.verno,
        isOpen: this.isOpen(),
        tables: {
          notes: 0,
          tasks: 0,
          folders: 0,
          tags: 0,
          syncOperations: 0,
          conflicts: 0,
          settings: 0,
        },
        diagnostics: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Query helper returning only active (non-soft-deleted) notes
   */
  async getActiveNotes(): Promise<Note[]> {
    return this.notes.filter((n) => n.deletedAt === null).toArray();
  }

  /**
   * Query helper returning only active (non-soft-deleted) tasks
   */
  async getActiveTasks(): Promise<Task[]> {
    return this.tasks.filter((t) => t.deletedAt === null).toArray();
  }

  /**
   * Query helper returning only active (non-soft-deleted) folders
   */
  async getActiveFolders(): Promise<Folder[]> {
    return this.folders.filter((f) => f.deletedAt === null).toArray();
  }
}

// Export canonical database singleton instance
export const db = new DaymarkDatabase();
