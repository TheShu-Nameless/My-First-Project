@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo =========================================
echo  第一次使用请先执行：数据库初始化
echo =========================================
echo 正在调用 init-database.bat ...
call "%~dp0init-database.bat"
