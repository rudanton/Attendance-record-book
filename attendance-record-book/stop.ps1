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

Write-Host "Stopping all Node.js processes on port $Port..." -ForegroundColor Yellow

$stopped = $false

# Method 1: Stop by port (LISTENING state)
try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    $pid = $conn.OwningProcess
    if ($pid) {
        Write-Host "Stopping LISTENING process PID $pid..." -ForegroundColor Cyan
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        $stopped = $true
    }
} catch {
    Write-Host "[INFO] No LISTENING process found on port $Port." -ForegroundColor DarkGray
}

# Method 2: Stop all connections on port 3000
try {
    $allConns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    foreach ($conn in $allConns) {
        $pid = $conn.OwningProcess
        if ($pid) {
            Write-Host "Stopping connected process PID $pid..." -ForegroundColor Cyan
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
    }
} catch {
    # Silently continue
}

# Method 3: Stop all node.exe processes (fallback)
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "Stopping all Node.js processes..." -ForegroundColor Cyan
    foreach ($proc in $nodeProcesses) {
        Write-Host "  Stopping PID $($proc.Id)..." -ForegroundColor Gray
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        $stopped = $true
    }
}

# Method 4: Stop hidden cmd processes
$cmdProcesses = Get-Process -Name "cmd" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -eq 0 }
if ($cmdProcesses) {
    Write-Host "Stopping hidden CMD processes..." -ForegroundColor Cyan
    foreach ($proc in $cmdProcesses) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        $stopped = $true
    }
}

if ($stopped) {
    Write-Host "[SUCCESS] Server processes stopped." -ForegroundColor Green
} else {
    Write-Host "[INFO] No server running." -ForegroundColor Yellow
}

$success = $true

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
