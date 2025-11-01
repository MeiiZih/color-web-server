@echo off
chcp 65001 >nul
echo 心理測驗網站 - 管理員帳號創建工具
echo ========================================
echo.

echo 選擇數據庫位置:
echo 1. 本地數據庫 (localhost)
echo 2. 遠程數據庫 (20.57.128.97)
echo.

set /p choice=請選擇 (1/2): 

if "%choice%"=="1" (
  echo.
  echo 正在創建管理員帳號 (本地數據庫)...
  call npm run create-admin-local
) else if "%choice%"=="2" (
  echo.
  echo 正在創建管理員帳號 (遠程數據庫)...
  call npm run create-admin
) else (
  echo.
  echo 選擇無效，將使用遠程數據庫...
  echo.
  call npm run create-admin
)

echo.
echo 按任意鍵退出...
pause > nul 