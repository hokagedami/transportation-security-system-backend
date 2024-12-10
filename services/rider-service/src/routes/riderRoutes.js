const express = require('express');
const router = express.Router();
const riderController = require('../controllers/riderController');
const { authenticateToken, authorizeRole } = require('../../../../shared/middleware/authMiddleware');
const { validateCreateRider, validateUpdateRider, validateQuery } = require('../validators/riderValidators');

router.post('/', authenticateToken, authorizeRole(['super_admin', 'admin', 'lga_admin', 'field_officer']), validateCreateRider, riderController.createRider);
router.get('/', authenticateToken, validateQuery, riderController.getRiders);
router.get('/:id', authenticateToken, riderController.getRiderById);
router.put('/:id', authenticateToken, authorizeRole(['super_admin', 'admin', 'lga_admin']), validateUpdateRider, riderController.updateRider);
router.delete('/:id', authenticateToken, authorizeRole(['super_admin', 'admin']), riderController.deleteRider);
router.get('/:id/history', authenticateToken, riderController.getRiderHistory);

module.exports = router;