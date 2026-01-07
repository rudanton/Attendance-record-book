# SRS: 피자집 출퇴근 및 근태 관리

## 1. 프로젝트 개요

* **목적**: 종이 기록부를 대체하여 매장 전용 PC에서만 작동하는 디지털 출퇴근 및 휴게 관리 시스템 구축.
* **핵심 가치**: 기록 누락 방지, 실시간 현황 파악, 정산 자동화.

## 2. 기술 스택

* **Frontend**: Next.js 14 (App Router), Tailwind CSS, Zustand (상태 관리).
* **Backend/DB**: Firebase Authentication, Firestore (NoSQL).
* **Library**: `xlsx` (Excel Export용), `date-fns` (시간 계산용).

## 3. 기능 요구사항

### 3.1 일반 유저 기능 (Employee)

#### [P1] 핵심 출퇴근

* **직원 대시보드**: 매장 PC 인증 시에만 노출. 등록된 직원 이름 목록이 카드/리스트 형태로 표시.
* **출퇴근 기록**:
* 이름 옆에 '오늘' 날짜와 출근/퇴근 시간이 실시간으로 표시됨.
* [출근하기], [퇴근하기] 토글되는 버튼 제공.


* **개인 이력 조회**: 본인 이름을 클릭하면 상세 페이지로 이동하여 **월별 출퇴근 목록**을 확인 가능.

#### [P2] 휴게 관리

* **휴식 기능**: [휴식 시작], [휴식 종료] 버튼 제공.
* **기록 저장**: 출퇴근 기록 내에 휴게 시간이 포함되어 저장됨.

### 3.2 관리자 기능 (Admin)

#### [P1] 직원 및 데이터 관리

* **직원 관리**:
* 신규 직원 등록 (이름, 시급, PIN 설정 등).
* 직원 퇴사 처리 (데이터 보존을 위한 **Soft Delete** 방식 사용, `isActive: false` 처리).


* **기록 수정**:
* 직원이 실수로 누락하거나 오기입한 출퇴근/휴게 시간 수정 및 수동 추가 기능.


* **데이터 정산 및 내보내기**:
* 특정 기간(월별 등) 직원별 총 근무 시간 및 휴게 제외 실근무 시간 확인.
* 정산 데이터를 **Excel(.xlsx)** 파일로 추출.



### 3.3 보안 및 접근 제어

* **기기 인증**: 사장님이 인증한 '매장 전용 PC 브라우저'에서만 직원 기능(출퇴근 버튼 등) 활성화.
* **관리자 권한**: 사장님은 외부 기기에서도 로그인하여 관리자 페이지 접근 가능.

## 4. DB 테이블(Collection) 구성 (Firestore)

### 4.1 `users` (직원 정보)

```typescript
{
  uid: string;            // Firebase Auth UID 또는 고유 ID
  name: string;           // 직원 이름
  pin: string;            // 4자리 암호 (인증용)
  role: "admin" | "staff";
  hourlyRate: number;     // 시급
  isActive: boolean;      // Soft Delete 여부 (true: 재직, false: 퇴사)
  joinedAt: timestamp;    // 입사일
}

```

### 4.2 `attendance` (근태 기록)

```typescript
{
  id: string;             // 기록 고유 ID
  userId: string;         // users 컬렉션 참조 ID
  userName: string;       // 가독성을 위한 이름 복사본
  date: string;           // 날짜 (YYYY-MM-DD)
  checkIn: timestamp;     // 출근 시간
  checkOut: timestamp | null; // 퇴근 시간
  breaks: [               // 휴식 시간 배열 (P2)
    { start: timestamp, end: timestamp | null }
  ];
  isModified: boolean;    // 관리자 수정 여부
  totalWorkMinutes: number; // 총 근무 시간 (정산용)
}

```

### 4.3 `config` (시스템 설정)

```typescript
{
  id: "authorized_devices";
  tokens: string[];       // 인증된 기기(브라우저) 토큰 리스트
}

```

---

## 5. UI/UX 레이아웃 가이드 (Gemini 참조용)

1. **메인 화면**: 그리드 형태의 직원 카드. 카드 내에 현재 상태(업무중/휴식중/미출근)와 오늘 기록 표시.
2. **개인 상세**: 캘린더 또는 리스트 뷰로 해당 월의 일자별 출근, 퇴근, 휴게 시간, 총 근무 시간 표시.
3. **관리자 페이지**:
* 직원 목록 관리 탭 (입/퇴사 처리).
* 전체 로그 보기 탭 (필터링 및 수정 버튼).
* 통계 탭 (총 시간 합산 및 엑셀 다운로드 버튼).


