import type Dexie from 'dexie';
import type { Transaction } from 'dexie';
import { DEXIE_SCHEMA_V1 } from './schema';

export interface Migration {
  version: number;
  description: string;
  stores: Record<string, string>;
  upgrade?: (tx: Transaction) => Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial canonical schema for Note, Task, Folder, Tag, SyncOperation, Conflict, and AppSetting',
    stores: DEXIE_SCHEMA_V1,
  },
];

/**
 * Applies all registered migrations to a Dexie database instance in version order
 */
export function registerMigrations(db: Dexie): void {
  for (const migration of MIGRATIONS) {
    const versionDef = db.version(migration.version).stores(migration.stores);
    if (migration.upgrade) {
      versionDef.upgrade(migration.upgrade);
    }
  }
}
