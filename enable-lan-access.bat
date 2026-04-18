@echo off
setlocal
chcp 65001 >nul
echo [TCM] Enabling inbound firewall rules for 11999 and 11888...
netsh advfirewall firewall add rule name="TCM Frontend 11999" dir=in action=allow protocol=TCP localport=11999 >nul 2>nul
netsh advfirewall firewall add rule name="TCM Backend 11888" dir=in action=allow protocol=TCP localport=11888 >nul 2>nul
if errorlevel 1 (
  echo [TCM] Rule add may have failed. Try running this script as Administrator.
  pause
  exit /b 1
)
echo [TCM] LAN access ports are open.
echo [TCM] Use http://<your-lan-ip>:11999 inside campus network.
pause
