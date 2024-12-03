const Joi = require('joi');

const phonePattern = /^(\+234|0)[789]\d{9}$/;

const phoneSchema = Joi.string()
  .pattern(phonePattern)
  .messages({
    'string.pattern.base': 'Phone number must be a valid Nigerian phone number'
  });

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

const dateRangeSchema = Joi.object({
  start_date: Joi.date().iso(),
  end_date: Joi.date().iso().greater(Joi.ref('start_date'))
});

const lgaIdSchema = Joi.number().integer().positive().required();

const vehicleTypeSchema = Joi.string().valid('motorcycle', 'tricycle');

const statusSchema = Joi.string().valid('active', 'suspended', 'revoked', 'pending');

const jacketNumberPattern = /^OG-[A-Z]{3}-\d{5}$/;

const jacketNumberSchema = Joi.string()
  .pattern(jacketNumberPattern)
  .messages({
    'string.pattern.base': 'Jacket number must be in format OG-XXX-00000'
  });

module.exports = {
  phoneSchema,
  paginationSchema,
  dateRangeSchema,
  lgaIdSchema,
  vehicleTypeSchema,
  statusSchema,
  jacketNumberSchema
};