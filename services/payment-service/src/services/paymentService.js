const pool = require('../../shared/database/connection');
const logger = require('../../shared/utils/logger');
const axios = require('axios');
const crypto = require('crypto');

const generateReference = (riderId) => {
  const timestamp = Date.now();
  return `OG_${timestamp}_${riderId}`;
};

const initializePayment = async (paymentData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const riderResult = await client.query(
      'SELECT jacket_number FROM riders WHERE id = $1',
      [paymentData.rider_id]
    );
    
    if (riderResult.rows.length === 0) {
      throw new Error('Rider not found');
    }
    
    const reference = generateReference(paymentData.rider_id);
    const jacketNumber = riderResult.rows[0].jacket_number;
    
    const query = `
      INSERT INTO payments (
        reference, rider_id, amount, method, email, phone,
        name, lga_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      reference,
      paymentData.rider_id,
      paymentData.amount,
      paymentData.method,
      paymentData.email,
      paymentData.phone,
      paymentData.name,
      paymentData.lga_id,
      'pending'
    ];
    
    const result = await client.query(query, values);
    const payment = result.rows[0];
    
    let gatewayResponse = {};
    
    if (paymentData.method === 'paystack') {
      gatewayResponse = await initializePaystack(payment, paymentData.email, jacketNumber);
    } else if (paymentData.method === 'flutterwave') {
      gatewayResponse = await initializeFlutterwave(payment, paymentData, jacketNumber);
    } else if (paymentData.method === 'bank_transfer') {
      gatewayResponse = {
        account_number: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
        account_name: process.env.BANK_ACCOUNT_NAME || 'Ogun State Transport Initiative',
        bank_name: process.env.BANK_NAME || 'First Bank Nigeria',
        reference: reference
      };
    }
    
    await client.query(
      'UPDATE payments SET gateway_response = $1 WHERE reference = $2',
      [JSON.stringify(gatewayResponse), reference]
    );
    
    await client.query('COMMIT');
    
    return {
      reference,
      payment_url: gatewayResponse.authorization_url || null,
      access_code: gatewayResponse.access_code || null,
      bank_details: paymentData.method === 'bank_transfer' ? gatewayResponse : null,
      amount: paymentData.amount,
      method: paymentData.method
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Initialize payment service error:', error);
    throw error;
  } finally {
    client.release();
  }
};

const initializePaystack = async (payment, email, jacketNumber) => {
  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: email,
        amount: payment.amount * 100,
        reference: payment.reference,
        metadata: {
          rider_id: payment.rider_id,
          jacket_number: jacketNumber
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.data;
  } catch (error) {
    logger.error('Paystack initialization error:', error);
    throw new Error('Payment gateway initialization failed');
  }
};

const initializeFlutterwave = async (payment, paymentData, jacketNumber) => {
  try {
    const response = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      {
        tx_ref: payment.reference,
        amount: payment.amount,
        currency: 'NGN',
        redirect_url: process.env.FLUTTERWAVE_REDIRECT_URL || 'https://yourapp.com/payment/callback',
        customer: {
          email: paymentData.email,
          phone_number: paymentData.phone,
          name: paymentData.name
        },
        customizations: {
          title: 'Ogun State Transport Initiative',
          description: `Payment for jacket ${jacketNumber}`
        },
        meta: {
          rider_id: payment.rider_id,
          jacket_number: jacketNumber
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.data;
  } catch (error) {
    logger.error('Flutterwave initialization error:', error);
    throw new Error('Payment gateway initialization failed');
  }
};

const getRiderPayments = async (riderId) => {
  try {
    const query = `
      SELECT p.*, j.jacket_number, j.status as jacket_status
      FROM payments p
      LEFT JOIN jackets j ON p.reference = j.payment_reference
      WHERE p.rider_id = $1
      ORDER BY p.created_at DESC
    `;
    
    const result = await pool.query(query, [riderId]);
    
    return result.rows;
  } catch (error) {
    logger.error('Get rider payments service error:', error);
    throw error;
  }
};

const verifyPayment = async (reference, verifiedBy, verificationNotes) => {
  try {
    const query = `
      UPDATE payments 
      SET status = 'completed', 
          verified_by = $1,
          verified_at = CURRENT_TIMESTAMP,
          verification_notes = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE reference = $3 AND status IN ('pending', 'processing')
      RETURNING *
    `;
    
    const result = await pool.query(query, [verifiedBy, verificationNotes, reference]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Verify payment service error:', error);
    throw error;
  }
};

const processPaystackWebhook = async (payload, signature) => {
  try {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (hash !== signature) {
      return { valid: false };
    }
    
    if (payload.event === 'charge.success') {
      const reference = payload.data.reference;
      const status = 'completed';
      
      await pool.query(
        'UPDATE payments SET status = $1, gateway_response = $2, updated_at = CURRENT_TIMESTAMP WHERE reference = $3',
        [status, JSON.stringify(payload.data), reference]
      );
      
      return { valid: true, reference };
    }
    
    return { valid: true };
  } catch (error) {
    logger.error('Process Paystack webhook error:', error);
    throw error;
  }
};

const processFlutterwaveWebhook = async (payload, signature) => {
  try {
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
    
    if (signature !== secretHash) {
      return { valid: false };
    }
    
    if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
      const reference = payload.data.tx_ref;
      const status = 'completed';
      
      await pool.query(
        'UPDATE payments SET status = $1, gateway_response = $2, updated_at = CURRENT_TIMESTAMP WHERE reference = $3',
        [status, JSON.stringify(payload.data), reference]
      );
      
      return { valid: true, reference };
    }
    
    return { valid: true };
  } catch (error) {
    logger.error('Process Flutterwave webhook error:', error);
    throw error;
  }
};

const getPendingVerifications = async (page, limit, filters) => {
  try {
    let query = `
      SELECT p.*, r.first_name, r.last_name, r.jacket_number,
             l.name as lga_name
      FROM payments p
      LEFT JOIN riders r ON p.rider_id = r.id
      LEFT JOIN lgas l ON p.lga_id = l.id
      WHERE p.status IN ('pending', 'processing')
      AND p.method IN ('bank_transfer', 'cash', 'pos')
    `;
    
    const values = [];
    let valueIndex = 1;
    
    if (filters.method) {
      query += ` AND p.method = $${valueIndex}`;
      values.push(filters.method);
      valueIndex++;
    }
    
    if (filters.lga_id) {
      query += ` AND p.lga_id = $${valueIndex}`;
      values.push(filters.lga_id);
      valueIndex++;
    }
    
    const countQuery = query.replace(
      'SELECT p.*, r.first_name, r.last_name, r.jacket_number, l.name as lga_name',
      'SELECT COUNT(*)'
    );
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);
    
    const offset = (page - 1) * limit;
    query += ` ORDER BY p.created_at DESC LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    return {
      payments: result.rows,
      total
    };
  } catch (error) {
    logger.error('Get pending verifications service error:', error);
    throw error;
  }
};

module.exports = {
  initializePayment,
  getRiderPayments,
  verifyPayment,
  processPaystackWebhook,
  processFlutterwaveWebhook,
  getPendingVerifications
};