# Next.js & TypeScript Coding Guidelines

이 문서는 프로젝트의 코드 품질 일관성을 유지하기 위한 가이드라인입니다. 
AI Assistant(Copilot, ChatGPT 등)는 코드 생성 시 이 규칙을 최우선으로 준수해야 합니다.

## 1. Tech Stack & Principles
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS
- **State Management**: Zustand (Global), React Context (Compound Components)
- **Data Fetching**: Server Components (Default), TanStack Query (Client side)

## 2. General Code Quality
- **Early Returns**: 중첩된 `if` 문을 피하고, 조건이 맞지 않으면 빠르게 return 하여 가독성을 높인다.
- **Pure Functions**: 가능한 한 함수는 순수 함수로 작성하여 예측 가능하게 만든다.
- **DRY (Don't Repeat Yourself)**: 로직이 2회 이상 반복되면 커스텀 훅이나 유틸리티 함수로 분리한다.
- **Comments**: 코드가 *무엇*을 하는지보다 *왜* 그렇게 작성되었는지를 설명한다.
- **하드코딩 금지**: 모든 상수, 메시지, 설정값은 파일 상단에 상수로 분리한다.

## 3. Naming Conventions
- **Files & Folders**: 
  - 컴포넌트 파일: `PascalCase.tsx` (예: `UserProfile.tsx`)
  - 유틸리티/Hooks: `camelCase.ts` (예: `useAuth.ts`, `dateFormatter.ts`)
  - Next.js 라우팅 폴더: `kebab-case` (예: `app/blog-posts/page.tsx`)
- **Variables & Functions**: `camelCase` (예: `isLoading`, `fetchUserData`)
  - Boolean 변수는 접두사 사용: `is`, `has`, `should` (예: `isVisible`, `hasError`)
- **Constants**: `UPPER_SNAKE_CASE` (예: `MAX_RETRY_COUNT`)
- **Interfaces/Types**: `PascalCase`. `I` 접두사 금지 (예: `interface User` O, `interface IUser` X).

## 4. TypeScript Rules
- **No `any`**: `any` 타입 사용을 엄격히 금지한다. 필요하다면 `unknown`을 사용하고 타입 가드를 작성한다.
  - 예외: 타입 정의가 없는 레거시 코드나 외부 라이브러리와의 상호작용에서만 제한적으로 허용
- **Explicit Return Types**: 복잡한 함수의 경우 반환 타입을 명시한다.
- **Type vs Interface**: 
  - 확장이 필요한 공개 API(Props 등)는 `interface` 사용
  - 유니온 타입이나 튜플은 `type` 사용
- **타입 안전성**: Optional chaining(`?.`)과 Nullish coalescing(`??`)을 적극 활용한다.

## 5. React & Next.js Components

### 5.1 Structure
- **Server Components by Default**: 가능한 한 서버 컴포넌트로 작성한다.
- **Client Components**: `useState`, `useEffect`, 브라우저 API가 필요한 경우에만 파일 최상단에 `'use client'`를 선언한다.
- **Component Definition**: `function` 키워드 대신 `const` + 화살표 함수 사용을 지향한다.
  ```tsx
  // Good
  const UserCard: React.FC<UserCardProps> = ({ name }) => { ... }
  ```

### 5.2 파일 구조 (이 프로젝트 표준)
```typescript
"use client"; // 필요한 경우

// 1. Import 문
import { useState } from 'react';

// 2. 타입 정의
type Props = { ... };

// 3. 상수 정의 (컴포넌트 외부)
const CONSTANTS = { ... };

// 4. 컴포넌트
export default function Component() {
  // 4.1 State
  const [state, setState] = useState();
  
  // 4.2 Hooks
  useEffect(() => { ... }, []);
  
  // 4.3 핸들러 함수
  const handleClick = () => { ... };
  
  // 4.4 렌더링
  return ( ... );
}
```

### 5.3 Hooks
- **Logic Extraction**: UI와 비즈니스 로직을 분리한다. 컴포넌트 내부 로직이 길어지면 커스텀 훅으로 추출한다.
- **Dependency Array**: `useEffect`, `useCallback`, `useMemo`의 의존성 배열을 정확히 기입한다.

### 5.4 Props
- Props는 구조 분해 할당(Destructuring)으로 받는다.
- 선택적 Props는 기본값을 설정한다.

## 6. 프로젝트 특화 패턴 ⭐

### 6.1 상수 관리
```typescript
// ✅ 좋은 예: 모든 하드코딩 값을 상수로 분리
const CONFIG = {
  TIMEOUT_MS: 3000,
  MAX_RETRIES: 3
};

const MESSAGES = {
  ERROR: "오류가 발생했습니다",
  SUCCESS: "성공했습니다"
};

const STYLES = {
  BUTTON_PRIMARY: "bg-blue-500 hover:bg-blue-600 ...",
  BUTTON_SECONDARY: "bg-gray-500 hover:bg-gray-600 ..."
};

// ❌ 나쁜 예: 코드 내 하드코딩
alert("오류가 발생했습니다"); // NO
setTimeout(() => { ... }, 3000); // NO
```

### 6.2 낙관적 업데이트 (Optimistic Update)
```typescript
// ✅ 사용자 액션에 즉시 반응
const handleAction = async () => {
  // 1. UI 즉시 업데이트
  setData(optimisticValue);
  
  // 2. 백그라운드에서 서버 동기화
  try {
    await serverAction();
    fetchData(true); // silent 모드
  } catch (error) {
    fetchData(true); // 에러 시 복구
  }
};
```

### 6.3 데이터 페칭
```typescript
// ✅ silent 모드 지원
const fetchData = async (silent = false) => {
  if (!silent) setLoading(true);
  try {
    const data = await getData();
    setData(data);
  } finally {
    if (!silent) setLoading(false);
  }
};
```

## 7. TypeScript

### 타입 안전성
```typescript
// ✅ 타입 가드 사용
if (data?.field) {
  const value = (data.field as any)?.property;
}

// ✅ Optional chaining
const value = obj?.nested?.property;

// ❌ 불필요한 any 사용 지양
const value: any = getData(); // NO
```

### 인터페이스/타입
```typescript
// ✅ 명확한 타입 정의
interface UserData {
  id: string;
  name: string;
  email?: string; // optional
}

type Status = 'pending' | 'active' | 'inactive'; // union type
```

## 8. 성능 최적화

### 1. 불필요한 렌더링 방지
```typescript
// ✅ useCallback 사용
const handleClick = useCallback(() => {
  // ...
}, [dependencies]);

// ✅ useMemo 사용
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);
```

### 2. 병렬 요청
```typescript
// ✅ Promise.all 사용
const [data1, data2, data3] = await Promise.all([
  fetchData1(),
  fetchData2(),
  fetchData3()
]);
```

### 3. 조건부 로딩
```typescript
// ✅ 필요한 경우에만 로딩 표시
const fetchData = async (silent = false) => {
  if (!silent) setLoading(true);
  // ...
};
```

## 9. Styling (Tailwind CSS)

### Utility Order
- Tailwind 클래스는 논리적인 순서로 정렬한다 (또는 Prettier 플러그인 사용).
  - *Layout -> Box Model -> Typography -> Visual -> Misc*

### Semantic Colors
- 하드코딩된 색상(`bg-gray-100`) 대신 정의된 테마 색상(`bg-secondary`, `text-primary`)을 사용한다.

### Dynamic Classes
- 조건부 스타일링 시 `clsx` 또는 `tailwind-merge` 라이브러리를 사용한다.
  ```tsx
  // Good
  <div className={cn('bg-white p-4', isActive && 'bg-blue-500')} />
  ```

### 버튼 스타일
```typescript
// ✅ 재사용 가능한 스타일 상수
const BUTTON_STYLES = {
  PRIMARY: "bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300",
  SECONDARY: "bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300",
  DANGER: "bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300"
};
```

### 반응형 디자인
```typescript
// ✅ Tailwind 반응형 클래스 사용
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
```

## 10. File Structure (Colocation)
- 관련된 파일은 같은 폴더에 위치시킨다.
- `app/` 디렉토리 내부는 라우팅과 관련된 파일만 두고, 비즈니스 로직이 담긴 컴포넌트는 `components/` 폴더 등으로 분리한다.

```text
src/
├── app/               # Pages & Layouts
├── components/        # Shared Components
│   ├── ui/            # Buttons, Inputs (Atomic)
│   └── features/      # Domain specific components
├── lib/               # Utilities, Helpers
├── hooks/             # Custom Hooks
└── types/             # Global Types
```

## 11. 에러 처리

```typescript
// ✅ 명확한 에러 메시지
try {
  await action();
} catch (error) {
  console.error("Action failed:", error);
  alert(error instanceof Error ? error.message : MESSAGES.UNKNOWN_ERROR);
}
```

## 12. 주석

```typescript
// ✅ 의도를 설명하는 주석
// 낙관적 업데이트: UI 즉시 반영
setData(newValue);

// ❌ 불필요한 주석
// 데이터 설정
setData(newValue); // NO
```

## 13. Git 커밋

```bash
# ✅ 의미 있는 커밋 메시지
feat: 새로운 기능 추가
fix: 버그 수정
refactor: 코드 리팩토링
perf: 성능 개선
style: 스타일 변경
docs: 문서 수정

# 예시
refactor: 대시보드 UI 개선 및 성능 최적화

- 하드코딩된 값들을 상수로 분리
- 낙관적 업데이트 적용으로 응답 속도 개선
- silent 모드 데이터 페칭 추가
```

## 14. 금지 사항

❌ **절대 하지 말 것:**
1. 하드코딩된 문자열을 직접 사용
2. 매직 넘버 (숫자 리터럴) 직접 사용
3. 불필요한 `any` 타입 남용
4. 에러를 무시하고 넘어가기
5. 컴포넌트 내부에 상수 정의 (외부로 이동)
6. 긴 함수 (30줄 이상이면 분리)
7. 중복 코드 (DRY 원칙)

## 15. 필수 사항

✅ **반드시 지킬 것:**
1. 모든 상수는 파일 상단에 그룹화
2. TypeScript 타입 오류 0개 유지
3. 사용자 액션은 즉시 피드백 (낙관적 업데이트)
4. 에러 처리 완전성
5. 한국어 메시지는 상수로 관리
6. 성능 최적화 고려 (불필요한 렌더링 방지)
