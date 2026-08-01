@echo off
REM ============================================
REM SS Mart — Generate Tauri Icons from PNG
REM ============================================
REM Requires: ImageMagick (https://imagemagick.org)
REM Usage: scripts\generate-icons.bat
REM ============================================

set SRC=build-resources\icon.png
set OUT=src-tauri\icons

if not exist "%SRC%" (
    echo ERROR: %SRC% not found. Place your 1024x1024 PNG there.
    exit /b 1
)

if not exist "%OUT%" mkdir "%OUT%"

echo Generating Tauri icons from %SRC%...

REM Windows icons
magick "%SRC%" -resize 32x32 "%OUT%\32x32.png"
magick "%SRC%" -resize 128x128 "%OUT%\128x128.png"
magick "%SRC%" -resize 256x256 "%OUT%\128x128@2x.png"
magick "%SRC%" -resize 256x256 "%OUT%\icon.ico"

REM macOS icon
magick "%SRC%" -resize 128x128 "%OUT%\icon.icns" 2>nul

REM Linux icons
magick "%SRC%" -resize 32x32 "%OUT%\32x32.png"
magick "%SRC%" -resize 128x128 "%OUT%\128x128.png"
magick "%SRC%" -resize 256x256 "%OUT%\128x128@2x.png"
magick "%SRC%" -resize 512x512 "%OUT%\icon.png"

REM Mobile icons (Capacitor)
if not exist "src-capacitor\android\app\src\main\res\mipmap-xxxhdpi" mkdir "src-capacitor\android\app\src\main\res\mipmap-xxxhdpi"
magick "%SRC%" -resize 192x192 "src-capacitor\android\app\src\main\res\mipmap-xxxhdpi\icon.png" 2>nul
magick "%SRC%" -resize 1024x1024 "src-capacitor\ios\App\App\Assets.xcassets\AppIcon.appiconset\icon-1024.png" 2>nul

echo Done! Icons generated in %OUT%
