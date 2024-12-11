const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorizeRole } = require('../../../../shared/middleware/authMiddleware');
const { 
  validateInitializePayment, 
  validateVerifyPayment,
  validateWebhook 
} = require('../validators/paymentValidators');

router.post('/initialize', authenticateToken, validateInitializePayment, paymentController.initializePayment);
router.get('/rider/:rider_id', authenticateToken, paymentController.getRiderPayments);
router.put('/:reference/verify', authenticateToken, authorizeRole(['super_admin', 'admin', 'finance_officer']), validateVerifyPayment, paymentController.verifyPayment);
router.post('/webhook/paystack', validateWebhook, paymentController.paystackWebhook);
router.post('/webhook/flutterwave', validateWebhook, paymentController.flutterwaveWebhook);
router.get('/pending-verification', authenticateToken, authorizeRole(['super_admin', 'admin', 'finance_officer']), paymentController.getPendingVerifications);

module.exports = router;