# SRS: 지점 및 직원 관리 (Admin - Branch & Employee)

## 개요
관리자가 지점 정보를 확인/변경하고, 직원 데이터는 별도 기본 페이지에서 관리

---

## P1: 지점 및 직원 관리 (필수)

> 직원 추가/권한, 재직/퇴사 탭, 목록/삭제는 기본 페이지(`/add-employee`)·직원용 화면에서 이미 구현 완료. **시급 관리는 웹앱에서 하지 않음**(외부 관리).

### 지점 정보 조회 및 변경
- [x] 현재 선택 지점 표시 (지점명, ID)
- [x] [지점 변경] 버튼 → 지점 선택 페이지 (BranchSelectPage)
- [x] 새 지점 선택 시 모든 조회 데이터 새로고침

### 직원 목록/삭제 (기본 페이지에 구현)
- [x] 재직/퇴사 탭으로 목록 구분
- [x] Soft Delete 적용 (`isActive=false`)

---

## P2: 직원 관리 고급 기능

### 직원 상세 조회
- [ ] 직원 이름 클릭 → 상세 페이지
- [ ] 표시 정보:
  - 기본정보 (이름, 권한, 등록일)
  - 월별 근무 시간 통계 (총 시간, 야간/일반 분리)
  - 최근 30일 출퇴근 기록 미리보기

### 일괄 작업
- [ ] 복수 직원 선택 → 일괄 비활성화

---

## P3: 향후 개선

### 추가 기능
- [ ] 직원 프로필 사진 등록
- [ ] 주민등록번호 또는 사원번호 관리
- [ ] 근무 시간 제한 설정 (예: 최대 주 40시간)
- [ ] 휴가/연월차 관리

---

## DB Schema

### `branches` Collection
```typescript
{
  branchId: string;         // 지점 고유 ID
  branchName: string;       // 지점명
  address: string;          // 주소
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `employees` Collection
```typescript
{
  employeeId: string;       // 직원 고유 ID
  branchId: string;         // 지점 ID
  name: string;             // 직원명
  hourlyRate: number;       // 시급
  role: "staff" | "admin";  // 권한
  isActive: boolean;        // 활성 여부 (Soft Delete)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## UI 레이아웃

### 관리자 화면 스케치 (지점 선택용)
```
┌────────────────────────────────────────┐
│ 현재 지점: 강남점 [변경]               │
├────────────────────────────────────────┤
│ 지점 선택 페이지로 이동 -> 지점 교체   │
└────────────────────────────────────────┘
```

