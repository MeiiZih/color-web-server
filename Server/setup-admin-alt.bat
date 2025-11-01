@echo off
echo Color Psychology Test Website - Admin Account Setup Tool
echo ========================================
echo.

echo Select database location:
echo 1. Local database (localhost)
echo 2. Remote database (20.57.128.97)
echo.

set /p choice=Please choose (1/2): 

if "%choice%"=="1" (
  echo.
  echo Creating admin accounts (local database)...
  call npm run create-admin-local
) else if "%choice%"=="2" (
  echo.
  echo Creating admin accounts (remote database)...
  call npm run create-admin
) else (
  echo.
  echo Invalid choice, using remote database...
  echo.
  call npm run create-admin
)

echo.
echo Press any key to exit...
pause > nul 