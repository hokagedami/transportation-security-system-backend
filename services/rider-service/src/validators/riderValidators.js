const Joi = require('joi');
const { 
  phoneSchema, 
  paginationSchema, 
  lgaIdSchema, 
  vehicleTypeSchema,
  statusSchema 
} = require('../../shared/validators/commonSchemas');

const createRiderSchema = Joi.object({
  first_name: Joi.string().min(2).max(50).required(),
  last_name: Joi.string().min(2).max(50).required(),
  phone: phoneSchema.required(),
  email: Joi.string().email().allow(null, ''),
  lga_id: lgaIdSchema,
  vehicle_type: vehicleTypeSchema.required(),
  vehicle_plate: Joi.string().max(20).allow(null, ''),
  address: Joi.string().max(500).allow(null, ''),
  emergency_contact_name: Joi.string().max(100).allow(null, ''),
  emergency_contact_phone: phoneSchema.allow(null, '')
});

const updateRiderSchema = Joi.object({
  first_name: Joi.string().min(2).max(50),
  last_name: Joi.string().min(2).max(50),
  phone: phoneSchema,
  email: Joi.string().email().allow(null, ''),
  vehicle_type: vehicleTypeSchema,
  vehicle_plate: Joi.string().max(20).allow(null, ''),
  address: Joi.string().max(500).allow(null, ''),
  emergency_contact_name: Joi.string().max(100).allow(null, ''),
  emergency_contact_phone: phoneSchema.allow(null, ''),
  status: statusSchema
}).min(1);

const querySchema = paginationSchema.keys({
  lga_id: Joi.number().integer().positive(),
  status: statusSchema,
  vehicle_type: vehicleTypeSchema,
  search: Joi.string().max(100)
});

const validateCreateRider = (req, res, next) => {
  const { error } = createRiderSchema.validate(req.body);
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

const validateUpdateRider = (req, res, next) => {
  const { error } = updateRiderSchema.validate(req.body);
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
  validateCreateRider,
  validateUpdateRider,
  validateQuery
};