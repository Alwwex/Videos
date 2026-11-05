@echo off
chcp 65001 >nul
title Fyzika Studio
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Chybi Node.js. Otviram stranku ke stazeni - nainstaluj verzi LTS a spust tento soubor znovu.
  start https://nodejs.org/
  pause
  exit /b
)
if not exist node_modules (
  echo  Prvni spusteni: instaluji knihovny, chvili to potrva...
  call npm install
)
echo  Spoustim Fyzika Studio... (toto okno nech otevrene, muzes ho minimalizovat)
node --import tsx studio/server.ts %*
pause
