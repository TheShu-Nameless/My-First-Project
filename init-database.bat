@echo off
chcp 65001 >nul
echo [TCM] 在 database 目录执行 schema.sql（MySQL 127.0.0.1:1111, root）
echo [TCM] 若提示找不到 mysql，请将「MySQL Server 8.x\bin」加入系统 PATH，或在本 bat 中设置 MYSQL_BIN。
echo.

set "MYSQL_BIN=mysql"
if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" (
  set "MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
)

pushd "%~dp0database"
"%MYSQL_BIN%" --host=127.0.0.1 --port=1111 --user=root --password=123123 --default-character-set=utf8mb4 -e "source schema.sql"
set ERR=%ERRORLEVEL%
popd

if not %ERR%==0 (
  echo [TCM] 导入失败：请检查 MySQL 服务是否在 1111 端口、账号密码是否为 root/123123。
  pause
  exit /b 1
)
echo [TCM] 数据库 tcm_ai_review 初始化完成。
pause
