@echo off
setlocal
set SCRIPT_DIR=%~dp0

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%daily-backup.ps1"

if errorlevel 1 (
  echo.
  echo Backup failed.
) else (
  echo.
  echo Backup completed successfully.
)

echo.
pause
