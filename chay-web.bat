@echo off
cd /d "%~dp0"
title Web Davines - dung tat cua so nay khi dang dung web
where node >/dev/null 2>nul
if errorlevel 1 (
  echo Chua cai Node.js. Hay tai ban LTS o https://nodejs.org roi chay lai file nay.
  pause
  exit /b 1
)
chcp 65001 >nul
start "" cmd /c "timeout /t 2 /nobreak >/dev/null & start http://localhost:3000"
node server.js
echo.
echo 
pause
