const express = require('express');
const router = express.Router();
const jacketController = require('../controllers/jacketController');
const { authenticateToken, authorizeRole } = require('../../shared/middleware/authMiddleware');
const { 
  validateCreateOrder, 
  validateStatusUpdate, 
  validateBatch,
  validateDistribute,
  validateQuery 
} = require('../validators/jacketValidators');

router.post('/create-order', authenticateToken, authorizeRole(['super_admin', 'admin', 'lga_admin']), validateCreateOrder, jacketController.createOrder);
router.get('/', authenticateToken, validateQuery, jacketController.getJackets);
router.put('/:id/status', authenticateToken, authorizeRole(['super_admin', 'admin', 'lga_admin']), validateStatusUpdate, jacketController.updateStatus);
router.post('/batch', authenticateToken, authorizeRole(['super_admin', 'admin']), validateBatch, jacketController.createBatch);
router.get('/batch/:batch_id', authenticateToken, jacketController.getBatch);
router.put('/:id/distribute', authenticateToken, authorizeRole(['super_admin', 'admin', 'lga_admin', 'field_officer']), validateDistribute, jacketController.distribute);

module.exports = router;