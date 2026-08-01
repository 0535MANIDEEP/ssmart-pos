@echo off
title SS Mart POS
color 0A
cls

echo.
echo   ==============================
echo    SS Mart POS - Starting...
echo   ==============================
echo.

:: Check if Electron app exists
if exist "dist-electron\SS Mart Setup.exe" (
    echo   Launching SS Mart Desktop App...
    start "" "dist-electron\SS Mart Setup.exe"
) else if exist "electron\main.js" (
    echo   Launching SS Mart in development mode...
    cd /d "%~dp0"
    npx electron .
) else (
    echo   Starting web version...
    
    :: Kill any existing processes on our ports
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING" 2^>nul') do taskkill /PID %%a /F /T >nul 2>&1
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":1994" ^| findstr "LISTENING" 2^>nul') do taskkill /PID %%a /F /T >nul 2>&1

    :: Start Backend
    echo   Starting backend on port 4000...
    start "SS Mart Backend" /MIN cmd /c "cd /d %~dp0backend && node src/server.js"

    :: Wait for backend to be ready
    timeout /t 2 /nobreak >nul

    :: Start Frontend (production)
    echo   Starting frontend on port 1994...
    start "SS Mart Frontend" /MIN cmd /c "cd /d %~dp0frontend && npx next start -p 1994"

    :: Wait for frontend to start
    echo   Waiting for frontend...
    timeout /t 4 /nobreak >nul

    :: Open browser
    echo   Opening browser...
    start http://localhost:1994/login
)

echo.
echo   ==============================
echo    SS Mart is running!
echo   ==============================
echo.
pause
