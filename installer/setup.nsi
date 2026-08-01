!include "MUI2.nsh"

; ─── General ──────────────────────────────────────────────────────────────────
Name "SS Mart POS"
OutFile "dist\SSMart-Setup.exe"
InstallDir "$LOCALAPPDATA\SSMartPOS"
InstallDirRegKey HKCU "Software\SSMartPOS" "InstallDir"
RequestExecutionLevel user
Icon "build-resources\icon.ico"
UninstallIcon "build-resources\icon.ico"

; ─── Version Info ─────────────────────────────────────────────────────────────
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "SS Mart POS"
VIAddVersionKey "FileDescription" "Offline POS and Inventory Management"
VIAddVersionKey "LegalCopyright" "Copyright 2026 Manideep Daram"
VIAddVersionKey "FileVersion" "1.0.0"

; ─── MUI Settings ────────────────────────────────────────────────────────────
!define MUI_ABORTWARNING
!define MUI_ICON "build-resources\icon.ico"
!define MUI_UNICON "build-resources\icon.ico"

; ─── Pages ────────────────────────────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ─── Installer Sections ──────────────────────────────────────────────────────
Section "SS Mart POS (required)" SecMain
    SectionIn RO

    SetOutPath "$INSTDIR"

    ; Desktop wrapper
    File "dist\desktop\SSMartPos.exe"
    File "dist\desktop\SSMartPos.dll"
    File "dist\desktop\Microsoft.Web.WebView2.dll"
    File /nonfatal "dist\desktop\*.deps.json"
    File /nonfatal "dist\desktop\*.runtimeconfig.json"

    ; Backend
    SetOutPath "$INSTDIR\backend"
    File /r "dist\app\backend\*.*"

    ; Frontend
    SetOutPath "$INSTDIR\frontend"
    File /r "dist\app\frontend\*.*"

    ; Resources
    SetOutPath "$INSTDIR\resources"
    File "dist\app\resources\icon.ico"

    ; Save install directory
    WriteRegStr HKCU "Software\SSMartPOS" "InstallDir" "$INSTDIR"

    ; Start Menu shortcut
    CreateDirectory "$SMPROGRAMS\SS Mart POS"
    CreateShortCut "$SMPROGRAMS\SS Mart POS\SS Mart POS.lnk" \
        "$INSTDIR\SSMartPos.exe" "" "$INSTDIR\resources\icon.ico"
    CreateShortCut "$SMPROGRAMS\SS Mart POS\Uninstall.lnk" \
        "$INSTDIR\uninstall.exe"

    ; Desktop shortcut
    CreateShortCut "$DESKTOP\SS Mart POS.lnk" \
        "$INSTDIR\SSMartPos.exe" "" "$INSTDIR\resources\icon.ico"

    ; Uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"

    ; Add/Remove Programs
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SSMartPOS" \
        "DisplayName" "SS Mart POS"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SSMartPOS" \
        "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SSMartPOS" \
        "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SSMartPOS" \
        "DisplayVersion" "1.0.0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SSMartPOS" \
        "Publisher" "Manideep Daram"
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SSMartPOS" \
        "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SSMartPOS" \
        "NoRepair" 1
SectionEnd

Section "Start with Windows (recommended)" SecAutoStart
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
        "SSMartPOS" '"$INSTDIR\SSMartPos.exe" --minimized'
SectionEnd

; ─── Section Descriptions ────────────────────────────────────────────────────
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecMain} \
        "SS Mart POS application files (required)."
    !insertmacro MUI_DESCRIPTION_TEXT ${SecAutoStart} \
        "Automatically start SS Mart POS when Windows starts. Recommended for shop computers."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ─── Uninstaller ─────────────────────────────────────────────────────────────
Section "Uninstall"
    ; Kill running processes
    nsExec::ExecToLog 'taskkill /F /IM SSMartPos.exe /T 2>nul'
    nsExec::ExecToLog 'taskkill /F /IM node.exe /T 2>nul'

    ; Remove auto-start registry
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SSMartPOS"

    ; Remove files
    RMDir /r "$INSTDIR"

    ; Remove shortcuts
    RMDir /r "$SMPROGRAMS\SS Mart POS"
    Delete "$DESKTOP\SS Mart POS.lnk"

    ; Remove registry keys
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SSMartPOS"
    DeleteRegKey HKCU "Software\SSMartPOS"
SectionEnd
