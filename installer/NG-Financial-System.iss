; =====================================================================
; NG Financial System - Inno Setup Script
; مثبت الإعداد الاحترافي لنظام الإدارة المالية - NG Academy
; Compatible with: Windows 10, Windows 11, Windows Server (x64)
; Target Database: MariaDB 10.11.7 Winx64
; =====================================================================

#define MyAppName "NG Financial System"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "NG Academy"
#define MyAppURL "https://ngacademy.dz"
#define MyAppExeName "NG-Financial-System.exe"
#define MyAppAssocName "NG Financial File"
#define MyAppAssocExt ".ngfin"

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

; Branding & Visuals
SetupIconFile=..\client\public\favicon.ico
UninstallDisplayIcon={app}\client\public\favicon.ico
WizardSmallImageFile=..\client\public\icon.bmp
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=no

; Permissions & Architecture
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode
Name: "automariadb"; Description: "تهيئة قاعدة بيانات MariaDB 10.11.7 محلياً وإنشاء الجداول تلقائياً"; GroupDescription: "تهيئة قاعدة البيانات:"

[Files]
; Application Core Files
Source: "..\_internal\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\database\schema.sql"; DestDir: "{app}\database"; Flags: ignoreversion
Source: "..\database\seed.sql"; DestDir: "{app}\database"; Flags: ignoreversion
Source: "..\scripts\run-windows.bat"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\client\public\favicon.ico"; DestDir: "{app}\assets"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\scripts\run-windows.bat"; IconFilename: "{app}\assets\favicon.ico"; Comment: "تشغيل نظام الإدارة المالية NG Financial System"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"; IconFilename: "{app}\assets\favicon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\scripts\run-windows.bat"; IconFilename: "{app}\assets\favicon.ico"; Tasks: desktopicon; Comment: "NG Financial System - NG Academy"

[Run]
; Auto-Configure MariaDB Database if user selected task
Filename: "{cmd}"; Parameters: "/c mysql -u root -h localhost -e ""CREATE DATABASE IF NOT EXISTS ng_financial CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"" && mysql -u root -h localhost ng_financial < ""{app}\database\schema.sql"""; Flags: runhidden; Tasks: automariadb; StatusMsg: "جاري تهيئة قاعدة بيانات MariaDB المحلية (ng_financial)..."

; Launch Application on Finish
Filename: "{app}\scripts\run-windows.bat"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: files; Name: "{app}\data\ng_financial.db-shm"
Type: files; Name: "{app}\data\ng_financial.db-wal"
Type: dirifempty; Name: "{app}\data"
Type: dirifempty; Name: "{app}"
