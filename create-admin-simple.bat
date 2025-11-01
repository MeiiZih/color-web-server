@echo off
echo Creating admin accounts...
cd %~dp0
npm run create-admin
echo Done.
pause 