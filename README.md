# TSS Backend - Transportation Security System

Microservices-based backend system for the Ogun State Transportation Security Initiative.

## Architecture

The system consists of 6 microservices:
- **Authentication Service** (Port 3001): User authentication and authorization
- **Rider Service** (Port 3002): Rider registration and management
- **Jacket Service** (Port 3003): Jacket inventory and distribution
- **Payment Service** (Port 3004): Payment processing and verification
- **SMS Service** (Port 3005): SMS communications and verification
- **Verification Service** (Port 3006): Rider verification and incident management

## Project Structure

```
tss-backend/
├── services/
│   ├── auth-service/
│   ├── rider-service/
│   ├── jacket-service/
│   ├── payment-service/
│   ├── sms-service/
│   └── verification-service/
├── shared/
│   ├── database/
│   ├── middleware/
│   ├── utils/
│   ├── config/
│   └── validators/
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── schema.sql
├── docs/
├── scripts/
├── docker-compose.yml
└── .env.example
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Local Development

1. Clone the repository
2. Copy `.env.example` to `.env` and configure environment variables
3. Set up the database:
   ```bash
   psql -U postgres -d postgres -f database/schema.sql
   ```

4. Install dependencies for each service:
   ```bash
   cd services/auth-service && npm install
   cd ../rider-service && npm install
   # ... repeat for all services
   ```

5. Start each service:
   ```bash
   cd services/auth-service && npm run dev
   # In separate terminals for each service
   ```

### Docker Development

1. Copy `.env.example` to `.env`
2. Run all services:
   ```bash
   docker-compose up -d
   ```

## API Documentation

Each service exposes a health endpoint at `/health`.

### Authentication Service
- POST `/auth/login` - User login
- GET `/auth/me` - Get current user
- POST `/auth/refresh` - Refresh token
- POST `/auth/logout` - Logout

### Rider Service
- POST `/riders` - Create new rider
- GET `/riders` - List riders (paginated)
- GET `/riders/:id` - Get rider details
- PUT `/riders/:id` - Update rider
- DELETE `/riders/:id` - Soft delete rider
- GET `/riders/:id/history` - Get rider history

### Verification Service
- GET `/verify/:jacket_number` - Verify rider by jacket number
- POST `/verify/log` - Log verification attempt
- POST `/incidents` - Report incident
- GET `/incidents` - List incidents
- PUT `/incidents/:id` - Update incident

## Environment Variables

See `.env.example` for all required environment variables.

## Database Schema

The complete database schema is in `database/schema.sql`.

## Testing

Run tests for each service:
```bash
cd services/auth-service && npm test
```

## Deployment

The system is containerized and can be deployed using Docker Compose or Kubernetes.