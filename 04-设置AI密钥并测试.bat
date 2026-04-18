@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ========================================
echo Set AI key and test it
echo ========================================
echo.
set /p NEW_AI_KEY=Please paste your DeepSeek API key: 
if "%NEW_AI_KEY%"=="" (
  echo [ERROR] AI key is empty.
  pause
  exit /b 1
)

pushd "%~dp0server"
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Please install Node.js first.
  popd
  pause
  exit /b 1
)

call npm run set:ai-key -- "%NEW_AI_KEY%"
set CODE=%errorlevel%
popd

if not "%CODE%"=="0" (
  echo.
  echo [FAILED] AI key update or validation failed.
  pause
  exit /b %CODE%
)

echo.
echo [OK] AI key updated and verified.
echo Restart backend if it was already running.
pause
