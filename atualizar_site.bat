@echo off
color 0A
echo ====================================
echo   ROBOZINHO DE LINKS 🤖
echo ====================================
echo.
echo Enviando seus novos links para a nuvem...
echo.

git add .
git commit -m "Adicionado novo link"
git push

echo.
echo ====================================
echo 🎉 FEITO! Tudo atualizado!
echo O seu site estara com os novos links no ar em 1 a 2 minutos.
echo ====================================
echo.
pause
