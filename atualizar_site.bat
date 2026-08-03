@echo off
color 0A
echo ====================================
echo   ROBOZINHO DE LINKS 🤖
echo ====================================
echo.
echo Enviando seus novos links para a nuvem...
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\Git\cmd\git.exe" set "PATH=%PATH%;C:\Program Files\Git\cmd"
    if exist "%LocalAppData%\Programs\Git\cmd\git.exe" set "PATH=%PATH%;%LocalAppData%\Programs\Git\cmd"
)

git add .
git commit -m "Atualizacao de links"
git push

echo.
echo ====================================
echo 🎉 FEITO! Tudo atualizado!
echo O seu site estara com os novos links no ar em 1 a 2 minutos.
echo ====================================
echo.
pause
