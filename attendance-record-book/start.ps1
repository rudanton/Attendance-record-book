# PowerShell script to run the development environment
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   출퇴근 기록부 웹앱 시작" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check for .env.local
if (-not (Test-Path ".env.local")) {
    Write-Host "[오류] .env.local 파일이 없습니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "해결 방법:" -ForegroundColor Yellow
    Write-Host "1. 개인 드라이브에서 .env.local 파일 다운로드"
    Write-Host "2. 현재 폴더에 복사"
    Write-Host "3. start.bat을 다시 실행"
    Write-Host ""
    Read-Host "Enter 키를 눌러 종료"
    exit 1
}

Write-Host "[1/4] 저장소 업데이트 중..." -ForegroundColor Cyan
git pull
if ($LASTEXITCODE -ne 0) {
    Write-Host "[경고] git pull 실패. 계속 진행합니다." -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[2/4] npm 설정 확인 중..." -ForegroundColor Cyan
$clearCache = Read-Host "npm 캐시를 초기화하시겠습니까? (Y/N, 기본값: N)"
if ($clearCache -eq "Y" -or $clearCache -eq "y") {
    Write-Host "npm 캐시 초기화 중..." -ForegroundColor Yellow
    npm cache clean --force
}
Write-Host ""

Write-Host "[3/4] 의존성 설치 중..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[오류] npm install 실패했습니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "해결 방법:" -ForegroundColor Yellow
    Write-Host "1. 인터넷 연결 확인"
    Write-Host "2. Node.js가 제대로 설치되었는지 확인"
    Write-Host "   (PowerShell에서 'node --version' 입력)"
    Write-Host "3. 이 파일을 다시 실행"
    Write-Host ""
    Read-Host "Enter 키를 눌러 종료"
    exit 1
}
Write-Host ""

# Check if port 3000 is already in use
Write-Host "[4/4] 개발 서버 시작 중..." -ForegroundColor Cyan
$portInUse = netstat -ano | Select-String ":3000"
if ($portInUse) {
    Write-Host "[경고] 포트 3000이 이미 사용 중입니다." -ForegroundColor Yellow
    Write-Host "기존 프로세스를 종료하고 진행합니다..." -ForegroundColor Yellow
    $pid = $portInUse[0] -split '\s+' | Select-Object -Last 1
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden

Write-Host "서버 시작 대기 중..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "브라우저 열기 중..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   웹앱이 시작되었습니다!" -ForegroundColor Green
Write-Host "   http://localhost:3000 에서 접속 가능합니다." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
