@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title NG Financial System - معالج التثبيت الاحترافي لويندوز
color 0B

echo ==============================================================================
echo                      NG Financial System - NG Academy
echo                  معالج التثبيت والإعداد الاحترافي لنظام ويندوز
echo ==============================================================================
echo.

:: 1. Check Administrator Privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [تنبيه] يتطلب التثبيت صلاحيات مسؤول النظام (Administrator).
    echo جاري طلب الصلاحيات...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

set "NODE_EXE="
for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE (
    echo [خطأ] يلزم تثبيت Node.js على جهاز التثبيت لتضمين وقت التشغيل.
    pause
    exit /b 1
)

:: 2. Set Installation Directory
set "INSTALL_DIR=C:\Program Files\NG Financial System"
echo [1/5] مسار التثبيت الافتراضي:
echo       !INSTALL_DIR!
echo.
set /p USER_CHOICE="هل ترغب في متابعة التثبيت في هذا المسار؟ (Y/N) [الافتراضي: Y]: "
if /i "!USER_CHOICE!"=="N" (
    set /p INSTALL_DIR="الرجاء إدخال المسار المخصص المطلوب: "
)

echo.
echo [2/5] جاري إنشاء مجلدات النظام ونسخ الملفات...
mkdir "!INSTALL_DIR!" 2>nul
mkdir "!INSTALL_DIR!\database" 2>nul
mkdir "!INSTALL_DIR!\server" 2>nul
mkdir "!INSTALL_DIR!\client\dist" 2>nul
mkdir "!INSTALL_DIR!\scripts" 2>nul
mkdir "!INSTALL_DIR!\mariadb-10.11.7-winx64" 2>nul
mkdir "!INSTALL_DIR!\runtime" 2>nul
mkdir "!INSTALL_DIR!\data" 2>nul
icacls "!INSTALL_DIR!\data" /grant "*S-1-5-32-545:(OI)(CI)M" >nul

xcopy "%~dp0..\server" "!INSTALL_DIR!\server" /E /I /Y /Q >nul
xcopy "%~dp0..\client\dist" "!INSTALL_DIR!\client\dist" /E /I /Y /Q >nul
xcopy "%~dp0..\database" "!INSTALL_DIR!\database" /E /I /Y /Q >nul
xcopy "%~dp0..\scripts" "!INSTALL_DIR!\scripts" /E /I /Y /Q >nul
xcopy "%~dp0..\mariadb-10.11.7-winx64" "!INSTALL_DIR!\mariadb-10.11.7-winx64" /E /I /Y /Q >nul
xcopy "%~dp0..\node_modules" "!INSTALL_DIR!\node_modules" /E /I /Y /Q >nul
copy /y "%~dp0..\package.json" "!INSTALL_DIR!\" >nul
copy /y "!NODE_EXE!" "!INSTALL_DIR!\runtime\node.exe" >nul
copy /y "%~dp0..\client\public\logo.svg" "!INSTALL_DIR!\client\dist\" >nul

echo [✓] تم نسخ ملفات النظام بنجاح.
echo.

:: 3. The application provisions bundled MariaDB and migrates SQLite data on first launch.
echo [3/5] سيُهيئ التطبيق MariaDB المحلية تلقائياً عند أول تشغيل.
echo     سيتم نقل بيانات SQLite الموجودة مع الاحتفاظ بملفها الأصلي.
echo.

:: 4. Create Desktop & Start Menu Shortcuts using VBScript
echo [4/5] إنشاء اختصارات سطح المكتب وقائمة ابدأ (Desktop & Start Menu Shortcuts)...
set "VBS_SCRIPT=%TEMP%\create_shortcut.vbs"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "STARTMENU_DIR=%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs\NG Financial System"
mkdir "!STARTMENU_DIR!" 2>nul

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = "!DESKTOP_DIR!\NG Financial System.lnk" >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "!INSTALL_DIR!\scripts\run-windows.bat" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "!INSTALL_DIR!" >> "%VBS_SCRIPT%"
echo oLink.Description = "نظام الإدارة المالية - NG Academy" >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"

echo sLinkFile2 = "!STARTMENU_DIR!\NG Financial System.lnk" >> "%VBS_SCRIPT%"
echo Set oLink2 = oWS.CreateShortcut(sLinkFile2) >> "%VBS_SCRIPT%"
echo oLink2.TargetPath = "!INSTALL_DIR!\scripts\run-windows.bat" >> "%VBS_SCRIPT%"
echo oLink2.WorkingDirectory = "!INSTALL_DIR!" >> "%VBS_SCRIPT%"
echo oLink2.Description = "نظام الإدارة المالية - NG Academy" >> "%VBS_SCRIPT%"
echo oLink2.Save >> "%VBS_SCRIPT%"

cscript //nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%" 2>nul

echo [✓] تم إنشاء اختصار سطح المكتب بنجاح: "NG Financial System.lnk"
echo.

:: 5. Generate Uninstaller Script
echo [5/5] إنشاء معالج إلغاء التثبيت النظيف (Uninstaller)...
(
echo @echo off
echo title إلغاء تثبيت NG Financial System
echo chcp 65001 ^>nul
echo echo هل أنت متأكد من رغبتك في إلغاء تثبيت NG Financial System؟
echo set /p CONFIRM="اكتب Y للمتابعة أو N للإلغاء: "
echo if /i not "%%CONFIRM%%"=="Y" exit /b
echo echo جاري إزالة الاختصارات...
echo del "%USERPROFILE%\Desktop\NG Financial System.lnk" 2^>nul
echo rmdir /s /q "%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs\NG Financial System" 2^>nul
echo echo جاري إزالة ملفات البرنامج...
echo timeout /t 2 ^>nul
echo rmdir /s /q "!INSTALL_DIR!" 2^>nul
echo echo تم إلغاء تثبيت NG Financial System بنجاح من جهازك.
echo pause
) > "!INSTALL_DIR!\Uninstall.bat"

echo ==============================================================================
echo [تهانينا!] اكتمل تثبيت نظام NG Financial System بنجاح على جهازك!
echo ==============================================================================
echo.
echo المسار: !INSTALL_DIR!
echo قاعدة البيانات الافتراضية: MariaDB محلية مرفقة
echo بيانات SQLite السابقة تُنقل تلقائياً عند أول تشغيل
echo الحساب الافتراضي للتسجيل:
echo    اسم المستخدم: admin
echo    كلمة المرور: admin123
echo.
set /p LAUNCH="هل ترغب في تشغيل النظام الآن؟ (Y/N) [الافتراضي: Y]: "
if /i not "!LAUNCH!"=="N" (
    start "" "!INSTALL_DIR!\scripts\run-windows.bat"
)

exit /b 0
