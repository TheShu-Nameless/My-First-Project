@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
start "TCM-Backend" cmd /k call "%~dp0start-backend.bat"
timeout /t 4 /nobreak >nul
start "TCM-Frontend" cmd /k call "%~dp0start-frontend.bat"
echo [TCM] Backend and frontend windows started.
echo [TCM] Open http://localhost:11999 after Vite is ready.
pause
