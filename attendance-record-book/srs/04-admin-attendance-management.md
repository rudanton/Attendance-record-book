# SRS: 근무 시간 관리 (Admin - Attendance Management)

## 개요
관리자가 직원의 출퇴근 기록을 조회, 수정, 분석하는 기능 (시급/급여 관리는 하지 않음)

---

## P1: 근무 시간 조회 및 관리 (필수)

### 출퇴근 기록 조회
- [x] 월 선택 필터(연/월) → 해당 월 기록 조회 및 날짜/출근시각 정렬
- [x] 선택된 기간의 모든 출퇴근 기록 표시
- [ ] 필터링: 직원별 (미구현)
- [ ] 테이블 칼럼에 야간 근무 시간 포함 (현재: 날짜 | 직원명 | 출근 | 퇴근 | 총 근무 시간)

### 기록 수정
- [x] 각 기록 행 클릭 → 인라인 편집 모드
- [x] 수정 가능 항목: 출근/퇴근 시간 (휴식 시간 편집 UI는 미구현)
- [x] 수정 후 Firestore에 저장
- [x] 근무 시간 자동 재계산 (법정 최소 휴식 자동 보정 포함)

### 기록 추가
- [x] [수동 입력] 버튼 → 새 기록 추가
- [x] 입력 항목: 직원명, 날짜, 출근 시간, 퇴근 시간(선택)
- [x] 저장 후 자동 근무 시간 계산 (법정 최소 휴식 자동 보정 포함)

### 기록 삭제
- [ ] [삭제] 버튼 → 확인 모달
- [ ] 삭제 시 하드 삭제 (기록 완전 제거)

## P1: 근무 시간 통계 (시급/급여 미관리)

### 월별 근무 시간 집계
- [x] 직원별 기간(월 기본) 총 근무 시간 계산
- [x] 야간/일반 근무 시간 분리
- [x] 시급·급여 계산은 웹앱에서 수행하지 않음 (외부 관리)

### Excel 내보내기
- [x] [Excel 내보내기] 버튼 (현재 파일명: `YYYY_MM_출퇴근_기록.xlsx`)
- [x] 포맷: 행=날짜, 열=직원명, 셀=`HH:MM/HH:MM (Xh)` (24시간제), 하단에 직원별 월 합계
- [ ] 시트명: `기록_월`, `정산_월` (현재 단일 시트)

---

## P2: 고급 기능

### 휴식 시간 관리
- [ ] 휴식 시작/종료 시간 기록
- [ ] 총 근무 시간에서 휴식 시간 자동 제외

### 상세 분석
- [ ] 직원별 월 평균 근무 시간
- [ ] 최대/최소 일일 근무 시간
- [ ] 야간 근무 비율 분석

---

## P3: 향후 개선

### 추가 기능
- [ ] 출퇴근 기록 감시 알림 (오타 패턴 감지)
- [ ] 근무 일지 출력 (PDF)

---

## DB Schema

### `attendanceLogs` Collection
```typescript
{
  logId: string;                 // 기록 고유 ID
  employeeId: string;            // 직원 ID
  branchId: string;              // 지점 ID
  date: string;                  // 날짜 (YYYY-MM-DD)
  checkIn: Timestamp;            // 출근 시간
  checkOut: Timestamp;           // 퇴근 시간 (optional)
  breakStart: Timestamp;         // 휴식 시작 (optional)
  breakEnd: Timestamp;           // 휴식 종료 (optional)
  totalWorkMinutes: number;      // 총 근무 분
  regularWorkMinutes: number;    // 일반 근무 분 (22:00 이전)
  nightWorkMinutes: number;      // 야간 근무 분 (22:00~05:00 KST)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 계산 로직

### 근무 시간 계산 (KST 기준)
- **시간대 분류**:
  - 일반: 05:00 ~ 21:59 (KST)
  - 야간: 22:00 ~ 04:59 (KST)
- **변환 방식**: UTC 시간 + 9시간 = KST
- **계산 함수**: `calculateWorkMinutes(checkIn, checkOut)`
  - 1분 단위로 순회
  - 각 분의 시간을 KST로 변환: `(getUTCHours() + 9) % 24`
  - 22:00~04:59 범위면 nightWorkMinutes++
  - 나머지면 regularWorkMinutes++

### 예시 계산
- **출근 22:30 → 퇴근 05:30** (야간 근무)
  - checkIn: 2024-01-01T22:30 UTC (2024-01-02T07:30 KST)
  - checkOut: 2024-01-02T05:30 UTC (2024-01-02T14:30 KST)
  - totalWorkMinutes: 420분 (7시간)
  - regularWorkMinutes: 0분
  - nightWorkMinutes: 420분

- **출근 10:00 → 퇴근 00:00** (장시간 근무)
  - checkIn: 2024-01-01T10:00 UTC (2024-01-01T19:00 KST)
  - checkOut: 2024-01-02T00:00 UTC (2024-01-02T09:00 KST)
  - totalWorkMinutes: 840분 (14시간)
  - regularWorkMinutes: 120분 (19:00~22:00, 3시간)
  - nightWorkMinutes: 720분 (22:00~05:00, 11시간)

---

