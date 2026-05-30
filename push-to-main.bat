@echo off
REM Auto-push script for Blueorion QMS
cd /d %~dp0
git add .
git commit -m "Auto: Updating tracker database"
git push origin main
pause