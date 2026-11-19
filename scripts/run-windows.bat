@echo off
setlocal
title NG Financial System - NG Academy
color 0B

set "APP_ROOT=%~dp0.."
cd /d "%APP_ROOT%"

if exist "%APP_ROOT%\electron-runtime\electron.exe" (
    start "NG Financial System" "%APP_ROOT%\electron-runtime\electron.exe" "%APP_ROOT%\electron-app"
    exit /b 0
)

echo ===================================================================
echo               NG Financial System - NG Academy
echo             نظام الإدارة المالية لأكاديمية NG Academy
echo ===================================================================
echo.
echo [1/3] Checking Node.js installation...
set "NODE_EXE=%APP_ROOT%\runtime\node.exe"
if exist "%NODE_EXE%" goto node_available
set "NODE_EXE=node"
where node >nul 2>nul
if not errorlevel 1 goto node_available
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js version 18 or later from https://nodejs.org
    pause
    exit /b 1
:node_available

echo [2/3] Initializing local database and dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo [3/3] Starting NG Financial Local Desktop Server...
echo Database: Embedded SQLite (MariaDB can be configured in Settings)
echo Offline Local Server: http://localhost:3000
echo.

start "" http://localhost:3000
"%NODE_EXE%" server/index.js
pause
