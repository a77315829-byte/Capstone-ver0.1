@echo off
setlocal
if not exist .venv\Scripts\python.exe (
  echo Run setup.bat first.
  exit /b 1
)
.venv\Scripts\python.exe -m scripts.seed_database --scenario semiconductor
endlocal
