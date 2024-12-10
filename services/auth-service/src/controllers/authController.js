const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../../../../shared/utils/responseHelper');
const logger = require('../../../../shared/utils/logger');

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    
    if (!result.success) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Invalid username or password', null, 401);
    }

    logger.info(`User ${username} logged in successfully`);
    return sendSuccess(res, result.data, 'Login successful');
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await authService.getUserProfile(userId);
    
    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', null, 404);
    }

    return sendSuccess(res, user, 'User profile retrieved successfully');
  } catch (error) {
    logger.error('Get profile error:', error);
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    const result = await authService.refreshToken(refresh_token);
    
    if (!result.success) {
      return sendError(res, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', null, 401);
    }

    return sendSuccess(res, result.data, 'Token refreshed successfully');
  } catch (error) {
    logger.error('Refresh token error:', error);
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await authService.logout(userId);
    
    logger.info(`User ${userId} logged out successfully`);
    return sendSuccess(res, null, 'Logout successful');
  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
};

module.exports = {
  login,
  getMe,
  refreshToken,
  logout
};