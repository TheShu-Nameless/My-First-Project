@echo off
setlocal
chcp 65001 >nul
set "CF_EXE="
for /f "delims=" %%i in ('where.exe cloudflared 2^>nul') do if not defined CF_EXE set "CF_EXE=%%i"
if not defined CF_EXE if exist "%LOCALAPPDATA%\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe" set "CF_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe"

if not defined CF_EXE (
  echo [TCM] cloudflared not found.
  echo [TCM] Installing cloudflared with winget...
  winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements --silent
  for /f "delims=" %%i in ('where.exe cloudflared 2^>nul') do if not defined CF_EXE set "CF_EXE=%%i"
  if not defined CF_EXE if exist "%LOCALAPPDATA%\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe" set "CF_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe"
  if not defined CF_EXE (
    echo [TCM] cloudflared install failed. Please install manually and retry.
    pause
    exit /b 1
  )
)
echo [TCM] Starting public tunnel for http://localhost:11999
echo [TCM] Keep this window open. Use the https://xxxx.trycloudflare.com URL shown below.
"%CF_EXE%" tunnel --url http://localhost:11999
