# PowerShell script to run the development environment
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Attendance Record Book - Dev Server" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check for .env.local
if (-not (Test-Path ".env.local")) {
    Write-Host "[ERROR] .env.local file not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Solution:" -ForegroundColor Yellow
    Write-Host "1. Download .env.local from Google Drive"
    Write-Host "2. Copy to current folder"
    Write-Host "3. Run start.bat again"
    Write-Host ""
    Write-Host "Closing in 10 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    exit 1
}

Write-Host "[1/3] Updating repository..." -ForegroundColor Cyan
git pull
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] git pull failed. Continuing..." -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[2/3] Installing dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] npm install failed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Closing in 5 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    exit 1
}
Write-Host ""

# Check if port 3000 is already in use
Write-Host "[START] Starting development server..." -ForegroundColor Cyan
$portInUse = netstat -ano | Select-String ":3000"
if ($portInUse) {
    Write-Host "[WARNING] Port 3000 is already in use." -ForegroundColor Yellow
    Write-Host "Terminating existing process..." -ForegroundColor Yellow
    $pid = $portInUse[0] -split '\s+' | Select-Object -Last 1
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Start npm dev in hidden cmd window (background process)
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WindowStyle Hidden -WorkingDirectory $PSScriptRoot

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   Server starting in background..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Waiting for server to be ready..." -ForegroundColor Cyan

# Wait for port 3000 to be open (faster than waiting for HTTP response)
$maxAttempts = 30
$attempt = 0
$serverReady = $false

while ($attempt -lt $maxAttempts -and -not $serverReady) {
    try {
        $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            $serverReady = $true
        } else {
            $attempt++
            Write-Host "." -NoNewline -ForegroundColor Gray
            Start-Sleep -Milliseconds 500
        }
    } catch {
        $attempt++
        Write-Host "." -NoNewline -ForegroundColor Gray
        Start-Sleep -Milliseconds 500
    }
}

Write-Host ""
if ($serverReady) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "   Server is ready!" -ForegroundColor Green
    Write-Host "   Access at http://localhost:3000" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Opening browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:3000"
    Write-Host ""
    Write-Host "Server is running. Use 'stop.bat' to stop it." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "[WARNING] Server took longer than expected." -ForegroundColor Yellow
    Write-Host "Opening browser anyway. Server might still be loading..." -ForegroundColor Yellow
    Start-Process "http://localhost:3000"
}
Write-Host ""
