@echo off
echo Starting WhatsApp Desktop with Translation Debug Mode...
echo.
echo This will:
echo - Auto-open DevTools for each account
echo - Enable detailed translation logs
echo - Allow F12 to toggle DevTools
echo.

set NODE_ENV=development
set DEBUG_TRANSLATION=true

npm start

pause
