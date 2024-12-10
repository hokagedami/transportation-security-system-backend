const pool = require('../../../../shared/database/connection');
const logger = require('../../../../shared/utils/logger');

const generateJacketNumber = async (lgaId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const lgaResult = await client.query('SELECT code FROM lgas WHERE id = $1', [lgaId]);
    if (lgaResult.rows.length === 0) {
      throw new Error('Invalid LGA ID');
    }
    
    const lgaCode = lgaResult.rows[0].code;
    
    const countResult = await client.query(
      'SELECT COUNT(*) FROM riders WHERE lga_id = $1',
      [lgaId]
    );
    
    const count = parseInt(countResult.rows[0].count) + 1;
    const sequentialNumber = count.toString().padStart(5, '0');
    const jacketNumber = `OG-${lgaCode}-${sequentialNumber}`;
    
    await client.query('COMMIT');
    return jacketNumber;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const createRider = async (riderData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const jacketNumber = await generateJacketNumber(riderData.lga_id);
    
    const query = `
      INSERT INTO riders (
        jacket_number, first_name, last_name, phone, email, lga_id,
        vehicle_type, vehicle_plate, address, emergency_contact_name,
        emergency_contact_phone, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const values = [
      jacketNumber,
      riderData.first_name,
      riderData.last_name,
      riderData.phone,
      riderData.email || null,
      riderData.lga_id,
      riderData.vehicle_type,
      riderData.vehicle_plate || null,
      riderData.address || null,
      riderData.emergency_contact_name || null,
      riderData.emergency_contact_phone || null,
      riderData.created_by
    ];
    
    const result = await client.query(query, values);
    
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create rider service error:', error);
    throw error;
  } finally {
    client.release();
  }
};

const getRiders = async (page, limit, filters) => {
  try {
    let query = `
      SELECT r.*, l.name as lga_name, l.code as lga_code
      FROM riders r
      LEFT JOIN lgas l ON r.lga_id = l.id
      WHERE 1=1
    `;
    
    const values = [];
    let valueIndex = 1;
    
    if (filters.lga_id) {
      query += ` AND r.lga_id = $${valueIndex}`;
      values.push(filters.lga_id);
      valueIndex++;
    }
    
    if (filters.status) {
      query += ` AND r.status = $${valueIndex}`;
      values.push(filters.status);
      valueIndex++;
    }
    
    if (filters.vehicle_type) {
      query += ` AND r.vehicle_type = $${valueIndex}`;
      values.push(filters.vehicle_type);
      valueIndex++;
    }
    
    if (filters.search) {
      query += ` AND (
        r.first_name ILIKE $${valueIndex} OR 
        r.last_name ILIKE $${valueIndex} OR 
        r.phone ILIKE $${valueIndex} OR 
        r.jacket_number ILIKE $${valueIndex}
      )`;
      values.push(`%${filters.search}%`);
      valueIndex++;
    }
    
    const countQuery = query.replace('SELECT r.*, l.name as lga_name, l.code as lga_code', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);
    
    const offset = (page - 1) * limit;
    query += ` ORDER BY r.created_at DESC LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    return {
      riders: result.rows,
      total
    };
  } catch (error) {
    logger.error('Get riders service error:', error);
    throw error;
  }
};

const getRiderById = async (id) => {
  try {
    const query = `
      SELECT r.*, l.name as lga_name, l.code as lga_code
      FROM riders r
      LEFT JOIN lgas l ON r.lga_id = l.id
      WHERE r.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Get rider by id service error:', error);
    throw error;
  }
};

const updateRider = async (id, updateData) => {
  try {
    const allowedFields = [
      'first_name', 'last_name', 'phone', 'email', 'vehicle_type',
      'vehicle_plate', 'address', 'emergency_contact_name',
      'emergency_contact_phone', 'status'
    ];
    
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
      const rider = await getRiderById(id);
      return rider;
    }
    
    values.push(id);
    
    const query = `
      UPDATE riders 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${valueIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    return result.rows[0];
  } catch (error) {
    logger.error('Update rider service error:', error);
    throw error;
  }
};

const deleteRider = async (id, deletedBy) => {
  try {
    await pool.query(
      'UPDATE riders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['revoked', id]
    );
    
    logger.info(`Rider ${id} revoked by user ${deletedBy}`);
    return true;
  } catch (error) {
    logger.error('Delete rider service error:', error);
    throw error;
  }
};

const getRiderHistory = async (riderId) => {
  try {
    const queries = {
      registration: pool.query(
        'SELECT * FROM riders WHERE id = $1',
        [riderId]
      ),
      payments: pool.query(
        'SELECT * FROM payments WHERE rider_id = $1 ORDER BY created_at DESC',
        [riderId]
      ),
      jackets: pool.query(
        'SELECT * FROM jackets WHERE rider_id = $1 ORDER BY created_at DESC',
        [riderId]
      ),
      incidents: pool.query(
        'SELECT * FROM incidents WHERE rider_id = $1 ORDER BY created_at DESC',
        [riderId]
      ),
      verifications: pool.query(
        'SELECT * FROM verifications WHERE rider_id = $1 ORDER BY created_at DESC LIMIT 10',
        [riderId]
      )
    };
    
    const results = await Promise.all(Object.values(queries));
    
    return {
      registration: results[0].rows[0],
      payments: results[1].rows,
      jackets: results[2].rows,
      incidents: results[3].rows,
      recent_verifications: results[4].rows
    };
  } catch (error) {
    logger.error('Get rider history service error:', error);
    throw error;
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