const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../shared/database/connection', () => ({
  connect: jest.fn(),
  query: jest.fn(),
}));

jest.mock('../shared/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const pool = require('../shared/database/connection');
const riderService = require('../src/services/riderService');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/', require('../src/routes/riderRoutes'));
app.use(require('../shared/middleware/errorHandler'));

// Helper function to create JWT token
const createToken = (payload) => {
  return jwt.sign(payload, 'test-secret', { expiresIn: '1h' });
};

describe('Rider Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('POST /', () => {
    it('should create a new rider successfully', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      const mockRider = {
        id: 1,
        first_name: 'John',
        last_name: 'Doe',
        phone: '+2348123456789',
        email: 'john@example.com',
        lga_id: 1,
        vehicle_type: 'motorcycle',
        jacket_number: 'OG-LAG-00001',
        status: 'pending'
      };

      pool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ code: 'LAG' }] }) // LGA lookup
        .mockResolvedValueOnce({ rows: [{ max_number: 0 }] }) // Max jacket number
        .mockResolvedValueOnce({ rows: [mockRider] }) // Insert rider
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const token = createToken({ id: 1, role: 'admin', lga_id: 1 });

      const response = await request(app)
        .post('/')
        .set('Authorization', `Bearer ${token}`)
        .send({
          first_name: 'John',
          last_name: 'Doe',
          phone: '+2348123456789',
          email: 'john@example.com',
          lga_id: 1,
          vehicle_type: 'motorcycle'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('jacket_number');
      expect(response.body.data.first_name).toBe('John');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/')
        .send({
          first_name: 'John',
          last_name: 'Doe',
          phone: '+2348123456789'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    it('should validate required fields', async () => {
      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .post('/')
        .set('Authorization', `Bearer ${token}`)
        .send({
          first_name: 'John'
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should prevent duplicate phone numbers', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      pool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce({ code: '23505' }); // Unique constraint violation

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .post('/')
        .set('Authorization', `Bearer ${token}`)
        .send({
          first_name: 'John',
          last_name: 'Doe',
          phone: '+2348123456789',
          lga_id: 1,
          vehicle_type: 'motorcycle'
        });

      expect(response.status).toBe(409);
    });
  });

  describe('GET /', () => {
    it('should return paginated riders list', async () => {
      const mockRiders = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          jacket_number: 'OG-LAG-00001',
          status: 'active'
        },
        {
          id: 2,
          first_name: 'Jane',
          last_name: 'Smith',
          jacket_number: 'OG-LAG-00002',
          status: 'pending'
        }
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Count query
        .mockResolvedValueOnce({ rows: mockRiders }); // Data query

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .get('/?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toHaveProperty('total', 2);
      expect(response.body.pagination).toHaveProperty('page', 1);
    });

    it('should filter by status', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'active' }] });

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .get('/?status=active')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should filter by LGA for LGA admin', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, lga_id: 2 }] });

      const token = createToken({ id: 1, role: 'lga_admin', lga_id: 2 });

      const response = await request(app)
        .get('/')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /:id', () => {
    it('should return rider by ID', async () => {
      const mockRider = {
        id: 1,
        first_name: 'John',
        last_name: 'Doe',
        jacket_number: 'OG-LAG-00001',
        phone: '+2348123456789',
        status: 'active'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockRider] });

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .get('/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.first_name).toBe('John');
    });

    it('should return 404 for non-existent rider', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .get('/999')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RIDER_NOT_FOUND');
    });
  });

  describe('PUT /:id', () => {
    it('should update rider successfully', async () => {
      const mockUpdatedRider = {
        id: 1,
        first_name: 'John Updated',
        last_name: 'Doe',
        phone: '+2348123456789',
        status: 'active'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUpdatedRider] });

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .put('/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          first_name: 'John Updated',
          last_name: 'Doe'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.first_name).toBe('John Updated');
    });

    it('should require admin role for updates', async () => {
      const token = createToken({ id: 1, role: 'field_officer' });

      const response = await request(app)
        .put('/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          first_name: 'John Updated'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /:id', () => {
    it('should delete rider successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const token = createToken({ id: 1, role: 'super_admin' });

      const response = await request(app)
        .delete('/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Rider revoked successfully');
    });

    it('should require super_admin or admin role for deletion', async () => {
      const token = createToken({ id: 1, role: 'field_officer' });

      const response = await request(app)
        .delete('/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /:id/history', () => {
    it('should return rider history', async () => {
      const mockHistory = [
        {
          id: 1,
          action: 'created',
          timestamp: '2024-01-01T00:00:00Z',
          performed_by: 'admin'
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockHistory });

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .get('/1/history')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].action).toBe('created');
    });
  });
});

describe('Rider Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateJacketNumber', () => {
    it('should generate unique jacket numbers', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      pool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ code: 'LAG' }] }) // LGA lookup
        .mockResolvedValueOnce({ rows: [{ max_number: 5 }] }) // Max number
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await riderService.generateJacketNumber(1);
      expect(result).toMatch(/^OG-LAG-\d{5}$/);
    });

    it('should handle database errors', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      pool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(riderService.generateJacketNumber(1))
        .rejects.toThrow('Database error');
    });
  });

  describe('createRider', () => {
    it('should handle validation errors', async () => {
      const invalidRiderData = {
        first_name: '', // Invalid empty name
        phone: 'invalid-phone'
      };

      await expect(riderService.createRider(invalidRiderData))
        .rejects.toThrow();
    });
  });
});