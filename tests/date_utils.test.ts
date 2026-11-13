import { describe, expect, it } from 'vitest';
import { formatExactTimestamp, formatShortDate, toDate } from '../src/utils/date.utils';

describe('date utils', () => {
  it('converts valid timestamps and Date objects to Date', () => {
    const ts = new Date(2026, 2, 12, 16, 15).getTime();
    expect(toDate(ts)).toEqual(new Date(2026, 2, 12, 16, 15));
    expect(toDate(new Date(2026, 2, 12, 16, 15))).toEqual(new Date(2026, 2, 12, 16, 15));
  });

  it('returns null for missing or invalid dates', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate(NaN)).toBeNull();
    expect(toDate(new Date('invalid'))).toBeNull();
  });

  it('formats an exact localized timestamp with date and time', () => {
    const ts = new Date(2026, 2, 12, 16, 15).getTime();
    const result = formatExactTimestamp(ts);
    expect(result).toContain('March');
    expect(result).toContain('2026');
    expect(result).toContain('4:15 PM');
  });

  it('returns null exact timestamp for missing or invalid dates', () => {
    expect(formatExactTimestamp(null)).toBeNull();
    expect(formatExactTimestamp(undefined)).toBeNull();
    expect(formatExactTimestamp(NaN)).toBeNull();
    expect(formatExactTimestamp(new Date('invalid'))).toBeNull();
  });

  it('formats a short date for the compact label', () => {
    const ts = new Date(2026, 2, 12, 16, 15).getTime();
    expect(formatShortDate(ts)).toBe('Mar 12');
  });

  it('falls back instead of throwing for invalid short dates', () => {
    expect(formatShortDate(null)).toBe('—');
    expect(formatShortDate(NaN)).toBe('—');
  });
});
