@echo off
chcp 65001 >nul
title Document Management System — e-Office DMS
color 0b

echo.
echo ======================================================================
echo      ENTERPRISE E-OFFICE — DOCUMENT MANAGEMENT SYSTEM
echo ======================================================================
echo.
echo [1/3] Checking environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on this computer.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [2/3] Starting e-Office DMS servers...
echo.
echo  • Local Access:    http://localhost:5188
echo  • Office LAN WiFi: Check your computer IP (e.g. http://192.168.1.xxx:5188)
echo.
echo Press Ctrl+C in this window to stop the system.
echo.

:: Open browser automatically after 3 seconds
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5188"

:: Run the development servers (or production)
npm run dev:all
