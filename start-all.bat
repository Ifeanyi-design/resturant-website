@echo off
REM ===========================================================================
REM  Restaurant System  -  start everything
REM
REM  Opens two windows, in the order they must start:
REM     1. MariaDB  -  the database (port 3306)
REM     2. The app  -  Express, serving the API AND the frontend (port 3000)
REM
REM  There is no third window any more. The Express server serves the static
REM  frontend itself, so the whole application is one service - the same way it
REM  runs on Render.
REM ===========================================================================

title Restaurant System - launcher

echo.
echo   Starting the Restaurant System...
echo.
echo     1. MariaDB  - database server, port 3306
echo     2. App      - API + frontend, http://localhost:3000
echo.

REM --- 1. Database -----------------------------------------------------------
REM  Adjust this path if MariaDB lives somewhere else on your machine.
set "MARIADB_BAT=C:\Users\IFEANYI\mariadb\start-mariadb.bat"

if exist "%MARIADB_BAT%" (
    echo   Starting MariaDB...
    start "MariaDB" "%MARIADB_BAT%"
    REM  Give InnoDB a moment to finish recovery before the app connects.
    timeout /t 6 /nobreak >nul
) else (
    echo   WARNING: MariaDB launcher not found at:
    echo            %MARIADB_BAT%
    echo            Start your database manually, then re-run this file.
    echo.
    pause
)

REM --- 2. App ----------------------------------------------------------------
echo   Starting the app...
start "Restaurant System" "%~dp0start-backend.bat"

echo.
echo   Both should now be running in their own windows.
echo.
echo   App     : http://localhost:3000
echo   Health  : http://localhost:3000/api/health
echo.
echo   Seeded accounts:
echo     admin@restaurant.test    /  admin123     (administrator)
echo     manager@restaurant.test  /  manager123   (administrator)
echo     staff@restaurant.test    /  staff123     (staff)
echo     cashier@restaurant.test  /  cashier123   (staff)
echo     ada@example.com          /  customer123  (customer)
echo     bola@example.com         /  bola123      (customer)
echo.
echo   If a page loads but shows no data, check the app window for errors.
echo.

timeout /t 12 /nobreak >nul
