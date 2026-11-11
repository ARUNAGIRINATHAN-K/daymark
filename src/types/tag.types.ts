import type { Timestamp, UUID } from './common.types';

export interface Tag {
  id: UUID;
  name: string;
  color?: string;
  createdAt: Timestamp;
}

export type CreateTagInput = Omit<Tag, 'id' | 'createdAt'> & {
  id?: UUID;
};
