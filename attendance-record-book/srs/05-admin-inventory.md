# SRS: 재고 관리 (Admin - Inventory Management)

## 개요
관리자가 매장의 재고 현황을 관리하고, 입고/출고를 기록하는 기능

---

## P1: 재고 기본 기능 (필수)

### 재고 항목 등록
- [ ] [재고 추가] 버튼 → 등록 모달
- [ ] 입력 항목:
  - 항목명 (필수)
  - 카테고리 선택 (필수):
    - 냉동 (Frozen)
    - 냉장 (Refrigerated)
    - 캔 (Canned)
  - 현재 수량 (필수, 기본값 0)
  - 최소 수량 경고선 (선택)
- [ ] 등록 후 Firestore `inventoryItems` 컬렉션에 저장

### 재고 현황 조회
- [ ] 카테고리별 탭 전환 (냉동 / 냉장 / 캔)
- [ ] 각 탭에서 해당 카테고리 항목 목록 표시
- [ ] 목록 칼럼:
  - 항목명
  - 현재 수량
  - 상태 (정상/경고/위험, 색상 코드)
  - 최근 수정일
  - 액션 (수정/삭제)

### 상태 색상 표시
- [ ] **정상** (초록색 🟢): 현재 수량 ≥ 최소 수량
- [ ] **경고** (노란색 🟡): 최소 수량의 50% ≤ 현재 수량 < 최소 수량
- [ ] **위험** (빨강색 🔴): 현재 수량 < 최소 수량의 50%

### 재고 정보 수정
- [ ] 항목 행 클릭 → 편집 모달
- [ ] 수정 가능 항목:
  - 항목명
  - 현재 수량
  - 최소 수량 경고선
- [ ] 수정 후 Firestore에 `updatedAt` 함께 저장

### 재고 삭제
- [ ] [삭제] 버튼 → 확인 모달
- [ ] 삭제 방식: 하드 삭제 (항목 완전 제거)
- [ ] 관련 입출고 기록은 유지 (감사용)

---

## P1: 입고/출고 기록

### 입고 기록 (In)
- [ ] [입고] 버튼 → 입고 모달
- [ ] 입력 항목:
  - 항목 선택 (드롭다운)
  - 입고 수량 (필수)
  - 입고 날짜 (기본값: 오늘)
  - 메모 (선택)
- [ ] 저장 시 재고 항목의 `currentQuantity += 입고수량` 자동 업데이트
- [ ] 입고 기록을 `inventoryLogs` 컬렉션에 저장

### 출고 기록 (Out)
- [ ] [출고] 버튼 → 출고 모달
- [ ] 입력 항목:
  - 항목 선택 (드롭다운)
  - 출고 수량 (필수, 현재 수량 이하)
  - 출고 날짜 (기본값: 오늘)
  - 메모 (선택)
- [ ] 저장 시 재고 항목의 `currentQuantity -= 출고수량` 자동 업데이트
- [ ] 출고 불가 검사 (출고 수량 > 현재 수량이면 에러)
- [ ] 출고 기록을 `inventoryLogs` 컬렉션에 저장

### 입출고 이력 조회
- [ ] [이력 보기] 버튼 → 특정 항목의 입출고 기록 목록
- [ ] 테이블 칼럼:
  - 날짜
  - 유형 (입고 / 출고)
  - 수량
  - 메모
  - 작성자 (관리자명)

---

## P2: 재고 분석 및 통계

### 재고 요약
- [ ] 전체 재고 수량 합계
- [ ] 카테고리별 항목 수
- [ ] 경고 상태 항목 목록 (경고/위험 항목만 강조)

### 월별 입출고 통계
- [ ] 월별 카테고리별 입고 총액/총 수량
- [ ] 월별 카테고리별 출고 총액/총 수량
- [ ] 월별 재고 증감 추세 그래프

### 재고 회전율 분석
- [ ] 항목별 월 평균 출고 수량
- [ ] 느린 회전 항목 리스트 (경고)

---

## P3: 향후 개선

### 추가 기능
- [ ] 유통기한 관리 (만료 예정 항목 경고)
- [ ] 재주문 자동 알림 (경고 상태 시 알림)
- [ ] 다중 창고 관리
- [ ] 재고 실사 (Count)와 시스템 재고 비교
- [ ] 바코드 스캔을 통한 빠른 입출고
- [ ] 공급업체별 구매 가격 기록
- [ ] 원가 추적 및 손실액 계산

---

## DB Schema

### `inventoryItems` Collection
```typescript
{
  itemId: string;              // 재고 항목 고유 ID
  branchId: string;            // 지점 ID
  name: string;                // 항목명
  category: "frozen" | "refrigerated" | "canned"; // 카테고리
  currentQuantity: number;     // 현재 수량
  minQuantity: number;         // 최소 수량 경고선 (default: 0)
  status: "normal" | "warning" | "danger"; // 상태 (자동 계산)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `inventoryLogs` Collection
```typescript
{
  logId: string;               // 입출고 기록 고유 ID
  branchId: string;            // 지점 ID
  itemId: string;              // 재고 항목 ID
  type: "in" | "out";          // 입고 or 출고
  quantity: number;            // 수량
  date: string;                // 기록 날짜 (YYYY-MM-DD)
  memo: string;                // 메모
  recordedBy: string;          // 기록자 (adminId)
  createdAt: Timestamp;
}
```

---

## UI 레이아웃

### 재고 관리 탭
```
┌────────────────────────────────────────┐
│ 재고 관리                              │
│ [입고] [출고] [이력 보기]              │
├────────────────────────────────────────┤
│ [냉동] [냉장] [캔]                    │
├────────────────────────────────────────┤
│ 항목명      | 수량  | 상태   | 액션   │
├────────────────────────────────────────┤
│ 딸기 냉동   | 50개 | 🟢정상 | 수정/삭제│
│ 우유        | 2개  | 🔴위험 | 수정/삭제│
│ 콜라        | 100개| 🟢정상 | 수정/삭제│
└────────────────────────────────────────┘
```

### 상태 색상 코드
```
정상(Normal):   #22C55E (Green-500)   🟢
경고(Warning):  #EAB308 (Yellow-500)  🟡
위험(Danger):   #EF4444 (Red-500)     🔴
```

---

## 상태 판정 로직

```typescript
function getInventoryStatus(
  currentQuantity: number,
  minQuantity: number
): "normal" | "warning" | "danger" {
  if (currentQuantity >= minQuantity) {
    return "normal";
  } else if (currentQuantity >= minQuantity * 0.5) {
    return "warning";
  } else {
    return "danger";
  }
}
```

