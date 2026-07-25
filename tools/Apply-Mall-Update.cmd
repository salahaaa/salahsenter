@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Apply-Mall-Update.ps1"
echo.
pause
