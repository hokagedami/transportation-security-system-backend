const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../../../../shared/middleware/authMiddleware');
const rateLimiter = require('../middleware/rateLimiter');
const { validateLogin, validateRefreshToken } = require('../validators/authValidators');

router.post('/login', rateLimiter, validateLogin, authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.post('/refresh', validateRefreshToken, authController.refreshToken);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;