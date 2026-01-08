# SRS: 피자집 출퇴근 및 근태 관리

## 1. 프로젝트 개요

* **목적**: 종이 기록부를 대체하여 매장 전용 PC에서만 작동하는 디지털 출퇴근 및 휴게 관리 시스템 구축.
* **핵심 가치**: 기록 누락 방지, 실시간 현황 파악, 정산 자동화.

## 2. 기술 스택

* **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS.
* **Backend/DB**: Firebase Authentication, Firestore (NoSQL).
* **Library**: `xlsx` (Excel Export용), `date-fns` (시간 계산용), Vitest (유닛 테스트).

## 3. 기능 요구사항



### 3.1 지점 선택 및 설정



*   **최초 실행 시 지점 선택**: 앱을 처음 로컬에서 실행 시, 등록된 지점 목록을 보여주고 운영할 지점을 선택하도록 함. 선택된 지점 정보는 로컬에 저장됨.

*   **지점 데이터 격리**: 모든 직원 정보 및 출퇴근 기록은 선택된 지점을 기준으로만 조회되고 저장됨.



### 3.2 일반 유저 기능 (Employee)



#### [P1] 핵심 출퇴근



*   **직원 대시보드**: 선택된 지점에 소속된 직원 이름 목록이 카드/리스트 형태로 표시.

*   **출퇴근 기록**:

*   이름 옆에 '오늘' 날짜와 출근/퇴근 시간이 실시간으로 표시됨.

*   [출근하기], [퇴근하기] 토글되는 버튼 제공.





*   **개인 이력 조회**: 본인 이름을 클릭하면 상세 페이지로 이동하여 **월별 출퇴근 목록**을 확인 가능.



#### [P2] 휴게 관리



*   **휴식 기능**: [휴식 시작], [휴식 종료] 버튼 제공.

*   **기록 저장**: 출퇴근 기록 내에 휴게 시간이 포함되어 저장됨.



### 3.3 관리자 기능 (Admin)



#### [P1] 직원 및 데이터 관리
  role: "admin" | "staff";



  hourlyRate: number;     // 시급 (공개 등록은 기본 0으로 생성, 관리자 화면에서 후속 수정)

*   신규 직원 등록 (이름, 시급 설정). **PIN은 더 이상 사용하지 않음.**

*   직원 퇴사 처리 (데이터 보존을 위한 **Soft Delete** 방식 사용, `isActive: false` 처리).





*   **기록 수정**:

*   직원이 실수로 누락하거나 오기입한 출퇴근/휴게 시간 수정 및 수동 추가 기능.





*   **데이터 정산 및 내보내기**:

*   특정 기간(월별 등) 직원별 총 근무 시간 및 휴게 제외 실근무 시간 확인.

*   **자동 급여 계산**: 각 직원의 시급(hourlyRate)과 총 근무 시간을 바탕으로 예상 급여를 자동 계산하여 표시.

*   정산 데이터를 **Excel(.xlsx)** 파일로 추출.

*   **공개 직원 등록 페이지**(`/add-employee`): 지점 선택 후 이름만 입력해 신규 직원을 추가할 수 있으며 기본값으로 `role=staff`, `hourlyRate=0`이 설정된다.







### 3.4 보안 및 접근 제어















*   **관리자 권한**: 사장님은 외부 기기에서도 로그인하여 관리자 페이지 접근 가능.
*   **세션 안전장치**: 관리자 영역(`/admin`)을 벗어나면 자동 로그아웃 처리하여 장시간 세션 노출을 방지.
*   **클라이언트 지점 선택 저장**: 선택한 지점 ID는 로컬스토리지에 저장되어 재방문 시 자동 복원.















## 4. DB 테이블(Collection) 구성 (Firestore)















### 4.1 `branches` (지점 정보)















```typescript







{







  branchId: string;       // 지점 고유 ID







  branchName: string;     // 지점명 (예: "강남점", "홍대점")







}







```















### 4.2 `users` (직원 정보)















```typescript







{







  uid: string;            // Firebase Auth UID 또는 고유 ID







  branchId: string;       // 소속된 지점 ID (branches 컬렉션 참조)







  name: string;           // 직원 이름







  pin: string;            // 4자리 암호 (인증용)







  role: "admin" | "staff";







  hourlyRate: number;     // 시급







  isActive: boolean;      // Soft Delete 여부 (true: 재직, false: 퇴사)







  joinedAt: timestamp;    // 입사일







}















```















### 4.3 `attendance` (근태 기록)















```typescript







{







  id: string;             // 기록 고유 ID







  branchId: string;       // 소속된 지점 ID (branches 컬렉션 참조)







  userId: string;         // users 컬렉션 참조 ID







  userName: string;       // 가독성을 위한 이름 복사본







  date: string;           // 날짜 (YYYY-MM-DD)







  checkIn: timestamp;     // 출근 시간







  checkOut: timestamp | null; // 퇴근 시간







  breaks: [               // 휴식 시간 배열 (P2)







    { start: timestamp, end: timestamp | null }







  ];







  isModified: boolean;    // 관리자 수정 여부







  regularWorkMinutes: number; // 일반 근무 시간 (분)







  nightWorkMinutes: number;   // 야간 근무 시간 (분, 22:00-05:00, KST 기준 계산)







  totalWorkMinutes: number; // 총 근무 시간 (정산용, 일반 + 야간)







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


