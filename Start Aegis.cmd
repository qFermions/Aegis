@echo off
rem Start Aegis.cmd: double-click on Windows to start Aegis. It runs scripts\start-aegis.js from this folder.
rem What it saves and how to reset it: docs\aegis\start-aegis.md
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Aegis needs Node.js. Install it from https://nodejs.org, then double-click Start Aegis again.
  pause
  exit /b 1
)

node scripts\start-aegis.js
set "code=%errorlevel%"
if not "%code%"=="0" pause
exit /b %code%
