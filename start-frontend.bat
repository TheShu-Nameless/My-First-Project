@echo off
setlocal
chcp 65001 >nul

set "NODE_EXE="
if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not defined NODE_EXE for /f "delims=" %%i in ('where.exe node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%i"
if not defined NODE_EXE (
  echo [TCM] Node.js not found. Install from https://nodejs.org/
  pause
  exit /b 1
)

for %%i in ("%NODE_EXE%") do set "NODE_DIR=%%~dpi"
set "PATH=%NODE_DIR%;%PATH%"
set "NPM_CMD=%NODE_DIR%npm.cmd"
if not exist "%NPM_CMD%" (
  for /f "delims=" %%i in ('where.exe npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%i"
)
if not exist "%NPM_CMD%" (
  echo [TCM] npm.cmd not found.
  pause
  exit /b 1
)

cd /d "%~dp0client"
if not exist "node_modules\" (
  echo [TCM] Installing frontend dependencies...
  call "%NPM_CMD%" install
  if errorlevel 1 (
    echo [TCM] npm install failed.
    pause
    exit /b 1
  )
)

echo [TCM] Frontend URL: http://localhost:11999
call "%NPM_CMD%" run dev
if errorlevel 1 pause
