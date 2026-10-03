@echo off
REM ===========================================================================
REM  Restaurant System - Frontend
REM
REM  Serves the static frontend on http://localhost:8080 and opens your browser.
REM
REM  Why a server instead of double-clicking index.html?
REM  The pages are plain files with no build step, so double-clicking does
REM  "work" - but browsers treat file:// pages as a null origin, which makes
REM  some fetch() calls fail in confusing ways. Serving over http:// avoids
REM  the whole class of problem and matches how it would be hosted for real.
REM
REM  The backend (start-backend.bat) must also be running, or the screens will
REM  load but show no data.
REM ===========================================================================

title Frontend - Restaurant System (http://localhost:8080)

cd /d "%~dp0frontend"

echo.
echo   Restaurant System - Frontend
echo.
echo   Folder : %~dp0frontend
echo   URL    : http://localhost:8080
echo.
echo   The backend must also be running, or the screens will load empty.
echo.
echo   Keep this window open while you use the app.
echo   Press Ctrl+C to stop.
echo.
echo ---------------------------------------------------------------------------

REM Prefer the Windows "py" launcher; fall back to "python" if it is absent.
set "PY=python"
where py >nul 2>nul && set "PY=py"

start "" http://localhost:8080/

%PY% -m http.server 8080 --bind 127.0.0.1

echo.
echo   Frontend server stopped.
pause
