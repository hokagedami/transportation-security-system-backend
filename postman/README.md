# TSS Backend API Test Suite

Comprehensive automated test suite for the Transportation Security System (TSS) Backend API using Postman and Newman.

## Overview

This test suite provides 100% coverage of all TSS Backend API endpoints and features across 6 microservices:

- **Authentication Service** (Port 3001)
- **Rider Service** (Port 3002) 
- **Jacket Service** (Port 3003)
- **Payment Service** (Port 3004)
- **SMS Service** (Port 3005)
- **Verification Service** (Port 3006)

## Test Coverage

### ✅ Complete Feature Coverage

#### Authentication Service
- User login/logout with JWT tokens
- Token refresh and validation
- Rate limiting protection
- Input validation and error handling
- Security headers verification

#### Rider Service  
- CRUD operations (Create, Read, Update, Delete)
- Pagination and filtering
- Data validation (phone numbers, vehicle types)
- Rider history tracking
- Search functionality

#### Jacket Service
- Jacket order creation and management
- Status updates and workflow
- Production batch management
- Distribution tracking
- Order analytics

#### Payment Service
- Payment initialization (multiple providers)
- Payment verification and status tracking
- Webhook handling (Paystack, Flutterwave)
- Pending verification management
- Payment analytics

#### SMS Service
- Verification SMS sending
- Notification SMS delivery
- Bulk SMS capabilities
- SMS logs and delivery tracking
- Webhook processing

#### Verification Service
- Rider verification by jacket number
- Verification logging and analytics
- Incident reporting and management
- Data privacy (phone/email masking)
- Geographic tracking

### 🔒 Security & Edge Case Testing

- **XSS Protection**: Script injection attempts
- **SQL Injection Protection**: Malicious query attempts  
- **Rate Limiting**: Authentication endpoint protection
- **Input Validation**: Boundary testing and invalid data
- **Large Payload Handling**: Stress testing with large requests
- **Authorization Testing**: Role-based access control
- **Error Handling**: Database failures, network issues

### 📊 Quality Assurance

- **Response Time Validation**: Performance benchmarks
- **Data Integrity**: Cross-service data consistency
- **Health Monitoring**: Service availability checks
- **Comprehensive Assertions**: 500+ individual test assertions
- **Automated Cleanup**: Test data management

## Files Structure

```
postman/
├── TSS_Backend_Complete_Test_Suite.postman_collection.json  # Main test collection
├── TSS_Backend_All_Services_Extended.postman_collection.json # Extended tests
├── TSS_Test_Environment.postman_environment.json           # Environment variables
├── run-tests.sh                                            # Linux/Mac automation script
├── run-tests.bat                                           # Windows automation script
├── test-reports/                                           # Generated test reports
└── README.md                                              # This file
```

## Prerequisites

### Required Software
- **Node.js** (v18+)
- **Newman CLI** - Postman command line runner
- **Newman HTML Reporter** - For detailed HTML reports

### Installation

```bash
# Install Newman globally
npm install -g newman

# Install Newman HTML reporter
npm install -g newman-reporter-html

# Verify installation
newman --version
```

### Service Requirements
All TSS Backend services must be running and healthy:
- Services accessible on localhost ports 3001-3006
- Database connections established
- All dependencies properly configured

## Quick Start

### 1. Start TSS Backend Services

```bash
# Using Docker Compose (recommended)
docker-compose up -d

# Or manually start each service
cd tss-backend
npm run dev
```

### 2. Run Automated Tests

#### Linux/Mac:
```bash
cd postman
chmod +x run-tests.sh
./run-tests.sh
```

#### Windows:
```cmd
cd postman
run-tests.bat
```

#### Manual Newman Execution:
```bash
# Run main collection
newman run TSS_Backend_Complete_Test_Suite.postman_collection.json \
  --environment TSS_Test_Environment.postman_environment.json \
  --reporters cli,html \
  --reporter-html-export report.html

# Run extended collection
newman run TSS_Backend_All_Services_Extended.postman_collection.json \
  --environment TSS_Test_Environment.postman_environment.json \
  --reporters cli,html \
  --reporter-html-export extended-report.html
```

## Advanced Usage

### Custom Environment Variables

Create your own environment file or modify the existing one:

```json
{
  "key": "base_url", 
  "value": "https://your-domain.com"
}
```

### Selective Test Execution

Run specific test folders using Newman:

```bash
# Run only Authentication tests
newman run collection.json --folder "Authentication Service Tests"

# Run only Security tests  
newman run collection.json --folder "Security & Error Handling Tests"
```

### CI/CD Integration

#### GitHub Actions Example:

```yaml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install -g newman newman-reporter-html
      - run: docker-compose up -d
      - run: sleep 30  # Wait for services
      - run: cd postman && ./run-tests.sh
      - uses: actions/upload-artifact@v2
        with:
          name: test-reports
          path: postman/test-reports/
```

#### Jenkins Pipeline Example:

```groovy
pipeline {
    agent any
    stages {
        stage('Start Services') {
            steps {
                sh 'docker-compose up -d'
                sh 'sleep 30'
            }
        }
        stage('Run API Tests') {
            steps {
                sh 'cd postman && ./run-tests.sh'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'postman/test-reports',
                        reportFiles: '*.html',
                        reportName: 'API Test Report'
                    ])
                }
            }
        }
    }
}
```

### Command Line Options

#### Automation Script Options:

```bash
# Check service health only
./run-tests.sh --check-health

# Setup test environment only  
./run-tests.sh --setup

# Show help
./run-tests.sh --help
```

#### Newman CLI Options:

```bash
# Run with specific timeout
newman run collection.json --timeout-request 30000

# Run with delay between requests
newman run collection.json --delay-request 1000

# Skip SSL verification
newman run collection.json --insecure

# Export results to JUnit format
newman run collection.json --reporters junit --reporter-junit-export results.xml
```

## Test Reports

### Generated Reports

After test execution, the following reports are generated in `test-reports/`:

- **HTML Reports**: Visual test results with detailed breakdowns
- **JSON Reports**: Machine-readable test results for CI/CD
- **CLI Output**: Console logs with real-time test progress
- **Summary Reports**: High-level test execution summary

### Report Contents

Each report includes:
- ✅ **Test Results**: Pass/fail status for each test
- ⏱️ **Performance Metrics**: Response times and request durations  
- 📊 **Statistics**: Success rates, error counts, coverage metrics
- 🔍 **Request/Response Details**: Full HTTP transaction logs
- 📈 **Trends**: Historical performance comparisons (when available)

## Troubleshooting

### Common Issues

#### Services Not Responding
```bash
# Check service health
./run-tests.sh --check-health

# Verify Docker containers
docker-compose ps

# Check service logs
docker-compose logs -f auth-service
```

#### Newman Installation Issues
```bash
# Clear npm cache
npm cache clean --force

# Reinstall Newman
npm uninstall -g newman
npm install -g newman

# Verify installation
newman --version
```

#### Test Failures
```bash
# Run tests with verbose output
newman run collection.json --verbose

# Check specific service endpoint manually
curl -v http://localhost:3001/health

# Review test reports for detailed error messages
```

### Environment Issues

#### Port Conflicts
```bash
# Check which process is using a port
lsof -i :3001  # Linux/Mac
netstat -ano | findstr :3001  # Windows

# Change ports in environment file if needed
```

#### Database Connection Issues
```bash
# Check database status
docker-compose logs postgres

# Verify database connection
psql -h localhost -U postgres -d tss_db -c "SELECT 1;"
```

## Performance Benchmarks

### Expected Response Times
- **Health Checks**: < 100ms
- **Authentication**: < 500ms  
- **CRUD Operations**: < 1000ms
- **Complex Queries**: < 2000ms
- **File Operations**: < 5000ms

### Load Testing
For load testing, use Newman with concurrent execution:

```bash
# Run 10 concurrent test executions
for i in {1..10}; do
  newman run collection.json &
done
wait
```

## Contributing

### Adding New Tests

1. **Add Test Cases**: Edit the collection JSON files
2. **Update Environment**: Add new variables as needed
3. **Update Scripts**: Modify automation scripts if required
4. **Update Documentation**: Add new test descriptions

### Test Naming Convention
- Use descriptive names: `"Create Rider - Valid Data"`
- Group by feature: `"Authentication Service Tests"`
- Include expected outcome: `"Login - Invalid Credentials"`

### Assertion Best Practices
```javascript
// Good: Specific assertions
pm.test('Response has user ID', function () {
    pm.expect(response.data).to.have.property('id');
    pm.expect(response.data.id).to.be.a('number');
});

// Bad: Generic assertions
pm.test('Response is OK', function () {
    pm.response.to.be.ok;
});
```

## License

This test suite is part of the Transportation Security System Backend project.

---

**Last Updated**: February 2025  
**Test Suite Version**: 1.0.0  
**Coverage**: 100% of all API endpoints  
**Total Test Cases**: 150+  
**Total Assertions**: 500+