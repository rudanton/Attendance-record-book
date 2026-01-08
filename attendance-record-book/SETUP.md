# 매장 PC 설정 가이드

출퇴근 관리 웹앱을 매장 PC에서 실행하기 위한 설정 절차입니다.

## 필수 설치 프로그램

### 1. Git 설치
- 웹사이트: https://git-scm.com
- Windows 버전 다운로드
- 설치 중 모든 기본 설정으로 진행 (Next 반복)
- 설치 후 확인:
  ```powershell
  git --version
  ```

### 2. Node.js 설치
- 웹사이트: https://nodejs.org
- **LTS (Long Term Support)** 버전 다운로드
- 설치 중 모든 기본 설정으로 진행 (Next 반복)
- 설치 후 확인:
  ```powershell
  node --version
  npm --version
  ```

---

## 설정 절차

### 1단계: 저장소 클론
PowerShell을 열고 다음 명령어 실행:

```powershell
git clone https://github.com/rudanton/Attendance-record-book.git
cd Attendance-record-book/attendance-record-book
```

### 2단계: 환경 설정 파일 복사
전달받은 `.env.local` 파일을 현재 폴더(`attendance-record-book`)에 복사합니다.

파일 경로 확인:
```
attendance-record-book/
  .env.local  ← 여기에 복사
  start.bat
  package.json
  ...
```

### 3단계: 앱 실행
다음 중 하나 선택:

**옵션 A: 배치 파일 실행 (권장)**
```powershell
.\start.bat
```
또는 파일 탐색기에서 `start.bat` 파일 더블클릭

**옵션 B: 수동 명령어 실행**
```powershell
git pull
npm install
npm run dev
```

### 4단계: 브라우저 접속
자동으로 브라우저가 열리고 `http://localhost:3000`에 접속됩니다.

만약 자동 열림이 안 되면 수동으로 주소창에 `http://localhost:3000` 입력.

---

## 이후 업데이트 방법

코드 수정 후 최신 버전 적용:

```powershell
.\start.bat
```

`start.bat`가 자동으로 `git pull`을 실행하여 최신 코드를 가져옵니다.

---

## 문제 해결

### 명령어를 인식하지 못할 때
- Git 또는 Node.js 설치가 완료되지 않았을 수 있음
- PC를 재부팅 후 다시 시도

### 포트 3000이 이미 사용 중이라는 오류
- 기존 `npm run dev` 프로세스 종료
- PC 재부팅 후 다시 시도

### Firebase 연결 오류
- `.env.local` 파일이 올바르게 복사되었는지 확인
- 인터넷 연결 확인

---

## 앱 종료
터미널에서 `Ctrl + C` 입력하여 종료합니다.
