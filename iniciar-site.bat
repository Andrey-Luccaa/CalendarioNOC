@echo off
setlocal
cd /d "%~dp0"
title Escala de Hora Extra

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:5500"
  python -m http.server 5500
  exit /b
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:5500"
  py -m http.server 5500
  exit /b
)

echo Python nao foi encontrado.
echo Tentando iniciar com PowerShell...
start "" "http://localhost:5500"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1" -Porta 5500
pause
