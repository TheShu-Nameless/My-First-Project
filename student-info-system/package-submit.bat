@echo off
chcp 65001 >nul
setlocal

set PROJECT_NAME=student-info-system
set JAR_NAME=student-info-system-1.0.0.jar

where java >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 Java，请先安装并配置 JDK 17+。
  exit /b 1
)

where mvn >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 Maven，请先安装 Maven 3.8+ 并配置 PATH。
  exit /b 1
)

echo [1/3] 执行测试并打包...
call mvn clean package
if errorlevel 1 (
  echo [ERROR] 打包失败。
  exit /b 1
)

echo [2/3] 生成项目压缩包...
powershell -NoProfile -Command "if (Test-Path '%PROJECT_NAME%.zip') { Remove-Item '%PROJECT_NAME%.zip' -Force }; Compress-Archive -Path * -DestinationPath '%PROJECT_NAME%.zip' -Force"
if errorlevel 1 (
  echo [ERROR] 生成项目压缩包失败。
  exit /b 1
)

echo [3/3] 复制可执行 Jar 到根目录...
copy /Y "target\%JAR_NAME%" "%JAR_NAME%" >nul
if errorlevel 1 (
  echo [ERROR] 复制 Jar 失败。
  exit /b 1
)

echo.
echo 打包完成：
echo - %CD%\%PROJECT_NAME%.zip
echo - %CD%\%JAR_NAME%

endlocal
