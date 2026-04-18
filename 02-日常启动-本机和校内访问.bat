@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo =========================================
echo  日常启动（本机 + 校内）
echo =========================================
echo 将启动前端和后端，请保持窗口不要关闭。
echo 启动完成后访问：
echo   http://localhost:11999
echo =========================================
call "%~dp0start-all.bat"
