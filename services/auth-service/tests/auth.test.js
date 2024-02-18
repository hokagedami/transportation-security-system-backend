const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../shared/database/connection', () => ({
  query: jest.fn(),
}));

jest.mock('../shared/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const pool = require('../shared/database/connection');
const authService = require('../src/services/authService');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/auth', require('../src/routes/authRoutes'));
app.use(require('../shared/middleware/errorHandler'));

describe('Auth Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        password_hash: await bcrypt.hash('password123', 10),
        role: 'admin',
        lga_id: 1,
        lga_name: 'Test LGA',
        lga_code: 'TL',
        is_active: true
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // User lookup
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Update last_login

      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toHaveProperty('username', 'testuser');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should fail with invalid credentials', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'wronguser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should fail with wrong password', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        password_hash: await bcrypt.hash('correctpassword', 10),
        role: 'admin',
        is_active: true
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser'
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile with valid token', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'admin',
        lga_id: 1,
        lga_name: 'Test LGA'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const token = jwt.sign(
        { id: 1, username: 'testuser', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('username', 'testuser');
    });

    it('should fail without token', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        role: 'admin',
        refresh_token: 'valid-refresh-token',
        is_active: true
      };

      const refreshToken = jwt.sign(
        { id: 1, username: 'testuser', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      pool.query
        .mockResolvedValueOnce({ rows: [{ ...mockUser, refresh_token: refreshToken }] }) // Verify refresh token
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Update refresh token

      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refresh_token: refreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should fail with invalid refresh token', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refresh_token: 'invalid-token'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const token = jwt.sign(
        { id: 1, username: 'testuser', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should fail without token', async () => {
      const response = await request(app)
        .post('/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to login endpoint', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      // Make multiple requests to trigger rate limiting
      const requests = Array(6).fill().map(() =>
        request(app)
          .post('/auth/login')
          .send({
            username: 'testuser',
            password: 'password123'
          })
      );

      const responses = await Promise.all(requests);
      
      // Last request should be rate limited
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
    });
  });
});

describe('Auth Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authService.login', () => {
    it('should handle database errors gracefully', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(authService.login('testuser', 'password123'))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('authService.getUserProfile', () => {
    it('should return null for non-existent user', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await authService.getUserProfile(999);
      expect(result).toBeNull();
    });
  });

  describe('authService.refreshToken', () => {
    it('should handle expired tokens', async () => {
      const result = await authService.refreshToken('expired-token');
      expect(result.success).toBe(false);
    });
  });
});