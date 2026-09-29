@echo off
title NG Financial System - NG Academy
color 0B

echo ===================================================================
echo               NG Financial System - NG Academy
echo             نظام الإدارة المالية لأكاديمية NG Academy
echo ===================================================================
echo.
echo [1/3] Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js (v18+) from https://nodejs.org
    pause
    exit /b 1
)

echo [2/3] Initializing local database and dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo [3/3] Starting NG Financial Local Desktop Server...
echo Database: MariaDB 10.11.7 (localhost:3306/ng_financial)
echo Offline Local Server: http://localhost:5000
echo.

start "" http://localhost:5000
node server/index.js
pause
