import type { BaseEntity, UUID } from './common.types';

export interface Folder extends BaseEntity {
  name: string;
  color?: string;
  icon?: string;
  parentId?: UUID | null;
  sortOrder?: number;
}

export type CreateFolderInput = Partial<Omit<Folder, 'createdAt' | 'updatedAt' | 'deletedAt' | 'version' | 'syncStatus'>> & {
  name: string;
  id?: UUID;
};

export type UpdateFolderInput = Partial<Omit<Folder, 'id' | 'createdAt'>>;
