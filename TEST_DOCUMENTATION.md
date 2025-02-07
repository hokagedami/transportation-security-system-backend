# Transportation Security System - Test Documentation

## Overview

This document provides comprehensive guidance for running and maintaining the automated test suite for the Transportation Security System (TSS) backend services.

## Test Architecture

### Test Types

1. **Unit Tests** - Test individual functions and components in isolation
2. **Integration Tests** - Test API endpoints and service interactions
3. **End-to-End Tests** - Test complete workflows across all services
4. **API Tests (Postman)** - Comprehensive API testing with Newman automation

### Test Structure

```
tss-backend/
├── services/
│   ├── auth-service/tests/
│   ├── rider-service/tests/
│   ├── jacket-service/tests/
│   ├── payment-service/tests/
│   ├── sms-service/tests/
│   └── verification-service/tests/
├── e2e-tests/
├── postman/                                      # API Test Suite
│   ├── TSS_Backend_Complete_Test_Suite.json     # Main test collection
│   ├── TSS_Backend_All_Services_Extended.json   # Extended tests
│   ├── TSS_Test_Environment.json                # Environment config
│   ├── run-tests.sh                             # Linux/Mac runner
│   ├── run-tests.bat                            # Windows runner
│   ├── package.json                             # NPM scripts
│   └── README.md                                # API test docs
├── jest.setup.js
├── docker-compose.test.yml
└── TEST_DOCUMENTATION.md
```

## Test Coverage

### Service Coverage

| Service | Test File | Coverage Areas |
|---------|-----------|----------------|
| Auth Service | `auth.test.js` | Login, Token Management, Authorization |
| Rider Service | `rider.test.js` | Registration, Profile Management, Search |
| Jacket Service | `jacket.test.js` | Orders, Production, Distribution |
| Payment Service | `payment.test.js` | Payment Processing, Webhooks, Verification |
| SMS Service | `sms.test.js` | Messaging, Notifications, Bulk SMS |
| Verification Service | `verification.test.js` | Rider Verification, Incidents |

### Feature Coverage

- ✅ Authentication & Authorization
- ✅ Input Validation
- ✅ Database Operations
- ✅ External API Integration
- ✅ Error Handling
- ✅ Security (Data Masking, Token Validation)
- ✅ Rate Limiting
- ✅ Role-Based Access Control

## Running Tests

### Prerequisites

1. Docker and Docker Compose installed
2. Node.js 18+ (for local testing only)
3. Newman CLI (for API testing): `npm install -g newman newman-reporter-html`

### Quick Start

#### API Testing with Postman/Newman

```bash
# Navigate to postman directory
cd postman

# Run all API tests (Linux/Mac)
./run-tests.sh

# Run all API tests (Windows)
run-tests.bat

# Run specific test collections
npm run test:full          # Run all collections
npm run test:auth          # Auth service only
npm run test:rider         # Rider service only
npm run test:payment       # Payment service only
npm run test:security      # Security tests only

# Run with CI/CD output format
npm run test:ci           # Generates JUnit XML reports
```

#### Docker Testing (Recommended)

```bash
# Run all tests in Docker (unit + integration + e2e)
npm run test:docker:all

# Note: Works on both Windows and Unix systems automatically

# Run only unit and integration tests
npm run test:docker

# Run only end-to-end tests
npm run test:docker:e2e

# Run tests with coverage report
npm run test:docker:coverage

# Run tests for specific service
./scripts/test-docker.sh service auth
./scripts/test-docker.sh service rider
```

#### Local Testing (Alternative)

```bash
# Install dependencies
npm install

# Setup local test database
npm run setup:test-db

# Run all tests locally
npm test

# Run specific test suites
npm run test:auth
npm run test:rider
npm run test:jacket
npm run test:payment
npm run test:sms
npm run test:verification

# Cleanup test database
npm run teardown:test-db
```

### Docker Testing Environment

#### Architecture

The Docker test environment provides complete isolation with:
- **Test Database**: PostgreSQL 15 (port 5433)
- **Test Cache**: Redis 7 (port 6380)
- **Test Runner**: Node.js 18 container with all dependencies
- **Test Services**: Full microservices stack for E2E testing

#### Docker Test Commands

```bash
# Build test images
npm run test:docker:build

# Run unit and integration tests
npm run test:docker

# Run end-to-end tests
npm run test:docker:e2e

# Run all tests
npm run test:docker:all

# Run with coverage report
npm run test:docker:coverage

# Debug test environment
npm run test:docker:debug

# Cleanup test containers
npm run test:docker:cleanup
```

#### Advanced Docker Testing

```bash
# Using the test script directly
./scripts/test-docker.sh help              # Show all commands
./scripts/test-docker.sh unit              # Unit tests only
./scripts/test-docker.sh e2e               # E2E tests only
./scripts/test-docker.sh all               # All tests
./scripts/test-docker.sh coverage          # With coverage
./scripts/test-docker.sh service auth      # Specific service
./scripts/test-docker.sh build             # Build images
./scripts/test-docker.sh cleanup           # Cleanup
./scripts/test-docker.sh logs              # Show logs
./scripts/test-docker.sh debug             # Debug shell
```

#### Docker Test Configuration

Test containers use these configurations:
- **Dockerfile.test**: Test runner image definition
- **docker-compose.test.yml**: Complete test environment
- **scripts/test-docker.sh**: Test automation script

#### Manual Docker Setup

If you need manual control:

```bash
# Start test database services
docker-compose -f docker-compose.test.yml up -d postgres-test redis-test

# Run specific tests
docker-compose -f docker-compose.test.yml run --rm test-runner npm run test:auth

# Start E2E environment
docker-compose -f docker-compose.test.yml --profile e2e up -d

# Cleanup
docker-compose -f docker-compose.test.yml down --volumes
```

### Environment Variables

Set these environment variables for testing:

```bash
# Test Database
export DB_HOST=localhost
export DB_PORT=5433
export DB_NAME=tss_test_db
export DB_USER=postgres
export DB_PASSWORD=postgres

# Test Redis
export REDIS_URL=redis://localhost:6380

# Test JWT
export JWT_SECRET=test-jwt-secret-key

# E2E Test Configuration
export E2E_BASE_URL=http://localhost
export E2E_ADMIN_USERNAME=admin
export E2E_ADMIN_PASSWORD=admin123
export E2E_OFFICER_USERNAME=officer
export E2E_OFFICER_PASSWORD=officer123
```

## Test Scripts

### Available Scripts

```bash
# Run all tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run individual service tests
npm run test:auth
npm run test:rider
npm run test:jacket
npm run test:payment
npm run test:sms
npm run test:verification

# Run end-to-end tests
npm run test:e2e

# Lint all services
npm run lint
```

### Coverage Reports

Test coverage reports are generated in the `coverage/` directory:
- HTML report: `coverage/lcov-report/index.html`
- Text summary displayed in terminal
- LCOV format for CI/CD integration

## Test Data Management

### Mock Data

Tests use Jest mocks for:
- Database connections (`pool.query`, `pool.connect`)
- External APIs (Paystack, Flutterwave, SMS providers)
- File system operations
- Logger functions

### Test Utilities

Global test utilities are available in `jest.setup.js`:

```javascript
// Create mock database client
const mockClient = testUtils.createMockClient();

// Create test user data
const testUser = testUtils.createTestUser({ role: 'admin' });

// Create test rider data
const testRider = testUtils.createTestRider({ status: 'active' });

// Generate random test data
const randomPhone = testUtils.randomPhone();
const randomEmail = testUtils.randomEmail();
```

## End-to-End Testing

### E2E Test Workflow

The E2E test suite (`complete-workflow.test.js`) tests the entire system workflow:

1. **Authentication** - Admin and field officer login
2. **Rider Registration** - Create new rider with jacket number
3. **SMS Verification** - Send verification SMS
4. **Payment Processing** - Initialize and complete payment
5. **Jacket Ordering** - Create and process jacket order
6. **Production Management** - Batch creation and status updates
7. **Distribution** - Jacket distribution to rider
8. **Verification** - Rider verification by jacket number
9. **Incident Management** - Create and manage incidents
10. **Analytics** - System-wide reporting

### E2E Test Setup

```bash
# Start all services
docker-compose up -d

# Wait for services to be healthy
sleep 30

# Run E2E tests
npm run test:e2e
```

## Continuous Integration

### GitHub Actions

Example CI configuration (`.github/workflows/test.yml`):

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: tss_test_db
        ports:
          - 5433:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7-alpine
        ports:
          - 6380:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm install
          cd services/auth-service && npm install
          cd ../rider-service && npm install
          cd ../jacket-service && npm install
          cd ../payment-service && npm install
          cd ../sms-service && npm install
          cd ../verification-service && npm install
      
      - name: Run tests
        run: npm run test:coverage
        env:
          DB_HOST: localhost
          DB_PORT: 5433
          DB_NAME: tss_test_db
          DB_USER: postgres
          DB_PASSWORD: postgres
          REDIS_URL: redis://localhost:6380
          JWT_SECRET: test-jwt-secret-key
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check if test database is running
   docker-compose -f docker-compose.test.yml ps
   
   # Restart test database
   npm run teardown:test-db && npm run setup:test-db
   ```

2. **Port Conflicts**
   ```bash
   # Check for conflicting processes
   lsof -i :5433  # Test PostgreSQL
   lsof -i :6380  # Test Redis
   
   # Kill conflicting processes or change ports in docker-compose.test.yml
   ```

3. **Mock Issues**
   ```bash
   # Clear Jest cache
   npx jest --clearCache
   
   # Reset mocks in test
   beforeEach(() => {
     jest.clearAllMocks();
   });
   ```

4. **Timeout Issues**
   ```bash
   # Increase timeout in jest.config.js
   jest.setTimeout(15000);
   
   # Or in individual tests
   it('should work', async () => {
     // test code
   }, 15000);
   ```

### Debug Mode

Run tests with debug output:

```bash
# Enable debug logging
DEBUG=* npm test

# Run specific test file
npx jest services/auth-service/tests/auth.test.js --verbose

# Run with coverage details
npm run test:coverage -- --verbose
```

## Best Practices

### Writing Tests

1. **Use Descriptive Names**
   ```javascript
   describe('POST /auth/login', () => {
     it('should login successfully with valid credentials', async () => {
       // test implementation
     });
   });
   ```

2. **Mock External Dependencies**
   ```javascript
   jest.mock('../shared/database/connection', () => ({
     query: jest.fn(),
   }));
   ```

3. **Test Error Cases**
   ```javascript
   it('should handle database errors gracefully', async () => {
     pool.query.mockRejectedValueOnce(new Error('Database error'));
     
     await expect(authService.login('user', 'pass'))
       .rejects.toThrow('Database error');
   });
   ```

4. **Clean Up After Tests**
   ```javascript
   afterEach(() => {
     jest.clearAllMocks();
   });
   ```

### Test Maintenance

1. **Keep Tests Updated** - Update tests when API changes
2. **Monitor Coverage** - Maintain >80% code coverage
3. **Review Test Failures** - Investigate and fix failing tests promptly
4. **Refactor Tests** - Keep test code clean and maintainable

## Performance Testing

For performance testing, consider using:
- Artillery.io for load testing
- Apache Bench (ab) for simple HTTP benchmarks
- Custom scripts using the E2E test framework

## API Testing with Postman

### Overview

The Postman test suite provides comprehensive API testing with 100% endpoint coverage across all microservices. Tests are automated using Newman CLI and can be integrated into CI/CD pipelines.

### Test Collections

1. **Main Collection** (`TSS_Backend_Complete_Test_Suite.postman_collection.json`)
   - Health checks for all services
   - Authentication service complete testing
   - Global test scripts and pre-request scripts

2. **Extended Collection** (`TSS_Backend_All_Services_Extended.postman_collection.json`)
   - All remaining service tests (Rider, Jacket, Payment, SMS, Verification)
   - Security and error handling tests
   - Cleanup operations

### Running API Tests

#### Automated Execution

```bash
# Linux/Mac
cd postman
./run-tests.sh              # Run full test suite
./run-tests.sh --check-health  # Health checks only
./run-tests.sh --help          # Show options

# Windows
cd postman
run-tests.bat               # Run full test suite
```

#### Manual Newman Execution

```bash
# Basic execution
newman run TSS_Backend_Complete_Test_Suite.postman_collection.json \
  --environment TSS_Test_Environment.postman_environment.json

# With HTML report
newman run TSS_Backend_Complete_Test_Suite.postman_collection.json \
  --environment TSS_Test_Environment.postman_environment.json \
  --reporters cli,html \
  --reporter-html-export test-report.html

# Run specific folder
newman run collection.json --folder "Authentication Service Tests"
```

### API Test Coverage

#### Endpoints Tested (100% Coverage)

**Authentication Service (8 endpoints)**
- POST /auth/login
- GET /auth/me
- POST /auth/refresh
- POST /auth/logout

**Rider Service (6 endpoints)**
- POST /riders
- GET /riders
- GET /riders/:id
- PUT /riders/:id
- DELETE /riders/:id
- GET /riders/:id/history

**Jacket Service (6 endpoints)**
- POST /jackets/create-order
- GET /jackets
- PUT /jackets/:id/status
- POST /jackets/batch
- GET /jackets/batch/:batch_id
- PUT /jackets/:id/distribute

**Payment Service (5 endpoints)**
- POST /payment/initialize
- GET /payment/rider/:rider_id
- PUT /payment/:reference/verify
- GET /payment/pending-verification
- POST /payment/webhook/* (Paystack, Flutterwave)

**SMS Service (5 endpoints)**
- POST /sms/send-verification
- POST /sms/send-notification
- POST /sms/send-bulk
- GET /sms/logs
- POST /sms/webhook

**Verification Service (6 endpoints)**
- GET /verify/:jacket_number
- POST /verify/log
- POST /incidents
- GET /incidents
- PUT /incidents/:id
- GET /verify/stats

### Test Assertions

Each test includes multiple assertions covering:
- Response status codes
- Response body structure
- Data type validation
- Business logic validation
- Security headers
- Response time benchmarks
- Error message validation

### CI/CD Integration

#### GitHub Actions

```yaml
- name: Run API Tests
  run: |
    npm install -g newman newman-reporter-html
    cd postman
    npm run test:ci
  
- uses: actions/upload-artifact@v2
  with:
    name: api-test-reports
    path: postman/test-reports/
```

#### Jenkins

```groovy
stage('API Tests') {
    steps {
        sh 'npm install -g newman newman-reporter-html'
        sh 'cd postman && npm run test:ci'
    }
    post {
        always {
            junit 'postman/test-reports/*.xml'
            publishHTML([
                reportDir: 'postman/test-reports',
                reportFiles: '*.html',
                reportName: 'API Test Report'
            ])
        }
    }
}
```

### Test Reports

Reports are generated in `postman/test-reports/`:
- **HTML Reports**: Visual test results with charts
- **JSON Reports**: Machine-readable results
- **JUnit XML**: CI/CD integration format
- **Summary Reports**: Test execution summary

## Security Testing

Security tests are integrated into both Jest and Postman test suites:
- Authentication bypass attempts
- SQL injection prevention
- XSS prevention
- CSRF token validation
- Rate limiting effectiveness
- Large payload handling
- Invalid input handling

## Metrics and Monitoring

Track test metrics:
- Test execution time
- Coverage percentage
- Flaky test identification
- Test reliability scores

## Support

For test-related issues:
1. Check this documentation
2. Review test logs and error messages
3. Check service-specific test files
4. Contact the development team

---

**Last Updated:** 2024-01-01  
**Version:** 1.0.0  
**Maintainer:** TSS Development Team