const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const { authenticateToken, authorizeRole } = require('../../shared/middleware/authMiddleware');
const { 
  validateVerificationLog,
  validateIncidentReport,
  validateIncidentUpdate,
  validateQuery 
} = require('../validators/verificationValidators');

router.get('/verify/:jacket_number', verificationController.verifyRider);
router.post('/verify/log', validateVerificationLog, verificationController.logVerification);
router.post('/incidents', validateIncidentReport, verificationController.createIncident);
router.get('/incidents', authenticateToken, validateQuery, verificationController.getIncidents);
router.put('/incidents/:id', authenticateToken, authorizeRole(['super_admin', 'admin', 'lga_admin']), validateIncidentUpdate, verificationController.updateIncident);
router.get('/verify/stats', authenticateToken, verificationController.getVerificationStats);

module.exports = router;