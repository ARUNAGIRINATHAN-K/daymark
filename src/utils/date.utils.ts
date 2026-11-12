import { format, isValid } from 'date-fns';
import type { Timestamp } from '../types/common.types';

export function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
}

export function formatExactTimestamp(value: Timestamp | Date | null | undefined): string | null {
  const date = toDate(value);
  if (!date) return null;
  return format(date, 'PPP · p');
}

export function formatShortDate(value: Timestamp | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, 'MMM d') : '—';
}
