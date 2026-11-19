@echo off
cd /d "%~dp0"
call node scripts/exhibition.cjs lan
pause
