@echo off
chcp 65001 >nul
title e-Office DMS — Database & Document Backup
color 0a

echo.
echo ======================================================================
echo      ENTERPRISE E-OFFICE — AUTOMATIC LOCAL BACKUP
echo ======================================================================
echo.

:: Get current timestamp in YYYY-MM-DD_HHMM format
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set BACKUP_DIR=%~dp0backups\dms_backup_%datetime:~0,8%_%datetime:~8,4%

echo [1/3] Creating backup folder: %BACKUP_DIR%
mkdir "%BACKUP_DIR%" 2>nul
mkdir "%BACKUP_DIR%\database" 2>nul
mkdir "%BACKUP_DIR%\uploads" 2>nul

echo [2/3] Backing up SQLite Database...
if exist "%~dp0server\prisma\dev.db" (
    copy /y "%~dp0server\prisma\dev.db" "%BACKUP_DIR%\database\dev.db" >nul
    echo   ✓ Database backed up successfully (dev.db)
) else (
    echo   ! Warning: dev.db not found.
)

echo [3/3] Backing up uploaded document files...
if exist "%~dp0server\uploads" (
    xcopy /e /i /y "%~dp0server\uploads" "%BACKUP_DIR%\uploads" >nul
    echo   ✓ Uploaded documents backed up successfully
) else (
    echo   ! Warning: uploads folder not found.
)

echo.
echo ======================================================================
echo   BACKUP COMPLETE!
echo   Saved in: %BACKUP_DIR%
echo ======================================================================
echo.
pause
