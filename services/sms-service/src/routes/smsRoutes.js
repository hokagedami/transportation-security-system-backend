const express = require('express');
const router = express.Router();
const smsController = require('../controllers/smsController');
const { authenticateToken, authorizeRole } = require('../../../../shared/middleware/authMiddleware');
const { 
  validateSendVerification, 
  validateSendNotification,
  validateSendBulk,
  validateQuery 
} = require('../validators/smsValidators');

router.post('/send-verification', validateSendVerification, smsController.sendVerification);
router.post('/webhook', smsController.handleWebhook);
router.get('/logs', authenticateToken, validateQuery, smsController.getLogs);
router.post('/send-notification', authenticateToken, authorizeRole(['super_admin', 'admin', 'lga_admin']), validateSendNotification, smsController.sendNotification);
router.post('/send-bulk', authenticateToken, authorizeRole(['super_admin', 'admin']), validateSendBulk, smsController.sendBulk);

module.exports = router;