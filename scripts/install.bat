@echo off
REM WhatsApp Desktop Container - Windows 安装脚本

echo =========================================
echo WhatsApp Desktop Container - 安装
echo =========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误: 未找到 Node.js
    echo 请先安装 Node.js 18 或更高版本
    echo 访问: https://nodejs.org/
    exit /b 1
)

node --version
echo ✓ Node.js 已安装

REM 检查 npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误: 未找到 npm
    exit /b 1
)

npm --version
echo ✓ npm 已安装
echo.

REM 安装依赖
echo 正在安装依赖...
call npm install

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =========================================
    echo ✓ 安装完成！
    echo =========================================
    echo.
    echo 使用以下命令启动应用:
    echo   npm start          - 启动应用
    echo   npm run dev        - 开发模式（带调试）
    echo   npm run build      - 打包应用
    echo.
) else (
    echo.
    echo ❌ 安装失败
    exit /b 1
)
