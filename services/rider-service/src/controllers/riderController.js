const riderService = require('../services/riderService');
const { sendSuccess, sendError, sendPaginatedResponse } = require('../../shared/utils/responseHelper');
const logger = require('../../shared/utils/logger');

const createRider = async (req, res, next) => {
  try {
    const riderData = req.body;
    riderData.created_by = req.user.id;
    
    const rider = await riderService.createRider(riderData);
    
    logger.info(`Rider created with jacket number: ${rider.jacket_number}`);
    return sendSuccess(res, rider, 'Rider created successfully', 201);
  } catch (error) {
    logger.error('Create rider error:', error);
    if (error.code === '23505') {
      return sendError(res, 'DUPLICATE_ENTRY', 'Phone number already registered', null, 409);
    }
    next(error);
  }
};

const getRiders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, lga_id, status, vehicle_type, search } = req.query;
    
    const filters = {
      lga_id: req.user.role === 'lga_admin' ? req.user.lga_id : lga_id,
      status,
      vehicle_type,
      search
    };
    
    const result = await riderService.getRiders(page, limit, filters);
    
    return sendPaginatedResponse(res, result.riders, page, limit, result.total);
  } catch (error) {
    logger.error('Get riders error:', error);
    next(error);
  }
};

const getRiderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rider = await riderService.getRiderById(id);
    
    if (!rider) {
      return sendError(res, 'RIDER_NOT_FOUND', 'Rider not found', null, 404);
    }
    
    if (req.user.role === 'lga_admin' && rider.lga_id !== req.user.lga_id) {
      return sendError(res, 'FORBIDDEN', 'Access denied', null, 403);
    }
    
    return sendSuccess(res, rider, 'Rider retrieved successfully');
  } catch (error) {
    logger.error('Get rider by id error:', error);
    next(error);
  }
};

const updateRider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const existingRider = await riderService.getRiderById(id);
    if (!existingRider) {
      return sendError(res, 'RIDER_NOT_FOUND', 'Rider not found', null, 404);
    }
    
    if (req.user.role === 'lga_admin' && existingRider.lga_id !== req.user.lga_id) {
      return sendError(res, 'FORBIDDEN', 'Access denied', null, 403);
    }
    
    const updatedRider = await riderService.updateRider(id, updateData);
    
    logger.info(`Rider ${id} updated by user ${req.user.id}`);
    return sendSuccess(res, updatedRider, 'Rider updated successfully');
  } catch (error) {
    logger.error('Update rider error:', error);
    next(error);
  }
};

const deleteRider = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const rider = await riderService.getRiderById(id);
    if (!rider) {
      return sendError(res, 'RIDER_NOT_FOUND', 'Rider not found', null, 404);
    }
    
    await riderService.deleteRider(id, req.user.id);
    
    logger.info(`Rider ${id} revoked by user ${req.user.id}`);
    return sendSuccess(res, null, 'Rider revoked successfully');
  } catch (error) {
    logger.error('Delete rider error:', error);
    next(error);
  }
};

const getRiderHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const rider = await riderService.getRiderById(id);
    if (!rider) {
      return sendError(res, 'RIDER_NOT_FOUND', 'Rider not found', null, 404);
    }
    
    if (req.user.role === 'lga_admin' && rider.lga_id !== req.user.lga_id) {
      return sendError(res, 'FORBIDDEN', 'Access denied', null, 403);
    }
    
    const history = await riderService.getRiderHistory(id);
    
    return sendSuccess(res, history, 'Rider history retrieved successfully');
  } catch (error) {
    logger.error('Get rider history error:', error);
    next(error);
  }
};

module.exports = {
  createRider,
  getRiders,
  getRiderById,
  updateRider,
  deleteRider,
  getRiderHistory
};