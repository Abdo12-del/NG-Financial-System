@echo off
setlocal
chcp 65001 >nul
title Build NG Financial System Setup

set "PROJECT_ROOT=%~dp0.."
set "ISS_COMPILER=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not exist "%ISS_COMPILER%" set "ISS_COMPILER=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if not exist "%ISS_COMPILER%" set "ISS_COMPILER=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"

if not exist "%ISS_COMPILER%" (
    echo [ERROR] Inno Setup 6 is not installed.
    echo Install it from https://jrsoftware.org/isdl.php and run this script again.
    exit /b 1
)

if not exist "%PROJECT_ROOT%\client\node_modules\.bin\vite.cmd" (
    echo [ERROR] Client dependencies are missing. Run "npm install" from the project root first.
    exit /b 1
)

echo Building the latest client application...
pushd "%PROJECT_ROOT%\client"
call npm run build
set "BUILD_EXIT_CODE=%errorlevel%"
popd
if not "%BUILD_EXIT_CODE%"=="0" (
    echo [ERROR] Client build failed.
    exit /b %BUILD_EXIT_CODE%
)

if not exist "%PROJECT_ROOT%\node_modules\better-sqlite3\prebuilds\win32-x64.node" (
    echo [ERROR] better-sqlite3 native module is missing. Run "npm install" from the project root first.
    exit /b 1
)

if not exist "%PROJECT_ROOT%\node_modules\electron\dist\electron.exe" (
    echo [ERROR] Electron runtime is missing. Run "npm install" from the project root first.
    exit /b 1
)

for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE (
    echo [ERROR] Node.js is not installed or not available in PATH.
    exit /b 1
)

echo Building NG Financial System Setup with:
echo   Node: "%NODE_EXE%"
echo   Inno Setup: "%ISS_COMPILER%"
call "%ISS_COMPILER%" "%~dp0NG-Financial-System.iss"
exit /b %errorlevel%