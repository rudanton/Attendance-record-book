# Stop the dev server listening on port 3000
param(
    [int]$Port = 3000
)

Write-Host "Stopping dev server on port $Port..." -ForegroundColor Yellow

try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    $pid = $conn.OwningProcess
    if ($pid) {
        Write-Host "Killing process PID $pid" -ForegroundColor Cyan
        Stop-Process -Id $pid -Force
        Write-Host "Stopped." -ForegroundColor Green
    } else {
        Write-Host "No owning process found." -ForegroundColor Red
    }
} catch {
    Write-Host "No server listening on port $Port." -ForegroundColor DarkGray
}
