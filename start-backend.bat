@echo off
REM ===========================================================================
REM  Restaurant System  -  start the app
REM
REM  ONE service. The Express server serves the REST API *and* the frontend,
REM  so there is no separate web server to run and no CORS to think about.
REM
REM  Requires MariaDB to be running already (start-mariadb.bat), otherwise the
REM  pages load but every data request fails.
REM ===========================================================================

title Restaurant System (http://localhost:3000)

cd /d "%~dp0backend"

echo.
echo   Restaurant System
echo.
echo   URL : http://localhost:3000
echo.
echo   MariaDB must already be running, or data requests will fail.
echo   Start it with C:\Users\IFEANYI\mariadb\start-mariadb.bat
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

REM Open the browser once the server has had a moment to bind.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000/"

call npm start

echo.
echo   Server stopped.
pause
