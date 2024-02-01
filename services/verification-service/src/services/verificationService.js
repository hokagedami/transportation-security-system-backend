const pool = require('../../shared/database/connection');
const logger = require('../../shared/utils/logger');

const validateJacketNumber = (jacketNumber) => {
  const pattern = /^OG-[A-Z]{3}-\d{5}$/;
  return pattern.test(jacketNumber);
};

const verifyRider = async (jacketNumber, verificationData) => {
  const client = await pool.connect();
  
  try {
    if (!validateJacketNumber(jacketNumber)) {
      await logVerificationAttempt({
        ...verificationData,
        result: 'invalid'
      });
      
      return {
        success: false,
        error_code: 'INVALID_FORMAT',
        error_message: 'Invalid jacket number format'
      };
    }
    
    const query = `
      SELECT r.*, l.name as lga_name, l.code as lga_code
      FROM riders r
      LEFT JOIN lgas l ON r.lga_id = l.id
      WHERE r.jacket_number = $1
    `;
    
    const result = await client.query(query, [jacketNumber]);
    
    if (result.rows.length === 0) {
      await logVerificationAttempt({
        ...verificationData,
        result: 'not_found'
      });
      
      return {
        success: false,
        error_code: 'RIDER_NOT_FOUND',
        error_message: 'Jacket number not found in system'
      };
    }
    
    const rider = result.rows[0];
    
    await logVerificationAttempt({
      ...verificationData,
      rider_id: rider.id,
      result: 'valid'
    });
    
    const responseData = {
      first_name: rider.first_name,
      last_name: rider.last_name,
      lga_name: rider.lga_name,
      vehicle_type: rider.vehicle_type,
      vehicle_plate: rider.vehicle_plate,
      phone: rider.phone,
      status: rider.status,
      registration_date: rider.registration_date
    };
    
    return {
      success: true,
      data: responseData
    };
  } catch (error) {
    logger.error('Verify rider service error:', error);
    throw error;
  } finally {
    client.release();
  }
};

const logVerificationAttempt = async (logData) => {
  try {
    const query = `
      INSERT INTO verifications (
        jacket_number, rider_id, verifier_phone, verification_method,
        location_data, user_agent, ip_address, result
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    const values = [
      logData.jacket_number,
      logData.rider_id || null,
      logData.verifier_phone || null,
      logData.verification_method || 'unknown',
      logData.location_data ? JSON.stringify(logData.location_data) : null,
      logData.user_agent || null,
      logData.ip_address || null,
      logData.result
    ];
    
    await pool.query(query, values);
  } catch (error) {
    logger.error('Log verification attempt error:', error);
  }
};

const createIncident = async (incidentData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    let riderId = null;
    
    if (incidentData.jacket_number) {
      const riderResult = await client.query(
        'SELECT id FROM riders WHERE jacket_number = $1',
        [incidentData.jacket_number]
      );
      
      if (riderResult.rows.length === 0) {
        throw new Error('Rider not found');
      }
      
      riderId = riderResult.rows[0].id;
    }
    
    const referenceNumber = `INC-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    const query = `
      INSERT INTO incidents (
        reference_number, jacket_number, rider_id, reporter_name,
        reporter_phone, incident_type, description, location,
        severity, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const values = [
      referenceNumber,
      incidentData.jacket_number || null,
      riderId,
      incidentData.reporter_name,
      incidentData.reporter_phone,
      incidentData.incident_type,
      incidentData.description,
      incidentData.location || null,
      incidentData.severity || 'medium',
      'open'
    ];
    
    const result = await client.query(query, values);
    
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create incident service error:', error);
    throw error;
  } finally {
    client.release();
  }
};

const getIncidents = async (page, limit, filters) => {
  try {
    let query = `
      SELECT i.*, r.first_name, r.last_name, r.jacket_number as rider_jacket,
             l.name as lga_name, u.first_name || ' ' || u.last_name as assigned_to_name
      FROM incidents i
      LEFT JOIN riders r ON i.rider_id = r.id
      LEFT JOIN lgas l ON r.lga_id = l.id
      LEFT JOIN users u ON i.assigned_to = u.id
      WHERE 1=1
    `;
    
    const values = [];
    let valueIndex = 1;
    
    if (filters.status) {
      query += ` AND i.status = $${valueIndex}`;
      values.push(filters.status);
      valueIndex++;
    }
    
    if (filters.severity) {
      query += ` AND i.severity = $${valueIndex}`;
      values.push(filters.severity);
      valueIndex++;
    }
    
    if (filters.lga_id) {
      query += ` AND r.lga_id = $${valueIndex}`;
      values.push(filters.lga_id);
      valueIndex++;
    }
    
    if (filters.assigned_to) {
      query += ` AND i.assigned_to = $${valueIndex}`;
      values.push(filters.assigned_to);
      valueIndex++;
    }
    
    if (filters.date_range) {
      const dates = filters.date_range.split(',');
      if (dates.length === 2) {
        query += ` AND i.created_at BETWEEN $${valueIndex} AND $${valueIndex + 1}`;
        values.push(dates[0], dates[1]);
        valueIndex += 2;
      }
    }
    
    const countQuery = query.replace(
      'SELECT i.*, r.first_name, r.last_name, r.jacket_number as rider_jacket, l.name as lga_name, u.first_name || \' \' || u.last_name as assigned_to_name',
      'SELECT COUNT(*)'
    );
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);
    
    const offset = (page - 1) * limit;
    query += ` ORDER BY i.created_at DESC LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    return {
      incidents: result.rows,
      total
    };
  } catch (error) {
    logger.error('Get incidents service error:', error);
    throw error;
  }
};

const updateIncident = async (id, updateData) => {
  try {
    const allowedFields = ['status', 'assigned_to', 'resolution_notes', 'severity'];
    
    const updateFields = [];
    const values = [];
    let valueIndex = 1;
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = $${valueIndex}`);
        values.push(updateData[field]);
        valueIndex++;
      }
    }
    
    if (updateFields.length === 0) {
      const incident = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
      return incident.rows[0] || null;
    }
    
    if (updateData.status === 'resolved' || updateData.status === 'closed') {
      updateFields.push(`resolved_at = CURRENT_TIMESTAMP`);
    }
    
    values.push(id);
    
    const query = `
      UPDATE incidents 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${valueIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Update incident service error:', error);
    throw error;
  }
};

const getVerificationStats = async (filters) => {
  try {
    let dateFilter = '';
    const values = [];
    let valueIndex = 1;
    
    if (filters.date_range) {
      const dates = filters.date_range.split(',');
      if (dates.length === 2) {
        dateFilter = ` WHERE created_at BETWEEN $${valueIndex} AND $${valueIndex + 1}`;
        values.push(dates[0], dates[1]);
        valueIndex += 2;
      }
    } else {
      dateFilter = ` WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }
    
    let lgaFilter = '';
    if (filters.lga_id) {
      lgaFilter = valueIndex === 1 
        ? ` WHERE rider_id IN (SELECT id FROM riders WHERE lga_id = $${valueIndex})`
        : ` AND rider_id IN (SELECT id FROM riders WHERE lga_id = $${valueIndex})`;
      values.push(filters.lga_id);
      valueIndex++;
    }
    
    const queries = {
      totalVerifications: `SELECT COUNT(*) as count FROM verifications${dateFilter}${lgaFilter}`,
      successfulVerifications: `SELECT COUNT(*) as count FROM verifications${dateFilter}${lgaFilter} ${valueIndex === 1 ? 'WHERE' : 'AND'} result = 'valid'`,
      verificationsByMethod: `
        SELECT verification_method, COUNT(*) as count 
        FROM verifications${dateFilter}${lgaFilter} 
        GROUP BY verification_method
      `,
      verificationsByHour: `
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
        FROM verifications${dateFilter}${lgaFilter}
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `,
      verificationsByResult: `
        SELECT result, COUNT(*) as count
        FROM verifications${dateFilter}${lgaFilter}
        GROUP BY result
      `,
      topVerifiedRiders: `
        SELECT r.jacket_number, r.first_name, r.last_name, COUNT(v.id) as verification_count
        FROM verifications v
        JOIN riders r ON v.rider_id = r.id
        ${dateFilter}${lgaFilter ? lgaFilter.replace('rider_id IN (SELECT id FROM riders WHERE lga_id', 'r.lga_id') : ''}
        GROUP BY r.id, r.jacket_number, r.first_name, r.last_name
        ORDER BY verification_count DESC
        LIMIT 10
      `
    };
    
    const results = await Promise.all(
      Object.values(queries).map(query => pool.query(query, values))
    );
    
    return {
      total_verifications: parseInt(results[0].rows[0].count),
      successful_verifications: parseInt(results[1].rows[0].count),
      success_rate: results[0].rows[0].count > 0 
        ? ((results[1].rows[0].count / results[0].rows[0].count) * 100).toFixed(2) 
        : 0,
      verifications_by_method: results[2].rows,
      verifications_by_hour: results[3].rows,
      verifications_by_result: results[4].rows,
      top_verified_riders: results[5].rows
    };
  } catch (error) {
    logger.error('Get verification stats service error:', error);
    throw error;
  }
};

module.exports = {
  verifyRider,
  logVerificationAttempt,
  createIncident,
  getIncidents,
  updateIncident,
  getVerificationStats
};