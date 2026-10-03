@echo off
REM ===========================================================================
REM  Restaurant System - start everything
REM
REM  Opens three windows, in the order they must start:
REM     1. MariaDB   (the database)
REM     2. Backend   (the Express API on port 3000)
REM     3. Frontend  (the web pages on port 8080, and opens your browser)
REM
REM  Close each window to stop that service. Closing the MariaDB window is the
REM  same as shutting the database down.
REM ===========================================================================

title Restaurant System - launcher

echo.
echo   Starting the Restaurant System...
echo.
echo     1. MariaDB  - database server, port 3306
echo     2. Backend  - API, port 3000
echo     3. Frontend - web pages, port 8080
echo.

REM --- 1. Database -----------------------------------------------------------
REM  Adjust this path if MariaDB lives somewhere else on your machine.
set "MARIADB_BAT=C:\Users\IFEANYI\mariadb\start-mariadb.bat"

if exist "%MARIADB_BAT%" (
    echo   Starting MariaDB...
    start "MariaDB" "%MARIADB_BAT%"
    REM  Give InnoDB a moment to finish recovery before the API connects.
    timeout /t 6 /nobreak >nul
) else (
    echo   WARNING: MariaDB launcher not found at:
    echo            %MARIADB_BAT%
    echo            Start your database manually, then re-run this file.
    echo.
    pause
)

REM --- 2. API ----------------------------------------------------------------
echo   Starting the backend API...
start "Backend API" "%~dp0start-backend.bat"
timeout /t 4 /nobreak >nul

REM --- 3. Frontend -----------------------------------------------------------
echo   Starting the frontend...
start "Frontend" "%~dp0start-frontend.bat"

echo.
echo   All three should now be running in their own windows.
echo.
echo   Login page : http://localhost:8080/
echo.
echo   Seeded accounts:
echo     admin@restaurant.test  /  admin123     (administrator)
echo     staff@restaurant.test  /  staff123     (staff)
echo     ada@example.com        /  customer123  (customer)
echo.
echo   If a screen loads but shows no data, check the Backend window for errors.
echo.

timeout /t 12 /nobreak >nul
