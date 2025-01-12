const Joi = require('joi');
const { 
  phoneSchema, 
  paginationSchema, 
  jacketNumberSchema 
} = require('../../shared/validators/commonSchemas');

const verificationLogSchema = Joi.object({
  jacket_number: jacketNumberSchema.required(),
  verifier_phone: phoneSchema,
  verification_method: Joi.string().valid('sms', 'web', 'mobile_app', 'api').required(),
  location_data: Joi.object({
    latitude: Joi.number(),
    longitude: Joi.number(),
    address: Joi.string()
  }),
  user_agent: Joi.string(),
  ip_address: Joi.string()
});

const incidentReportSchema = Joi.object({
  jacket_number: jacketNumberSchema,
  reporter_name: Joi.string().max(200).required(),
  reporter_phone: phoneSchema.required(),
  incident_type: Joi.string().valid('misconduct', 'accident', 'theft', 'fraud', 'complaint', 'lost_jacket', 'other').required(),
  description: Joi.string().max(1000).required(),
  location: Joi.string().max(500),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium')
});

const incidentUpdateSchema = Joi.object({
  status: Joi.string().valid('open', 'investigating', 'resolved', 'closed', 'escalated'),
  assigned_to: Joi.number().integer().positive(),
  resolution_notes: Joi.string().max(1000),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical')
}).min(1);

const querySchema = paginationSchema.keys({
  status: Joi.string().valid('open', 'investigating', 'resolved', 'closed', 'escalated'),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical'),
  lga_id: Joi.number().integer().positive(),
  date_range: Joi.string().pattern(/^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/),
  assigned_to: Joi.number().integer().positive()
});

const validateVerificationLog = (req, res, next) => {
  const { error } = verificationLogSchema.validate(req.body);
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

const validateIncidentReport = (req, res, next) => {
  const { error } = incidentReportSchema.validate(req.body);
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

const validateIncidentUpdate = (req, res, next) => {
  const { error } = incidentUpdateSchema.validate(req.body);
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
  validateVerificationLog,
  validateIncidentReport,
  validateIncidentUpdate,
  validateQuery
};