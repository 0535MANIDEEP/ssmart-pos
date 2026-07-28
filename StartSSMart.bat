@echo off
title SS Mart POS
echo.
echo   Starting SS Mart...
echo.

:: Start Backend
start /MIN "" cmd /c "cd /d D:\Projects\ssmart-pos\backend && node src/server.js"

:: Start Frontend (production - instant, no compilation)
start /MIN "" cmd /c "cd /d D:\Projects\ssmart-pos\frontend && npx next start -p 1994"

:: Wait then open browser
timeout /t 4 /nobreak >nul
start http://localhost:1994/login

echo   SS Mart is running.
echo   Close this window to STOP.
pause
