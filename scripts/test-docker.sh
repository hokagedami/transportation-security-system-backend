#!/bin/bash

# Docker Test Runner Script for TSS Backend
# This script provides convenient commands for running tests in Docker containers

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to cleanup test containers
cleanup() {
    print_status "Cleaning up test containers and volumes..."
    docker-compose -f docker-compose.test.yml down --volumes --remove-orphans
    docker system prune -f --volumes
    print_success "Cleanup completed"
}

# Function to build test images
build_test_images() {
    print_status "Building test images..."
    docker-compose -f docker-compose.test.yml build --no-cache
    print_success "Test images built successfully"
}

# Function to run unit and integration tests
run_unit_tests() {
    print_status "Running unit and integration tests..."
    
    # Start test database services
    docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
    
    # Wait for services to be healthy
    print_status "Waiting for test services to be ready..."
    docker-compose -f docker-compose.test.yml exec postgres-test pg_isready -U postgres || {
        print_error "Test database failed to start"
        cleanup
        exit 1
    }
    
    # Run tests
    docker-compose -f docker-compose.test.yml run --rm test-runner
    
    # Capture exit code
    TEST_EXIT_CODE=$?
    
    # Stop test services
    docker-compose -f docker-compose.test.yml down
    
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        print_success "All unit and integration tests passed!"
    else
        print_error "Some tests failed. Exit code: $TEST_EXIT_CODE"
        exit $TEST_EXIT_CODE
    fi
}

# Function to run E2E tests
run_e2e_tests() {
    print_status "Running end-to-end tests..."
    
    # Start all services including test applications
    docker-compose -f docker-compose.test.yml --profile e2e up -d
    
    # Wait for all services to be healthy
    print_status "Waiting for all services to be ready..."
    sleep 30  # Give services time to start
    
    # Check service health
    for service in auth-service-test rider-service-test jacket-service-test payment-service-test sms-service-test verification-service-test; do
        if ! docker-compose -f docker-compose.test.yml exec $service curl -f http://localhost:$(docker-compose -f docker-compose.test.yml port $service 300X | cut -d: -f2)/health > /dev/null 2>&1; then
            print_warning "Service $service may not be fully ready"
        fi
    done
    
    # Run E2E tests
    docker-compose -f docker-compose.test.yml run --rm e2e-test-runner
    
    # Capture exit code
    E2E_EXIT_CODE=$?
    
    # Stop all services
    docker-compose -f docker-compose.test.yml --profile e2e down
    
    if [ $E2E_EXIT_CODE -eq 0 ]; then
        print_success "All end-to-end tests passed!"
    else
        print_error "Some E2E tests failed. Exit code: $E2E_EXIT_CODE"
        exit $E2E_EXIT_CODE
    fi
}

# Function to run tests with coverage
run_tests_with_coverage() {
    print_status "Running tests with coverage..."
    
    # Start test database services
    docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
    
    # Wait for services
    print_status "Waiting for test services to be ready..."
    sleep 10
    
    # Run tests with coverage
    docker-compose -f docker-compose.test.yml run --rm test-runner npm run test:coverage
    
    # Copy coverage reports out of container
    CONTAINER_ID=$(docker-compose -f docker-compose.test.yml run -d test-runner npm run test:coverage)
    docker cp $CONTAINER_ID:/app/coverage ./coverage-docker
    docker rm $CONTAINER_ID
    
    # Stop services
    docker-compose -f docker-compose.test.yml down
    
    print_success "Coverage report saved to ./coverage-docker/"
}

# Function to run specific service tests
run_service_tests() {
    local service=$1
    if [ -z "$service" ]; then
        print_error "Please specify a service name (auth, rider, jacket, payment, sms, verification)"
        exit 1
    fi
    
    print_status "Running tests for $service service..."
    
    # Start test database services
    docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
    
    # Wait for services
    sleep 5
    
    # Run specific service tests
    docker-compose -f docker-compose.test.yml run --rm test-runner npm run test:$service
    
    # Stop services
    docker-compose -f docker-compose.test.yml down
    
    print_success "$service service tests completed"
}

# Function to show logs from test services
show_test_logs() {
    print_status "Showing logs from test services..."
    docker-compose -f docker-compose.test.yml logs -f
}

# Function to enter test container for debugging
debug_tests() {
    print_status "Starting test environment for debugging..."
    
    # Start test services
    docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
    
    # Wait for services
    sleep 5
    
    # Start interactive shell in test container
    docker-compose -f docker-compose.test.yml run --rm test-runner bash
    
    # Stop services when done
    docker-compose -f docker-compose.test.yml down
}

# Main function
main() {
    check_docker
    
    case "${1:-help}" in
        "unit"|"integration")
            run_unit_tests
            ;;
        "e2e"|"end-to-end")
            run_e2e_tests
            ;;
        "all")
            run_unit_tests
            run_e2e_tests
            ;;
        "coverage")
            run_tests_with_coverage
            ;;
        "build")
            build_test_images
            ;;
        "cleanup"|"clean")
            cleanup
            ;;
        "service")
            run_service_tests $2
            ;;
        "logs")
            show_test_logs
            ;;
        "debug")
            debug_tests
            ;;
        "help"|"--help"|"-h")
            echo ""
            echo "TSS Backend Docker Test Runner"
            echo ""
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  unit              Run unit and integration tests"
            echo "  e2e               Run end-to-end tests"
            echo "  all               Run all tests (unit + e2e)"
            echo "  coverage          Run tests with coverage report"
            echo "  service <name>    Run tests for specific service"
            echo "  build             Build test Docker images"
            echo "  cleanup           Clean up test containers and volumes"
            echo "  logs              Show logs from test services"
            echo "  debug             Enter test container for debugging"
            echo "  help              Show this help message"
            echo ""
            echo "Service names: auth, rider, jacket, payment, sms, verification"
            echo ""
            echo "Examples:"
            echo "  $0 unit                    # Run unit tests"
            echo "  $0 e2e                     # Run E2E tests"
            echo "  $0 all                     # Run all tests"
            echo "  $0 service auth            # Run auth service tests"
            echo "  $0 coverage                # Run with coverage"
            echo ""
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use '$0 help' to see available commands"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"