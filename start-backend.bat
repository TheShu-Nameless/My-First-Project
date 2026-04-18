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

set "MYSQL_BIN=mysql"
if exist "C:\Users\52001\Documents\MySQL84\extracted\mysql-8.4.8-winx64\bin\mysql.exe" set "MYSQL_BIN=C:\Users\52001\Documents\MySQL84\extracted\mysql-8.4.8-winx64\bin\mysql.exe"
if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
set "MYSQLD_EXE="
if exist "C:\Users\52001\Documents\MySQL84\extracted\mysql-8.4.8-winx64\bin\mysqld.exe" set "MYSQLD_EXE=C:\Users\52001\Documents\MySQL84\extracted\mysql-8.4.8-winx64\bin\mysqld.exe"
if not defined MYSQLD_EXE if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" set "MYSQLD_EXE=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"

set "MYSQL_OK=0"
"%MYSQL_BIN%" --host=127.0.0.1 --port=1111 --user=root --password=123123 -e "SELECT 1;" >nul 2>nul
if not errorlevel 1 set "MYSQL_OK=1"
if "%MYSQL_OK%"=="0" (
  if defined MYSQLD_EXE (
    echo [TCM] MySQL not ready. Starting MySQL on 1111...
    if exist "C:\Users\52001\Documents\MySQL84\my.ini" (
      start "TCM-MySQL-1111" /min "%MYSQLD_EXE%" --defaults-file="C:\Users\52001\Documents\MySQL84\my.ini"
    ) else (
      start "TCM-MySQL-1111" /min "%MYSQLD_EXE%" --port=1111
    )
  )
  echo [TCM] Waiting MySQL startup...
  for /l %%i in (1,1,20) do (
    "%MYSQL_BIN%" --host=127.0.0.1 --port=1111 --user=root --password=123123 -e "SELECT 1;" >nul 2>nul
    if not errorlevel 1 (
      set "MYSQL_OK=1"
      goto :mysql_ready
    )
    timeout /t 1 /nobreak >nul
  )
)
:mysql_ready
if "%MYSQL_OK%"=="0" (
  echo [TCM] Cannot connect MySQL on 127.0.0.1:1111.
  echo [TCM] Please check:
  echo [TCM]  1^) MySQL data dir exists: C:\Users\52001\Documents\MySQL84\data
  echo [TCM]  2^) my.ini port is 1111: C:\Users\52001\Documents\MySQL84\my.ini
  echo [TCM]  3^) .env matches MYSQL_PORT=1111, root/123123
  pause
  exit /b 1
)

cd /d "%~dp0server"
if not exist "node_modules\" (
  echo [TCM] Installing backend dependencies...
  call "%NPM_CMD%" install
  if errorlevel 1 (
    echo [TCM] npm install failed.
    pause
    exit /b 1
  )
)
if not exist ".env" (
  echo [TCM] Copying .env.example to .env ...
  copy /Y ".env.example" ".env" >nul
)

echo [TCM] Checking database schema...
"%MYSQL_BIN%" --host=127.0.0.1 --port=1111 --user=root --password=123123 --batch --skip-column-names -e "USE tcm_ai_review; SELECT 1 FROM department LIMIT 1;" >nul 2>nul
if errorlevel 1 (
  echo [TCM] Importing database\schema.sql ...
  pushd "%~dp0database"
  "%MYSQL_BIN%" --host=127.0.0.1 --port=1111 --user=root --password=123123 --default-character-set=utf8mb4 -e "source schema.sql"
  set "ERR=%ERRORLEVEL%"
  popd
  if not "%ERR%"=="0" (
    echo [TCM] Schema import failed.
    pause
    exit /b 1
  )
)

echo [TCM] Backend URL: http://localhost:11888
echo [TCM] Health URL : http://localhost:11888/api/public/health
call "%NPM_CMD%" run dev
if errorlevel 1 pause
