@echo off
title ElecTrade Pro — Stopping
echo.
echo  Stopping ElecTrade Pro...
docker compose down
echo.
echo  All containers stopped. Your data is preserved.
echo  Run start.bat to start again.
echo.
pause
