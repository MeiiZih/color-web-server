@echo off
echo Checking Node.js environment...
echo.

echo Node version:
node -v
echo.

echo NPM version:
npm -v
echo.

echo Current directory:
cd
echo.

echo Package.json exists?
if exist package.json (echo Yes) else (echo No)
echo.

echo Scripts in package.json:
type package.json | findstr "scripts"
echo.

echo Done checking environment.
pause 