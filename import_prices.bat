@echo off
setlocal
if not exist .venv\Scripts\python.exe (
  echo Run setup.bat first.
  exit /b 1
)
.venv\Scripts\python.exe -m scripts.import_kis_prices --scenario semiconductor --start 20231101 --end 20240719
endlocal
