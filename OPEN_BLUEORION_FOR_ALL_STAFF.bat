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
echo Step 4: Waking up Render and opening workstation...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$probe='https://www.blueorion.com/login.html?next=%2Fstaff_workstation_new.html'; $open='https://www.blueorion.com/login.html?next=%2Fstaff_workstation_new.html'; $ready=$false; foreach($i in 1..8){ try { $r=Invoke-WebRequest -Uri $probe -UseBasicParsing -TimeoutSec 45 -MaximumRedirection 10; if($r.StatusCode -eq 200){ $ready=$true; Write-Host ('Render ready on try ' + $i); break } else { Write-Host ('Render still waking (try ' + $i + '/8)...') } } catch { Write-Host ('Render still waking (try ' + $i + '/8)...') }; if(-not $ready){ Start-Sleep -Seconds 8 } }; if(-not $ready){ Write-Host 'Render may still be waking, opening now anyway...'; }; Start-Process $open"
echo.
echo If you still see starting up once, keep the tab open and it will continue automatically.

echo.
echo ================================================
echo   STAFF LOGIN LINKS:
echo.
echo   [PUBLIC INTERNET - Anyone anywhere]:
echo   https://www.blueorion.com/login.html?next=%2Fstaff_workstation_new.html
echo   https://www.blueorion.com/login.html (admin/staff login)
echo   https://www.blueorion.com/admin
echo.
echo   [APPLY FORM - Share with applicants]:
echo   https://www.blueorion.com/apply
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

