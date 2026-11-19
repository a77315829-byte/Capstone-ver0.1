@echo off
cd /d "%~dp0"
call npm run doctor
echo.
echo All five checks above should show OK. If unavailable, check the running server and school network.
pause
