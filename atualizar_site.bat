@echo off
chcp 65001 >nul
color 0A
echo ====================================
echo   ROBOZINHO DE LINKS
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
git commit -m "Atualizacao de links" >nul 2>&1

REM Traz antes o que foi publicado por outro caminho (ex.: Robozinho pelo celular), evitando "rejected (fetch first)"
git pull --rebase origin main
if %errorlevel% neq 0 (
    git rebase --abort >nul 2>&1
    color 0C
    echo.
    echo ====================================
    echo CONFLITO: o GitHub tem alteracoes que batem com as suas
    echo (provavelmente links publicados pelo celular^).
    echo Nada foi enviado e nada foi perdido. Peca ajuda para juntar.
    echo ====================================
    echo.
    pause
    exit /b 1
)

git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ====================================
    echo FEITO! Tudo enviado com sucesso!
    echo O seu site estara com os novos links no ar em 1 a 2 minutos.
    echo ====================================
) else (
    echo.
    echo ====================================
    echo ERRO AO ENVIAR PARA O GITHUB!
    echo Tente executar o arquivo novamente.
    echo ====================================
)

echo.
pause
