@echo off
echo ------------------------------------------
echo  🚀 Starting Deployment to GitHub & Render
echo ------------------------------------------

:: Step 1: Stage all changes (including landing.html)
git add .

:: Step 2: Commit with a generic timestamped message
set current_time=%date% %time%
git commit -m "Auto-update deployment: %current_time%"

:: Step 3: Push to GitHub (assumes your main branch is called 'main')
git push origin main

echo ------------------------------------------
echo  ✅ Pushed successfully! Render is now building...
echo ------------------------------------------
pause
