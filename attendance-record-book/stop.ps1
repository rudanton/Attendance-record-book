# PowerShell script to stop the development environment
param(
    [int]$Port = 3000
)

# 한글 인코딩 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Stopping Development Server" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping process on port $Port..." -ForegroundColor Yellow

$success = $false
try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    $pid = $conn.OwningProcess
    if ($pid) {
        Write-Host "Stopping process PID $pid..." -ForegroundColor Cyan
        Stop-Process -Id $pid -Force
        Write-Host "[SUCCESS] Server stopped successfully." -ForegroundColor Green
        $success = $true
    } else {
        Write-Host "[INFO] No process found." -ForegroundColor Yellow
        $success = $true
    }
} catch {
    Write-Host "[INFO] No server running on port $Port." -ForegroundColor DarkGray
    $success = $true
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   Completed" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

if ($success) {
    exit 0
} else {
    Write-Host "Closing in 5 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    exit 1
}
