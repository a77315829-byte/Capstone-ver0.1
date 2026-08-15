@echo off
setlocal
if not exist .venv\Scripts\python.exe (
  py -3.11 -m venv .venv
)
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
if not exist .env copy .env.example .env >nul
echo.
echo Setup complete. Edit .env, then run seed_content.bat.
endlocal
