// Global Jest setup for all tests

// Set test timeout
jest.setTimeout(10000);

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'tss_test_db';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock console methods in test environment
global.console = {
  ...console,
  // Uncomment to suppress console output during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
  // info: jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Helper to create mock database client
  createMockClient: () => ({
    query: jest.fn(),
    release: jest.fn(),
  }),

  // Helper to create test user data
  createTestUser: (overrides = {}) => ({
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: 'admin',
    lga_id: 1,
    is_active: true,
    created_at: new Date(),
    ...overrides
  }),

  // Helper to create test rider data
  createTestRider: (overrides = {}) => ({
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    phone: '+2348123456789',
    email: 'john@example.com',
    lga_id: 1,
    vehicle_type: 'motorcycle',
    jacket_number: 'OG-LAG-00001',
    status: 'active',
    created_at: new Date(),
    ...overrides
  }),

  // Helper to create test payment data
  createTestPayment: (overrides = {}) => ({
    id: 1,
    rider_id: 1,
    reference: 'PAY_123456789',
    amount: 5000.00,
    method: 'paystack',
    status: 'completed',
    created_at: new Date(),
    ...overrides
  }),

  // Helper to wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate random test data
  randomString: (length = 8) => Math.random().toString(36).substring(2, length + 2),
  randomPhone: () => `+234${Math.floor(Math.random() * 9000000000) + 1000000000}`,
  randomEmail: () => `test${Math.floor(Math.random() * 10000)}@example.com`,
};

// Mock external services by default
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

// Setup and teardown for tests
beforeAll(async () => {
  // Global setup - runs once before all tests
});

afterAll(async () => {
  // Global teardown - runs once after all tests
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});