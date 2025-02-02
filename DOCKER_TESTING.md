# Docker Testing Guide

Complete guide for running tests using Docker containers in the Transportation Security System.

## 🐳 Quick Start

### 1. Prerequisites
- Docker and Docker Compose installed
- Git repository cloned

### 2. Run Tests Immediately

```bash
# Run all tests (unit + integration + e2e)
npm run test:docker:all

# Or run individually
npm run test:docker          # Unit and integration tests
npm run test:docker:e2e      # End-to-end tests
npm run test:docker:coverage # With coverage report
```

## 🏗️ Docker Test Architecture

### Container Setup
```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Test Environment                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Test Database  │  │   Test Cache    │  │   Test Runner   │ │
│  │  PostgreSQL 15  │  │    Redis 7      │  │   Node.js 18    │ │
│  │   Port: 5433    │  │   Port: 6380    │  │   All Tests     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│              E2E Testing Services (Optional)                │
├─────────────────────────────────────────────────────────────┤
│  Auth   Rider   Jacket   Payment   SMS   Verification       │
│  :3001  :3002   :3003    :3004     :3005     :3006         │
└─────────────────────────────────────────────────────────────┘
```

### Test Types in Docker

1. **Unit Tests**: Individual function testing in isolated containers
2. **Integration Tests**: API endpoint testing with test database
3. **End-to-End Tests**: Full workflow testing with all services running

## 📋 Available Commands

### NPM Scripts (Recommended)
```bash
npm run test:docker          # Unit + Integration tests
npm run test:docker:e2e      # End-to-end tests
npm run test:docker:all      # All tests
npm run test:docker:coverage # Tests with coverage
npm run test:docker:build    # Build test images
npm run test:docker:cleanup  # Cleanup containers
npm run test:docker:debug    # Debug environment
```

### Direct Script Usage
```bash
# Linux/Mac
./scripts/test-docker.sh [command]

# Windows
scripts\test-docker.bat [command]
```

### Available Script Commands
| Command | Description |
|---------|-------------|
| `unit` | Run unit and integration tests |
| `e2e` | Run end-to-end tests |
| `all` | Run all tests |
| `coverage` | Run tests with coverage report |
| `service <name>` | Run tests for specific service |
| `build` | Build test Docker images |
| `cleanup` | Clean up containers and volumes |
| `logs` | Show test service logs |
| `debug` | Enter test container shell |
| `help` | Show help message |

## 🔧 Configuration Files

### Dockerfile.test
Defines the test runner container with:
- Node.js 18 Alpine base image
- All service dependencies installed
- Test environment variables
- Wait-for-services script

### docker-compose.test.yml
Complete test environment with:
- **postgres-test**: Test database with schema
- **redis-test**: Test cache
- **test-runner**: Unit/integration test container
- **e2e-test-runner**: End-to-end test container
- **Service containers**: Full app stack for E2E testing

## 🚀 Usage Examples

### Basic Testing
```bash
# Quick test run
npm run test:docker

# With detailed output
./scripts/test-docker.sh unit

# Test specific service
./scripts/test-docker.sh service auth
./scripts/test-docker.sh service rider
```

### Coverage Testing
```bash
# Generate coverage report
npm run test:docker:coverage

# Coverage files will be in ./coverage-docker/
open coverage-docker/lcov-report/index.html  # View HTML report
```

### End-to-End Testing
```bash
# Run full E2E workflow
npm run test:docker:e2e

# This will:
# 1. Start all 6 microservices
# 2. Wait for services to be healthy
# 3. Run complete workflow tests
# 4. Cleanup automatically
```

### Development & Debugging
```bash
# Build fresh test images
npm run test:docker:build

# Debug test environment
npm run test:docker:debug
# This opens a shell in the test container

# View test logs
./scripts/test-docker.sh logs

# Manual test run
docker-compose -f docker-compose.test.yml run --rm test-runner npm test
```

## 🐛 Debugging Failed Tests

### 1. View Test Logs
```bash
# Show all test logs
./scripts/test-docker.sh logs

# Show specific service logs
docker-compose -f docker-compose.test.yml logs test-runner
docker-compose -f docker-compose.test.yml logs postgres-test
```

### 2. Interactive Debugging
```bash
# Enter test container
npm run test:docker:debug

# Inside container, run tests manually
npm run test:auth
npm run test:e2e

# Check database connection
psql -h postgres-test -U postgres -d tss_test_db
```

### 3. Service Health Checks
```bash
# Check if services are healthy during E2E tests
docker-compose -f docker-compose.test.yml ps

# Test service endpoints
curl http://localhost:3001/health  # Auth service
curl http://localhost:3002/health  # Rider service
```

## 🔧 Advanced Configuration

### Custom Environment Variables
Create `.env.test` file:
```bash
# Test Database
DB_HOST=postgres-test
DB_PORT=5432
DB_NAME=tss_test_db
DB_USER=postgres
DB_PASSWORD=postgres

# Test Redis
REDIS_URL=redis://redis-test:6379

# Test JWT
JWT_SECRET=test-jwt-secret-key

# E2E Test Users
E2E_ADMIN_USERNAME=admin
E2E_ADMIN_PASSWORD=admin123
```

### Custom Test Database
```bash
# Start only test database
docker-compose -f docker-compose.test.yml up -d postgres-test

# Connect to test database
docker-compose -f docker-compose.test.yml exec postgres-test psql -U postgres -d tss_test_db

# Run custom SQL
docker-compose -f docker-compose.test.yml exec postgres-test psql -U postgres -d tss_test_db -c "SELECT * FROM users;"
```

### Performance Testing
```bash
# Run tests with timing
time npm run test:docker

# Parallel test execution
docker-compose -f docker-compose.test.yml run --rm test-runner npm run test:unit -- --maxWorkers=4
```

## 🚨 Troubleshooting

### Common Issues

1. **Docker not running**
   ```bash
   # Error: Cannot connect to Docker daemon
   # Solution: Start Docker Desktop or Docker service
   sudo systemctl start docker  # Linux
   ```

2. **Port conflicts**
   ```bash
   # Error: Port 5433 already in use
   # Solution: Stop conflicting services or change ports
   docker-compose -f docker-compose.test.yml down
   ```

3. **Out of disk space**
   ```bash
   # Clean up Docker resources
   npm run test:docker:cleanup
   docker system prune -a --volumes
   ```

4. **Database connection issues**
   ```bash
   # Check database health
   docker-compose -f docker-compose.test.yml exec postgres-test pg_isready -U postgres
   
   # Restart database
   docker-compose -f docker-compose.test.yml restart postgres-test
   ```

5. **Test timeout issues**
   ```bash
   # Increase timeouts in jest.config.js
   jest.setTimeout(30000);
   
   # Or use environment variable
   JEST_TIMEOUT=30000 npm run test:docker
   ```

### Getting Help
```bash
# Show script help
./scripts/test-docker.sh help

# Check Docker status
docker info
docker-compose -f docker-compose.test.yml config

# View container logs
docker-compose -f docker-compose.test.yml logs
```

## 📊 Performance Benchmarks

### Typical Test Execution Times
- **Unit Tests**: 2-3 minutes
- **Integration Tests**: 3-5 minutes  
- **End-to-End Tests**: 5-10 minutes
- **All Tests**: 10-15 minutes
- **Coverage Generation**: +2-3 minutes

### Resource Usage
- **Memory**: ~2GB during full test run
- **CPU**: 2-4 cores recommended
- **Disk**: ~1GB for test images and volumes

## 🔒 Security Considerations

### Test Environment Isolation
- Tests run in isolated Docker network
- Test database is separate from production
- No external network access required
- All test data is ephemeral

### Secrets Management
- Test secrets are hardcoded (safe for testing)
- No production secrets in test environment
- Test JWT tokens use test-only secret

## 📈 CI/CD Integration

### GitHub Actions Example
```yaml
name: Docker Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Docker Tests
        run: |
          chmod +x scripts/test-docker.sh
          ./scripts/test-docker.sh all
```

### Jenkins Pipeline
```groovy
pipeline {
    agent any
    stages {
        stage('Docker Tests') {
            steps {
                sh './scripts/test-docker.sh all'
            }
        }
    }
}
```

---

## 📚 Additional Resources

- **Main Documentation**: `README.md`
- **Detailed Test Guide**: `TEST_DOCUMENTATION.md`
- **Docker Compose Config**: `docker-compose.test.yml`
- **Test Scripts**: `scripts/test-docker.sh`, `scripts/test-docker.bat`

**Need Help?** Check the troubleshooting section above or review the test logs for specific error messages.