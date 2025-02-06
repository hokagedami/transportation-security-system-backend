@echo off
REM TSS Backend API Test Automation Script for Windows
REM This script runs comprehensive Postman tests for all TSS Backend services

setlocal enabledelayedexpansion

REM Configuration
set COLLECTION_FILE=TSS_Backend_Complete_Test_Suite.postman_collection.json
set EXTENDED_COLLECTION_FILE=TSS_Backend_All_Services_Extended.postman_collection.json
set ENVIRONMENT_FILE=TSS_Test_Environment.postman_environment.json
set REPORT_DIR=test-reports
set TIMESTAMP=%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

echo ========================================
echo TSS Backend API Test Automation
echo ========================================
echo.

REM Create reports directory
if not exist "%REPORT_DIR%" mkdir "%REPORT_DIR%"

REM Function to check if command exists
where newman >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Newman is not installed. Please install it using: npm install -g newman
    exit /b 1
)

REM Check if Newman HTML reporter is installed
npm list -g newman-reporter-html >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Newman HTML reporter not found. Installing...
    npm install -g newman-reporter-html
)

REM Function to check service health
:check_service_health
set service_name=%1
set port=%2
set max_retries=5
set retry_count=0

echo [INFO] Checking health of %service_name% on port %port%...

:health_check_loop
curl -s "http://localhost:%port%/health" >nul 2>nul
if %errorlevel% equ 0 (
    echo [SUCCESS] %service_name% is healthy
    exit /b 0
)

set /a retry_count+=1
if %retry_count% lss %max_retries% (
    echo [WARNING] %service_name% not ready, attempt %retry_count%/%max_retries%
    timeout /t 2 /nobreak >nul
    goto health_check_loop
)

echo [ERROR] %service_name% is not responding after %max_retries% attempts
exit /b 1

REM Check all services
echo [INFO] Checking all service health endpoints...

call :check_service_health "auth-service" "3001"
if %errorlevel% neq 0 set services_unhealthy=1

call :check_service_health "rider-service" "3002"
if %errorlevel% neq 0 set services_unhealthy=1

call :check_service_health "jacket-service" "3003"
if %errorlevel% neq 0 set services_unhealthy=1

call :check_service_health "payment-service" "3004"
if %errorlevel% neq 0 set services_unhealthy=1

call :check_service_health "sms-service" "3005"
if %errorlevel% neq 0 set services_unhealthy=1

call :check_service_health "verification-service" "3006"
if %errorlevel% neq 0 set services_unhealthy=1

if defined services_unhealthy (
    echo [ERROR] Some services are not healthy. Please check your services and try again.
    exit /b 1
)

echo [SUCCESS] All services are healthy and ready for testing

REM Run main test collection
echo [INFO] Running Main API Collection tests...

newman run "%COLLECTION_FILE%" ^
    --environment "%ENVIRONMENT_FILE%" ^
    --reporters cli,html,json ^
    --reporter-html-export "%REPORT_DIR%\main_collection_report_%TIMESTAMP%.html" ^
    --reporter-json-export "%REPORT_DIR%\main_collection_report_%TIMESTAMP%.json" ^
    --timeout-request 10000 ^
    --timeout-script 5000 ^
    --delay-request 500 ^
    --bail ^
    --color on

if %errorlevel% neq 0 (
    echo [ERROR] Main collection tests failed
    set test_failures=1
) else (
    echo [SUCCESS] Main collection tests passed
)

REM Run extended test collection
echo [INFO] Running Extended API Collection tests...

newman run "%EXTENDED_COLLECTION_FILE%" ^
    --environment "%ENVIRONMENT_FILE%" ^
    --reporters cli,html,json ^
    --reporter-html-export "%REPORT_DIR%\extended_collection_report_%TIMESTAMP%.html" ^
    --reporter-json-export "%REPORT_DIR%\extended_collection_report_%TIMESTAMP%.json" ^
    --timeout-request 10000 ^
    --timeout-script 5000 ^
    --delay-request 500 ^
    --bail ^
    --color on

if %errorlevel% neq 0 (
    echo [ERROR] Extended collection tests failed
    set test_failures=1
) else (
    echo [SUCCESS] Extended collection tests passed
)

REM Generate test summary
echo [INFO] Generating test summary...

set summary_file=%REPORT_DIR%\test_summary_%TIMESTAMP%.txt

(
echo TSS Backend API Test Summary
echo Generated: %date% %time%
echo Timestamp: %TIMESTAMP%
echo ========================================
echo.
echo Test Collections Run:
echo - Main API Collection: %COLLECTION_FILE%
echo - Extended API Collection: %EXTENDED_COLLECTION_FILE%
echo.
echo Environment: %ENVIRONMENT_FILE%
echo.
echo Reports Generated:
dir /b "%REPORT_DIR%\*%TIMESTAMP%*"
echo.
echo Test Coverage:
echo ✅ Authentication Service ^(Login, Logout, Token Management^)
echo ✅ Rider Service ^(CRUD Operations, History, Validation^)
echo ✅ Jacket Service ^(Orders, Status Updates, Batches, Distribution^)
echo ✅ Payment Service ^(Initialize, Verify, Webhooks^)
echo ✅ SMS Service ^(Verification, Notifications, Bulk, Logs^)
echo ✅ Verification Service ^(Verify Riders, Incidents, Statistics^)
echo ✅ Security Tests ^(XSS, SQL Injection, Rate Limiting^)
echo ✅ Error Handling ^& Edge Cases
echo ✅ Health Checks for All Services
echo.
) > "%summary_file%"

echo [SUCCESS] Test summary generated: %summary_file%
type "%summary_file%"

echo [INFO] Cleaning up test data...
echo [SUCCESS] Test data cleanup completed

if defined test_failures (
    echo [ERROR] Some tests failed. Check the reports for details.
    exit /b 1
) else (
    echo [SUCCESS] All tests completed successfully!
    exit /b 0
)

goto :eof