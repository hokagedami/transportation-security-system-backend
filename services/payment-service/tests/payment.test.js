const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../shared/database/connection', () => ({
  query: jest.fn(),
}));

jest.mock('../shared/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

jest.mock('crypto', () => ({
  createHmac: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'mocked-signature')
    }))
  }))
}));

const pool = require('../shared/database/connection');
const paymentService = require('../src/services/paymentService');
const axios = require('axios');
const crypto = require('crypto');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/payments', require('../src/routes/paymentRoutes'));
app.use(require('../shared/middleware/errorHandler'));

describe('Payment Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_123';
    process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-123';
    process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_123';
    process.env.FLUTTERWAVE_PUBLIC_KEY = 'FLWPUBK_TEST-123';
  });

  const createValidToken = (userId = 1, role = 'admin', lgaId = 1) => {
    return jwt.sign(
      { id: userId, username: 'testuser', role, lga_id: lgaId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  };

  describe('POST /payments/initialize', () => {
    it('should initialize payment with Paystack successfully', async () => {
      const token = createValidToken();
      const mockRider = {
        id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '+2348123456789'
      };

      const mockPaystackResponse = {
        data: {
          status: true,
          data: {
            authorization_url: 'https://checkout.paystack.com/xyz123',
            access_code: 'abc123',
            reference: 'ref_123456789'
          }
        }
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] }) // Rider lookup
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert payment record

      axios.post.mockResolvedValueOnce(mockPaystackResponse);

      const response = await request(app)
        .post('/payments/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rider_id: 1,
          amount: 5000,
          method: 'paystack',
          description: 'Test payment'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('authorization_url');
      expect(response.body.data).toHaveProperty('reference');
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/transaction/initialize',
        expect.objectContaining({
          email: 'john@example.com',
          amount: 500000, // Amount in kobo
          callback_url: expect.any(String)
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sk_test_123'
          })
        })
      );
    });

    it('should initialize payment with Flutterwave successfully', async () => {
      const token = createValidToken();
      const mockRider = {
        id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '+2348123456789'
      };

      const mockFlutterwaveResponse = {
        data: {
          status: 'success',
          data: {
            link: 'https://checkout.flutterwave.com/v3/hosted/pay/xyz123'
          }
        }
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] }) // Rider lookup
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert payment record

      axios.post.mockResolvedValueOnce(mockFlutterwaveResponse);

      const response = await request(app)
        .post('/payments/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rider_id: 1,
          amount: 5000,
          method: 'flutterwave',
          description: 'Test payment'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('link');
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.flutterwave.com/v3/payments',
        expect.objectContaining({
          tx_ref: expect.any(String),
          amount: 5000,
          currency: 'NGN',
          customer: expect.objectContaining({
            email: 'john@example.com',
            phonenumber: '+2348123456789',
            name: 'John Doe'
          })
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer FLWSECK_TEST-123'
          })
        })
      );
    });

    it('should fail when rider not found', async () => {
      const token = createValidToken();
      pool.query.mockResolvedValueOnce({ rows: [] }); // No rider found

      const response = await request(app)
        .post('/payments/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rider_id: 999,
          amount: 5000,
          method: 'paystack',
          description: 'Test payment'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RIDER_NOT_FOUND');
    });

    it('should validate required fields', async () => {
      const token = createValidToken();

      const response = await request(app)
        .post('/payments/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rider_id: 1,
          // Missing amount and method
          description: 'Test payment'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/payments/initialize')
        .send({
          rider_id: 1,
          amount: 5000,
          method: 'paystack',
          description: 'Test payment'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('GET /payments/rider/:rider_id', () => {
    it('should get rider payments successfully', async () => {
      const token = createValidToken();
      const mockPayments = [
        {
          id: 1,
          reference: 'ref_123',
          amount: 5000,
          status: 'success',
          method: 'paystack',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          reference: 'ref_456',
          amount: 3000,
          status: 'pending',
          method: 'flutterwave',
          created_at: new Date().toISOString()
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockPayments });

      const response = await request(app)
        .get('/payments/rider/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('reference', 'ref_123');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/payments/rider/1');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('PUT /payments/:reference/verify', () => {
    it('should verify payment successfully', async () => {
      const token = createValidToken(1, 'admin');
      const mockPayment = {
        id: 1,
        reference: 'ref_123',
        status: 'verified',
        verified_by: 1,
        verification_notes: 'Manual verification'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockPayment] });

      const response = await request(app)
        .put('/payments/ref_123/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          verification_notes: 'Manual verification'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'verified');
    });

    it('should fail with insufficient permissions', async () => {
      const token = createValidToken(1, 'user'); // Regular user role

      const response = await request(app)
        .put('/payments/ref_123/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          verification_notes: 'Manual verification'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should fail when payment not found', async () => {
      const token = createValidToken(1, 'admin');
      pool.query.mockResolvedValueOnce({ rows: [] }); // No payment found

      const response = await request(app)
        .put('/payments/nonexistent_ref/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          verification_notes: 'Manual verification'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PAYMENT_NOT_FOUND');
    });
  });

  describe('POST /payments/webhook/paystack', () => {
    it('should process Paystack webhook successfully', async () => {
      const mockPayload = {
        event: 'charge.success',
        data: {
          reference: 'ref_123456789',
          amount: 500000,
          status: 'success',
          customer: {
            email: 'john@example.com'
          }
        }
      };

      // Mock crypto signature verification
      crypto.createHmac.mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('valid-signature')
        })
      });

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Update payment

      const response = await request(app)
        .post('/payments/webhook/paystack')
        .set('x-paystack-signature', 'valid-signature')
        .send(mockPayload);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Webhook processed successfully');
    });

    it('should reject invalid webhook signature', async () => {
      const mockPayload = {
        event: 'charge.success',
        data: {
          reference: 'ref_123456789'
        }
      };

      // Mock invalid signature
      crypto.createHmac.mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('different-signature')
        })
      });

      const response = await request(app)
        .post('/payments/webhook/paystack')
        .set('x-paystack-signature', 'invalid-signature')
        .send(mockPayload);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid webhook signature');
    });
  });

  describe('POST /payments/webhook/flutterwave', () => {
    it('should process Flutterwave webhook successfully', async () => {
      const mockPayload = {
        event: 'charge.completed',
        data: {
          tx_ref: 'ref_123456789',
          amount: 5000,
          status: 'successful',
          customer: {
            email: 'john@example.com'
          }
        }
      };

      // Mock hash verification
      process.env.FLUTTERWAVE_WEBHOOK_HASH = 'valid-hash';

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Update payment

      const response = await request(app)
        .post('/payments/webhook/flutterwave')
        .set('verif-hash', 'valid-hash')
        .send(mockPayload);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Webhook processed successfully');
    });

    it('should reject invalid webhook hash', async () => {
      const mockPayload = {
        event: 'charge.completed',
        data: {
          tx_ref: 'ref_123456789'
        }
      };

      process.env.FLUTTERWAVE_WEBHOOK_HASH = 'valid-hash';

      const response = await request(app)
        .post('/payments/webhook/flutterwave')
        .set('verif-hash', 'invalid-hash')
        .send(mockPayload);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid webhook signature');
    });
  });

  describe('GET /payments/pending-verification', () => {
    it('should get pending verifications successfully', async () => {
      const token = createValidToken(1, 'admin');
      const mockPayments = [
        {
          id: 1,
          reference: 'ref_123',
          amount: 5000,
          status: 'pending_verification',
          method: 'bank_transfer',
          rider_name: 'John Doe',
          created_at: new Date().toISOString()
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockPayments });

      const response = await request(app)
        .get('/payments/pending-verification')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('status', 'pending_verification');
    });

    it('should filter by payment method', async () => {
      const token = createValidToken(1, 'admin');
      const mockPayments = [
        {
          id: 1,
          reference: 'ref_123',
          method: 'bank_transfer',
          status: 'pending_verification'
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockPayments });

      const response = await request(app)
        .get('/payments/pending-verification')
        .set('Authorization', `Bearer ${token}`)
        .query({ method: 'bank_transfer' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('method = $'),
        expect.arrayContaining(['bank_transfer'])
      );
    });

    it('should fail with insufficient permissions', async () => {
      const token = createValidToken(1, 'user');

      const response = await request(app)
        .get('/payments/pending-verification')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Payment Service Error Handling', () => {
    it('should handle payment provider API failures', async () => {
      const token = createValidToken();
      const mockRider = {
        id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '+2348123456789'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockRider] });
      axios.post.mockRejectedValueOnce(new Error('Payment provider API error'));

      const response = await request(app)
        .post('/payments/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({
          rider_id: 1,
          amount: 5000,
          method: 'paystack',
          description: 'Test payment'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const token = createValidToken();
      pool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/payments/rider/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});

describe('Payment Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_123';
    process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-123';
  });

  describe('paymentService.initializePayment', () => {
    it('should handle unsupported payment method', async () => {
      const mockRider = {
        id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockRider] });

      await expect(paymentService.initializePayment({
        rider_id: 1,
        amount: 5000,
        method: 'unsupported_method',
        description: 'Test payment'
      })).rejects.toThrow('Unsupported payment method');
    });

    it('should generate unique payment reference', async () => {
      const mockRider = {
        id: 1,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com'
      };

      const mockPaystackResponse = {
        data: {
          status: true,
          data: {
            reference: 'generated_ref_123'
          }
        }
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      axios.post.mockResolvedValueOnce(mockPaystackResponse);

      const result = await paymentService.initializePayment({
        rider_id: 1,
        amount: 5000,
        method: 'paystack',
        description: 'Test payment'
      });

      expect(result).toHaveProperty('reference');
      expect(result.reference).toMatch(/^PAY_\d+_\w+$/);
    });
  });

  describe('paymentService.verifyPayment', () => {
    it('should return null for non-existent payment', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await paymentService.verifyPayment('nonexistent_ref', 1);
      expect(result).toBeNull();
    });

    it('should update payment verification status', async () => {
      const mockPayment = {
        id: 1,
        reference: 'ref_123',
        status: 'verified'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockPayment] });

      const result = await paymentService.verifyPayment('ref_123', 1, 'Manual verification');
      expect(result).toHaveProperty('status', 'verified');
    });
  });

  describe('paymentService.processPaystackWebhook', () => {
    it('should validate webhook signature correctly', async () => {
      const payload = { event: 'charge.success', data: { reference: 'ref_123' } };
      const validSignature = 'valid-signature';

      crypto.createHmac.mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue(validSignature)
        })
      });

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await paymentService.processPaystackWebhook(payload, validSignature);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid webhook signature', async () => {
      const payload = { event: 'charge.success', data: { reference: 'ref_123' } };
      const invalidSignature = 'invalid-signature';

      crypto.createHmac.mockReturnValue({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue('different-signature')
        })
      });

      const result = await paymentService.processPaystackWebhook(payload, invalidSignature);
      expect(result.valid).toBe(false);
    });
  });

  describe('paymentService.processFlutterwaveWebhook', () => {
    it('should validate webhook hash correctly', async () => {
      const payload = { event: 'charge.completed', data: { tx_ref: 'ref_123' } };
      const validHash = 'valid-hash';

      process.env.FLUTTERWAVE_WEBHOOK_HASH = validHash;
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await paymentService.processFlutterwaveWebhook(payload, validHash);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid webhook hash', async () => {
      const payload = { event: 'charge.completed', data: { tx_ref: 'ref_123' } };
      const invalidHash = 'invalid-hash';

      process.env.FLUTTERWAVE_WEBHOOK_HASH = 'different-hash';

      const result = await paymentService.processFlutterwaveWebhook(payload, invalidHash);
      expect(result.valid).toBe(false);
    });
  });

  describe('paymentService.getRiderPayments', () => {
    it('should return empty array for rider with no payments', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await paymentService.getRiderPayments(1);
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(paymentService.getRiderPayments(1))
        .rejects.toThrow('Database error');
    });
  });

  describe('paymentService.getPendingVerifications', () => {
    it('should apply LGA filtering for LGA admins', async () => {
      const mockPayments = [
        { id: 1, reference: 'ref_123', lga_id: 1 }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockPayments });

      const result = await paymentService.getPendingVerifications(1, 20, { lga_id: 1 });
      expect(result.payments).toHaveLength(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('lga_id = $'),
        expect.arrayContaining([1])
      );
    });
  });
});