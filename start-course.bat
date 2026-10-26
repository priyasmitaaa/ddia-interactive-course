@echo off
rem Double-click to start the DDIA course on Windows. Opens http://localhost:5317 in your browser.
rem First run installs dependencies (needs Node.js 18+ from https://nodejs.org).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies - this happens only once...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)
echo Starting the course at http://localhost:5317  (close this window to stop it)
call npm start
pause
