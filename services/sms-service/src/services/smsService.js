const pool = require('../../shared/database/connection');
const logger = require('../../shared/utils/logger');
const axios = require('axios');

const SMS_TEMPLATES = {
  verification: (data) => `OGUN TRANSPORT VERIFICATION
${data.first_name} ${data.last_name}
LGA: ${data.lga_name}
Vehicle: ${data.vehicle_type}
Status: ${data.status}
Valid Rider ✓
Report issues: SMS REPORT ${data.jacket_number}`,

  payment_confirmation: (data) => `Payment of ₦${data.amount} confirmed for jacket ${data.jacket_number}. Your jacket will be ready in 5-7 working days. Collect at ${data.lga_name} office.`,

  incident_received: (data) => `Incident report #${data.report_id} received for jacket ${data.jacket_number}. We will investigate and respond within 24 hours.`,

  invalid_jacket: (data) => `Jacket ${data.jacket_number} not found. Please verify number. Report suspicious activity: Call 080-OGUN-HELP`,

  help: () => `OGUN TRANSPORT HELP
Commands:
VERIFY [jacket_number] - Check rider
REPORT [jacket_number] [description] - Report incident
STATUS [jacket_number] - Check status
Help: 080-OGUN-HELP`
};

const sendSMS = async (phone, message, messageType = 'general', riderId = null) => {
  try {
    const smsData = {
      to: phone,
      from: process.env.TERMII_SENDER_ID || 'OGUN-TRANS',
      sms: message,
      type: 'plain',
      channel: 'generic',
      api_key: process.env.TERMII_API_KEY
    };

    const response = await axios.post('https://api.ng.termii.com/api/sms/send', smsData);
    
    const logData = {
      phone,
      message,
      message_type: messageType,
      direction: 'outbound',
      status: response.data.code === 'ok' ? 'sent' : 'failed',
      gateway_response: JSON.stringify(response.data),
      cost: calculateSMSCost(message),
      rider_id: riderId
    };
    
    await logSMS(logData);
    
    return {
      success: response.data.code === 'ok',
      message_id: response.data.message_id,
      status: logData.status
    };
  } catch (error) {
    logger.error('Send SMS error:', error);
    
    await logSMS({
      phone,
      message,
      message_type: messageType,
      direction: 'outbound',
      status: 'failed',
      gateway_response: JSON.stringify({ error: error.message }),
      cost: 0,
      rider_id: riderId
    });
    
    throw error;
  }
};

const sendVerificationSMS = async (phone, jacketNumber, riderData) => {
  const message = SMS_TEMPLATES.verification(riderData);
  return await sendSMS(phone, message, 'verification', riderData.rider_id);
};

const processIncomingSMS = async (from, text, messageId, to) => {
  try {
    await logSMS({
      phone: from,
      message: text,
      message_type: 'incoming',
      direction: 'inbound',
      status: 'received',
      gateway_response: JSON.stringify({ message_id: messageId })
    });
    
    const command = text.trim().toUpperCase();
    const parts = command.split(' ');
    const action = parts[0];
    
    if (action === 'VERIFY' && parts.length >= 2) {
      const jacketNumber = parts[1];
      const riderData = await getRiderByJacketNumber(jacketNumber);
      
      if (riderData) {
        const response = SMS_TEMPLATES.verification(riderData);
        return { response };
      } else {
        const response = SMS_TEMPLATES.invalid_jacket({ jacket_number: jacketNumber });
        return { response };
      }
    }
    
    if (action === 'REPORT' && parts.length >= 3) {
      const jacketNumber = parts[1];
      const description = parts.slice(2).join(' ');
      
      const incident = await createIncidentReport(jacketNumber, from, description);
      
      if (incident) {
        const response = SMS_TEMPLATES.incident_received({
          report_id: incident.reference_number,
          jacket_number: jacketNumber
        });
        return { response };
      }
    }
    
    if (action === 'STATUS' && parts.length >= 2) {
      const jacketNumber = parts[1];
      const riderData = await getRiderByJacketNumber(jacketNumber);
      
      if (riderData) {
        const response = `Jacket ${jacketNumber} Status: ${riderData.status.toUpperCase()}`;
        return { response };
      } else {
        const response = SMS_TEMPLATES.invalid_jacket({ jacket_number: jacketNumber });
        return { response };
      }
    }
    
    if (action === 'HELP') {
      const response = SMS_TEMPLATES.help();
      return { response };
    }
    
    const response = `Command not recognized. ${SMS_TEMPLATES.help()}`;
    return { response };
    
  } catch (error) {
    logger.error('Process incoming SMS error:', error);
    return { response: 'Service temporarily unavailable. Please try again later.' };
  }
};

const getRiderByJacketNumber = async (jacketNumber) => {
  try {
    const query = `
      SELECT r.*, l.name as lga_name
      FROM riders r
      LEFT JOIN lgas l ON r.lga_id = l.id
      WHERE r.jacket_number = $1
    `;
    
    const result = await pool.query(query, [jacketNumber]);
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Get rider by jacket number error:', error);
    return null;
  }
};

const createIncidentReport = async (jacketNumber, reporterPhone, description) => {
  try {
    const riderResult = await pool.query(
      'SELECT id FROM riders WHERE jacket_number = $1',
      [jacketNumber]
    );
    
    if (riderResult.rows.length === 0) {
      return null;
    }
    
    const riderId = riderResult.rows[0].id;
    const referenceNumber = `INC-${Date.now()}`;
    
    const query = `
      INSERT INTO incidents (
        reference_number, jacket_number, rider_id, reporter_phone,
        incident_type, description, severity, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      referenceNumber,
      jacketNumber,
      riderId,
      reporterPhone,
      'other',
      description,
      'medium',
      'open'
    ];
    
    const result = await pool.query(query, values);
    
    return result.rows[0];
  } catch (error) {
    logger.error('Create incident report error:', error);
    return null;
  }
};

const logSMS = async (logData) => {
  try {
    const query = `
      INSERT INTO sms_logs (
        phone, message, message_type, direction, status,
        gateway_response, cost, rider_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    const values = [
      logData.phone,
      logData.message,
      logData.message_type,
      logData.direction,
      logData.status,
      logData.gateway_response,
      logData.cost || 0,
      logData.rider_id || null
    ];
    
    await pool.query(query, values);
  } catch (error) {
    logger.error('Log SMS error:', error);
  }
};

const calculateSMSCost = (message) => {
  const length = message.length;
  const pages = Math.ceil(length / 160);
  const costPerPage = 4.0;
  return pages * costPerPage;
};

const getSMSLogs = async (page, limit, filters) => {
  try {
    let query = `
      SELECT sl.*, r.jacket_number, r.first_name, r.last_name
      FROM sms_logs sl
      LEFT JOIN riders r ON sl.rider_id = r.id
      WHERE 1=1
    `;
    
    const values = [];
    let valueIndex = 1;
    
    if (filters.phone) {
      query += ` AND sl.phone = $${valueIndex}`;
      values.push(filters.phone);
      valueIndex++;
    }
    
    if (filters.message_type) {
      query += ` AND sl.message_type = $${valueIndex}`;
      values.push(filters.message_type);
      valueIndex++;
    }
    
    if (filters.status) {
      query += ` AND sl.status = $${valueIndex}`;
      values.push(filters.status);
      valueIndex++;
    }
    
    if (filters.date_range) {
      const dates = filters.date_range.split(',');
      if (dates.length === 2) {
        query += ` AND sl.created_at BETWEEN $${valueIndex} AND $${valueIndex + 1}`;
        values.push(dates[0], dates[1]);
        valueIndex += 2;
      }
    }
    
    const countQuery = query.replace(
      'SELECT sl.*, r.jacket_number, r.first_name, r.last_name',
      'SELECT COUNT(*)'
    );
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);
    
    const offset = (page - 1) * limit;
    query += ` ORDER BY sl.created_at DESC LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    return {
      logs: result.rows,
      total
    };
  } catch (error) {
    logger.error('Get SMS logs service error:', error);
    throw error;
  }
};

const sendBulkSMS = async (recipients, message, messageType) => {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const result = await sendSMS(recipient, message, messageType);
      results.push({
        phone: recipient,
        success: result.success,
        message_id: result.message_id
      });
    } catch (error) {
      results.push({
        phone: recipient,
        success: false,
        error: error.message
      });
    }
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  return {
    total: results.length,
    successful,
    failed,
    results
  };
};

module.exports = {
  sendSMS,
  sendVerificationSMS,
  processIncomingSMS,
  getSMSLogs,
  sendBulkSMS
};