const Joi = require('joi');
const { paginationSchema, lgaIdSchema } = require('../../shared/validators/commonSchemas');

const createOrderSchema = Joi.object({
  rider_id: Joi.number().integer().positive().required(),
  payment_reference: Joi.string().required(),
  quantity: Joi.number().integer().positive().default(1),
  lga_id: lgaIdSchema,
  production_batch_id: Joi.number().integer().positive(),
  notes: Joi.string().max(500)
});

const statusUpdateSchema = Joi.object({
  status: Joi.string().valid('ordered', 'produced', 'quality_checked', 'distributed', 'lost', 'damaged', 'returned').required(),
  notes: Joi.string().max(500)
});

const batchSchema = Joi.object({
  lga_id: lgaIdSchema,
  quantity: Joi.number().integer().positive().required(),
  supplier_info: Joi.object({
    name: Joi.string().required(),
    contact: Joi.string(),
    address: Joi.string()
  }),
  cost_per_unit: Joi.number().positive().precision(2).required(),
  production_start_date: Joi.date().iso().required(),
  notes: Joi.string().max(1000)
});

const distributeSchema = Joi.object({
  distribution_date: Joi.date().iso(),
  rider_confirmation: Joi.boolean()
});

const querySchema = paginationSchema.keys({
  status: Joi.string().valid('ordered', 'produced', 'quality_checked', 'distributed', 'lost', 'damaged', 'returned'),
  lga_id: Joi.number().integer().positive(),
  production_batch: Joi.number().integer().positive()
});

const validateCreateOrder = (req, res, next) => {
  const { error } = createOrderSchema.validate(req.body);
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

const validateStatusUpdate = (req, res, next) => {
  const { error } = statusUpdateSchema.validate(req.body);
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

const validateBatch = (req, res, next) => {
  const { error } = batchSchema.validate(req.body);
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

const validateDistribute = (req, res, next) => {
  const { error } = distributeSchema.validate(req.body);
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
  validateCreateOrder,
  validateStatusUpdate,
  validateBatch,
  validateDistribute,
  validateQuery
};