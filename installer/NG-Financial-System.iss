; =====================================================================
; NG Financial System - Inno Setup Script
; مثبت الإعداد الاحترافي لنظام الإدارة المالية - NG Academy
; Compatible with: Windows 10, Windows 11, Windows Server (x64)
; Default database: bundled local MariaDB 10.11.7; existing SQLite data is migrated on first launch
; =====================================================================

#define MyAppName "NG Financial System"
#define MyAppVersion "1.0.22"
#define MyAppPublisher "NG Academy"
#define MyAppURL "https://ngacademy.dz"
#define NodeExePath GetEnv("NODE_EXE")

#if NodeExePath == ""
	#error "Run installer\\Build-Installer.bat so NODE_EXE is set to the Node.js runtime used to build native dependencies."
#endif

[Setup]
; App Identity
AppId={{C8E19B4A-5762-4D91-8AF5-927A19B53A01}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Destination Folder
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist-installer
OutputBaseFilename=NG-Financial-System-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupIconFile=assets\ng-financial-system.ico
UninstallDisplayIcon={app}\assets\ng-financial-system.ico
WizardImageFile=assets\ng-financial-system-wizard.bmp
WizardSmallImageFile=assets\ng-financial-system-small.bmp

; Branding
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=no

; Permissions & Architecture
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
CloseApplications=force
RestartApplications=no

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Application and local database runtime
Source: "..\server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\node_modules\*"; DestDir: "{app}\node_modules"; Excludes: "electron\*"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\client\dist\*"; DestDir: "{app}\client\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\database\*"; DestDir: "{app}\database"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\mariadb-10.11.7-winx64\*"; DestDir: "{app}\mariadb-10.11.7-winx64"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "assets\ng-financial-system.ico"; DestDir: "{app}\assets"; Flags: ignoreversion
Source: "assets\ng-financial-system-logo.png"; DestDir: "{app}\assets"; Flags: ignoreversion
Source: "..\node_modules\electron\dist\*"; DestDir: "{app}\electron-runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\electron\main.js"; DestDir: "{app}\electron-app"; Flags: ignoreversion
Source: "..\electron\preload.js"; DestDir: "{app}\electron-app"; Flags: ignoreversion
Source: "..\electron\package.json"; DestDir: "{app}\electron-app"; Flags: ignoreversion
Source: "{#NodeExePath}"; DestDir: "{app}\runtime"; DestName: "node.exe"; Flags: ignoreversion
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scripts\run-windows.bat"; DestDir: "{app}\scripts"; Flags: ignoreversion

[Dirs]
Name: "{app}\data"; Permissions: users-modify

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\electron-runtime\electron.exe"; Parameters: """{app}\electron-app"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\ng-financial-system.ico"; Comment: "تشغيل نظام الإدارة المالية NG Financial System"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\electron-runtime\electron.exe"; Parameters: """{app}\electron-app"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\ng-financial-system.ico"; Tasks: desktopicon; Comment: "NG Financial System - NG Academy"

[Run]
; Launch Application on Finish
Filename: "{app}\electron-runtime\electron.exe"; Parameters: """{app}\electron-app"""; WorkingDir: "{app}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: files; Name: "{app}\data\ng_financial.db-shm"
Type: files; Name: "{app}\data\ng_financial.db-wal"
Type: dirifempty; Name: "{app}\data"
Type: dirifempty; Name: "{app}"
