// src/lib/types.ts

import { Timestamp } from 'firebase/firestore'; // Assuming firebase/firestore is used for Timestamps

export interface User {
  uid: string;            // Firebase Auth UID 또는 고유 ID
  name: string;           // 직원 이름
  role: "admin" | "staff";
  hourlyRate: number;     // 시급
  isActive: boolean;      // Soft Delete 여부 (true: 재직, false: 퇴사)
  joinedAt: Timestamp;    // 입사일
}

export interface BreakRecord {
  start: Timestamp;
  end: Timestamp | null;
}

export interface Attendance {
  id: string;             // 기록 고유 ID
  userId: string;         // users 컬렉션 참조 ID
  userName: string;       // 가독성을 위한 이름 복사본
  date: string;           // 날짜 (YYYY-MM-DD)
  checkIn: Timestamp;     // 출근 시간
  checkOut: Timestamp | null; // 퇴근 시간
  breaks: BreakRecord[];
  isModified: boolean;
  regularWorkMinutes: number;
  nightWorkMinutes: number;
  totalWorkMinutes: number;
};

export interface Branch {
  branchId: string;       // 지점 고유 ID
  branchName: string;     // 지점명 (예: "강남점", "홍대점")
}

export interface AuditChangeField<T = unknown> {
  before: T | null;
  after: T | null;
}

export interface AuditLogEntry {
  branchId: string;
  resourceType: 'attendance' | 'user' | 'branch';
  resourceId: string;
  action: 'create' | 'update' | 'delete' | 'reactivate' | 'deactivate';
  actorId?: string | null;
  actorName?: string | null;
  changes?: Record<string, AuditChangeField>;
  timestamp?: any; // Firestore serverTimestamp()
}

