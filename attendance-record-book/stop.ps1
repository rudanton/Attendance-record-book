# PowerShell script to stop the development environment
param(
    [int]$Port = 3000
)

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   출퇴근 기록부 웹앱 종료" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "포트 $Port 에서 실행 중인 프로세스 종료 중..." -ForegroundColor Yellow

try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    $pid = $conn.OwningProcess
    if ($pid) {
        Write-Host "프로세스 PID $pid 종료 중..." -ForegroundColor Cyan
        Stop-Process -Id $pid -Force
        Write-Host "[성공] 웹앱이 종료되었습니다." -ForegroundColor Green
    } else {
        Write-Host "[정보] 소유 프로세스를 찾을 수 없습니다." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[정보] 포트 $Port 에서 실행 중인 서버가 없습니다." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   종료 완료" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Enter 키를 눌러 종료"
