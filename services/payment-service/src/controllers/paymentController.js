const paymentService = require('../services/paymentService');
const { sendSuccess, sendError, sendPaginatedResponse } = require('../../shared/utils/responseHelper');
const logger = require('../../shared/utils/logger');

const initializePayment = async (req, res, next) => {
  try {
    const paymentData = req.body;
    paymentData.initiated_by = req.user.id;
    
    const result = await paymentService.initializePayment(paymentData);
    
    logger.info(`Payment initialized for rider ${paymentData.rider_id} with reference ${result.reference}`);
    return sendSuccess(res, result, 'Payment initialized successfully');
  } catch (error) {
    logger.error('Initialize payment error:', error);
    if (error.message === 'Rider not found') {
      return sendError(res, 'RIDER_NOT_FOUND', 'Rider not found', null, 404);
    }
    next(error);
  }
};

const getRiderPayments = async (req, res, next) => {
  try {
    const { rider_id } = req.params;
    
    const payments = await paymentService.getRiderPayments(rider_id);
    
    return sendSuccess(res, payments, 'Payments retrieved successfully');
  } catch (error) {
    logger.error('Get rider payments error:', error);
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;
    const { verification_notes } = req.body;
    const verified_by = req.user.id;
    
    const payment = await paymentService.verifyPayment(reference, verified_by, verification_notes);
    
    if (!payment) {
      return sendError(res, 'PAYMENT_NOT_FOUND', 'Payment not found', null, 404);
    }
    
    logger.info(`Payment ${reference} manually verified by user ${verified_by}`);
    return sendSuccess(res, payment, 'Payment verified successfully');
  } catch (error) {
    logger.error('Verify payment error:', error);
    next(error);
  }
};

const paystackWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const payload = req.body;
    
    const result = await paymentService.processPaystackWebhook(payload, signature);
    
    if (!result.valid) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }
    
    logger.info(`Paystack webhook processed for reference ${result.reference}`);
    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    logger.error('Paystack webhook error:', error);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};

const flutterwaveWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['verif-hash'];
    const payload = req.body;
    
    const result = await paymentService.processFlutterwaveWebhook(payload, signature);
    
    if (!result.valid) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }
    
    logger.info(`Flutterwave webhook processed for reference ${result.reference}`);
    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    logger.error('Flutterwave webhook error:', error);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};

const getPendingVerifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, method } = req.query;
    
    const filters = {
      method,
      lga_id: req.user.role === 'lga_admin' ? req.user.lga_id : null
    };
    
    const result = await paymentService.getPendingVerifications(page, limit, filters);
    
    return sendPaginatedResponse(res, result.payments, page, limit, result.total);
  } catch (error) {
    logger.error('Get pending verifications error:', error);
    next(error);
  }
};

module.exports = {
  initializePayment,
  getRiderPayments,
  verifyPayment,
  paystackWebhook,
  flutterwaveWebhook,
  getPendingVerifications
};