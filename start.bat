@echo off
title ElecTrade Pro — Startup
color 1F

echo.
echo  ==========================================
echo   ElecTrade Pro — Al Manama Electrical
echo  ==========================================
echo.

REM ── Check Docker is running ───────────────────────────────
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Docker Desktop is not running.
    echo.
    echo  Please open Docker Desktop and wait for the whale
    echo  icon to appear in the taskbar, then run this again.
    echo.
    pause
    exit /b 1
)
echo  [OK] Docker is running.

REM ── Create .env if missing ────────────────────────────────
if not exist ".env" (
    echo  Creating .env...
    (
        echo DB_PASSWORD=ElecTrade2025
        echo JWT_SECRET=electrade-secret-key-change-this-in-production-2025
        echo FRONTEND_URL=http://localhost
        echo SMTP_HOST=
        echo SMTP_PORT=587
        echo SMTP_USER=
        echo SMTP_PASS=
    ) > .env
    echo  [OK] .env created.
) else (
    echo  [OK] .env found.
)

REM ── Build and start ───────────────────────────────────────
echo.
echo  Starting containers (first run: 3-5 mins to build)...
echo.
docker compose up -d --build
if %errorlevel% neq 0 (
    echo  ERROR: docker compose failed.
    pause
    exit /b 1
)

REM ── Wait for API on port 3001 (direct, bypasses nginx) ────
echo.
echo  Waiting for API to start (checking port 3001 directly)...

set ATTEMPTS=0
:wait_api
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 36 (
    echo.
    echo  API did not respond after 3 minutes.
    echo  Run this to see what went wrong:
    echo    docker compose logs api
    echo.
    pause
    exit /b 1
)
curl -s -f http://localhost:3001/health >nul 2>&1
if %errorlevel% neq 0 (
    set /a SECS=%ATTEMPTS%*5
    echo  [%ATTEMPTS%/36] Waiting... (%SECS% seconds elapsed)
    timeout /t 5 /nobreak >nul
    goto wait_api
)
echo  [OK] API is up!

REM ── Wait for frontend on port 5173 ───────────────────────
echo  Waiting for frontend to finish building...
set ATTEMPTS=0
:wait_fe
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 24 (
    echo  Frontend taking too long - opening anyway...
    goto seed
)
curl -s -f http://localhost:5173 >nul 2>&1
if %errorlevel% neq 0 (
    echo  [%ATTEMPTS%/24] Frontend building...
    timeout /t 5 /nobreak >nul
    goto wait_fe
)
echo  [OK] Frontend is up!

REM ── Seed demo data ────────────────────────────────────────
:seed
echo.
echo  Loading demo data...
docker compose exec -T api node src/db/seed.js
echo  [OK] Demo data ready (existing data is never overwritten).

REM ── Done ─────────────────────────────────────────────────
echo.
echo  ==========================================
echo   ElecTrade Pro is READY
echo  ==========================================
echo.
echo   Browser:  http://localhost
echo.
echo   Admin login:  admin@almanama.com  /  Admin@1234
echo   Sales login:  sales@almanama.com  /  Sales@1234
echo.
echo   Stop:  run stop.bat
echo  ==========================================
echo.
timeout /t 2 /nobreak >nul
start http://localhost

echo  Press any key to watch live logs  (Ctrl+C exits)
pause >nul
docker compose logs -f
