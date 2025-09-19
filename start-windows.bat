@echo off
setlocal

REM Try to get host IP address
for /f "tokens=2 delims=[]" %%a in ('ping -4 -n 1 %ComputerName% ^| findstr "["') do (
    set HOST_IP=%%a
)

REM If no IP is found, use default
if "%HOST_IP%"=="" (
    echo Could not automatically get IP address, using default 127.0.0.1
    set HOST_IP=127.0.0.1
)

echo Detected host IP address: %HOST_IP%

REM Set environment variables
set REACT_APP_API_URL=http://%HOST_IP%:5000/api
set BACKEND_CORS_ORIGIN=http://%HOST_IP%:3000

echo Setting environment variables:
echo REACT_APP_API_URL=%REACT_APP_API_URL%
echo BACKEND_CORS_ORIGIN=%BACKEND_CORS_ORIGIN%

REM Start docker-compose services
echo Starting services...
docker-compose down
docker-compose up -d

echo.
echo Services started
echo Frontend URL: http://%HOST_IP%:3000
echo Backend API URL: http://%HOST_IP%:5000

pause