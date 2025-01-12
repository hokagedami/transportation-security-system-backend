const Joi = require('joi');
const { phoneSchema, lgaIdSchema } = require('../../shared/validators/commonSchemas');

const initializePaymentSchema = Joi.object({
  rider_id: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().precision(2).required(),
  method: Joi.string().valid('paystack', 'flutterwave', 'bank_transfer', 'pos', 'cash', 'mobile_money').required(),
  email: Joi.string().email().required(),
  phone: phoneSchema.required(),
  name: Joi.string().max(100).required(),
  jacket_number: Joi.string(),
  lga_id: lgaIdSchema
});

const verifyPaymentSchema = Joi.object({
  verification_notes: Joi.string().max(500).required()
});

const webhookSchema = Joi.object({}).unknown(true);

const validateInitializePayment = (req, res, next) => {
  const { error } = initializePaymentSchema.validate(req.body);
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

const validateVerifyPayment = (req, res, next) => {
  const { error } = verifyPaymentSchema.validate(req.body);
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

const validateWebhook = (req, res, next) => {
  const { error } = webhookSchema.validate(req.body);
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
  validateInitializePayment,
  validateVerifyPayment,
  validateWebhook
};