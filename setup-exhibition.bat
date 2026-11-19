@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 22, Python 3.12 and Ollama first. See README-SCHOOL.txt.
 pause
 exit /b 1
)
call npm run setup:school
if errorlevel 1 (
 echo.
 echo Setup failed. Read the error above, fix it, then run this file again.
 pause
 exit /b 1
)
echo.
echo Setup finished. Double-click start-exhibition.bat next.
pause
