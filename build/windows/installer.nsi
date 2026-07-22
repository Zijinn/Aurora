Unicode true

!include "MUI2.nsh"
!include "FileFunc.nsh"

!ifndef VERSION
  !define VERSION "1.4.0"
!endif
!ifndef APP_EXE
  !error "APP_EXE must point to Aurora.exe"
!endif
!ifndef APP_ICON
  !error "APP_ICON must point to Aurora.ico"
!endif
!ifndef LICENSE_FILE
  !error "LICENSE_FILE must point to LICENSE"
!endif
!ifndef WEBVIEW2_BOOTSTRAPPER
  !error "WEBVIEW2_BOOTSTRAPPER must point to MicrosoftEdgeWebview2Setup.exe"
!endif
!ifndef WEB_ASSETS
  !error "WEB_ASSETS must point to the built web/dist directory"
!endif
!ifndef OUT_FILE
  !define OUT_FILE "Aurora-${VERSION}-windows-x64-setup.exe"
!endif

Name "Aurora"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Aurora"
InstallDirRegKey HKCU "Software\Aurora" "InstallDir"
RequestExecutionLevel user
ManifestDPIAware true

VIProductVersion "${VERSION}.0"
VIFileVersion "${VERSION}.0"
VIAddVersionKey "CompanyName" "Aurora contributors"
VIAddVersionKey "FileDescription" "Aurora installer"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright 2026 Aurora contributors. GPL-3.0-only."
VIAddVersionKey "ProductName" "Aurora"

!define MUI_ABORTWARNING
!define MUI_ICON "${APP_ICON}"
!define MUI_UNICON "${APP_ICON}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${LICENSE_FILE}"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Aurora" SEC_AURORA
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /oname=Aurora.exe "${APP_EXE}"
  File /oname=LICENSE.txt "${LICENSE_FILE}"
  SetOutPath "$INSTDIR\web\dist"
  File /r "${WEB_ASSETS}\*"

  SetOutPath "$PLUGINSDIR"
  File /oname=MicrosoftEdgeWebview2Setup.exe "${WEBVIEW2_BOOTSTRAPPER}"
  ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install'

  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Aurora" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Aurora" "DisplayName" "Aurora"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Aurora" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Aurora" "Publisher" "Aurora contributors"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Aurora" "DisplayIcon" "$INSTDIR\Aurora.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Aurora" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Aurora" "EstimatedSize" $0
  CreateDirectory "$SMPROGRAMS\Aurora"
  CreateShortcut "$SMPROGRAMS\Aurora\Aurora.lnk" "$INSTDIR\Aurora.exe"
  CreateShortcut "$DESKTOP\Aurora.lnk" "$INSTDIR\Aurora.exe"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\Aurora.lnk"
  Delete "$SMPROGRAMS\Aurora\Aurora.lnk"
  RMDir "$SMPROGRAMS\Aurora"
  Delete "$INSTDIR\Aurora.exe"
  Delete "$INSTDIR\LICENSE.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Aurora"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Aurora"
SectionEnd
