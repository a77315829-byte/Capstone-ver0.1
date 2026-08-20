@echo off
setlocal
cd /d "%~dp0"

if not exist .venv\Scripts\python.exe (
  echo Run setup.bat first.
  exit /b 1
)

if not exist .env (
  echo Copy .env.example to .env and review the settings first.
  exit /b 1
)

.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8003 --reload
endlocal
