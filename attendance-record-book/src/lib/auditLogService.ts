import { db, auth } from '@/firebase/config';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Attendance, AuditLogEntry, AuditChangeField } from './types';

export function buildChanges(before: Record<string, any>, afterUpdates: Record<string, any>): Record<string, AuditChangeField> {
  const changes: Record<string, AuditChangeField> = {};
  const keys = new Set([...Object.keys(afterUpdates)]);
  keys.forEach((key) => {
    const beforeVal = (before as any)[key];
    const afterVal = (afterUpdates as any)[key];
    const changed = JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
    if (changed) {
      changes[key] = {
        before: beforeVal ?? null,
        after: afterVal ?? null,
      };
    }
  });
  return changes;
}

export async function logAudit(entry: Omit<AuditLogEntry, 'timestamp' | 'actorId' | 'actorName'> & Partial<Pick<AuditLogEntry, 'actorId' | 'actorName'>>): Promise<void> {
  const payload: AuditLogEntry = {
    ...entry,
    actorId: entry.actorId ?? auth.currentUser?.uid ?? null,
    actorName: entry.actorName ?? auth.currentUser?.displayName ?? null,
    timestamp: serverTimestamp(),
  };
  await addDoc(collection(db, 'auditLogs'), payload);
}

export const __testables = {
  buildChanges,
};
