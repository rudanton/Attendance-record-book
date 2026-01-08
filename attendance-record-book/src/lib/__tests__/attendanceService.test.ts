import { describe, it, expect, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

// Stub Firebase dependencies that attendanceService pulls in but tests do not need.
vi.mock('@/firebase/config', () => ({
  db: {},
  auth: {},
}));

import { __testables } from '../attendanceService';

const { calculateWorkMinutes } = __testables;

const makeTs = (iso: string) => Timestamp.fromDate(new Date(iso));

describe('calculateWorkMinutes', () => {
  it('handles overnight night shift (22:00 -> 10:00 next day) with no breaks', () => {
    const checkIn = makeTs('2026-01-01T22:00:00+09:00');
    const checkOut = makeTs('2026-01-02T10:00:00+09:00');

    const result = calculateWorkMinutes(checkIn, checkOut, []);

    expect(result.totalWorkMinutes).toBe(12 * 60); // 12 hours
    expect(result.nightWorkMinutes).toBe(7 * 60); // 22:00-05:00
    expect(result.regularWorkMinutes).toBe(5 * 60); // 05:00-10:00
  });

  it('handles long shift with late checkout (10:00 -> 00:00 next day) with no breaks', () => {
    const checkIn = makeTs('2026-01-01T10:00:00+09:00');
    const checkOut = makeTs('2026-01-02T00:00:00+09:00');

    const result = calculateWorkMinutes(checkIn, checkOut, []);

    expect(result.totalWorkMinutes).toBe(14 * 60); // 14 hours
    expect(result.nightWorkMinutes).toBe(2 * 60); // 22:00-24:00
    expect(result.regularWorkMinutes).toBe(12 * 60); // 10:00-22:00
  });
});
