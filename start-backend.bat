@echo off
REM ===========================================================================
REM  Restaurant System - Backend API
REM
REM  Starts the Express API on http://localhost:3000
REM
REM  Requires MariaDB to be running already (start-mariadb.bat), otherwise the
REM  API starts fine but every data request fails.
REM ===========================================================================

title Backend - Restaurant System API (http://localhost:3000)

cd /d "%~dp0backend"

echo.
echo   Restaurant System - Backend API
echo.
echo   Folder : %~dp0backend
echo   URL    : http://localhost:3000
echo.
echo   MariaDB must already be running, or data requests will fail.
echo.
echo   Keep this window open while you use the app.
echo   Press Ctrl+C to stop.
echo.
echo ---------------------------------------------------------------------------

REM First run on a fresh clone: install dependencies.
if not exist "node_modules" (
    echo.
    echo   node_modules not found - installing dependencies for the first time.
    echo   This can take a minute.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo   npm install failed. Fix that before continuing.
        pause
        exit /b 1
    )
)

echo.
call npm start

echo.
echo   API stopped.
pause
