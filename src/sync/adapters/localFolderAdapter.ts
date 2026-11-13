import { db } from '../../db/database';
import { backupService } from '../../services/backup.service';
import type {
  PullChangesResult,
  PushOperation,
  PushOperationsResult,
  RemoteChange,
  SyncAdapter,
  SyncAdapterStatus,
} from '../types';
import { decryptText, encryptText } from './localFolderCrypto';

export const LOCAL_FOLDER_FILE_NAME = 'daymark-sync.json.enc';
const LOCAL_FOLDER_TMP_FILE_NAME = `${LOCAL_FOLDER_FILE_NAME}.tmp`;

export const LOCAL_FOLDER_UNSUPPORTED_MESSAGE =
  'This browser does not support the File System Access API, so a local folder cannot be used. ' +
  'Use the Download Backup button above to save an encrypted-free JSON backup manually instead; nothing is uploaded anywhere.';

export function isLocalFolderSyncSupported(): boolean {
  return typeof window !== 'undefined' &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

export interface FileSystemWritableFileStreamLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

export interface FileSystemFileHandleLike {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

export interface FileSystemDirectoryHandleLike {
  kind: 'directory';
  name?: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>;
  removeEntry(name: string): Promise<void>;
  queryPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

async function pickDirectory(): Promise<FileSystemDirectoryHandleLike> {
  const picker = (window as unknown as {
    showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandleLike>;
  }).showDirectoryPicker;
  return picker.call(window, { id: 'daymark-local-sync', mode: 'readwrite' });
}

async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

interface RemoteSnapshot {
  notes: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  folders: Array<Record<string, unknown>>;
}

function parseSnapshot(json: string): RemoteSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('The decrypted local folder backup is not valid JSON.');
  }
  const data = (parsed as { data?: unknown } | null)?.data;
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : null;
  if (!record || !Array.isArray(record.notes) || !Array.isArray(record.tasks) || !Array.isArray(record.folders)) {
    throw new Error('The decrypted file is not a supported Daymark backup snapshot.');
  }
  return record as unknown as RemoteSnapshot;
}

/**
 * Local-folder backup adapter. The user explicitly picks a folder via the File
 * System Access API; every push writes a full backup encrypted with
 * AES-256-GCM (PBKDF2-SHA-256 key from a user passphrase) as a single file.
 * Pulls diff the remote snapshot against the local database and report
 * creates/updates through the standard SyncAdapter contract. Deletes are never
 * inferred from a folder snapshot, so a partial folder cannot wipe local data.
 */
export class LocalFolderSyncAdapter implements SyncAdapter {
  private directory: FileSystemDirectoryHandleLike | null;
  private passphrase: string | null;

  constructor(directory: FileSystemDirectoryHandleLike | null = null, passphrase: string | null = null) {
    this.directory = directory;
    this.passphrase = passphrase;
  }

  async selectFolder(passphrase: string): Promise<SyncAdapterStatus> {
    if (!passphrase) {
      throw new Error('Enter a passphrase first; the folder backup is encrypted with it and never written as plaintext.');
    }
    if (!isLocalFolderSyncSupported()) {
      return { configured: false, message: LOCAL_FOLDER_UNSUPPORTED_MESSAGE };
    }
    let directory: FileSystemDirectoryHandleLike;
    try {
      directory = await pickDirectory();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { configured: false, message: 'Folder selection was cancelled; no folder was connected.' };
      }
      throw error;
    }
    return this.attach(directory, passphrase);
  }

  async attach(directory: FileSystemDirectoryHandleLike, passphrase: string): Promise<SyncAdapterStatus> {
    if (!passphrase) {
      throw new Error('A passphrase is required; the folder backup is never written as plaintext.');
    }
    await this.ensurePermission(directory);
    this.directory = directory;
    this.passphrase = passphrase;
    return this.getStatus();
  }

  getStatus(): SyncAdapterStatus {
    if (!this.directory || !this.passphrase) {
      return {
        configured: false,
        message: 'No local folder selected. Choose a folder and enter a passphrase to enable encrypted local-folder backup.',
      };
    }
    return {
      configured: true,
      message: `Encrypted backups (AES-256-GCM) are written to “${this.directory.name ?? 'the selected folder'}” as ${LOCAL_FOLDER_FILE_NAME}.`,
    };
  }

  private async ensurePermission(directory: FileSystemDirectoryHandleLike | null = this.directory): Promise<void> {
    if (!directory) throw new Error('No local folder is configured.');
    if (directory.queryPermission) {
      const state = await directory.queryPermission({ mode: 'readwrite' });
      if (state === 'granted') return;
    }
    if (directory.requestPermission) {
      const state = await directory.requestPermission({ mode: 'readwrite' });
      if (state === 'granted') return;
    }
    throw new Error('Permission for the selected folder was revoked. Choose the folder again to re-authorize access.');
  }

  async pushOperations(operations: PushOperation[]): Promise<PushOperationsResult> {
    const status = this.getStatus();
    if (!status.configured || !this.directory || !this.passphrase) {
      return { configured: false, message: status.message };
    }
    await this.ensurePermission();
    const json = await backupService.createBackupJson();
    const envelope = await encryptText(this.passphrase, json);
    const revision = await sha256Hex(envelope);
    await this.writeEnvelope(envelope);
    return {
      configured: true,
      acknowledgements: operations.map((operation) => ({
        idempotencyKey: operation.id,
        acknowledged: true as const,
        remoteRevision: revision,
      })),
    };
  }

  private async writeEnvelope(envelope: string): Promise<void> {
    const directory = this.directory;
    if (!directory) throw new Error('No local folder is configured.');
    const tmpHandle = await directory.getFileHandle(LOCAL_FOLDER_TMP_FILE_NAME, { create: true });
    const tmpWritable = await tmpHandle.createWritable();
    await tmpWritable.write(envelope);
    await tmpWritable.close();
    const finalHandle = await directory.getFileHandle(LOCAL_FOLDER_FILE_NAME, { create: true });
    const finalWritable = await finalHandle.createWritable();
    await finalWritable.write(envelope);
    await finalWritable.close();
    await directory.removeEntry(LOCAL_FOLDER_TMP_FILE_NAME).catch(() => undefined);
  }

  private async readEnvelope(): Promise<string | null> {
    const directory = this.directory;
    if (!directory) throw new Error('No local folder is configured.');
    try {
      const handle = await directory.getFileHandle(LOCAL_FOLDER_FILE_NAME);
      return await handle.getFile().then((file) => file.text());
    } catch {
      // Final file missing or unreadable; fall back to the temp file left by an interrupted write.
    }
    try {
      const tmpHandle = await directory.getFileHandle(LOCAL_FOLDER_TMP_FILE_NAME);
      return await tmpHandle.getFile().then((file) => file.text());
    } catch {
      return null;
    }
  }

  async pullChanges(cursor?: string | null): Promise<PullChangesResult> {
    const status = this.getStatus();
    if (!status.configured || !this.directory || !this.passphrase) {
      return { configured: false, message: status.message };
    }
    await this.ensurePermission();
    const envelope = await this.readEnvelope();
    if (envelope === null) return { configured: true, changes: [], cursor: null };
    const revision = await sha256Hex(envelope);
    if (cursor === revision) return { configured: true, changes: [], cursor };
    const json = await decryptText(this.passphrase, envelope);
    const snapshot = parseSnapshot(json);
    const changes = await this.buildChanges(snapshot, cursor ?? null, revision);
    return { configured: true, changes, cursor: revision };
  }

  private async buildChanges(snapshot: RemoteSnapshot, baseRevision: string | null, revision: string): Promise<RemoteChange[]> {
    const changes: RemoteChange[] = [];
    const collections: Array<['note' | 'task' | 'folder', Array<Record<string, unknown>>]> = [
      ['note', snapshot.notes],
      ['task', snapshot.tasks],
      ['folder', snapshot.folders],
    ];
    for (const [entityType, records] of collections) {
      for (const record of records) {
        const id = typeof record.id === 'string' ? record.id : null;
        if (!id) continue;
        const table = entityType === 'note' ? db.notes : entityType === 'task' ? db.tasks : db.folders;
        const local = await table.get(id) as Record<string, unknown> | undefined;
        if (local && stableStringify(local) === stableStringify(record)) continue;
        changes.push({
          entityType,
          entityId: id,
          action: local ? 'update' : 'create',
          payload: record,
          remoteRevision: revision,
          baseRemoteRevision: baseRevision,
          timestamp: typeof record.updatedAt === 'number' ? record.updatedAt : Date.now(),
        });
      }
    }
    return changes;
  }
}
