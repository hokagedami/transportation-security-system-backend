const Joi = require('joi');

const loginSchema = Joi.object({
  username: Joi.string().required().min(3).max(50),
  password: Joi.string().required().min(6)
});

const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required()
});

const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message
      },
      timestamp: new Date().toISOString()
    });
  }
  next();
};

const validateRefreshToken = (req, res, next) => {
  const { error } = refreshTokenSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message
      },
      timestamp: new Date().toISOString()
    });
  }
  next();
};

module.exports = {
  validateLogin,
  validateRefreshToken
};