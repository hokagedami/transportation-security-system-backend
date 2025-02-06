@echo off
REM TSS Backend - Docker Test Runner for Windows
REM This script runs tests in isolated Docker containers

setlocal enabledelayedexpansion

REM Configuration
set COMPOSE_FILE=docker-compose.test.yml
set PROJECT_NAME=tss-test
set TEST_COMMAND=%1

REM Colors for output (Windows doesn't support ANSI colors in batch by default)
echo ========================================
echo TSS Backend - Docker Test Runner
echo ========================================
echo.

REM Function to check if Docker is running
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running or not installed
    echo Please ensure Docker Desktop is running and try again
    exit /b 1
)

REM Main command switch
if "%TEST_COMMAND%"=="" goto :show_help
if /i "%TEST_COMMAND%"=="help" goto :show_help
if /i "%TEST_COMMAND%"=="build" goto :build
if /i "%TEST_COMMAND%"=="unit" goto :unit
if /i "%TEST_COMMAND%"=="e2e" goto :e2e
if /i "%TEST_COMMAND%"=="all" goto :all
if /i "%TEST_COMMAND%"=="coverage" goto :coverage
if /i "%TEST_COMMAND%"=="service" goto :service
if /i "%TEST_COMMAND%"=="cleanup" goto :cleanup
if /i "%TEST_COMMAND%"=="logs" goto :logs
if /i "%TEST_COMMAND%"=="debug" goto :debug

echo [ERROR] Unknown command: %TEST_COMMAND%
goto :show_help

:show_help
echo Usage: test-docker.bat [COMMAND] [OPTIONS]
echo.
echo Commands:
echo   help        Show this help message
echo   build       Build test Docker images
echo   unit        Run unit and integration tests
echo   e2e         Run end-to-end tests
echo   all         Run all tests (unit + e2e)
echo   coverage    Run tests with coverage report
echo   service     Run tests for specific service
echo   cleanup     Clean up test containers and volumes
echo   logs        Show test container logs
echo   debug       Open interactive shell in test container
echo.
echo Examples:
echo   test-docker.bat all                  # Run all tests
echo   test-docker.bat unit                 # Run unit tests only
echo   test-docker.bat service auth         # Run auth service tests
echo   test-docker.bat coverage             # Run with coverage report
echo.
exit /b 0

:build
echo [INFO] Building test Docker images...
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build test images
    exit /b 1
)
echo [SUCCESS] Test images built successfully
exit /b 0

:setup_test_env
echo [INFO] Setting up test environment...

REM Stop any existing test containers
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% down --volumes >nul 2>&1

REM Start test infrastructure (postgres and redis)
echo [INFO] Starting test database and cache...
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% up -d postgres-test redis-test

REM Wait for services to be ready
echo [INFO] Waiting for services to be ready...
timeout /t 5 /nobreak >nul

REM Check if postgres is ready
set POSTGRES_RETRIES=0
:check_postgres
if %POSTGRES_RETRIES% geq 30 (
    echo [ERROR] PostgreSQL failed to start after 60 seconds
    echo [INFO] Checking PostgreSQL logs...
    docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% logs postgres-test
    exit /b 1
)

docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% exec -T postgres-test pg_isready >nul 2>&1
if %errorlevel% neq 0 (
    set /a POSTGRES_RETRIES+=1
    echo [INFO] Waiting for PostgreSQL... (attempt %POSTGRES_RETRIES%/30)
    timeout /t 2 /nobreak >nul
    goto :check_postgres
)

echo [SUCCESS] Test environment is ready
exit /b 0

:unit
echo [INFO] Running unit and integration tests...
call :setup_test_env
if %errorlevel% neq 0 exit /b 1

docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% run --rm test-runner npm test
set TEST_EXIT_CODE=%errorlevel%

if %TEST_EXIT_CODE% equ 0 (
    echo [SUCCESS] Unit and integration tests passed
) else (
    echo [ERROR] Unit and integration tests failed
)

call :cleanup_quiet
exit /b %TEST_EXIT_CODE%

:e2e
echo [INFO] Running end-to-end tests...
call :setup_test_env
if %errorlevel% neq 0 exit /b 1

REM Start all services for E2E testing
echo [INFO] Starting all services for E2E testing...
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% --profile e2e up -d

REM Wait for services
echo [INFO] Waiting for all services to be ready...
timeout /t 15 /nobreak >nul

REM Run E2E tests
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% run --rm test-runner npm run test:e2e
set TEST_EXIT_CODE=%errorlevel%

if %TEST_EXIT_CODE% equ 0 (
    echo [SUCCESS] End-to-end tests passed
) else (
    echo [ERROR] End-to-end tests failed
)

call :cleanup_quiet
exit /b %TEST_EXIT_CODE%

:all
echo [INFO] Running all tests (unit + integration + e2e)...
call :setup_test_env
if %errorlevel% neq 0 exit /b 1

REM Run unit and integration tests first
echo.
echo [INFO] Phase 1: Unit and Integration Tests
echo ========================================
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% run --rm test-runner npm test
set UNIT_EXIT_CODE=%errorlevel%

if %UNIT_EXIT_CODE% neq 0 (
    echo [ERROR] Unit tests failed, skipping E2E tests
    call :cleanup_quiet
    exit /b %UNIT_EXIT_CODE%
)

REM Run E2E tests
echo.
echo [INFO] Phase 2: End-to-End Tests
echo ========================================

REM Start all services
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% --profile e2e up -d
timeout /t 15 /nobreak >nul

docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% run --rm test-runner npm run test:e2e
set E2E_EXIT_CODE=%errorlevel%

echo.
echo ========================================
echo Test Summary:
echo Unit Tests: %UNIT_EXIT_CODE%
echo E2E Tests: %E2E_EXIT_CODE%
echo ========================================

call :cleanup_quiet

if %E2E_EXIT_CODE% neq 0 exit /b %E2E_EXIT_CODE%
exit /b 0

:coverage
echo [INFO] Running tests with coverage report...
call :setup_test_env
if %errorlevel% neq 0 exit /b 1

docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% run --rm test-runner npm run test:coverage
set TEST_EXIT_CODE=%errorlevel%

if %TEST_EXIT_CODE% equ 0 (
    echo [SUCCESS] Coverage report generated
    echo [INFO] Coverage report available in ./coverage/lcov-report/index.html
) else (
    echo [ERROR] Tests failed
)

call :cleanup_quiet
exit /b %TEST_EXIT_CODE%

:service
if "%2"=="" (
    echo [ERROR] Service name required
    echo Usage: test-docker.bat service [service-name]
    echo Example: test-docker.bat service auth
    exit /b 1
)

echo [INFO] Running tests for %2 service...
call :setup_test_env
if %errorlevel% neq 0 exit /b 1

docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% run --rm test-runner npm run test:%2
set TEST_EXIT_CODE=%errorlevel%

if %TEST_EXIT_CODE% equ 0 (
    echo [SUCCESS] %2 service tests passed
) else (
    echo [ERROR] %2 service tests failed
)

call :cleanup_quiet
exit /b %TEST_EXIT_CODE%

:cleanup
echo [INFO] Cleaning up test containers and volumes...
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% down --volumes --remove-orphans
echo [SUCCESS] Cleanup completed
exit /b 0

:cleanup_quiet
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% down --volumes --remove-orphans >nul 2>&1
exit /b 0

:logs
echo [INFO] Showing test container logs...
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% logs -f
exit /b 0

:debug
echo [INFO] Opening debug shell in test container...
call :setup_test_env
if %errorlevel% neq 0 exit /b 1

docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% run --rm test-runner /bin/bash
call :cleanup_quiet
exit /b 0

:end
endlocal