import { describe, it, expect, vi } from 'vitest';
vi.mock('@/firebase/config', () => ({ db: {}, auth: { currentUser: null } }));
import { __testables } from '../auditLogService';

const { buildChanges } = __testables as any;

describe('buildChanges', () => {
  it('captures simple field changes', () => {
    const before = { a: 1, b: 'old' };
    const afterUpdates = { a: 2, b: 'new' };
    const changes = buildChanges(before, afterUpdates);
    expect(changes.a.before).toBe(1);
    expect(changes.a.after).toBe(2);
    expect(changes.b.before).toBe('old');
    expect(changes.b.after).toBe('new');
  });

  it('ignores unchanged fields', () => {
    const before = { a: 1 };
    const afterUpdates = { a: 1 };
    const changes = buildChanges(before, afterUpdates);
    expect(Object.keys(changes).length).toBe(0);
  });
});
