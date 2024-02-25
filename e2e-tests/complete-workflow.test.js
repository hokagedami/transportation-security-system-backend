const axios = require('axios');

// E2E Test Configuration
const CONFIG = {
  baseUrl: process.env.E2E_BASE_URL || 'http://localhost',
  services: {
    auth: process.env.AUTH_SERVICE_PORT || 3001,
    rider: process.env.RIDER_SERVICE_PORT || 3002,
    jacket: process.env.JACKET_SERVICE_PORT || 3003,
    payment: process.env.PAYMENT_SERVICE_PORT || 3004,
    sms: process.env.SMS_SERVICE_PORT || 3005,
    verification: process.env.VERIFICATION_SERVICE_PORT || 3006
  },
  testTimeout: 30000
};

// Helper class for API interactions
class APIClient {
  constructor(baseUrl, port) {
    this.baseUrl = `${baseUrl}:${port}`;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(method, endpoint, data = null) {
    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {}
    };

    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    if (data) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async get(endpoint) {
    return this.request('GET', endpoint);
  }

  async post(endpoint, data) {
    return this.request('POST', endpoint, data);
  }

  async put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  }
}

describe('Transportation Security System - Complete E2E Workflow', () => {
  let authClient, riderClient, jacketClient, paymentClient, smsClient, verificationClient;
  let adminToken, fieldOfficerToken;
  let testRider, testPayment, testOrder;

  beforeAll(async () => {
    // Initialize API clients
    authClient = new APIClient(CONFIG.baseUrl, CONFIG.services.auth);
    riderClient = new APIClient(CONFIG.baseUrl, CONFIG.services.rider);
    jacketClient = new APIClient(CONFIG.baseUrl, CONFIG.services.jacket);
    paymentClient = new APIClient(CONFIG.baseUrl, CONFIG.services.payment);
    smsClient = new APIClient(CONFIG.baseUrl, CONFIG.services.sms);
    verificationClient = new APIClient(CONFIG.baseUrl, CONFIG.services.verification);
  }, CONFIG.testTimeout);

  describe('Authentication Flow', () => {
    it('should authenticate admin user and get token', async () => {
      const loginData = {
        username: process.env.E2E_ADMIN_USERNAME || 'admin',
        password: process.env.E2E_ADMIN_PASSWORD || 'admin123'
      };

      const response = await authClient.post('/auth/login', loginData);
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('accessToken');
      expect(response.data).toHaveProperty('user');
      expect(response.data.user.role).toBe('admin');

      adminToken = response.data.accessToken;
      
      // Set token for all clients
      [riderClient, jacketClient, paymentClient, smsClient, verificationClient]
        .forEach(client => client.setToken(adminToken));
    });

    it('should authenticate field officer and get token', async () => {
      const loginData = {
        username: process.env.E2E_OFFICER_USERNAME || 'officer',
        password: process.env.E2E_OFFICER_PASSWORD || 'officer123'
      };

      const response = await authClient.post('/auth/login', loginData);
      
      expect(response.success).toBe(true);
      expect(response.data.user.role).toBe('field_officer');
      
      fieldOfficerToken = response.data.accessToken;
    });
  });

  describe('Rider Registration Flow', () => {
    it('should create a new rider', async () => {
      const riderData = {
        first_name: 'John',
        last_name: 'Doe',
        phone: '+2348123456789',
        email: 'john.doe@example.com',
        lga_id: 1,
        vehicle_type: 'motorcycle',
        vehicle_details: {
          make: 'Honda',
          model: 'CBR600RR',
          year: 2020,
          plate_number: 'ABC123DE'
        }
      };

      const response = await riderClient.post('/', riderData);
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('jacket_number');
      expect(response.data.first_name).toBe('John');
      expect(response.data.status).toBe('pending');

      testRider = response.data;
    });

    it('should retrieve created rider details', async () => {
      const response = await riderClient.get(`/${testRider.id}`);
      
      expect(response.success).toBe(true);
      expect(response.data.id).toBe(testRider.id);
      expect(response.data.jacket_number).toBe(testRider.jacket_number);
    });

    it('should send verification SMS to rider', async () => {
      const smsData = {
        phone: testRider.phone,
        jacket_number: testRider.jacket_number,
        rider_data: {
          rider_id: testRider.id,
          first_name: testRider.first_name,
          last_name: testRider.last_name,
          lga_name: 'Test LGA',
          vehicle_type: testRider.vehicle_type,
          status: testRider.status
        }
      };

      const response = await smsClient.post('/send-verification', smsData);
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('message_id');
    });
  });

  describe('Payment Processing Flow', () => {
    it('should initialize payment for jacket order', async () => {
      const paymentData = {
        rider_id: testRider.id,
        amount: 5000.00,
        method: 'paystack',
        email: testRider.email,
        phone: testRider.phone,
        name: `${testRider.first_name} ${testRider.last_name}`,
        description: 'Transportation Security Jacket Payment'
      };

      const response = await paymentClient.post('/initialize', paymentData);
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('reference');
      expect(response.data).toHaveProperty('authorization_url');
      expect(response.data.amount).toBe(5000.00);

      testPayment = response.data;
    });

    it('should simulate payment completion via webhook', async () => {
      const webhookData = {
        event: 'charge.success',
        data: {
          reference: testPayment.reference,
          amount: 500000, // Amount in kobo
          status: 'success',
          customer: {
            email: testRider.email
          }
        }
      };

      // Note: In real E2E tests, this would be triggered by the payment provider
      const response = await paymentClient.post('/webhook/paystack', webhookData);
      
      expect(response.success).toBe(true);
    });

    it('should verify payment status', async () => {
      const response = await paymentClient.put(`/${testPayment.reference}/verify`, {});
      
      expect(response.success).toBe(true);
      expect(response.data.status).toBe('completed');
    });
  });

  describe('Jacket Order Flow', () => {
    it('should create jacket order after payment', async () => {
      const orderData = {
        rider_id: testRider.id,
        payment_reference: testPayment.reference,
        quantity: 1,
        lga_id: testRider.lga_id,
        notes: 'Standard motorcycle jacket'
      };

      const response = await jacketClient.post('/orders', orderData);
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('id');
      expect(response.data.payment_reference).toBe(testPayment.reference);
      expect(response.data.status).toBe('pending');

      testOrder = response.data;
    });

    it('should update order status to production', async () => {
      const statusUpdate = {
        status: 'production',
        notes: 'Order moved to production queue'
      };

      const response = await jacketClient.put(`/orders/${testOrder.id}/status`, statusUpdate);
      
      expect(response.success).toBe(true);
      expect(response.data.status).toBe('production');
    });

    it('should create production batch', async () => {
      const batchData = {
        batch_name: `BATCH_${Date.now()}`,
        quantity: 50,
        lga_id: testRider.lga_id,
        notes: 'Test production batch'
      };

      const response = await jacketClient.post('/batches', batchData);
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('batch_name');
      expect(response.data.status).toBe('pending');
    });

    it('should update order status to completed', async () => {
      const statusUpdate = {
        status: 'completed',
        notes: 'Jacket production completed'
      };

      const response = await jacketClient.put(`/orders/${testOrder.id}/status`, statusUpdate);
      
      expect(response.success).toBe(true);
      expect(response.data.status).toBe('completed');
    });

    it('should distribute jackets', async () => {
      const distributionData = {
        order_ids: [testOrder.id],
        distributed_to: `${testRider.first_name} ${testRider.last_name}`,
        distribution_location: 'LGA Office',
        notes: 'Jacket distributed to rider'
      };

      const response = await jacketClient.post('/distribute', distributionData);
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('distribution_id');
    });
  });

  describe('Rider Status Update Flow', () => {
    it('should update rider status to active', async () => {
      const updateData = {
        status: 'active',
        notes: 'Rider has received jacket and is now active'
      };

      const response = await riderClient.put(`/${testRider.id}`, updateData);
      
      expect(response.success).toBe(true);
      expect(response.data.status).toBe('active');
    });

    it('should send notification SMS about activation', async () => {
      const notificationData = {
        phone: testRider.phone,
        message: `Congratulations! Your registration is now ACTIVE. Jacket Number: ${testRider.jacket_number}. You can now operate legally in Ogun State.`,
        category: 'activation'
      };

      const response = await smsClient.post('/send-notification', notificationData);
      
      expect(response.success).toBe(true);
    });
  });

  describe('Verification Flow', () => {
    it('should verify rider by jacket number', async () => {
      const response = await verificationClient.get(`/verify/${testRider.jacket_number}?phone=+2348123456789`);
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('rider');
      expect(response.data.rider.jacket_number).toBe(testRider.jacket_number);
      expect(response.data.rider.status).toBe('active');
      expect(response.data.verification_status).toBe('valid');
    });

    it('should log verification attempt', async () => {
      const logData = {
        jacket_number: testRider.jacket_number,
        verifier_phone: '+2348987654321',
        verification_method: 'api',
        location_data: {
          latitude: 6.5244,
          longitude: 3.3792,
          address: 'Lagos, Nigeria'
        },
        notes: 'E2E test verification'
      };

      const response = await verificationClient.post('/verify/log', logData);
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('log_id');
    });

    it('should create incident report', async () => {
      const incidentData = {
        jacket_number: testRider.jacket_number,
        incident_type: 'minor_violation',
        description: 'Rider found without helmet',
        location: 'Ikorodu Road, Lagos',
        reported_by: 'Field Officer',
        priority: 'medium'
      };

      const response = await verificationClient.post('/incidents', incidentData);
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('reference_number');
      expect(response.data.status).toBe('open');
    });
  });

  describe('Analytics and Reporting', () => {
    it('should get rider analytics', async () => {
      const response = await riderClient.get('/analytics');
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('total_riders');
      expect(response.data).toHaveProperty('riders_by_status');
      expect(response.data).toHaveProperty('riders_by_lga');
    });

    it('should get jacket order analytics', async () => {
      const response = await jacketClient.get('/analytics');
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('total_orders');
      expect(response.data).toHaveProperty('orders_by_status');
    });

    it('should get payment analytics', async () => {
      const response = await paymentClient.get('/analytics');
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('total_payments');
      expect(response.data).toHaveProperty('revenue');
    });

    it('should get verification statistics', async () => {
      const response = await verificationClient.get('/verify/stats');
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('total_verifications');
      expect(response.data).toHaveProperty('verification_trends');
    });
  });

  describe('Service Health Checks', () => {
    it('should check all services are healthy', async () => {
      const services = [
        { name: 'auth', client: authClient },
        { name: 'rider', client: riderClient },
        { name: 'jacket', client: jacketClient },
        { name: 'payment', client: paymentClient },
        { name: 'sms', client: smsClient },
        { name: 'verification', client: verificationClient }
      ];

      for (const service of services) {
        try {
          const response = await service.client.get('/health');
          expect(response).toHaveProperty('status', 'healthy');
          expect(response).toHaveProperty('service');
        } catch (error) {
          fail(`${service.name} service health check failed: ${error.message}`);
        }
      }
    });
  });

  afterAll(async () => {
    // Cleanup test data if needed
    if (testRider && testRider.id) {
      try {
        // In a real scenario, you might want to clean up test data
        // await riderClient.delete(`/${testRider.id}`);
      } catch (error) {
        console.warn('Cleanup failed:', error.message);
      }
    }
  });
});