@echo off
chcp 65001 >nul
title CallBiz Desktop
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ============================================================
rem  CallBiz Desktop - הפעלה ללא התקנה
rem  ------------------------------------------------------------
rem  לחיצה כפולה מרימה שרת מקומי ופותחת את המערכת בחלון אפליקציה.
rem  השרת המקומי נדרש כדי שהדפדפן ייתן גישה למיקרופון - דפדפנים
rem  חוסמים גישה לחומרה מקובץ מקומי (file://), אבל מאפשרים אותה
rem  ב-localhost. אין התקנה, אין הרשאות מנהל, אין שינוי במערכת.
rem ============================================================

set "PORT=8787"
set "URL=http://localhost:%PORT%/index.html"

echo.
echo   CallBiz Desktop
echo   ---------------
echo.

rem --- איתור Python ---
set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY ( where python >nul 2>&1 && set "PY=python" )
if not defined PY (
  echo   [!] לא נמצא Python במחשב.
  echo       ניתן להוריד מ- https://www.python.org/downloads/  ולסמן "Add to PATH".
  echo.
  echo   פותח את המערכת ישירות מהקובץ ^(ללא גישה למיקרופון^)...
  timeout /t 3 >nul
  start "" "%~dp0index.html"
  exit /b 0
)

rem --- אם הפורט תפוס, מניחים שהשרת כבר רץ ---
netstat -ano | findstr /r /c:"LISTENING.*:%PORT% " >nul 2>&1
if %errorlevel%==0 (
  echo   השרת כבר פעיל - פותח את החלון...
) else (
  echo   מפעיל שרת מקומי על פורט %PORT%...
  start "CallBiz Desktop Server" /min cmd /c "%PY% -m http.server %PORT% --bind 127.0.0.1"
  timeout /t 2 >nul
)

rem --- קיצור דרך בשולחן העבודה בפעם הראשונה ---
set "LNK=%USERPROFILE%\Desktop\CallBiz Desktop.lnk"
if not exist "%LNK%" (
  powershell -NoProfile -Command ^
    "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%');" ^
    "$s.TargetPath='%~f0'; $s.WorkingDirectory='%~dp0';" ^
    "$s.IconLocation='%SystemRoot%\System32\SHELL32.dll,238'; $s.Description='CallBiz Desktop'; $s.Save()" >nul 2>&1
  if exist "%LNK%" echo   נוצר קיצור דרך בשולחן העבודה.
)

rem --- פתיחה בחלון אפליקציה ---
set "CHROME="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do if exist %%P set "CHROME=%%~P"

set "EDGE="
for %%P in (
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) do if exist %%P set "EDGE=%%~P"

if defined CHROME (
  start "" "%CHROME%" --app="%URL%" --window-size=1360,860 --allow-file-access-from-files
) else if defined EDGE (
  start "" "%EDGE%" --app="%URL%" --window-size=1360,860
) else (
  start "" "%URL%"
)

echo.
echo   המערכת נפתחה. לסגירה מלאה הריצו את Uninstall-CallBiz-Desktop.cmd
echo   או פשוט סגרו את חלון "CallBiz Desktop Server".
timeout /t 4 >nul
exit /b 0
