@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ========================================
echo Switch system AI to local Ollama
echo ========================================
echo.
set /p MODEL=Model name [default: qwen2.5:7b]:
if "%MODEL%"=="" set MODEL=qwen2.5:7b

pushd "%~dp0server"
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Please install Node.js first.
  popd
  pause
  exit /b 1
)

call npm run set:ollama -- "%MODEL%"
set CODE=%errorlevel%
popd

if not "%CODE%"=="0" (
  echo.
  echo [FAILED] Could not switch to Ollama config.
  pause
  exit /b %CODE%
)

echo.
echo [OK] AI switched to Ollama.
echo Next:
echo 1) Start Ollama service: ollama serve
echo 2) Pull model once: ollama pull %MODEL%
echo 3) Restart backend, then test AI connectivity in admin page.
pause
