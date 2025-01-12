# TSS Backend - Transportation Security System

Microservices-based backend system for the Ogun State Transportation Security Initiative.

## Architecture

The system consists of 6 independent microservices, each with its own database connection, shared utilities, and test suite:

- **Authentication Service** (Port 3001): User authentication and authorization
- **Rider Service** (Port 3002): Rider registration and management
- **Jacket Service** (Port 3003): Jacket inventory and distribution
- **Payment Service** (Port 3004): Payment processing and verification
- **SMS Service** (Port 3005): SMS communications and verification  
- **Verification Service** (Port 3006): Rider verification and incident management

## Project Structure

```
tss-backend/
├── services/                          # Microservices
│   ├── auth-service/
│   │   ├── src/                       # Application source code
│   │   │   ├── controllers/           # Route handlers
│   │   │   ├── services/              # Business logic
│   │   │   ├── routes/                # API routes
│   │   │   ├── validators/            # Input validation
│   │   │   ├── middleware/            # Service-specific middleware
│   │   │   └── index.js               # Service entry point
│   │   ├── shared/                    # Local shared utilities
│   │   │   ├── database/              # Database connection
│   │   │   ├── middleware/            # Auth, error handling
│   │   │   ├── utils/                 # Logger, response helpers
│   │   │   └── validators/            # Common validation schemas
│   │   ├── tests/                     # Service test suite
│   │   ├── Dockerfile                 # Container configuration
│   │   └── package.json               # Service dependencies
│   ├── rider-service/                 # Same structure as auth-service
│   ├── jacket-service/                # Same structure as auth-service
│   ├── payment-service/               # Same structure as auth-service
│   ├── sms-service/                   # Same structure as auth-service
│   └── verification-service/          # Same structure as auth-service
├── database/                          # Database setup
│   ├── schema.sql                     # Complete database schema
│   ├── migrations/                    # Database migrations
│   └── seeds/                         # Sample data
├── e2e-tests/                         # End-to-end test suite
│   └── complete-workflow.test.js      # Full system workflow tests
├── docker-compose.yml                 # Production services
├── docker-compose.test.yml            # Test environment
├── jest.setup.js                      # Global test configuration
├── TEST_DOCUMENTATION.md              # Testing guide
├── package.json                       # Root test scripts
└── README.md                          # This file
```

## Features

### 🔐 Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (Super Admin, Admin, LGA Admin, Field Officer)
- Rate limiting on authentication endpoints
- Secure password hashing with bcrypt

### 👤 Rider Management
- Complete rider registration and profile management
- Automatic jacket number generation (format: OG-LGA-XXXXX)
- Vehicle information and documentation
- Status tracking (pending, active, suspended, expired)
- Rider history and audit trail

### 🧥 Jacket Management
- Jacket order processing linked to payments
- Production batch management
- Distribution tracking
- Order status workflows (pending → production → completed → distributed)
- Analytics and reporting

### 💳 Payment Processing
- Multi-provider payment integration (Paystack, Flutterwave)
- Secure webhook handling with signature verification
- Payment verification and status tracking
- Comprehensive payment analytics

### 📱 SMS Communications
- Verification SMS for rider registration
- Notification system for status updates
- Bulk messaging capabilities
- SMS logs and delivery tracking
- Auto-response system for incoming messages

### ✅ Verification System
- Real-time rider verification by jacket number
- Data privacy with phone/email masking
- Verification logging and analytics
- Incident reporting and management
- Geographic tracking of verifications

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### Development Setup

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd tss-backend
   ```

2. **Start with Docker (Recommended)**
   ```bash
   # Start all services
   docker-compose up -d
   
   # Check service health
   docker-compose ps
   
   # View logs
   docker-compose logs -f
   ```

3. **Manual Setup (Optional)**
   ```bash
   # Install dependencies for all services
   cd services/auth-service && npm install
   cd ../rider-service && npm install
   cd ../jacket-service && npm install
   cd ../payment-service && npm install
   cd ../sms-service && npm install
   cd ../verification-service && npm install
   
   # Setup database
   psql -U postgres -d postgres -f database/schema.sql
   
   # Start each service (in separate terminals)
   cd services/auth-service && npm run dev
   # Repeat for each service...
   ```

### Service URLs

Once running, services are available at:
- Auth Service: http://localhost:3001
- Rider Service: http://localhost:3002
- Jacket Service: http://localhost:3003
- Payment Service: http://localhost:3004
- SMS Service: http://localhost:3005
- Verification Service: http://localhost:3006

Health checks: `GET /{service-url}/health`

## API Documentation

### Authentication Service (Port 3001)
```bash
POST /auth/login           # User login
GET  /auth/me              # Get current user profile
POST /auth/refresh         # Refresh access token
POST /auth/logout          # User logout
```

### Rider Service (Port 3002)
```bash
POST   /riders             # Create new rider
GET    /riders             # List riders (paginated, filtered)
GET    /riders/:id         # Get rider details
PUT    /riders/:id         # Update rider
DELETE /riders/:id         # Soft delete rider
GET    /riders/:id/history # Get rider history
GET    /riders/analytics   # Rider statistics
```

### Jacket Service (Port 3003)
```bash
POST /orders               # Create jacket order
GET  /orders               # List orders (paginated, filtered)
GET  /orders/:id           # Get order details
PUT  /orders/:id/status    # Update order status
POST /batches              # Create production batch
GET  /batches              # List production batches
POST /distribute           # Distribute jackets
GET  /analytics            # Jacket analytics
```

### Payment Service (Port 3004)
```bash
POST /payments/initialize  # Initialize payment
PUT  /payments/:ref/verify # Verify payment
GET  /payments/rider/:id   # Get rider payments
POST /payments/webhook/*   # Payment provider webhooks
GET  /payments/analytics   # Payment analytics
```

### SMS Service (Port 3005)
```bash
POST /sms/send-verification # Send verification SMS
POST /sms/send-notification # Send notification SMS
POST /sms/send-bulk        # Send bulk SMS
GET  /sms/logs             # Get SMS logs
POST /sms/webhook          # SMS provider webhook
```

### Verification Service (Port 3006)
```bash
GET  /verification/verify/:jacket_number # Verify rider
POST /verification/verify/log           # Log verification
POST /verification/incidents            # Report incident
GET  /verification/incidents            # List incidents
PUT  /verification/incidents/:id        # Update incident
GET  /verification/verify/stats         # Verification statistics
```

## Testing

### Automated Test Suite

The project includes comprehensive automated tests:

```bash
# Install test dependencies
npm install

# Run all tests
npm test

# Run individual service tests
npm run test:auth
npm run test:rider
npm run test:jacket
npm run test:payment
npm run test:sms
npm run test:verification

# Run end-to-end tests
npm run test:e2e

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Test Coverage
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **End-to-End Tests**: Complete workflow testing
- **Security Tests**: Authentication, authorization, input validation
- **Error Handling**: Database failures, external API failures

See `TEST_DOCUMENTATION.md` for detailed testing information.

## Environment Configuration

Key environment variables:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tss_db
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=8h
REFRESH_TOKEN_EXPIRES_IN=7d

# Payment Providers
PAYSTACK_SECRET_KEY=sk_test_xxx
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxx

# SMS Provider
SMS_PROVIDER_API_KEY=your-sms-api-key
SMS_PROVIDER_URL=https://api.sms-provider.com
```

## Database Schema

The complete database schema includes:
- **users**: System users with role-based access
- **lgas**: Local Government Area information
- **riders**: Registered riders with jacket numbers
- **payments**: Payment transactions and status
- **jacket_orders**: Jacket orders and distribution
- **sms_logs**: SMS communication tracking
- **verification_logs**: Rider verification history
- **incidents**: Incident reports and tracking

Schema file: `database/schema.sql`

## Development Scripts

```bash
# Docker Operations
npm run start              # Start all services
npm run stop               # Stop all services  
npm run restart            # Restart all services
npm run logs               # View service logs

# Testing
npm run test               # Run all tests
npm run test:coverage      # Run tests with coverage
npm run setup:test-db      # Setup test database
npm run teardown:test-db   # Cleanup test database

# Development
npm run dev                # Start in development mode
npm run lint               # Lint all services
```

## Deployment

### Docker Deployment
```bash
# Production deployment
docker-compose up -d

# Scale services
docker-compose up -d --scale rider-service=3
```

### Environment-Specific Configurations
- Development: `docker-compose.yml`
- Testing: `docker-compose.test.yml`
- Production: Use environment variables and secrets management

## Architecture Decisions

### Self-Contained Services
Each service includes its own copy of shared utilities to ensure:
- **Independence**: Services can be deployed separately
- **Resilience**: No single point of failure
- **Scalability**: Services can scale independently
- **Maintainability**: Changes to shared code are isolated

### Database Design
- **Single Database**: All services share one PostgreSQL database
- **Service Boundaries**: Each service owns specific tables
- **Referential Integrity**: Foreign keys maintain data consistency
- **Audit Trails**: All critical operations are logged

### Security
- **JWT Authentication**: Stateless authentication across services
- **Role-Based Access**: Granular permissions by user role
- **Input Validation**: Comprehensive validation using Joi schemas
- **Rate Limiting**: Protection against abuse
- **Data Privacy**: Sensitive data masking in verification responses

## Support & Documentation

- **API Documentation**: See individual service endpoints above
- **Test Documentation**: `TEST_DOCUMENTATION.md`
- **Database Schema**: `database/schema.sql`
- **Docker Configuration**: `docker-compose.yml`

## Contributing

1. Follow the existing code structure and conventions
2. Write tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting changes

## License

Transportation Security System Backend  
© 2024 Ogun State Government

---

**Version**: 1.0.0  
**Last Updated**: 2024-01-01  
**Node.js**: 18+  
**Database**: PostgreSQL 15+