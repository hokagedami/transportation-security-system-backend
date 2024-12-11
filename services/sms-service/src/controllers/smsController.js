const smsService = require('../services/smsService');
const { sendSuccess, sendError, sendPaginatedResponse } = require('../../../../shared/utils/responseHelper');
const logger = require('../../../../shared/utils/logger');

const sendVerification = async (req, res, next) => {
  try {
    const { phone, jacket_number, rider_data } = req.body;
    
    const result = await smsService.sendVerificationSMS(phone, jacket_number, rider_data);
    
    logger.info(`Verification SMS sent to ${phone} for jacket ${jacket_number}`);
    return sendSuccess(res, result, 'Verification SMS sent successfully');
  } catch (error) {
    logger.error('Send verification SMS error:', error);
    next(error);
  }
};

const handleWebhook = async (req, res, next) => {
  try {
    const { from, text, messageId, to } = req.body;
    
    const result = await smsService.processIncomingSMS(from, text, messageId, to);
    
    logger.info(`Incoming SMS processed from ${from}: ${text}`);
    
    if (result.response) {
      await smsService.sendSMS(from, result.response, 'auto_response');
    }
    
    return res.status(200).json({ message: 'SMS processed successfully' });
  } catch (error) {
    logger.error('SMS webhook error:', error);
    return res.status(500).json({ message: 'SMS processing failed' });
  }
};

const getLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, phone, date_range, message_type, status } = req.query;
    
    const filters = {
      phone,
      date_range,
      message_type,
      status
    };
    
    const result = await smsService.getSMSLogs(page, limit, filters);
    
    return sendPaginatedResponse(res, result.logs, page, limit, result.total);
  } catch (error) {
    logger.error('Get SMS logs error:', error);
    next(error);
  }
};

const sendNotification = async (req, res, next) => {
  try {
    const { phone, message, message_type } = req.body;
    
    const result = await smsService.sendSMS(phone, message, message_type);
    
    logger.info(`Notification SMS sent to ${phone}: ${message_type}`);
    return sendSuccess(res, result, 'Notification sent successfully');
  } catch (error) {
    logger.error('Send notification error:', error);
    next(error);
  }
};

const sendBulk = async (req, res, next) => {
  try {
    const { recipients, message, message_type } = req.body;
    
    const result = await smsService.sendBulkSMS(recipients, message, message_type);
    
    logger.info(`Bulk SMS sent to ${recipients.length} recipients`);
    return sendSuccess(res, result, 'Bulk SMS sent successfully');
  } catch (error) {
    logger.error('Send bulk SMS error:', error);
    next(error);
  }
};

module.exports = {
  sendVerification,
  handleWebhook,
  getLogs,
  sendNotification,
  sendBulk
};