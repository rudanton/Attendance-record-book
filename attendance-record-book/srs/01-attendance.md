# SRS: 출퇴근 시스템 (Employee)

## 개요
일반 직원들이 사용하는 출퇴근 및 휴게 관리 기능

---

## P1: 핵심 기능 (필수)

### 지점 선택 및 설정
- [x] 최초 실행 시 지점 목록 표시 및 선택
- [x] 선택된 지점을 로컬스토리지에 저장 (재방문 시 자동 복원)
- [x] 지점 변경 UI 제공 (Branch Select Page)

### 직원 등록 (공개 페이지 `/add-employee`)
- [x] 지점 선택 후 이름만 입력해 등록
- [x] 기본값: `role=staff`
- [x] 등록 시 `isActive=true`, Soft Delete는 `isActive=false`

### 직원 대시보드
- [x] 선택된 지점의 직원 이름 목록 표시 (카드/리스트)
- [x] 각 직원 옆에 오늘 날짜 표시
- [x] 현재 상태 표시 (미출근/출근중/퇴근함)

### 출퇴근 기록
- [x] [출근하기] 버튼 → `checkIn` 기록 저장 (Firestore)
- [x] [퇴근하기] 버튼 → `checkOut` 기록 저장
- [x] 중복 출퇴근 방지 로직
- [x] 실시간 근무 시간 계산 표시
- [x] 자동 종료(24시간 매장): `checkIn` 이후 20시간 경과 시 `checkOut=checkIn+20h`로 자동 퇴근 처리, 근무시간 재계산/법정 최소 휴식 보정, `isAutoClosed`/`autoClosedAt` 저장, 기본 출퇴근/휴식 액션 및 페이지 진입 시 트리거 (백엔드 스케줄러 도입 전 단계)

### 개인 이력 조회
- [x] 본인 이름 클릭 → 상세 페이지 이동
- [x] 월별 출퇴근 기록 목록 표시
- [x] 날짜별 체크인/체크아웃 시간 표시
- [x] 총 근무 시간 계산 (KST 기준, 22:00~05:00 야간 구분)

---

## P2: 휴게 관리

### 휴식 기능
- [x] [휴식 시작] 버튼 → `breakStart` 기록
- [x] [휴식 종료] 버튼 → `breakEnd` 기록
- [x] 휴식 중 표시 UI

### 기록 저장
- [x] 휴식 시간이 출퇴근 기록에 포함되어 저장
- [x] 총 근무 시간에서 휴식 시간 자동 제외

---

## P2: 출퇴근 수정 요청 (점진적 롤아웃, 향후)

### 수정 요청 기능
- [ ] 개인 이력 페이지에서 과거 기록 행 선택 → 수정 요청 모달 열기
- [ ] 요청 항목: 수정할 출퇴근 시간, 수정 사유 기입
- [ ] 요청 저장 → `attendanceModificationRequests` Collection에 저장
  - `requestId`, `employeeId`, `recordId`, `proposedCheckIn`, `proposedCheckOut`, `reason`, `status` (pending/approved/rejected), `requestedAt`, `respondedAt`, `respondedBy`
- [ ] 관리자 페이지에서 "수정 요청 대기" 탭 → 미승인 요청 목록 조회
- [ ] 각 요청 클릭 → 현재 기록 vs 제안 기록 비교 표시
- [ ] [수락] → 제안 기록으로 업데이트, 원본 기록 감사 로그 남김
- [ ] [거절] → status=rejected, 거절 사유(선택) 저장
- [ ] (선택) 직원에게 수정 요청 결과 알림 (관리자가 응답하면 이메일/앱 푸시 등)

---

## DB Schema

### `employees` Collection
```typescript
{
  employeeId: string;      // 직원 고유 ID
  branchId: string;        // 지점 ID
  name: string;            // 직원명
  role: "staff" | "admin"; // 권한
  isActive: boolean;       // 활성 여부 (Soft Delete)
  createdAt: Timestamp;    // 생성일
  updatedAt: Timestamp;    // 수정일
}
```

### `attendanceLogs` Collection
```typescript
{
  logId: string;           // 기록 고유 ID
  employeeId: string;      // 직원 ID
  branchId: string;        // 지점 ID
  date: string;            // 날짜 (YYYY-MM-DD)
  checkIn: Timestamp;      // 출근 시간
  checkOut: Timestamp;     // 퇴근 시간 (optional)
  breakStart: Timestamp;   // 휴식 시작 (optional)
  breakEnd: Timestamp;     // 휴식 종료 (optional)
  totalWorkMinutes: number; // 총 근무 분
  regularWorkMinutes: number; // 일반 근무 분 (22:00 이전)
  nightWorkMinutes: number; // 야간 근무 분 (22:00~05:00 KST)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 계산 로직

### 근무 시간 계산 (KST 기준)
- **야간 시간대**: 22:00 ~ 05:00 (KST)
- **계산 방식**: 
  - UTC 시간을 KST로 변환: `(getUTCHours() + 9) % 24`
  - 22:00~05:00 범위 내 분을 야간으로 카운트
  - 나머지는 일반 근무로 카운트

### 예시
- 출근 22:30 → 퇴근 05:30: 7시간 (모두 야간)
- 출근 10:00 → 퇴근 00:00: 14시간 (일반 2시간 + 야간 12시간)

---

## 보안 정책

- ✅ **Firebase Auth**: Email/Password 또는 Google 로그인
- ✅ **Firestore Security Rules**: 본인 데이터만 조회 가능
- ✅ **지점 기반 격리**: 다른 지점의 직원 정보 접근 불가

