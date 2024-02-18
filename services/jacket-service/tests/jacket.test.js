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
const jacketService = require('../src/services/jacketService');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/', require('../src/routes/jacketRoutes'));
app.use(require('../shared/middleware/errorHandler'));

// Helper function to create JWT token
const createToken = (payload) => {
  return jwt.sign(payload, 'test-secret', { expiresIn: '1h' });
};

describe('Jacket Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('POST /orders', () => {
    it('should create jacket order successfully', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      const mockOrder = {
        id: 1,
        rider_id: 1,
        payment_reference: 'PAY123456',
        quantity: 1,
        status: 'pending',
        created_by: 1,
        created_at: new Date()
      };

      pool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] }) // Payment check
        .mockResolvedValueOnce({ rows: [mockOrder] }) // Insert order
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const token = createToken({ id: 1, role: 'admin', lga_id: 1 });

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rider_id: 1,
          payment_reference: 'PAY123456',
          quantity: 1,
          lga_id: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payment_reference', 'PAY123456');
    });

    it('should fail without valid payment', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      pool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Payment not found

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rider_id: 1,
          payment_reference: 'INVALID_PAY',
          quantity: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rider_id: 1
          // Missing payment_reference
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /orders', () => {
    it('should return paginated orders list', async () => {
      const mockOrders = [
        {
          id: 1,
          rider_id: 1,
          payment_reference: 'PAY123456',
          status: 'pending',
          quantity: 1
        },
        {
          id: 2,
          rider_id: 2,
          payment_reference: 'PAY789012',
          status: 'production',
          quantity: 2
        }
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Count query
        .mockResolvedValueOnce({ rows: mockOrders }); // Data query

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .get('/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toHaveProperty('total', 2);
    });

    it('should filter by status', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'production' }] });

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .get('/orders?status=production')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /orders/:id/status', () => {
    it('should update order status successfully', async () => {
      const mockUpdatedOrder = {
        id: 1,
        status: 'production',
        updated_at: new Date()
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUpdatedOrder] });

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .put('/orders/1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'production',
          notes: 'Moving to production phase'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('production');
    });

    it('should validate status values', async () => {
      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .put('/orders/1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'invalid_status'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /batches', () => {
    it('should create production batch successfully', async () => {
      const mockBatch = {
        id: 1,
        batch_name: 'BATCH_001',
        quantity: 100,
        lga_id: 1,
        status: 'pending'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockBatch] });

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .post('/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batch_name: 'BATCH_001',
          quantity: 100,
          lga_id: 1,
          notes: 'First production batch'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.batch_name).toBe('BATCH_001');
    });

    it('should require admin role for batch creation', async () => {
      const token = createToken({ id: 1, role: 'field_officer' });

      const response = await request(app)
        .post('/batches')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batch_name: 'BATCH_001',
          quantity: 100
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /batches', () => {
    it('should return production batches', async () => {
      const mockBatches = [
        {
          id: 1,
          batch_name: 'BATCH_001',
          quantity: 100,
          status: 'in_production'
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockBatches });

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .get('/batches')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /distribute', () => {
    it('should distribute jackets successfully', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      pool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] }) // Order check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Update order
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Create distribution record
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .post('/distribute')
        .set('Authorization', `Bearer ${token}`)
        .send({
          order_ids: [1],
          distributed_to: 'John Doe',
          distribution_location: 'LGA Office',
          notes: 'Distributed to rider'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should validate distribution data', async () => {
      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .post('/distribute')
        .set('Authorization', `Bearer ${token}`)
        .send({
          order_ids: []
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /orders/:id', () => {
    it('should return order details', async () => {
      const mockOrder = {
        id: 1,
        rider_id: 1,
        payment_reference: 'PAY123456',
        status: 'pending',
        rider_name: 'John Doe',
        jacket_number: 'OG-LAG-00001'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockOrder] });

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .get('/orders/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
    });

    it('should return 404 for non-existent order', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .get('/orders/999')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /analytics', () => {
    it('should return jacket analytics', async () => {
      const mockAnalytics = {
        total_orders: 100,
        orders_by_status: {
          pending: 20,
          production: 30,
          completed: 40,
          distributed: 10
        },
        orders_by_lga: {
          'Lagos Island': 50,
          'Ikeja': 30,
          'Surulere': 20
        }
      };

      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // Total orders
        .mockResolvedValueOnce({ rows: [
          { status: 'pending', count: '20' },
          { status: 'production', count: '30' },
          { status: 'completed', count: '40' },
          { status: 'distributed', count: '10' }
        ]}) // Orders by status
        .mockResolvedValueOnce({ rows: [
          { lga_name: 'Lagos Island', count: '50' },
          { lga_name: 'Ikeja', count: '30' },
          { lga_name: 'Surulere', count: '20' }
        ]}); // Orders by LGA

      const token = createToken({ id: 1, role: 'admin' });

      const response = await request(app)
        .get('/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total_orders).toBe(100);
      expect(response.body.data.orders_by_status).toHaveProperty('pending', 20);
    });
  });
});

describe('Jacket Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should validate payment before creating order', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      pool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Payment not found

      const orderData = {
        rider_id: 1,
        payment_reference: 'INVALID_PAY',
        quantity: 1
      };

      await expect(jacketService.createOrder(orderData))
        .rejects.toThrow('Payment not found or not completed');
    });

    it('should handle database transaction errors', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      pool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] }) // Payment check
        .mockRejectedValueOnce(new Error('Database error')); // Insert fails

      const orderData = {
        rider_id: 1,
        payment_reference: 'PAY123456',
        quantity: 1
      };

      await expect(jacketService.createOrder(orderData))
        .rejects.toThrow('Database error');
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status with valid transitions', async () => {
      const mockUpdatedOrder = {
        id: 1,
        status: 'production'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUpdatedOrder] });

      const result = await jacketService.updateOrderStatus(1, 'production', 1, 'Moving to production');
      
      expect(result).toHaveProperty('status', 'production');
    });
  });

  describe('distributeJackets', () => {
    it('should validate order completion before distribution', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      pool.connect.mockResolvedValueOnce(mockClient);
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending' }] }); // Order not completed

      const distributionData = {
        order_ids: [1],
        distributed_to: 'John Doe',
        distribution_location: 'LGA Office'
      };

      await expect(jacketService.distributeJackets(distributionData, 1))
        .rejects.toThrow('Order 1 is not ready for distribution');
    });
  });
});