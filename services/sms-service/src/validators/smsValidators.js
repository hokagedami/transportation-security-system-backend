const Joi = require('joi');
const { phoneSchema, paginationSchema } = require('../../shared/validators/commonSchemas');

const sendVerificationSchema = Joi.object({
  phone: phoneSchema.required(),
  jacket_number: Joi.string().required(),
  rider_data: Joi.object({
    rider_id: Joi.number().integer().positive(),
    first_name: Joi.string().required(),
    last_name: Joi.string().required(),
    lga_name: Joi.string().required(),
    vehicle_type: Joi.string().required(),
    status: Joi.string().required()
  }).required()
});

const sendNotificationSchema = Joi.object({
  phone: phoneSchema.required(),
  message: Joi.string().max(500).required(),
  message_type: Joi.string().valid('payment_confirmation', 'jacket_ready', 'incident_update', 'general').required()
});

const sendBulkSchema = Joi.object({
  recipients: Joi.array().items(phoneSchema).min(1).max(1000).required(),
  message: Joi.string().max(500).required(),
  message_type: Joi.string().valid('announcement', 'reminder', 'alert', 'general').required()
});

const querySchema = paginationSchema.keys({
  phone: phoneSchema,
  date_range: Joi.string().pattern(/^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/),
  message_type: Joi.string(),
  status: Joi.string().valid('pending', 'sent', 'delivered', 'failed')
});

const validateSendVerification = (req, res, next) => {
  const { error } = sendVerificationSchema.validate(req.body);
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

const validateSendNotification = (req, res, next) => {
  const { error } = sendNotificationSchema.validate(req.body);
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

const validateSendBulk = (req, res, next) => {
  const { error } = sendBulkSchema.validate(req.body);
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

const validateQuery = (req, res, next) => {
  const { error } = querySchema.validate(req.query);
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
  validateSendVerification,
  validateSendNotification,
  validateSendBulk,
  validateQuery
};