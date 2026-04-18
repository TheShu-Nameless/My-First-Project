@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo =========================================
echo  日常启动（校外 + 校内）
echo =========================================
echo 将启动：
echo  1) 前后端服务（本机/校内）
echo  2) 公网隧道（校外）
echo
echo 注意：会打开多个窗口，全部都要保持运行。
echo =========================================
call "%~dp0start-all-campus-and-offcampus.bat"
