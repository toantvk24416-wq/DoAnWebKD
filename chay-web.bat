@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:3000"
node server.js
pause
