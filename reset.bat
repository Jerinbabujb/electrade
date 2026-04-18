@echo off
title ElecTrade Pro — Reset
echo.
echo  WARNING: This will delete ALL data and start fresh.
echo  Your invoices, products, and customers will be erased.
echo.
set /p confirm=Type YES to confirm reset: 
if /i "%confirm%" neq "YES" (
    echo  Reset cancelled.
    pause
    exit /b 0
)
echo.
echo  Stopping containers and removing data...
docker compose down -v
echo.
echo  Done. Run start.bat to start fresh with demo data.
echo.
pause
