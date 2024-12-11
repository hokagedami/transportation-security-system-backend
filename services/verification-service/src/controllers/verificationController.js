const verificationService = require('../services/verificationService');
const { sendSuccess, sendError, sendPaginatedResponse } = require('../../../../shared/utils/responseHelper');
const logger = require('../../../../shared/utils/logger');

const verifyRider = async (req, res, next) => {
  try {
    const { jacket_number } = req.params;
    const { phone } = req.query;
    const verificationData = {
      jacket_number,
      verifier_phone: phone,
      verification_method: 'web',
      user_agent: req.get('User-Agent'),
      ip_address: req.ip
    };
    
    const result = await verificationService.verifyRider(jacket_number, verificationData);
    
    if (!result.success) {
      logger.info(`Verification failed for jacket ${jacket_number}`);
      return res.status(200).json({
        success: false,
        error: {
          code: result.error_code,
          message: result.error_message
        },
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`Verification successful for jacket ${jacket_number}`);
    return sendSuccess(res, result.data, 'Rider verified successfully');
  } catch (error) {
    logger.error('Verify rider error:', error);
    next(error);
  }
};

const logVerification = async (req, res, next) => {
  try {
    const logData = req.body;
    
    await verificationService.logVerificationAttempt(logData);
    
    return sendSuccess(res, null, 'Verification attempt logged');
  } catch (error) {
    logger.error('Log verification error:', error);
    next(error);
  }
};

const createIncident = async (req, res, next) => {
  try {
    const incidentData = req.body;
    
    const incident = await verificationService.createIncident(incidentData);
    
    logger.info(`Incident created: ${incident.reference_number}`);
    return sendSuccess(res, incident, 'Incident report created successfully', 201);
  } catch (error) {
    logger.error('Create incident error:', error);
    if (error.message === 'Rider not found') {
      return sendError(res, 'RIDER_NOT_FOUND', 'Jacket number not found', null, 404);
    }
    next(error);
  }
};

const getIncidents = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      severity, 
      lga_id, 
      date_range, 
      assigned_to 
    } = req.query;
    
    const filters = {
      status,
      severity,
      lga_id: req.user.role === 'lga_admin' ? req.user.lga_id : lga_id,
      date_range,
      assigned_to
    };
    
    const result = await verificationService.getIncidents(page, limit, filters);
    
    return sendPaginatedResponse(res, result.incidents, page, limit, result.total);
  } catch (error) {
    logger.error('Get incidents error:', error);
    next(error);
  }
};

const updateIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    updateData.updated_by = req.user.id;
    
    const incident = await verificationService.updateIncident(id, updateData);
    
    if (!incident) {
      return sendError(res, 'INCIDENT_NOT_FOUND', 'Incident not found', null, 404);
    }
    
    logger.info(`Incident ${id} updated by user ${req.user.id}`);
    return sendSuccess(res, incident, 'Incident updated successfully');
  } catch (error) {
    logger.error('Update incident error:', error);
    next(error);
  }
};

const getVerificationStats = async (req, res, next) => {
  try {
    const { date_range, lga_id } = req.query;
    
    const filters = {
      date_range,
      lga_id: req.user.role === 'lga_admin' ? req.user.lga_id : lga_id
    };
    
    const stats = await verificationService.getVerificationStats(filters);
    
    return sendSuccess(res, stats, 'Verification statistics retrieved successfully');
  } catch (error) {
    logger.error('Get verification stats error:', error);
    next(error);
  }
};

module.exports = {
  verifyRider,
  logVerification,
  createIncident,
  getIncidents,
  updateIncident,
  getVerificationStats
};