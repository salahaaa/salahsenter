@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Initialize-Mall-Update-Channel.ps1"
echo.
pause
