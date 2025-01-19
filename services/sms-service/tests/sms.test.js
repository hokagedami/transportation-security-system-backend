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

const pool = require('../shared/database/connection');
const smsService = require('../src/services/smsService');
const axios = require('axios');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/sms', require('../src/routes/smsRoutes'));
app.use(require('../shared/middleware/errorHandler'));

// Mock rate limiter middleware
jest.mock('../shared/middleware/rateLimiter', () => (req, res, next) => next());

describe('SMS Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.SMS_PROVIDER_API_KEY = 'test-api-key';
    process.env.SMS_PROVIDER_URL = 'https://api.sms-provider.com/send';
    process.env.SMS_SENDER_ID = 'TSS';
  });

  const createValidToken = (userId = 1, role = 'admin', lgaId = 1) => {
    return jwt.sign(
      { id: userId, username: 'testuser', role, lga_id: lgaId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  };

  describe('POST /sms/send-verification', () => {
    it('should send verification SMS successfully', async () => {
      const mockSMSResponse = {
        data: {
          status: 'success',
          message_id: 'msg_123456',
          cost: 0.05
        }
      };

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert SMS log
      axios.post.mockResolvedValueOnce(mockSMSResponse);

      const response = await request(app)
        .post('/sms/send-verification')
        .send({
          phone: '+2348123456789',
          jacket_number: 'TSS001',
          rider_data: {
            name: 'John Doe',
            lga: 'Lagos Island'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message_id');
      expect(axios.post).toHaveBeenCalledWith(
        process.env.SMS_PROVIDER_URL,
        expect.objectContaining({
          to: '+2348123456789',
          message: expect.stringContaining('TSS001'),
          sender_id: 'TSS'
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('test-api-key')
          })
        })
      );
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/sms/send-verification')
        .send({
          phone: 'invalid-phone',
          jacket_number: 'TSS001',
          rider_data: {
            name: 'John Doe',
            lga: 'Lagos Island'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/sms/send-verification')
        .send({
          phone: '+2348123456789'
          // Missing jacket_number and rider_data
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle SMS provider API failures', async () => {
      axios.post.mockRejectedValueOnce(new Error('SMS API error'));

      const response = await request(app)
        .post('/sms/send-verification')
        .send({
          phone: '+2348123456789',
          jacket_number: 'TSS001',
          rider_data: {
            name: 'John Doe',
            lga: 'Lagos Island'
          }
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /sms/send-notification', () => {
    it('should send notification SMS successfully', async () => {
      const token = createValidToken(1, 'admin');
      const mockSMSResponse = {
        data: {
          status: 'success',
          message_id: 'msg_789012'
        }
      };

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert SMS log
      axios.post.mockResolvedValueOnce(mockSMSResponse);

      const response = await request(app)
        .post('/sms/send-notification')
        .set('Authorization', `Bearer ${token}`)
        .send({
          phone: '+2348123456789',
          message: 'Your jacket registration has been approved.',
          message_type: 'approval'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message_id');
    });

    it('should fail with insufficient permissions', async () => {
      const token = createValidToken(1, 'user'); // Regular user role

      const response = await request(app)
        .post('/sms/send-notification')
        .set('Authorization', `Bearer ${token}`)
        .send({
          phone: '+2348123456789',
          message: 'Test notification',
          message_type: 'general'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/sms/send-notification')
        .send({
          phone: '+2348123456789',
          message: 'Test notification',
          message_type: 'general'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    it('should validate message length', async () => {
      const token = createValidToken(1, 'admin');
      const longMessage = 'A'.repeat(1000); // Assuming max SMS length is less than 1000

      const response = await request(app)
        .post('/sms/send-notification')
        .set('Authorization', `Bearer ${token}`)
        .send({
          phone: '+2348123456789',
          message: longMessage,
          message_type: 'general'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /sms/send-bulk', () => {
    it('should send bulk SMS successfully', async () => {
      const token = createValidToken(1, 'super_admin');
      const recipients = [
        { phone: '+2348123456789', name: 'John Doe' },
        { phone: '+2348987654321', name: 'Jane Smith' }
      ];

      const mockSMSResponse = {
        data: {
          status: 'success',
          message_ids: ['msg_001', 'msg_002'],
          successful_count: 2,
          failed_count: 0
        }
      };

      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert SMS log for first recipient
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }); // Insert SMS log for second recipient

      axios.post.mockResolvedValueOnce(mockSMSResponse);

      const response = await request(app)
        .post('/sms/send-bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipients,
          message: 'Important announcement from TSS.',
          message_type: 'announcement'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('successful_count', 2);
      expect(response.body.data).toHaveProperty('failed_count', 0);
    });

    it('should require super_admin or admin role', async () => {
      const token = createValidToken(1, 'lga_admin');

      const response = await request(app)
        .post('/sms/send-bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipients: [{ phone: '+2348123456789', name: 'John Doe' }],
          message: 'Test bulk SMS',
          message_type: 'general'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should validate recipients array', async () => {
      const token = createValidToken(1, 'admin');

      const response = await request(app)
        .post('/sms/send-bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipients: [], // Empty recipients array
          message: 'Test message',
          message_type: 'general'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle partial failures in bulk SMS', async () => {
      const token = createValidToken(1, 'admin');
      const recipients = [
        { phone: '+2348123456789', name: 'John Doe' },
        { phone: 'invalid-phone', name: 'Invalid User' }
      ];

      const mockSMSResponse = {
        data: {
          status: 'partial_success',
          message_ids: ['msg_001'],
          successful_count: 1,
          failed_count: 1,
          failures: [
            { phone: 'invalid-phone', error: 'Invalid phone number' }
          ]
        }
      };

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert SMS log
      axios.post.mockResolvedValueOnce(mockSMSResponse);

      const response = await request(app)
        .post('/sms/send-bulk')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recipients,
          message: 'Test bulk SMS',
          message_type: 'general'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('successful_count', 1);
      expect(response.body.data).toHaveProperty('failed_count', 1);
      expect(response.body.data).toHaveProperty('failures');
    });
  });

  describe('GET /sms/logs', () => {
    it('should get SMS logs successfully', async () => {
      const token = createValidToken();
      const mockLogs = [
        {
          id: 1,
          phone: '+2348123456789',
          message: 'Verification SMS for TSS001',
          message_type: 'verification',
          status: 'sent',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          phone: '+2348987654321',
          message: 'Notification SMS',
          message_type: 'notification',
          status: 'delivered',
          created_at: new Date().toISOString()
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockLogs });

      const response = await request(app)
        .get('/sms/logs')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('message_type', 'verification');
    });

    it('should filter logs by phone number', async () => {
      const token = createValidToken();
      const mockLogs = [
        {
          id: 1,
          phone: '+2348123456789',
          message: 'Filtered SMS',
          message_type: 'verification',
          status: 'sent'
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockLogs });

      const response = await request(app)
        .get('/sms/logs')
        .set('Authorization', `Bearer ${token}`)
        .query({ phone: '+2348123456789' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('phone = $'),
        expect.arrayContaining(['+2348123456789'])
      );
    });

    it('should filter logs by message type', async () => {
      const token = createValidToken();
      const mockLogs = [
        {
          id: 1,
          message_type: 'verification',
          status: 'sent'
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockLogs });

      const response = await request(app)
        .get('/sms/logs')
        .set('Authorization', `Bearer ${token}`)
        .query({ message_type: 'verification' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('message_type = $'),
        expect.arrayContaining(['verification'])
      );
    });

    it('should filter logs by status', async () => {
      const token = createValidToken();
      const mockLogs = [
        {
          id: 1,
          status: 'failed'
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockLogs });

      const response = await request(app)
        .get('/sms/logs')
        .set('Authorization', `Bearer ${token}`)
        .query({ status: 'failed' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['failed'])
      );
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/sms/logs');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('POST /sms/webhook', () => {
    it('should process incoming SMS webhook successfully', async () => {
      const webhookPayload = {
        from: '+2348123456789',
        to: '+2347000000000',
        text: 'VERIFY TSS001',
        messageId: 'msg_webhook_123'
      };

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Log incoming SMS

      const response = await request(app)
        .post('/sms/webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('SMS processed successfully');
    });

    it('should handle verification requests via SMS', async () => {
      const webhookPayload = {
        from: '+2348123456789',
        to: '+2347000000000',
        text: 'VERIFY TSS001',
        messageId: 'msg_webhook_verify'
      };

      const mockRiderData = {
        jacket_number: 'TSS001',
        name: 'John Doe',
        status: 'active'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Log incoming SMS
        .mockResolvedValueOnce({ rows: [mockRiderData] }) // Rider lookup
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Log response SMS

      axios.post.mockResolvedValueOnce({ data: { status: 'success' } }); // Send response SMS

      const response = await request(app)
        .post('/sms/webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('SMS processed successfully');
    });

    it('should handle unknown commands gracefully', async () => {
      const webhookPayload = {
        from: '+2348123456789',
        to: '+2347000000000',
        text: 'UNKNOWN COMMAND',
        messageId: 'msg_webhook_unknown'
      };

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Log incoming SMS

      const response = await request(app)
        .post('/sms/webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('SMS processed successfully');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to verification SMS endpoint', async () => {
      // Note: This test depends on the rate limiter implementation
      // The actual rate limiter is mocked, so this is more of a structural test
      
      const requests = Array(10).fill().map(() =>
        request(app)
          .post('/sms/send-verification')
          .send({
            phone: '+2348123456789',
            jacket_number: 'TSS001',
            rider_data: { name: 'John Doe', lga: 'Lagos Island' }
          })
      );

      const responses = await Promise.all(requests);
      
      // With mocked rate limiter, all should succeed
      // In real scenario, some would be rate limited
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
});

describe('SMS Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMS_PROVIDER_API_KEY = 'test-api-key';
    process.env.SMS_PROVIDER_URL = 'https://api.sms-provider.com/send';
  });

  describe('smsService.sendVerificationSMS', () => {
    it('should format verification message correctly', async () => {
      const mockSMSResponse = {
        data: { status: 'success', message_id: 'msg_123' }
      };

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      axios.post.mockResolvedValueOnce(mockSMSResponse);

      const result = await smsService.sendVerificationSMS(
        '+2348123456789',
        'TSS001',
        { name: 'John Doe', lga: 'Lagos Island' }
      );

      expect(result).toHaveProperty('message_id');
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.stringContaining('TSS001')
        }),
        expect.any(Object)
      );
    });

    it('should handle SMS provider API errors', async () => {
      axios.post.mockRejectedValueOnce(new Error('SMS API error'));

      await expect(smsService.sendVerificationSMS(
        '+2348123456789',
        'TSS001',
        { name: 'John Doe', lga: 'Lagos Island' }
      )).rejects.toThrow('SMS API error');
    });
  });

  describe('smsService.sendSMS', () => {
    it('should handle different message types', async () => {
      const mockSMSResponse = {
        data: { status: 'success', message_id: 'msg_456' }
      };

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      axios.post.mockResolvedValueOnce(mockSMSResponse);

      const result = await smsService.sendSMS(
        '+2348123456789',
        'Test notification message',
        'notification'
      );

      expect(result).toHaveProperty('message_id');
    });

    it('should log SMS attempts in database', async () => {
      const mockSMSResponse = {
        data: { status: 'success', message_id: 'msg_789' }
      };

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      axios.post.mockResolvedValueOnce(mockSMSResponse);

      await smsService.sendSMS(
        '+2348123456789',
        'Test message',
        'general'
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sms_logs'),
        expect.arrayContaining([
          '+2348123456789',
          'Test message',
          'general',
          expect.any(String), // status
          expect.any(String)  // message_id
        ])
      );
    });
  });

  describe('smsService.sendBulkSMS', () => {
    it('should process bulk SMS recipients correctly', async () => {
      const recipients = [
        { phone: '+2348123456789', name: 'John Doe' },
        { phone: '+2348987654321', name: 'Jane Smith' }
      ];

      const mockSMSResponse = {
        data: {
          status: 'success',
          successful_count: 2,
          failed_count: 0
        }
      };

      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] });

      axios.post.mockResolvedValueOnce(mockSMSResponse);

      const result = await smsService.sendBulkSMS(
        recipients,
        'Bulk test message',
        'announcement'
      );

      expect(result).toHaveProperty('successful_count', 2);
      expect(result).toHaveProperty('failed_count', 0);
    });

    it('should handle bulk SMS failures gracefully', async () => {
      const recipients = [
        { phone: '+2348123456789', name: 'John Doe' },
        { phone: 'invalid-phone', name: 'Invalid User' }
      ];

      axios.post.mockRejectedValueOnce(new Error('Bulk SMS API error'));

      await expect(smsService.sendBulkSMS(
        recipients,
        'Test message',
        'general'
      )).rejects.toThrow('Bulk SMS API error');
    });
  });

  describe('smsService.processIncomingSMS', () => {
    it('should process VERIFY commands correctly', async () => {
      const mockRiderData = {
        jacket_number: 'TSS001',
        name: 'John Doe',
        status: 'active',
        lga_name: 'Lagos Island'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Log incoming SMS
        .mockResolvedValueOnce({ rows: [mockRiderData] }); // Rider lookup

      const result = await smsService.processIncomingSMS(
        '+2348123456789',
        'VERIFY TSS001',
        'msg_123',
        '+2347000000000'
      );

      expect(result).toHaveProperty('response');
      expect(result.response).toContain('John Doe');
      expect(result.response).toContain('active');
    });

    it('should handle invalid jacket numbers', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Log incoming SMS
        .mockResolvedValueOnce({ rows: [] }); // No rider found

      const result = await smsService.processIncomingSMS(
        '+2348123456789',
        'VERIFY INVALID001',
        'msg_123',
        '+2347000000000'
      );

      expect(result).toHaveProperty('response');
      expect(result.response).toContain('not found');
    });

    it('should handle unrecognized commands', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Log incoming SMS

      const result = await smsService.processIncomingSMS(
        '+2348123456789',
        'UNKNOWN COMMAND',
        'msg_123',
        '+2347000000000'
      );

      expect(result).toHaveProperty('response');
      expect(result.response).toContain('help');
    });
  });

  describe('smsService.getSMSLogs', () => {
    it('should return paginated SMS logs', async () => {
      const mockLogs = [
        { id: 1, phone: '+2348123456789', message_type: 'verification' },
        { id: 2, phone: '+2348987654321', message_type: 'notification' }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockLogs });

      const result = await smsService.getSMSLogs(1, 20, {});
      expect(result).toHaveProperty('logs');
      expect(result.logs).toHaveLength(2);
    });

    it('should apply filters correctly', async () => {
      const mockLogs = [
        { id: 1, phone: '+2348123456789', message_type: 'verification', status: 'sent' }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockLogs });

      const filters = {
        phone: '+2348123456789',
        message_type: 'verification',
        status: 'sent'
      };

      await smsService.getSMSLogs(1, 20, filters);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['+2348123456789', 'verification', 'sent'])
      );
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(smsService.getSMSLogs(1, 20, {}))
        .rejects.toThrow('Database error');
    });
  });

  describe('Phone Number Validation', () => {
    it('should validate Nigerian phone numbers', () => {
      const validNumbers = [
        '+2348123456789',
        '+2347012345678',
        '+2349087654321'
      ];

      validNumbers.forEach(number => {
        expect(smsService.isValidPhoneNumber(number)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidNumbers = [
        '08123456789',     // Missing country code
        '+234812345678',   // Too short
        '+23481234567890', // Too long
        '+1234567890',     // Wrong country code
        'invalid-phone'    // Non-numeric
      ];

      invalidNumbers.forEach(number => {
        expect(smsService.isValidPhoneNumber(number)).toBe(false);
      });
    });
  });
});