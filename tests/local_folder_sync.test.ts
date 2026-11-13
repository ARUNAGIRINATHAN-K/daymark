import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
}

import { db } from '../src/db/database';
import { resetDatabase } from '../src/db/seed';
import { notesService } from '../src/services/notes.service';
import {
  isLocalFolderSyncSupported,
  LOCAL_FOLDER_FILE_NAME,
  LocalFolderSyncAdapter,
  type FileSystemDirectoryHandleLike,
  type FileSystemFileHandleLike,
} from '../src/sync/adapters/localFolderAdapter';
import { decryptText, encryptText, LOCAL_FOLDER_ENVELOPE_FORMAT } from '../src/sync/adapters/localFolderCrypto';
import type { PushOperation } from '../src/sync/types';

function createMockDirectory(name = 'daymark-test') {
  const files = new Map<string, string>();
  let permission: PermissionState = 'granted';
  const makeFileHandle = (fileName: string): FileSystemFileHandleLike => ({
    kind: 'file',
    getFile: async () => new File([files.get(fileName) ?? ''], fileName),
    createWritable: async () => {
      const chunks: string[] = [];
      return {
        write: async (data: string) => { chunks.push(data); },
        close: async () => { files.set(fileName, chunks.join('')); },
      };
    },
  });
  const directory: FileSystemDirectoryHandleLike = {
    kind: 'directory',
    name,
    getFileHandle: async (fileName: string, options?: { create?: boolean }) => {
      if (!files.has(fileName)) {
        if (options?.create) files.set(fileName, '');
        else throw new DOMException('File not found', 'NotFoundError');
      }
      return makeFileHandle(fileName);
    },
    removeEntry: async (fileName: string) => {
      if (!files.delete(fileName)) throw new DOMException('File not found', 'NotFoundError');
    },
    queryPermission: async () => permission,
    requestPermission: async () => permission,
  };
  return {
    directory,
    files,
    setPermission: (next: PermissionState) => { permission = next; },
  };
}

describe('local folder encryption envelope', () => {
  it('round-trips plaintext and never embeds it in the envelope', async () => {
    const secret = 'note with sensitive ✨ content';
    const envelope = await encryptText('correct horse', secret);
    expect(envelope).not.toContain(secret);
    const parsed = JSON.parse(envelope);
    expect(parsed.format).toBe(LOCAL_FOLDER_ENVELOPE_FORMAT);
    expect(await decryptText('correct horse', envelope)).toBe(secret);
  });

  it('uses a fresh salt and IV per encryption', async () => {
    const first = JSON.parse(await encryptText('pw', 'same'));
    const second = JSON.parse(await encryptText('pw', 'same'));
    expect(first.kdf.salt).not.toBe(second.kdf.salt);
    expect(first.cipher.iv).not.toBe(second.cipher.iv);
    expect(first.data).not.toBe(second.data);
  });

  it('rejects a wrong passphrase and tampered ciphertext', async () => {
    const envelope = await encryptText('right', 'payload');
    await expect(decryptText('wrong', envelope)).rejects.toThrow('Could not decrypt');
    const tampered = JSON.parse(envelope);
    tampered.data = tampered.data.slice(0, -4) + 'AAAA';
    await expect(decryptText('right', JSON.stringify(tampered))).rejects.toThrow('Could not decrypt');
  });

  it('rejects files that are not supported envelopes', async () => {
    await expect(decryptText('pw', 'not json')).rejects.toThrow('not valid JSON');
    await expect(decryptText('pw', JSON.stringify({ format: 'other', version: 1 }))).rejects.toThrow('not a supported Daymark encrypted backup');
  });

  it('requires a passphrase', async () => {
    await expect(encryptText('', 'x')).rejects.toThrow('passphrase is required');
  });
});

describe('LocalFolderSyncAdapter', () => {
  beforeEach(async () => {
    await resetDatabase(db);
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        get length() { return values.size; },
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, String(value)); },
        removeItem: (key: string) => { values.delete(key); },
        clear: () => values.clear(),
        key: (index: number) => Array.from(values.keys())[index] ?? null,
      } satisfies Storage,
    });
    localStorage.clear();
  });

  it('reports unsupported browsers without a window', () => {
    expect(isLocalFolderSyncSupported()).toBe(false);
  });

  it('is unconfigured until a folder and passphrase are attached', async () => {
    const adapter = new LocalFolderSyncAdapter();
    expect(adapter.getStatus().configured).toBe(false);
    const push = await adapter.pushOperations([]);
    expect(push.configured).toBe(false);
    const pull = await adapter.pullChanges();
    expect(pull.configured).toBe(false);
  });

  it('push writes an encrypted backup file and acknowledges operations with a revision', async () => {
    const note = await notesService.createNote({ title: 'Secret note ✨', content: '# hidden' });
    const operation = await db.outbox.where('entityId').equals(note.id).first();
    const pushOperation: PushOperation = { ...operation!, expectedRemoteRevision: null };

    const { directory, files } = createMockDirectory();
    const adapter = new LocalFolderSyncAdapter();
    const status = await adapter.attach(directory, 'pw');
    expect(status.configured).toBe(true);

    const result = await adapter.pushOperations([pushOperation]);
    if (!result.configured) throw new Error('expected configured push');
    expect(result.acknowledgements).toHaveLength(1);
    expect(result.acknowledgements[0].idempotencyKey).toBe(operation!.id);
    expect(result.acknowledgements[0].acknowledged).toBe(true);
    expect(result.acknowledgements[0].remoteRevision).toMatch(/^[0-9a-f]{64}$/);

    const written = files.get(LOCAL_FOLDER_FILE_NAME);
    expect(written).toBeDefined();
    expect(written).not.toContain('Secret note');
    expect(await decryptText('pw', written!)).toContain('Secret note');
  });

  it('pull returns an empty change set for an empty folder and dedupes by cursor', async () => {
    const note = await notesService.createNote({ title: 'Local only' });
    const { directory } = createMockDirectory();
    const adapter = new LocalFolderSyncAdapter(directory, 'pw');
    const empty = await adapter.pullChanges();
    if (!empty.configured) throw new Error('expected configured pull');
    expect(empty.changes).toEqual([]);
    expect(empty.cursor).toBeNull();

    const writer = new LocalFolderSyncAdapter(directory, 'pw');
    await writer.pushOperations([]);
    await notesService.updateNote(note.id, { title: 'Changed locally' });

    const first = await adapter.pullChanges();
    if (!first.configured) throw new Error('expected configured pull');
    const change = first.changes.find((item) => item.entityId === note.id);
    expect(change?.action).toBe('update');
    const second = await adapter.pullChanges(first.cursor);
    if (!second.configured) throw new Error('expected configured pull');
    expect(second.changes).toEqual([]);
    expect(second.cursor).toBe(first.cursor);
  });

  it('pull reports remote-only entities as create changes with revision lineage', async () => {
    const remote = createMockDirectory('remote');
    const writer = new LocalFolderSyncAdapter(remote.directory, 'pw');
    const note = await notesService.createNote({ title: 'Remote note', content: 'body' });
    await writer.pushOperations([]);

    await db.notes.delete(note.id);
    const reader = new LocalFolderSyncAdapter(remote.directory, 'pw');
    const result = await reader.pullChanges();
    if (!result.configured) throw new Error('expected configured pull');
    const change = result.changes.find((item) => item.entityId === note.id);
    expect(change).toBeDefined();
    expect(change?.entityType).toBe('note');
    expect(change?.action).toBe('create');
    expect(change?.remoteRevision).toBe(result.cursor);
    expect(change?.baseRemoteRevision).toBeNull();
  });

  it('fails clearly when folder permission is revoked', async () => {
    const { directory, setPermission } = createMockDirectory();
    const adapter = new LocalFolderSyncAdapter(directory, 'pw');
    setPermission('denied');
    await expect(adapter.pushOperations([])).rejects.toThrow('revoked');
    await expect(adapter.pullChanges()).rejects.toThrow('revoked');
  });

  it('fails clearly on a corrupted or wrong-passphrase folder file without touching local data', async () => {
    const { directory, files } = createMockDirectory();
    files.set(LOCAL_FOLDER_FILE_NAME, '{"format":"daymark-local-folder","version":1}');
    const adapter = new LocalFolderSyncAdapter(directory, 'pw');
    await expect(adapter.pullChanges()).rejects.toThrow('not a supported Daymark encrypted backup');

    const writer = new LocalFolderSyncAdapter(directory, 'right');
    await notesService.createNote({ title: 'Keep me' });
    await writer.pushOperations([]);
    const reader = new LocalFolderSyncAdapter(directory, 'wrong');
    await expect(reader.pullChanges()).rejects.toThrow('Could not decrypt');
    expect((await db.notes.toArray()).map((note) => note.title)).toContain('Keep me');
  });

  it('recovers the snapshot from the temp file when the final file is missing', async () => {
    const { directory, files } = createMockDirectory();
    const writer = new LocalFolderSyncAdapter(directory, 'pw');
    const note = await notesService.createNote({ title: 'Tmp note' });
    await writer.pushOperations([]);
    const envelope = files.get(LOCAL_FOLDER_FILE_NAME)!;
    files.delete(LOCAL_FOLDER_FILE_NAME);
    files.set(`${LOCAL_FOLDER_FILE_NAME}.tmp`, envelope);
    await db.notes.delete(note.id);

    const reader = new LocalFolderSyncAdapter(directory, 'pw');
    const result = await reader.pullChanges();
    if (!result.configured) throw new Error('expected configured pull');
    expect(result.changes.some((change) => change.entityId === note.id)).toBe(true);
  });
});
