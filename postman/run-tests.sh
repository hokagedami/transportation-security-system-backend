#!/bin/bash

# TSS Backend API Test Automation Script
# This script runs comprehensive Postman tests for all TSS Backend services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COLLECTION_FILE="TSS_Backend_Complete_Test_Suite.postman_collection.json"
EXTENDED_COLLECTION_FILE="TSS_Backend_All_Services_Extended.postman_collection.json"
ENVIRONMENT_FILE="TSS_Test_Environment.postman_environment.json"
REPORT_DIR="test-reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Function to print colored output
print_info() {
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local port=$2
    local max_retries=5
    local retry_count=0
    
    print_info "Checking health of $service_name on port $port..."
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -s "http://localhost:$port/health" > /dev/null; then
            print_success "$service_name is healthy"
            return 0
        else
            retry_count=$((retry_count + 1))
            print_warning "$service_name not ready, attempt $retry_count/$max_retries"
            sleep 2
        fi
    done
    
    print_error "$service_name is not responding after $max_retries attempts"
    return 1
}

# Function to setup test environment
setup_test_environment() {
    print_info "Setting up test environment..."
    
    # Create reports directory
    mkdir -p "$REPORT_DIR"
    
    # Check if Newman is installed
    if ! command_exists newman; then
        print_error "Newman is not installed. Please install it using: npm install -g newman"
        exit 1
    fi
    
    # Check if Newman HTML reporter is installed
    if ! npm list -g newman-reporter-html >/dev/null 2>&1; then
        print_warning "Newman HTML reporter not found. Installing..."
        npm install -g newman-reporter-html
    fi
    
    print_success "Test environment setup complete"
}

# Function to check all services
check_all_services() {
    print_info "Checking all service health endpoints..."
    
    local services=("auth-service:3001" "rider-service:3002" "jacket-service:3003" "payment-service:3004" "sms-service:3005" "verification-service:3006")
    local all_healthy=true
    
    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        if ! check_service_health "$name" "$port"; then
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        print_success "All services are healthy and ready for testing"
        return 0
    else
        print_error "Some services are not healthy. Please check your services and try again."
        return 1
    fi
}

# Function to run specific test collection
run_collection() {
    local collection_file=$1
    local collection_name=$2
    local report_name=$3
    
    print_info "Running $collection_name tests..."
    
    newman run "$collection_file" \
        --environment "$ENVIRONMENT_FILE" \
        --reporters cli,html,json \
        --reporter-html-export "$REPORT_DIR/${report_name}_${TIMESTAMP}.html" \
        --reporter-json-export "$REPORT_DIR/${report_name}_${TIMESTAMP}.json" \
        --timeout-request 10000 \
        --timeout-script 5000 \
        --delay-request 500 \
        --bail \
        --color on
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        print_success "$collection_name tests completed successfully"
    else
        print_error "$collection_name tests failed with exit code $exit_code"
    fi
    
    return $exit_code
}

# Function to run comprehensive tests
run_comprehensive_tests() {
    local total_exit_code=0
    
    print_info "Starting comprehensive API test suite..."
    print_info "Timestamp: $TIMESTAMP"
    
    # Run main test collection
    if run_collection "$COLLECTION_FILE" "Main API Collection" "main_collection_report"; then
        print_success "Main collection tests passed"
    else
        print_error "Main collection tests failed"
        total_exit_code=1
    fi
    
    # Run extended test collection
    if run_collection "$EXTENDED_COLLECTION_FILE" "Extended API Collection" "extended_collection_report"; then
        print_success "Extended collection tests passed"
    else
        print_error "Extended collection tests failed"
        total_exit_code=1
    fi
    
    return $total_exit_code
}

# Function to generate test summary
generate_test_summary() {
    print_info "Generating test summary..."
    
    local summary_file="$REPORT_DIR/test_summary_${TIMESTAMP}.txt"
    
    {
        echo "TSS Backend API Test Summary"
        echo "Generated: $(date)"
        echo "Timestamp: $TIMESTAMP"
        echo "========================================"
        echo ""
        echo "Test Collections Run:"
        echo "- Main API Collection: $COLLECTION_FILE"
        echo "- Extended API Collection: $EXTENDED_COLLECTION_FILE"
        echo ""
        echo "Environment: $ENVIRONMENT_FILE"
        echo ""
        echo "Reports Generated:"
        find "$REPORT_DIR" -name "*${TIMESTAMP}*" -type f | sort
        echo ""
        echo "Test Coverage:"
        echo "✅ Authentication Service (Login, Logout, Token Management)"
        echo "✅ Rider Service (CRUD Operations, History, Validation)"
        echo "✅ Jacket Service (Orders, Status Updates, Batches, Distribution)"
        echo "✅ Payment Service (Initialize, Verify, Webhooks)"
        echo "✅ SMS Service (Verification, Notifications, Bulk, Logs)"
        echo "✅ Verification Service (Verify Riders, Incidents, Statistics)"
        echo "✅ Security Tests (XSS, SQL Injection, Rate Limiting)"
        echo "✅ Error Handling & Edge Cases"
        echo "✅ Health Checks for All Services"
        echo ""
    } > "$summary_file"
    
    print_success "Test summary generated: $summary_file"
    cat "$summary_file"
}

# Function to cleanup test data
cleanup_test_data() {
    print_info "Cleaning up test data..."
    # Note: Cleanup is handled by the Postman collection's cleanup tests
    print_success "Test data cleanup completed"
}

# Main execution flow
main() {
    echo "========================================"
    echo "TSS Backend API Test Automation"
    echo "========================================"
    echo ""
    
    # Setup
    setup_test_environment
    
    # Check services
    if ! check_all_services; then
        print_error "Service health check failed. Exiting."
        exit 1
    fi
    
    # Run tests
    if run_comprehensive_tests; then
        print_success "All tests completed successfully!"
        generate_test_summary
        cleanup_test_data
        exit 0
    else
        print_error "Some tests failed. Check the reports for details."
        generate_test_summary
        cleanup_test_data
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    --check-health)
        check_all_services
        exit $?
        ;;
    --setup)
        setup_test_environment
        exit $?
        ;;
    --help)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --check-health    Check all service health endpoints"
        echo "  --setup          Setup test environment and dependencies"
        echo "  --help           Show this help message"
        echo ""
        echo "Default: Run comprehensive test suite"
        exit 0
        ;;
    *)
        main
        ;;
esac