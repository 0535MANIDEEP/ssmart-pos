@echo off
REM ============================================
REM SS Mart — Cross-Platform Build Script
REM Builds for: Windows, macOS, Linux, Android, iOS
REM ============================================

echo ========================================
echo   SS Mart - Cross-Platform Build
echo ========================================
echo.

REM --- Prerequisites Check ---
echo [1/6] Checking prerequisites...

where node >nul 2>&1 || (echo ERROR: Node.js not found && exit /b 1)
where cargo >nul 2>&1 || (echo ERROR: Rust not found. Install: https://rustup.rs && exit /b 1)

REM Check Tauri CLI
cargo tauri --version >nul 2>&1 || (
    echo Installing Tauri CLI...
    cargo install tauri-cli --version "^2"
)

REM Check Java for Android
if not defined JAVA_HOME (
    echo WARNING: JAVA_HOME not set. Android builds will be skipped.
    set SKIP_ANDROID=1
)

echo Prerequisites OK.
echo.

REM --- Build Frontend ---
echo [2/6] Building frontend (Next.js)...
cd frontend
call npx next build
if %ERRORLEVEL% neq 0 (echo ERROR: Frontend build failed && exit /b 1)
cd ..
echo Frontend built.
echo.

REM --- Build Backend ---
echo [3/6] Building backend (TypeScript)...
cd backend
call npx tsc
if %ERRORLEVEL% neq 0 (echo ERROR: Backend build failed && exit /b 1)
cd ..
echo Backend built.
echo.

REM --- Generate Icons ---
echo [4/6] Generating icons...
if exist "scripts\generate-icons.bat" (
    call scripts\generate-icons.bat
) else (
    echo No icon generation script found. Skipping.
)
echo.

REM --- Build Desktop (Tauri) ---
echo [5/6] Building desktop app (Tauri)...
echo.
echo   Platform: %OS%
echo.

REM Detect platform and build accordingly
if "%OS%"=="Windows_NT" (
    echo Building for Windows...
    cargo tauri build --target x86_64-pc-windows-msvc
) else (
    echo Building for current platform...
    cargo tauri build
)

if %ERRORLEVEL% neq 0 (echo ERROR: Desktop build failed && exit /b 1)

echo Desktop build complete.
echo.

REM --- Build Mobile (Capacitor) ---
echo [6/6] Building mobile app (Capacitor)...

REM Check if Capacitor is installed
cd frontend
call npx cap sync 2>nul
if %ERRORLEVEL% neq 0 (
    echo Capacitor not configured. Skipping mobile builds.
    echo To set up: npx cap init && npx cap add android && npx cap add ios
    cd ..
    goto :done
)
cd ..

REM Android
if not defined SKIP_ANDROID (
    echo Building Android APK...
    cd frontend
    call npx cap build android
    cd ..
    echo Android build complete.
)

REM iOS (only on macOS)
if "%OS%"=="Darwin" (
    echo Building iOS...
    cd frontend
    call npx cap build ios
    cd ..
    echo iOS build complete.
) else (
    echo Skipping iOS (requires macOS).
)

:done
echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Outputs:
echo   Windows: src-tauri/target/release/bundle/
echo   Android: frontend/android/app/build/outputs/apk/
echo   iOS:     frontend/ios/App/App.xcarchive
echo.
echo To install Windows:
echo   Run the .exe or .msi installer from the bundle folder
echo.
pause
