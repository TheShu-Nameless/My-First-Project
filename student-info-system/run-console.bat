@echo off
chcp 65001 >nul
setlocal

if not exist "target\student-info-system-1.0.0.jar" (
  echo 未找到可执行 jar，正在自动打包...
  call mvn clean package -q
  if errorlevel 1 (
    echo 打包失败，请检查 JDK 和 Maven 环境。
    exit /b 1
  )
)

echo 启动控制台版本...
java -cp "target\student-info-system-1.0.0.jar" com.example.sms.app.MainApp

endlocal
