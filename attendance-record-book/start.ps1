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

Write-Host "[1/4] Updating repository..." -ForegroundColor Cyan
git pull
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] git pull failed. Continuing..." -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[2/4] Checking npm configuration..." -ForegroundColor Cyan
$clearCache = Read-Host "Clear npm cache? (Y/N, default: N)"
if ($clearCache -eq "Y" -or $clearCache -eq "y") {
    Write-Host "Clearing npm cache..." -ForegroundColor Yellow
    npm cache clean --force
}
Write-Host ""

Write-Host "[3/4] Installing dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] npm install failed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Solution:" -ForegroundColor Yellow
    Write-Host "1. Check internet connection"
    Write-Host "2. Verify Node.js is installed correctly"
    Write-Host "   (Type 'node --version' in PowerShell)"
    Write-Host "3. Run this script again"
    Write-Host ""
    Write-Host "Closing in 10 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    exit 1
}
Write-Host ""

# Check if port 3000 is already in use
Write-Host "[4/4] Starting development server..." -ForegroundColor Cyan
$portInUse = netstat -ano | Select-String ":3000"
if ($portInUse) {
    Write-Host "[WARNING] Port 3000 is already in use." -ForegroundColor Yellow
    Write-Host "Terminating existing process..." -ForegroundColor Yellow
    $pid = $portInUse[0] -split '\s+' | Select-Object -Last 1
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev > npm.log 2>&1" -WorkingDirectory $PSScriptRoot

# npm dev가 시작될 때까지 대기
Start-Sleep -Seconds 5

$nodeProcess = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcess) {
    Write-Host "Opening browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:3000"
    
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "   Server started successfully!" -ForegroundColor Green
    Write-Host "   Access at http://localhost:3000" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host "[ERROR] Server failed to start. Check npm.log for details." -ForegroundColor Red
    Write-Host ""
    Write-Host "Closing in 10 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    exit 1
}
