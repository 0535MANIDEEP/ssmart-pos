@echo off
setlocal
title SS Mart POS - Desktop Build
color 0B

echo.
echo  ===================================
echo   SS Mart POS - Desktop Build
echo  ===================================
echo.

:: Check for .NET SDK
dotnet --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: .NET SDK not found!
    echo  Download from: https://dotnet.microsoft.com/download/dotnet/8.0
    echo.
    pause
    exit /b 1
)

:: Check for NSIS (optional, for installer)
set "NSIS_PATH="
if exist "C:\Program Files (x86)\NSIS\makensis.exe" (
    set "NSIS_PATH=C:\Program Files (x86)\NSIS\makensis.exe"
) else if exist "C:\Program Files\NSIS\makensis.exe" (
    set "NSIS_PATH=C:\Program Files\NSIS\makensis.exe"
)

echo  [1/4] Building frontend...
cd /d "%~dp0frontend"
call npm install --silent
call npx next build
if %errorlevel% neq 0 (
    echo  FAILED: Frontend build
    pause
    exit /b 1
)
echo  Frontend build OK.
echo.

echo  [2/4] Building backend...
cd /d "%~dp0backend"
call npm install --silent
call npx prisma generate
if %errorlevel% neq 0 (
    echo  FAILED: Backend build
    pause
    exit /b 1
)
echo  Backend build OK.
echo.

echo  [3/4] Building C# desktop wrapper...
cd /d "%~dp0desktop"
call dotnet publish -c Release -r win-x64 --self-contained false -o "..\dist\desktop"
if %errorlevel% neq 0 (
    echo  FAILED: C# build. Install .NET 8 SDK from https://dotnet.microsoft.com/download/dotnet/8.0
    pause
    exit /b 1
)
echo  C# build OK.
echo.

echo  [4/4] Copying runtime files...
cd /d "%~dp0"

:: Copy backend to dist
if not exist "dist\app\backend" mkdir "dist\app\backend"
xcopy /E /I /Y "backend\src" "dist\app\backend\src" >nul
xcopy /E /I /Y "backend\prisma" "dist\app\backend\prisma" >nul
xcopy /E /I /Y "backend\node_modules" "dist\app\backend\node_modules" >nul
copy /Y "backend\package.json" "dist\app\backend\" >nul
copy /Y "backend\package-lock.json" "dist\app\backend\" >nul
if exist "backend\data" xcopy /E /I /Y "backend\data" "dist\app\backend\data" >nul

:: Copy frontend to dist
if not exist "dist\app\frontend" mkdir "dist\app\frontend"
xcopy /E /I /Y "frontend\.next" "dist\app\frontend\.next" >nul
xcopy /E /I /Y "frontend\node_modules" "dist\app\frontend\node_modules" >nul
xcopy /E /I /Y "frontend\public" "dist\app\frontend\public" >nul
copy /Y "frontend\package.json" "dist\app\frontend\" >nul
copy /Y "frontend\next.config.ts" "dist\app\frontend\" >nul

:: Copy icon
if not exist "dist\app\resources" mkdir "dist\app\resources"
copy /Y "build-resources\icon.png" "dist\app\resources\icon.ico" >nul

echo  Runtime files copied.
echo.

echo  ===================================
echo   BUILD COMPLETE
echo  ===================================
echo.
echo  Desktop wrapper: dist\desktop\SSMartPos.exe
echo  Full app:       dist\app\
echo.
echo  To create installer, install NSIS and run:
echo    "C:\Program Files (x86)\NSIS\makensis.exe" installer\setup.nsi
echo.
echo  Or just run directly:
echo    dist\desktop\SSMartPos.exe
echo.

if defined NSIS_PATH (
    echo  NSIS found! Building installer...
    "%NSIS_PATH%" "%~dp0installer\setup.nsi"
    if %errorlevel% equ 0 (
        echo  Installer built: dist\SSMart-Setup.exe
    ) else (
        echo  Installer build failed. Check installer\setup.nsi
    )
) else (
    echo  NSIS not found. Install from https://nsis.sourceforge.io
)

echo.
pause
endlocal
