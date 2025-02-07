# TSS Backend Testing - Quick Reference

## 🚀 Quick Start

**⚠️ IMPORTANT: Initialize Database First**
```bash
# 1. Start services
docker-compose up -d

# 2. Initialize database (REQUIRED for tests to pass)
docker exec tss-backend-auth-service-1 node scripts/init-database.js

# 3. Run tests
npm test                        # Jest tests
cd postman && ./run-tests.sh   # API tests (Linux/Mac)
cd postman && run-tests.bat     # API tests (Windows)

# Docker testing (cross-platform)
npm run test:docker:all         # All tests in Docker
```

## 📋 Test Commands Reference

### Jest Testing (Unit & Integration)

| Command | Description |
|---------|-------------|
| `npm test` | Run all Jest tests |
| `npm run test:coverage` | Run with coverage report |
| `npm run test:watch` | Run in watch mode |
| `npm run test:auth` | Test auth service only |
| `npm run test:rider` | Test rider service only |
| `npm run test:jacket` | Test jacket service only |
| `npm run test:payment` | Test payment service only |
| `npm run test:sms` | Test SMS service only |
| `npm run test:verification` | Test verification service only |
| `npm run test:e2e` | Run end-to-end tests |

### Postman API Testing

| Command | Description |
|---------|-------------|
| `./run-tests.sh` | Run all API tests (Linux/Mac) |
| `run-tests.bat` | Run all API tests (Windows) |
| `npm run test:full` | Run all collections |
| `npm run test:auth` | Test auth endpoints |
| `npm run test:rider` | Test rider endpoints |
| `npm run test:security` | Run security tests |
| `npm run test:ci` | CI-friendly with JUnit output |
| `npm run health-check` | Check all services health |

### Docker Testing

| Command | Description |
|---------|-------------|
| `npm run test:docker:all` | Run all tests in Docker |
| `npm run test:docker:build` | Build test images |
| `npm run test:docker:coverage` | Run with coverage |
| `npm run test:docker:e2e` | E2E tests only |
| `npm run test:docker:cleanup` | Clean up containers |

## 📊 Test Coverage

### API Endpoints (100% Coverage)

| Service | Endpoints | Status |
|---------|-----------|--------|
| Auth | 4 | ✅ Complete |
| Rider | 6 | ✅ Complete |
| Jacket | 6 | ✅ Complete |
| Payment | 5 | ✅ Complete |
| SMS | 5 | ✅ Complete |
| Verification | 6 | ✅ Complete |
| **Total** | **32** | **✅ 100%** |

### Test Metrics

- **Total Test Cases**: 350+
- **API Tests**: 150+
- **Unit/Integration Tests**: 200+
- **Total Assertions**: 1500+
- **Code Coverage Target**: >80%
- **Execution Time**: ~5 minutes

## 🛠 Common Test Scenarios

### Authentication Testing
```bash
# Test login flow
cd postman && newman run TSS_Backend_Complete_Test_Suite.json \
  --folder "Authentication Service Tests"
```

### Security Testing
```bash
# Run security tests only
cd postman && npm run test:security

# Test rate limiting
for i in {1..10}; do curl -X POST http://localhost:3001/auth/login; done
```

### Performance Testing
```bash
# Simple load test
cd postman
for i in {1..5}; do npm run test & done; wait
```

## 🔍 Debugging Tests

### Database Initialization Issues
```bash
# Check if database is initialized
docker exec tss-backend-postgres-1 psql -U postgres -d tss_db -c "\dt"

# Re-initialize database if needed
docker exec tss-backend-auth-service-1 node scripts/init-database.js

# Check login credentials
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Jest Debugging
```bash
# Run specific test file
npx jest services/auth-service/tests/auth.test.js --verbose

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Clear cache
npx jest --clearCache
```

### Newman Debugging
```bash
# Verbose output
newman run collection.json --verbose

# Custom timeout
newman run collection.json --timeout-request 30000

# Show full response
newman run collection.json --reporters cli,json
```

### Docker Debugging
```bash
# View logs
docker-compose -f docker-compose.test.yml logs -f

# Access test container
docker-compose -f docker-compose.test.yml run --rm test-runner bash

# Check service health
docker-compose -f docker-compose.test.yml ps
```

## 📈 View Test Reports

### Coverage Reports
```bash
# Open Jest coverage
open coverage/lcov-report/index.html      # Mac
start coverage/lcov-report/index.html     # Windows

# Open Postman reports
open postman/test-reports/*.html          # Mac
start postman/test-reports/*.html         # Windows
```

### Report Locations
- **Jest Coverage**: `coverage/lcov-report/index.html`
- **Postman HTML**: `postman/test-reports/*_report_*.html`
- **JUnit XML**: `postman/test-reports/results.xml`
- **Test Summary**: `postman/test-reports/test_summary_*.txt`

## ⚡ CI/CD Commands

### GitHub Actions
```yaml
npm run test:coverage
cd postman && npm run test:ci
```

### Jenkins
```groovy
sh 'npm test'
sh 'cd postman && npm run test:ci'
```

### GitLab CI
```yaml
script:
  - npm run test:coverage
  - cd postman && npm run test:ci
```

## 🚨 Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -i :3001              # Mac/Linux
netstat -ano | findstr 3001 # Windows

# Kill process
kill -9 <PID>              # Mac/Linux
taskkill /PID <PID> /F     # Windows
```

### Database Connection Failed
```bash
# Check if services are running
docker-compose ps

# Restart services if needed
docker-compose restart

# Re-initialize database
docker exec tss-backend-auth-service-1 node scripts/init-database.js

# For test database issues
npm run teardown:test-db
npm run setup:test-db
```

### Test Timeout Issues
```javascript
// Increase timeout in test
it('slow test', async () => {
  // test code
}, 30000); // 30 seconds

// Global timeout
jest.setTimeout(15000);
```

### Newman Not Found
```bash
# Reinstall Newman
npm uninstall -g newman
npm install -g newman newman-reporter-html

# Verify installation
newman --version
```

## 📚 Documentation

- **Full Testing Guide**: `AUTOMATED_TESTING_GUIDE.md`
- **Test Documentation**: `TEST_DOCUMENTATION.md`
- **API Test Details**: `postman/README.md`
- **Docker Testing**: `DOCKER_TESTING.md`

## 🎯 Best Practices Checklist

- [ ] Run tests before committing
- [ ] Maintain >80% code coverage
- [ ] Update tests when changing code
- [ ] Use descriptive test names
- [ ] Test both success and error cases
- [ ] Mock external dependencies
- [ ] Clean up test data
- [ ] Review failing tests promptly

## 🔐 Test Credentials

After database initialization, use these credentials for testing:

- **Username**: `admin` | **Password**: `admin123` (Super Admin)
- **Username**: `lga_admin` | **Password**: `password123` (LGA Admin)
- **Username**: `finance` | **Password**: `password123` (Finance Officer)
- **Username**: `field` | **Password**: `password123` (Field Officer)
- **Username**: `viewer` | **Password**: `password123` (Viewer)

---

**Quick Help**: Run any command with `--help` flag for options