@echo off
setlocal
if not exist .venv\Scripts\python.exe (
  echo Run setup.bat first.
  exit /b 1
)
.venv\Scripts\python.exe -m unittest -v tests.test_beta_flow
endlocal
