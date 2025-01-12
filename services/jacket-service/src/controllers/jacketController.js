const jacketService = require('../services/jacketService');
const { sendSuccess, sendError, sendPaginatedResponse } = require('../../shared/utils/responseHelper');
const logger = require('../../shared/utils/logger');

const createOrder = async (req, res, next) => {
  try {
    const orderData = req.body;
    orderData.created_by = req.user.id;
    
    const jacket = await jacketService.createOrder(orderData);
    
    logger.info(`Jacket order created for rider ${orderData.rider_id}`);
    return sendSuccess(res, jacket, 'Jacket order created successfully', 201);
  } catch (error) {
    logger.error('Create jacket order error:', error);
    if (error.message === 'Payment not completed') {
      return sendError(res, 'PAYMENT_NOT_COMPLETED', 'Payment must be completed before creating jacket order', null, 400);
    }
    next(error);
  }
};

const getJackets = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, lga_id, production_batch } = req.query;
    
    const filters = {
      status,
      lga_id: req.user.role === 'lga_admin' ? req.user.lga_id : lga_id,
      production_batch
    };
    
    const result = await jacketService.getJackets(page, limit, filters);
    
    return sendPaginatedResponse(res, result.jackets, page, limit, result.total);
  } catch (error) {
    logger.error('Get jackets error:', error);
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const jacket = await jacketService.updateStatus(id, status, notes, req.user.id);
    
    if (!jacket) {
      return sendError(res, 'JACKET_NOT_FOUND', 'Jacket not found', null, 404);
    }
    
    logger.info(`Jacket ${id} status updated to ${status}`);
    return sendSuccess(res, jacket, 'Jacket status updated successfully');
  } catch (error) {
    logger.error('Update jacket status error:', error);
    next(error);
  }
};

const createBatch = async (req, res, next) => {
  try {
    const batchData = req.body;
    batchData.created_by = req.user.id;
    
    const batch = await jacketService.createBatch(batchData);
    
    logger.info(`Production batch created: ${batch.batch_number}`);
    return sendSuccess(res, batch, 'Production batch created successfully', 201);
  } catch (error) {
    logger.error('Create batch error:', error);
    next(error);
  }
};

const getBatch = async (req, res, next) => {
  try {
    const { batch_id } = req.params;
    
    const batch = await jacketService.getBatch(batch_id);
    
    if (!batch) {
      return sendError(res, 'BATCH_NOT_FOUND', 'Production batch not found', null, 404);
    }
    
    return sendSuccess(res, batch, 'Production batch retrieved successfully');
  } catch (error) {
    logger.error('Get batch error:', error);
    next(error);
  }
};

const distribute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const distributionData = req.body;
    distributionData.distributed_by = req.user.id;
    
    const jacket = await jacketService.distribute(id, distributionData);
    
    if (!jacket) {
      return sendError(res, 'JACKET_NOT_FOUND', 'Jacket not found', null, 404);
    }
    
    logger.info(`Jacket ${id} distributed to rider`);
    return sendSuccess(res, jacket, 'Jacket distributed successfully');
  } catch (error) {
    logger.error('Distribute jacket error:', error);
    if (error.message === 'Jacket not ready for distribution') {
      return sendError(res, 'JACKET_NOT_READY', 'Jacket must be quality checked before distribution', null, 400);
    }
    next(error);
  }
};

module.exports = {
  createOrder,
  getJackets,
  updateStatus,
  createBatch,
  getBatch,
  distribute
};