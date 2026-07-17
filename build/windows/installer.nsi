Unicode true

!include "MUI2.nsh"
!include "FileFunc.nsh"

!ifndef VERSION
  !define VERSION "0.1.0"
!endif
!ifndef APP_EXE
  !error "APP_EXE must point to Cairn.exe"
!endif
!ifndef APP_ICON
  !error "APP_ICON must point to Cairn.ico"
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
  !define OUT_FILE "Cairn-${VERSION}-windows-x64-setup.exe"
!endif

Name "Aurora"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Cairn"
InstallDirRegKey HKCU "Software\Cairn" "InstallDir"
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

Section "Cairn" SEC_CAIRN
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /oname=Cairn.exe "${APP_EXE}"
  File /oname=LICENSE.txt "${LICENSE_FILE}"
  SetOutPath "$INSTDIR\web\dist"
  File /r "${WEB_ASSETS}\*"

  SetOutPath "$PLUGINSDIR"
  File /oname=MicrosoftEdgeWebview2Setup.exe "${WEBVIEW2_BOOTSTRAPPER}"
  ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install'

  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Cairn" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cairn" "DisplayName" "Cairn"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cairn" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cairn" "Publisher" "Cairn contributors"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cairn" "DisplayIcon" "$INSTDIR\Cairn.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cairn" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cairn" "EstimatedSize" $0
  CreateDirectory "$SMPROGRAMS\Cairn"
  CreateShortcut "$SMPROGRAMS\Cairn\Cairn.lnk" "$INSTDIR\Cairn.exe"
  CreateShortcut "$DESKTOP\Cairn.lnk" "$INSTDIR\Cairn.exe"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\Cairn.lnk"
  Delete "$SMPROGRAMS\Cairn\Cairn.lnk"
  RMDir "$SMPROGRAMS\Cairn"
  Delete "$INSTDIR\Cairn.exe"
  Delete "$INSTDIR\LICENSE.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Cairn"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Cairn"
SectionEnd
