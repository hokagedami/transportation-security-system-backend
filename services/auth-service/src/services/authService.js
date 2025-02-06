const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../shared/database/connection');
const logger = require('../../shared/utils/logger');

const generateTokens = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    lga_id: user.lga_id
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
  });

  return { accessToken, refreshToken };
};

const login = async (username, password) => {
  try {
    const query = `
      SELECT u.*, l.name as lga_name, l.code as lga_code
      FROM users u
      LEFT JOIN lgas l ON u.lga_id = l.id
      WHERE u.username = $1 AND u.is_active = true
    `;
    
    const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      return { success: false };
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return { success: false };
    }

    const { accessToken, refreshToken } = generateTokens(user);
    
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP, refresh_token = $1 WHERE id = $2',
      [refreshToken, user.id]
    );

    delete user.password_hash;
    delete user.refresh_token;

    return {
      success: true,
      data: {
        user,
        access_token: accessToken,
        refresh_token: refreshToken
      }
    };
  } catch (error) {
    logger.error('Login service error:', error);
    throw error;
  }
};

const getUserProfile = async (userId) => {
  try {
    const query = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, 
             u.phone, u.role, u.lga_id, u.is_active, u.last_login,
             u.created_at, l.name as lga_name, l.code as lga_code
      FROM users u
      LEFT JOIN lgas l ON u.lga_id = l.id
      WHERE u.id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Get user profile error:', error);
    throw error;
  }
};

const refreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND refresh_token = $2 AND is_active = true',
      [decoded.id, token]
    );

    if (result.rows.length === 0) {
      return { success: false };
    }

    const user = result.rows[0];
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    
    await pool.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [newRefreshToken, user.id]
    );

    return {
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: newRefreshToken
      }
    };
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return { success: false };
    }
    logger.error('Refresh token service error:', error);
    throw error;
  }
};

const logout = async (userId) => {
  try {
    await pool.query(
      'UPDATE users SET refresh_token = NULL WHERE id = $1',
      [userId]
    );
    return true;
  } catch (error) {
    logger.error('Logout service error:', error);
    throw error;
  }
};

module.exports = {
  login,
  getUserProfile,
  refreshToken,
  logout
};