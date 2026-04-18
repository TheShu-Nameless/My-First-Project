@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
start "TCM-All-Local" cmd /k call "%~dp0start-all.bat"
timeout /t 8 /nobreak >nul
start "TCM-Public-Tunnel" cmd /k call "%~dp0start-public-tunnel.bat"
echo [TCM] Local/LAN entry: http://localhost:11999
echo [TCM] Public entry: check the TCM-Public-Tunnel window for the trycloudflare URL.
pause
