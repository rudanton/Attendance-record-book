# PowerShell script to stop the development environment
param(
    [int]$Port = 3000
)

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Stopping Development Server" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping process on port $Port..." -ForegroundColor Yellow

try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    $pid = $conn.OwningProcess
    if ($pid) {
        Write-Host "Stopping process PID $pid..." -ForegroundColor Cyan
        Stop-Process -Id $pid -Force
        Write-Host "[SUCCESS] Server stopped successfully." -ForegroundColor Green
    } else {
        Write-Host "[INFO] No process found." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[INFO] No server running on port $Port." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   Completed" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
