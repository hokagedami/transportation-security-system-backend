@echo off
REM Docker Test Runner Script for TSS Backend (Windows)
REM This script provides convenient commands for running tests in Docker containers

setlocal enabledelayedexpansion

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker and try again.
    exit /b 1
)

REM Set the command
set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=help

REM Handle commands
if "%COMMAND%"=="unit" goto :unit
if "%COMMAND%"=="integration" goto :unit
if "%COMMAND%"=="e2e" goto :e2e
if "%COMMAND%"=="end-to-end" goto :e2e
if "%COMMAND%"=="all" goto :all
if "%COMMAND%"=="coverage" goto :coverage
if "%COMMAND%"=="build" goto :build
if "%COMMAND%"=="cleanup" goto :cleanup
if "%COMMAND%"=="clean" goto :cleanup
if "%COMMAND%"=="service" goto :service
if "%COMMAND%"=="logs" goto :logs
if "%COMMAND%"=="debug" goto :debug
if "%COMMAND%"=="help" goto :help
if "%COMMAND%"=="--help" goto :help
if "%COMMAND%"=="-h" goto :help

echo [ERROR] Unknown command: %COMMAND%
echo Use '%0 help' to see available commands
exit /b 1

:unit
echo [INFO] Running unit and integration tests...
docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
timeout /t 10 /nobreak >nul
docker-compose -f docker-compose.test.yml run --rm test-runner
set TEST_EXIT_CODE=!errorlevel!
docker-compose -f docker-compose.test.yml down
if !TEST_EXIT_CODE! == 0 (
    echo [SUCCESS] All unit and integration tests passed!
) else (
    echo [ERROR] Some tests failed. Exit code: !TEST_EXIT_CODE!
    exit /b !TEST_EXIT_CODE!
)
goto :eof

:e2e
echo [INFO] Running end-to-end tests...
docker-compose -f docker-compose.test.yml --profile e2e up -d
timeout /t 30 /nobreak >nul
docker-compose -f docker-compose.test.yml run --rm e2e-test-runner
set E2E_EXIT_CODE=!errorlevel!
docker-compose -f docker-compose.test.yml --profile e2e down
if !E2E_EXIT_CODE! == 0 (
    echo [SUCCESS] All end-to-end tests passed!
) else (
    echo [ERROR] Some E2E tests failed. Exit code: !E2E_EXIT_CODE!
    exit /b !E2E_EXIT_CODE!
)
goto :eof

:all
echo [INFO] Running all tests...
call :unit
if errorlevel 1 exit /b 1
call :e2e
if errorlevel 1 exit /b 1
echo [SUCCESS] All tests completed successfully!
goto :eof

:coverage
echo [INFO] Running tests with coverage...
docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
timeout /t 10 /nobreak >nul
docker-compose -f docker-compose.test.yml run --rm test-runner npm run test:coverage
docker-compose -f docker-compose.test.yml down
echo [SUCCESS] Coverage report completed
goto :eof

:build
echo [INFO] Building test images...
docker-compose -f docker-compose.test.yml build --no-cache
echo [SUCCESS] Test images built successfully
goto :eof

:cleanup
echo [INFO] Cleaning up test containers and volumes...
docker-compose -f docker-compose.test.yml down --volumes --remove-orphans
docker system prune -f --volumes
echo [SUCCESS] Cleanup completed
goto :eof

:service
if "%2"=="" (
    echo [ERROR] Please specify a service name (auth, rider, jacket, payment, sms, verification)
    exit /b 1
)
echo [INFO] Running tests for %2 service...
docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
timeout /t 5 /nobreak >nul
docker-compose -f docker-compose.test.yml run --rm test-runner npm run test:%2
docker-compose -f docker-compose.test.yml down
echo [SUCCESS] %2 service tests completed
goto :eof

:logs
echo [INFO] Showing logs from test services...
docker-compose -f docker-compose.test.yml logs -f
goto :eof

:debug
echo [INFO] Starting test environment for debugging...
docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
timeout /t 5 /nobreak >nul
docker-compose -f docker-compose.test.yml run --rm test-runner bash
docker-compose -f docker-compose.test.yml down
goto :eof

:help
echo.
echo TSS Backend Docker Test Runner (Windows)
echo.
echo Usage: %0 [command] [options]
echo.
echo Commands:
echo   unit              Run unit and integration tests
echo   e2e               Run end-to-end tests
echo   all               Run all tests (unit + e2e)
echo   coverage          Run tests with coverage report
echo   service ^<name^>    Run tests for specific service
echo   build             Build test Docker images
echo   cleanup           Clean up test containers and volumes
echo   logs              Show logs from test services
echo   debug             Enter test container for debugging
echo   help              Show this help message
echo.
echo Service names: auth, rider, jacket, payment, sms, verification
echo.
echo Examples:
echo   %0 unit                    # Run unit tests
echo   %0 e2e                     # Run E2E tests
echo   %0 all                     # Run all tests
echo   %0 service auth            # Run auth service tests
echo   %0 coverage                # Run with coverage
echo.
goto :eof