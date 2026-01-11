# SRS: 재고 관리 (Inventory Management)

## 개요
매장 재고 현황 조회 및 관리 기능
- **경로**: `/inventory` (모든 직원 접근 가능)
- **권한**: 모든 직원이 재고 조회/추가/수정/삭제, 입고 기록 가능

---

## P1: 재고 조회 및 관리 (전 직원 공통)

### 재고 현황 조회
- [ ] 카테고리별 탭 전환 (냉동 / 냉장 / 캔)
- [ ] 각 탭에서 해당 카테고리 항목 목록 표시
- [ ] 목록 칼럼 (카테고리별로 다름):
  - 항목명
  - 총 수량 (자동 합계)
  - 위치별 수량:
    - **캔**: 창고 / 주방
    - **냉동**: 냉동실 / 냉장실(해동)
    - **냉장**: 냉장실
  - 상태 (정상/경고/위험, 색상 코드)
  - 최근 수정일
  - 액션 (수정/삭제)

### 상태 색상 표시
- [ ] **정상** (초록색 🟢): 현재 수량 ≥ 최소 수량
- [ ] **경고** (노란색 🟡): 최소 수량의 50% ≤ 현재 수량 < 최소 수량
- [ ] **위험** (빨강색 🔴): 현재 수량 < 최소 수량의 50%
- [ ] 상태 판정 기준: **주 보관 위치 수량만** 사용
  - 캔 제품: 창고 수량
  - 냉동 제품: 냉동실 수량
  - 냉장 제품: 냉장실 수량
- [ ] 주방/냉장실(해동)은 임시 작업 공간으로 상태 판정에서 제외

### 재고 항목 등록
- [ ] [재고 추가] 버튼 → 등록 모달
- [ ] 입력 항목:
  - 항목명 (필수)
  - 카테고리 선택 (필수):
    - 냉동 (Frozen)
    - 냉장 (Refrigerated)
    - 캔 (Canned)
  - 위치별 수량 (카테고리에 따라 다름, 각각 기본값 0):
    - **캔 제품**: 창고 수량, 주방 수량
    - **냉동 제품**: 냉동실 수량, 냉장실 수량 (해동용)
    - **냉장 제품**: 냉장실 수량
  - 최소 수량 경고선 (선택, 주 보관 위치 기준)
- [ ] 총 수량은 위치별 수량의 합으로 자동 계산
- [ ] 등록 후 Firestore `inventoryItems` 컬렉션에 저장

### 재고 정보 수정
- [ ] 항목 행 클릭 → 편집 모달
- [ ] 수정 가능 항목:
  - 항목명
  - 위치별 수량 (카테고리에 따라):
    - **캔 제품**: 창고 / 주방
    - **냉동 제품**: 냉동실 / 냉장실(해동)
    - **냉장 제품**: 냉장실
  - 최소 수량 경고선
- [ ] 총 수량은 위치별 수량의 합으로 자동 재계산
- [ ] 수정 후 Firestore에 `updatedAt` 함께 저장

### 재고 삭제
- [ ] [삭제] 버튼 → 확인 모달
- [ ] 삭제 방식: 하드 삭제 (항목 완전 제거)
- [ ] 관련 입출고 기록은 유지 (감사용)

---

## P1: 입고 기록 (전 직원 공통)

### 입고 기록 (In)
- [ ] [입고] 버튼 → 입고 모달
- [ ] 입력 항목:
  - 항목 선택 (드롭다운)
  - 입고 수량 (필수)
  - 입고 날짜 (기본값: 오늘)
  - 메모 (선택)
- [ ] 입고 위치 자동 결정:
  - **캔(Canned)** → 창고(warehouse)에 입고
  - **냉동(Frozen)** → 냉동실(freezer)에 입고
  - **냉장(Refrigerated)** → 냉장실(refrigerator)에 입고
- [ ] 저장 시:
  - 해당 위치의 수량 증가 (locations.warehouse / freezer / refrigerator)
  - `currentQuantity` 자동 재계산 (전체 위치 합계)
- [ ] 입고 기록을 `inventoryLogs` 컬렉션에 저장 (location 포함)

### 재고 수량 조정
- [ ] 재고 수정 기능을 통해 위치별 수량 직접 조정
- [ ] 실제 소비는 수정 기능으로 반영 (예: 판매/사용 후 재고 확인 시 수량 직접 수정)
- [ ] 수정 시 `updatedAt` 자동 기록

### 입고 이력 조회
- [ ] [이력 보기] 버튼 → 특정 항목의 입고 기록 목록
- [ ] 테이블 칼럼:
  - 날짜
  - 위치 (창고 / 주방 / 냉동실 / 냉장실)
  - 수량
  - 메모
  - 작성자 (직원명)

---

## P2: 재고 분석 및 통계

### 재고 요약
- [ ] 전체 재고 수량 합계
- [ ] 카테고리별 항목 수
- [ ] 경고 상태 항목 목록 (경고/위험 항목만 강조)

### 월별 입고 통계
- [ ] 월별 카테고리별 입고 총 수량
- [ ] 월별 재고 증감 추세 그래프

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
  locations: {                 // 위치별 수량 (카테고리별로 사용하는 필드가 다름)
    warehouse: number;         // 창고 수량 (캔 제품 주 보관)
    kitchen: number;           // 주방 수량 (캔 제품 작업 공간)
    freezer: number;           // 냉동실 수량 (냉동 제품 주 보관)
    refrigerator: number;      // 냉장실 수량 (냉장 제품 주 보관 + 냉동 제품 해동 공간)
  };
  currentQuantity: number;     // 총 수량 (자동 계산: 카테고리별 사용 위치 합계)
  minQuantity: number;         // 최소 수량 경고선 (default: 0, 주 보관 위치 기준)
  status: "normal" | "warning" | "danger"; // 상태 (주 보관 위치 수량으로 계산)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `inventoryLogs` Collection
```typescript
{
  logId: string;               // 입고 기록 고유 ID
  branchId: string;            // 지점 ID
  itemId: string;              // 재고 항목 ID
  location: "warehouse" | "kitchen" | "freezer" | "refrigerator"; // 입고 위치
  quantity: number;            // 입고 수량
  date: string;                // 기록 날짜 (YYYY-MM-DD)
  memo: string;                // 메모
  recordedBy: string;          // 기록자 (직원명)
  createdAt: Timestamp;
}
```

---

## UI 레이아웃

### 재고 관리 탭
```
┌───────────────────────────────────────────────────────────────────────┐
│ 재고 관리                                                            │
│ [입고] [이력 보기]                                                   │
├───────────────────────────────────────────────────────────────────────┤
│ [냉동] [냉장] [캔]                                                  │
├───────────────────────────────────────────────────────────────────────┤
│ 캔 탭:                                                               │
│ 항목명   | 총수량 | 창고 | 주방 | 상태   | 액션                    │
│ 콜라     | 100개 | 80개 | 20개 | 🟢정상 | 수정/삭제               │
│                                                                       │
│ 냉동 탭:                                                            │
│ 항목명      | 총수량 | 냉동실 | 냉장실 | 상태   | 액션          │
│ 딸기 냉동   | 50개  | 40개  | 10개  | 🟢정상 | 수정/삭제     │
│                                                                       │
│ 냉장 탭:                                                            │
│ 항목명   | 총수량 | 냉장실 | 상태   | 액션                       │
│ 우유     | 2개   | 2개   | 🔴위험 | 수정/삭제                  │
└───────────────────────────────────────────────────────────────────────┘
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
// 주 보관 위치 수량만 사용하여 상태 판정
function getInventoryStatus(
  item: InventoryItem
): "normal" | "warning" | "danger" {
  // 카테고리별 주 보관 위치 수량 추출
  let primaryQuantity: number;
  
  if (item.category === "canned") {
    primaryQuantity = item.locations.warehouse;
  } else if (item.category === "frozen") {
    primaryQuantity = item.locations.freezer;
  } else { // "refrigerated"
    primaryQuantity = item.locations.refrigerator;
  }
  
  // 주 보관 위치 수량으로 상태 판정
  if (primaryQuantity >= item.minQuantity) {
    return "normal";
  } else if (primaryQuantity >= item.minQuantity * 0.5) {
    return "warning";
  } else {
    return "danger";
  }
}
```

