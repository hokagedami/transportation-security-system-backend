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

const pool = require('../shared/database/connection');
const verificationService = require('../src/services/verificationService');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/verification', require('../src/routes/verificationRoutes'));
app.use(require('../shared/middleware/errorHandler'));

describe('Verification Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  const createValidToken = (userId = 1, role = 'admin', lgaId = 1) => {
    return jwt.sign(
      { id: userId, username: 'testuser', role, lga_id: lgaId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  };

  describe('GET /verification/verify/:jacket_number', () => {
    it('should verify rider successfully with valid jacket number', async () => {
      const mockRider = {
        id: 1,
        jacket_number: 'TSS001',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+2348123456789',
        email: 'john@example.com',
        status: 'active',
        lga_name: 'Lagos Island',
        lga_code: 'LI',
        registration_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] }) // Rider lookup
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Log verification

      const response = await request(app)
        .get('/verification/verify/TSS001')
        .query({ phone: '+2347000000000' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('jacket_number', 'TSS001');
      expect(response.body.data).toHaveProperty('first_name', 'John');
      expect(response.body.data).toHaveProperty('status', 'active');
      expect(response.body.data).not.toHaveProperty('phone'); // Should be masked for privacy
    });

    it('should mask sensitive information in verification response', async () => {
      const mockRider = {
        id: 1,
        jacket_number: 'TSS001',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+2348123456789',
        email: 'john@example.com',
        status: 'active',
        lga_name: 'Lagos Island'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .get('/verification/verify/TSS001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.phone).toMatch(/^\+234\*{6}\d{3}$/); // Masked phone
      expect(response.body.data.email).toMatch(/^j\*{3}@example\.com$/); // Masked email
    });

    it('should fail verification for invalid jacket number', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // No rider found
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Log verification attempt

      const response = await request(app)
        .get('/verification/verify/INVALID001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RIDER_NOT_FOUND');
      expect(response.body.error.message).toContain('not found');
    });

    it('should fail for inactive rider', async () => {
      const mockRider = {
        id: 1,
        jacket_number: 'TSS001',
        first_name: 'John',
        last_name: 'Doe',
        status: 'suspended',
        lga_name: 'Lagos Island'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .get('/verification/verify/TSS001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RIDER_INACTIVE');
      expect(response.body.error.message).toContain('suspended');
    });

    it('should fail for expired jacket', async () => {
      const mockRider = {
        id: 1,
        jacket_number: 'TSS001',
        first_name: 'John',
        last_name: 'Doe',
        status: 'active',
        expiry_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        lga_name: 'Lagos Island'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .get('/verification/verify/TSS001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('JACKET_EXPIRED');
      expect(response.body.error.message).toContain('expired');
    });

    it('should validate jacket number format', async () => {
      const response = await request(app)
        .get('/verification/verify/INVALID-FORMAT');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should log verification attempt with correct data', async () => {
      const mockRider = {
        id: 1,
        jacket_number: 'TSS001',
        first_name: 'John',
        last_name: 'Doe',
        status: 'active',
        lga_name: 'Lagos Island'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await request(app)
        .get('/verification/verify/TSS001')
        .query({ phone: '+2347000000000' })
        .set('User-Agent', 'TestAgent/1.0');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO verification_logs'),
        expect.arrayContaining([
          'TSS001',
          '+2347000000000',
          'web',
          'success',
          expect.any(String), // user_agent
          expect.any(String)  // ip_address
        ])
      );
    });
  });

  describe('POST /verification/verify/log', () => {
    it('should log verification attempt successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/verification/verify/log')
        .send({
          jacket_number: 'TSS001',
          verifier_phone: '+2347000000000',
          verification_method: 'sms',
          result: 'success',
          ip_address: '192.168.1.1'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Verification attempt logged');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/verification/verify/log')
        .send({
          jacket_number: 'TSS001'
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /verification/incidents', () => {
    it('should create incident report successfully', async () => {
      const mockRider = {
        id: 1,
        jacket_number: 'TSS001',
        first_name: 'John',
        last_name: 'Doe'
      };

      const mockIncident = {
        id: 1,
        reference_number: 'INC-2024-001',
        jacket_number: 'TSS001',
        incident_type: 'impersonation',
        severity: 'high',
        status: 'open'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] }) // Rider lookup
        .mockResolvedValueOnce({ rows: [mockIncident] }); // Insert incident

      const response = await request(app)
        .post('/verification/incidents')
        .send({
          jacket_number: 'TSS001',
          incident_type: 'impersonation',
          severity: 'high',
          description: 'Someone else is wearing this jacket',
          reporter_phone: '+2347000000000',
          location: 'Surulere Bus Stop',
          evidence_urls: ['https://example.com/image1.jpg']
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reference_number', 'INC-2024-001');
      expect(response.body.data).toHaveProperty('status', 'open');
    });

    it('should fail when jacket number not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // No rider found

      const response = await request(app)
        .post('/verification/incidents')
        .send({
          jacket_number: 'INVALID001',
          incident_type: 'impersonation',
          severity: 'medium',
          description: 'Suspicious activity',
          reporter_phone: '+2347000000000'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RIDER_NOT_FOUND');
    });

    it('should validate incident data', async () => {
      const response = await request(app)
        .post('/verification/incidents')
        .send({
          jacket_number: 'TSS001',
          // Missing required fields
          severity: 'medium'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate severity levels', async () => {
      const response = await request(app)
        .post('/verification/incidents')
        .send({
          jacket_number: 'TSS001',
          incident_type: 'impersonation',
          severity: 'invalid-severity',
          description: 'Test incident',
          reporter_phone: '+2347000000000'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /verification/incidents', () => {
    it('should get incidents successfully', async () => {
      const token = createValidToken();
      const mockIncidents = [
        {
          id: 1,
          reference_number: 'INC-2024-001',
          jacket_number: 'TSS001',
          incident_type: 'impersonation',
          severity: 'high',
          status: 'open',
          created_at: new Date().toISOString(),
          rider_name: 'John Doe'
        },
        {
          id: 2,
          reference_number: 'INC-2024-002',
          jacket_number: 'TSS002',
          incident_type: 'damaged_jacket',
          severity: 'medium',
          status: 'resolved',
          created_at: new Date().toISOString(),
          rider_name: 'Jane Smith'
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockIncidents });

      const response = await request(app)
        .get('/verification/incidents')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('reference_number', 'INC-2024-001');
    });

    it('should filter incidents by status', async () => {
      const token = createValidToken();
      const mockIncidents = [
        {
          id: 1,
          reference_number: 'INC-2024-001',
          status: 'open'
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockIncidents });

      const response = await request(app)
        .get('/verification/incidents')
        .set('Authorization', `Bearer ${token}`)
        .query({ status: 'open' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['open'])
      );
    });

    it('should filter incidents by severity', async () => {
      const token = createValidToken();
      const mockIncidents = [
        {
          id: 1,
          reference_number: 'INC-2024-001',
          severity: 'high'
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockIncidents });

      const response = await request(app)
        .get('/verification/incidents')
        .set('Authorization', `Bearer ${token}`)
        .query({ severity: 'high' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('severity = $'),
        expect.arrayContaining(['high'])
      );
    });

    it('should filter incidents by LGA for LGA admins', async () => {
      const token = createValidToken(1, 'lga_admin', 5);
      const mockIncidents = [
        {
          id: 1,
          reference_number: 'INC-2024-001',
          lga_id: 5
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockIncidents });

      const response = await request(app)
        .get('/verification/incidents')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('lga_id = $'),
        expect.arrayContaining([5])
      );
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/verification/incidents');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('PUT /verification/incidents/:id', () => {
    it('should update incident successfully', async () => {
      const token = createValidToken(1, 'admin');
      const mockIncident = {
        id: 1,
        reference_number: 'INC-2024-001',
        status: 'in_progress',
        assigned_to: 1,
        resolution_notes: 'Investigating the case'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockIncident] });

      const response = await request(app)
        .put('/verification/incidents/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'in_progress',
          assigned_to: 1,
          resolution_notes: 'Investigating the case'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'in_progress');
    });

    it('should fail with insufficient permissions', async () => {
      const token = createValidToken(1, 'user');

      const response = await request(app)
        .put('/verification/incidents/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'resolved'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should fail when incident not found', async () => {
      const token = createValidToken(1, 'admin');
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/verification/incidents/999')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'resolved'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INCIDENT_NOT_FOUND');
    });

    it('should validate status transitions', async () => {
      const token = createValidToken(1, 'admin');

      const response = await request(app)
        .put('/verification/incidents/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'invalid-status'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /verification/verify/stats', () => {
    it('should get verification statistics successfully', async () => {
      const token = createValidToken();
      const mockStats = {
        total_verifications: 1500,
        successful_verifications: 1350,
        failed_verifications: 150,
        success_rate: 90.0,
        verifications_by_method: {
          web: 800,
          sms: 450,
          mobile_app: 250
        },
        verifications_by_day: [
          { date: '2024-01-01', count: 45 },
          { date: '2024-01-02', count: 52 }
        ],
        top_failure_reasons: [
          { reason: 'RIDER_NOT_FOUND', count: 80 },
          { reason: 'JACKET_EXPIRED', count: 40 }
        ]
      };

      pool.query
        .mockResolvedValueOnce({ rows: [{ total: 1500, successful: 1350, failed: 150 }] }) // Overall stats
        .mockResolvedValueOnce({ rows: [
          { method: 'web', count: 800 },
          { method: 'sms', count: 450 },
          { method: 'mobile_app', count: 250 }
        ]}) // Method breakdown
        .mockResolvedValueOnce({ rows: [
          { date: '2024-01-01', count: 45 },
          { date: '2024-01-02', count: 52 }
        ]}) // Daily stats
        .mockResolvedValueOnce({ rows: [
          { reason: 'RIDER_NOT_FOUND', count: 80 },
          { reason: 'JACKET_EXPIRED', count: 40 }
        ]}); // Failure reasons

      const response = await request(app)
        .get('/verification/verify/stats')
        .set('Authorization', `Bearer ${token}`)
        .query({ date_range: '7d' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total_verifications');
      expect(response.body.data).toHaveProperty('success_rate');
      expect(response.body.data).toHaveProperty('verifications_by_method');
      expect(response.body.data).toHaveProperty('verifications_by_day');
    });

    it('should filter stats by LGA for LGA admins', async () => {
      const token = createValidToken(1, 'lga_admin', 3);
      const mockStats = {
        total_verifications: 200,
        successful_verifications: 180,
        failed_verifications: 20,
        success_rate: 90.0
      };

      pool.query
        .mockResolvedValueOnce({ rows: [{ total: 200, successful: 180, failed: 20 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/verification/verify/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('lga_id = $'),
        expect.arrayContaining([3])
      );
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/verification/verify/stats');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/verification/verify/TSS001');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});

describe('Verification Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verificationService.verifyRider', () => {
    it('should return success for valid active rider', async () => {
      const mockRider = {
        id: 1,
        jacket_number: 'TSS001',
        first_name: 'John',
        last_name: 'Doe',
        status: 'active',
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        lga_name: 'Lagos Island'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await verificationService.verifyRider('TSS001', {
        verifier_phone: '+2347000000000',
        verification_method: 'web'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('jacket_number', 'TSS001');
    });

    it('should return error for non-existent rider', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await verificationService.verifyRider('INVALID001', {
        verifier_phone: '+2347000000000',
        verification_method: 'web'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('RIDER_NOT_FOUND');
    });

    it('should mask sensitive information', async () => {
      const mockRider = {
        id: 1,
        jacket_number: 'TSS001',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+2348123456789',
        email: 'john.doe@example.com',
        status: 'active',
        lga_name: 'Lagos Island'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await verificationService.verifyRider('TSS001', {
        verification_method: 'web'
      });

      expect(result.success).toBe(true);
      expect(result.data.phone).toMatch(/^\+234\*{6}\d{3}$/);
      expect(result.data.email).toMatch(/^j\*{7}@example\.com$/);
    });

    it('should handle different rider statuses', async () => {
      const statuses = ['suspended', 'expired', 'revoked'];

      for (const status of statuses) {
        const mockRider = {
          id: 1,
          jacket_number: 'TSS001',
          first_name: 'John',
          last_name: 'Doe',
          status,
          lga_name: 'Lagos Island'
        };

        pool.query
          .mockResolvedValueOnce({ rows: [mockRider] })
          .mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const result = await verificationService.verifyRider('TSS001', {
          verification_method: 'web'
        });

        expect(result.success).toBe(false);
        expect(result.error_code).toBe('RIDER_INACTIVE');
      }
    });

    it('should check jacket expiry date', async () => {
      const mockRider = {
        id: 1,
        jacket_number: 'TSS001',
        first_name: 'John',
        last_name: 'Doe',
        status: 'active',
        expiry_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        lga_name: 'Lagos Island'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await verificationService.verifyRider('TSS001', {
        verification_method: 'web'
      });

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('JACKET_EXPIRED');
    });
  });

  describe('verificationService.createIncident', () => {
    it('should create incident with unique reference number', async () => {
      const mockRider = {
        id: 1,
        jacket_number: 'TSS001',
        first_name: 'John',
        last_name: 'Doe'
      };

      const mockIncident = {
        id: 1,
        reference_number: 'INC-2024-001',
        jacket_number: 'TSS001',
        incident_type: 'impersonation',
        severity: 'high',
        status: 'open'
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRider] })
        .mockResolvedValueOnce({ rows: [mockIncident] });

      const result = await verificationService.createIncident({
        jacket_number: 'TSS001',
        incident_type: 'impersonation',
        severity: 'high',
        description: 'Someone else wearing the jacket',
        reporter_phone: '+2347000000000'
      });

      expect(result).toHaveProperty('reference_number');
      expect(result.reference_number).toMatch(/^INC-\d{4}-\d{3}$/);
    });

    it('should throw error for non-existent rider', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await expect(verificationService.createIncident({
        jacket_number: 'INVALID001',
        incident_type: 'impersonation',
        severity: 'high',
        description: 'Test incident'
      })).rejects.toThrow('Rider not found');
    });
  });

  describe('verificationService.updateIncident', () => {
    it('should update incident successfully', async () => {
      const mockIncident = {
        id: 1,
        reference_number: 'INC-2024-001',
        status: 'in_progress',
        updated_by: 1
      };

      pool.query.mockResolvedValueOnce({ rows: [mockIncident] });

      const result = await verificationService.updateIncident(1, {
        status: 'in_progress',
        resolution_notes: 'Under investigation'
      });

      expect(result).toHaveProperty('status', 'in_progress');
    });

    it('should return null for non-existent incident', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await verificationService.updateIncident(999, {
        status: 'resolved'
      });

      expect(result).toBeNull();
    });
  });

  describe('verificationService.getIncidents', () => {
    it('should return paginated incidents', async () => {
      const mockIncidents = [
        { id: 1, reference_number: 'INC-2024-001' },
        { id: 2, reference_number: 'INC-2024-002' }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockIncidents });

      const result = await verificationService.getIncidents(1, 20, {});
      expect(result).toHaveProperty('incidents');
      expect(result.incidents).toHaveLength(2);
    });

    it('should apply filters correctly', async () => {
      const mockIncidents = [
        { id: 1, status: 'open', severity: 'high' }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockIncidents });

      const filters = {
        status: 'open',
        severity: 'high',
        lga_id: 1
      };

      await verificationService.getIncidents(1, 20, filters);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['open', 'high', 1])
      );
    });
  });

  describe('verificationService.getVerificationStats', () => {
    it('should return comprehensive statistics', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ total: 1000, successful: 900, failed: 100 }] })
        .mockResolvedValueOnce({ rows: [{ method: 'web', count: 500 }] })
        .mockResolvedValueOnce({ rows: [{ date: '2024-01-01', count: 50 }] })
        .mockResolvedValueOnce({ rows: [{ reason: 'RIDER_NOT_FOUND', count: 60 }] });

      const result = await verificationService.getVerificationStats({});

      expect(result).toHaveProperty('total_verifications', 1000);
      expect(result).toHaveProperty('success_rate', 90.0);
      expect(result).toHaveProperty('verifications_by_method');
      expect(result).toHaveProperty('verifications_by_day');
      expect(result).toHaveProperty('top_failure_reasons');
    });

    it('should handle empty statistics gracefully', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ total: 0, successful: 0, failed: 0 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await verificationService.getVerificationStats({});

      expect(result).toHaveProperty('total_verifications', 0);
      expect(result).toHaveProperty('success_rate', 0);
    });
  });

  describe('verificationService.logVerificationAttempt', () => {
    it('should log verification attempt successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await verificationService.logVerificationAttempt({
        jacket_number: 'TSS001',
        verifier_phone: '+2347000000000',
        verification_method: 'web',
        result: 'success',
        ip_address: '192.168.1.1'
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO verification_logs'),
        expect.arrayContaining([
          'TSS001',
          '+2347000000000',
          'web',
          'success',
          expect.any(String)
        ])
      );
    });
  });

  describe('Jacket Number Validation', () => {
    it('should validate correct jacket number format', () => {
      const validNumbers = [
        'TSS001',
        'TSS999',
        'ABC123',
        'XYZ999'
      ];

      validNumbers.forEach(number => {
        expect(verificationService.isValidJacketNumber(number)).toBe(true);
      });
    });

    it('should reject invalid jacket number formats', () => {
      const invalidNumbers = [
        'TSS',          // Too short
        'TSS1234',      // Too long
        'tss001',       // Lowercase
        '123TSS',       // Numbers first
        'TS-001',       // Contains dash
        ''              // Empty
      ];

      invalidNumbers.forEach(number => {
        expect(verificationService.isValidJacketNumber(number)).toBe(false);
      });
    });
  });

  describe('Data Privacy', () => {
    it('should mask phone numbers correctly', () => {
      const phoneNumbers = [
        { input: '+2348123456789', expected: '+234****6789' },
        { input: '+2347012345678', expected: '+234****5678' },
        { input: '+2349087654321', expected: '+234****4321' }
      ];

      phoneNumbers.forEach(({ input, expected }) => {
        const masked = verificationService.maskPhoneNumber(input);
        expect(masked).toBe(expected);
      });
    });

    it('should mask email addresses correctly', () => {
      const emails = [
        { input: 'john@example.com', expected: 'j***@example.com' },
        { input: 'jane.doe@test.org', expected: 'j*******@test.org' },
        { input: 'a@b.co', expected: 'a@b.co' } // Too short to mask
      ];

      emails.forEach(({ input, expected }) => {
        const masked = verificationService.maskEmail(input);
        expect(masked).toBe(expected);
      });
    });
  });
});