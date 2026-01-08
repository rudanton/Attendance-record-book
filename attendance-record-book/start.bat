@echo off
cd /d "%~dp0"
echo Updating from repository...
git pull
echo.
echo Installing dependencies...
npm install
echo.
echo Starting development server...
start npm run dev
timeout /t 3 /nobreak
echo Opening browser...
start http://localhost:3000
pause
