@echo off
chcp 65001 >nul
title CallBiz Desktop - הסרה
setlocal
cd /d "%~dp0"

rem ============================================================
rem  CallBiz Desktop - הסרה
rem  ------------------------------------------------------------
rem  אין התקנה במערכת ההפעלה, ולכן ההסרה פשוטה: עוצרים את השרת
rem  המקומי, מוחקים את קיצור הדרך, ואם רוצים - גם את התיקייה.
rem  שום דבר לא נוגע ברישום המערכת ולא בקבצים אחרים.
rem ============================================================

set "PORT=8787"

echo.
echo   CallBiz Desktop - הסרה
echo   ----------------------
echo.

rem --- עצירת השרת המקומי ---
set "KILLED=0"
for /f "tokens=5" %%A in ('netstat -ano ^| findstr /r /c:"LISTENING.*:%PORT% "') do (
  taskkill /f /pid %%A >nul 2>&1 && set "KILLED=1"
)
if "%KILLED%"=="1" (echo   [1/3] השרת המקומי נעצר.) else (echo   [1/3] השרת לא היה פעיל.)

rem --- קיצור הדרך ---
set "LNK=%USERPROFILE%\Desktop\CallBiz Desktop.lnk"
if exist "%LNK%" ( del /f /q "%LNK%" >nul 2>&1 & echo   [2/3] קיצור הדרך נמחק. ) else ( echo   [2/3] אין קיצור דרך למחיקה. )

rem --- נתוני האפליקציה בדפדפן ---
echo   [3/3] נתוני המערכת בדפדפן ^(היסטוריית שיחות והגדרות^) נשמרים באחסון
echo         המקומי של הדפדפן. למחיקה: פתחו את המערכת, הגדרות ^> מחיקת נתונים.
echo.

choice /c YN /n /m "   למחוק גם את תיקיית התוכנה? (Y/N) "
if errorlevel 2 goto done

cd /d "%~dp0.."
echo.
echo   מוחק את התיקייה...
timeout /t 2 >nul
rmdir /s /q "%~dp0" >nul 2>&1
echo   הושלם.

:done
echo.
echo   ההסרה הסתיימה.
timeout /t 4 >nul
exit /b 0
