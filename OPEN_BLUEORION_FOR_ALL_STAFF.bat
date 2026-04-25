@echo off
title Blueorion QMS - Open for All Staff
color 1F
echo.
echo ================================================
echo   BLUEORION QMS - STAFF ACCESS SETUP
echo   Atlantis Beacon Tower, Malate Manila
echo ================================================
echo.
echo Step 1: Opening Windows Firewall for port 3000...
netsh advfirewall firewall delete rule name="Blueorion QMS Port 3000" >nul 2>&1
netsh advfirewall firewall add rule name="Blueorion QMS Port 3000" dir=in action=allow protocol=TCP localport=3000
echo   Done.

echo.
echo Step 2: Getting office IP addresses...
echo.
ipconfig | findstr /i "IPv4"

echo.
echo Step 3: Testing server on port 3000...
netstat -an | findstr ":3000" | findstr "LISTENING"
if %errorlevel%==0 (
    echo   Server is RUNNING on port 3000.
) else (
    echo   WARNING: Server is NOT running on port 3000.
    echo   Please start the server first: node server.js
)

echo.
echo ================================================
echo   STAFF LOGIN LINKS:
echo.
echo   [PUBLIC INTERNET - Anyone anywhere]:
echo   https://blueorion-qms.onrender.com/login.html
echo   https://blueorion-qms.onrender.com/admin
echo.
echo   [APPLY FORM - Share with applicants]:
echo   https://blueorion-qms.onrender.com/apply
echo.
echo   Main PC / Localhost:
echo   http://localhost:3000/login.html
echo.
echo   Office Network (all staff):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set ip=%%a
    setlocal enabledelayedexpansion
    set ip=!ip: =!
    echo   http://!ip!:3000/login.html
    endlocal
)
echo.
echo ================================================
echo   STAFF ACCOUNTS (Malate Office):
echo.
echo   Lyndie      ^|  lyndie            ^|  Blue@Lyndie2026
echo   Jenny       ^|  jenny             ^|  Blue@Jenny2026
echo   Geneve      ^|  geneve            ^|  Blue@Geneve2026
echo   Shekainah   ^|  blueorion.sg      ^|  Blue@2026!S
echo   Malate Staff^|  blueorion_staff01 ^|  BlueorionStart2026!
echo.
echo ================================================
echo.
echo IMPORTANT FOR JENNY (192.168.1.30):
echo   Connect Jenny's PC to the SAME Wi-Fi as this server.
echo   Both PCs must show 192.168.100.x or 192.168.1.x
echo   on the SAME router/switch to communicate.
echo.
pause
