@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title حزم النسخة المحمولة - NG Financial System Portable
color 0A

echo ==============================================================================
echo                 إنشاء النسخة المحمولة (Portable Edition)
echo                      NG Financial System - NG Academy
echo ==============================================================================
echo.

set "PORTABLE_DIR=%~dp0..\NG-Financial-System-Portable"
echo [1/3] جاري تجهيز مجلد النسخة المحمولة...
if exist "!PORTABLE_DIR!" rmdir /s /q "!PORTABLE_DIR!"
mkdir "!PORTABLE_DIR!"
mkdir "!PORTABLE_DIR!\server"
mkdir "!PORTABLE_DIR!\client\dist"
mkdir "!PORTABLE_DIR!\database"
mkdir "!PORTABLE_DIR!\data"
mkdir "!PORTABLE_DIR!\scripts"

echo [2/3] جاري نسخ الملفات والحزم المدمجة...
xcopy "%~dp0..\server" "!PORTABLE_DIR!\server" /E /I /Y /Q >nul
xcopy "%~dp0..\client\dist" "!PORTABLE_DIR!\client\dist" /E /I /Y /Q >nul
xcopy "%~dp0..\database" "!PORTABLE_DIR!\database" /E /I /Y /Q >nul
xcopy "%~dp0..\scripts" "!PORTABLE_DIR!\scripts" /E /I /Y /Q >nul
xcopy "%~dp0..\node_modules" "!PORTABLE_DIR!\node_modules" /E /I /Y /Q >nul
copy /y "%~dp0..\package.json" "!PORTABLE_DIR!\" >nul
copy /y "%~dp0..\client\public\logo.svg" "!PORTABLE_DIR!\client\dist\" >nul

:: Create root launcher
(
echo @echo off
echo title NG Financial System - Portable Edition
echo chcp 65001 ^>nul
echo echo تشغيل النسخة المحمولة لـ NG Financial System...
echo start "" http://localhost:3000
echo cd /d "%%~dp0"
echo node server/index.js
echo pause
) > "!PORTABLE_DIR!\تشغيل_النظام_المحمول.bat"

echo [3/3] إنشاء ملف تعليمات التشغيل السريع...
(
echo ========================================================
echo           NG Financial System - النسخة المحمولة
echo ========================================================
echo.
echo هذه النسخة تعمل بشكل محمول بالكامل بدون الحاجة لتثبيت مسبق:
echo 1. انقر نقراً مزدوجاً على "تشغيل_النظام_المحمول.bat"
echo 2. سيفتح النظام تلقائياً في متصفحك أو عبر تطبيق سطح المكتب
echo 3. للاتصال بـ MariaDB 10.11.7: ادخل إلى الإعدادات وأدخل بيانات خادمك
echo 4. تعمل قاعدة البيانات المحلية المدمجة فوراً في حالة عدم وجود MariaDB.
) > "!PORTABLE_DIR!\README_PORTABLE.txt"

echo.
echo [✓] تم تجهيز النسخة المحمولة بنجاح في المسار:
echo     !PORTABLE_DIR!
echo.
pause
