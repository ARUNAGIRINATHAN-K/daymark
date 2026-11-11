import type { BaseEntity, UUID } from './common.types';

export interface Note extends BaseEntity {
  title: string;
  content: string;
  folderId?: UUID | null;
  tagIds: UUID[];
  isPinned: boolean;
  isArchived: boolean;
}

export type CreateNoteInput = Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version' | 'syncStatus'>> & {
  title?: string;
  content?: string;
};

export type UpdateNoteInput = Partial<Omit<Note, 'id' | 'createdAt'>>;
