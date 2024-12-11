const pool = require('../../../../shared/database/connection');
const logger = require('../../../../shared/utils/logger');

const createOrder = async (orderData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const paymentCheck = await client.query(
      'SELECT status FROM payments WHERE reference = $1 AND rider_id = $2',
      [orderData.payment_reference, orderData.rider_id]
    );
    
    if (paymentCheck.rows.length === 0 || paymentCheck.rows[0].status !== 'completed') {
      throw new Error('Payment not completed');
    }
    
    const riderResult = await client.query(
      'SELECT jacket_number FROM riders WHERE id = $1',
      [orderData.rider_id]
    );
    
    if (riderResult.rows.length === 0) {
      throw new Error('Rider not found');
    }
    
    const jacketNumber = riderResult.rows[0].jacket_number;
    
    const query = `
      INSERT INTO jackets (
        jacket_number, rider_id, production_batch_id, payment_reference,
        lga_id, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      jacketNumber,
      orderData.rider_id,
      orderData.production_batch_id || null,
      orderData.payment_reference,
      orderData.lga_id,
      'ordered',
      orderData.notes || null
    ];
    
    const result = await client.query(query, values);
    
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create jacket order service error:', error);
    throw error;
  } finally {
    client.release();
  }
};

const getJackets = async (page, limit, filters) => {
  try {
    let query = `
      SELECT j.*, r.first_name, r.last_name, r.phone as rider_phone,
             l.name as lga_name, pb.batch_number
      FROM jackets j
      LEFT JOIN riders r ON j.rider_id = r.id
      LEFT JOIN lgas l ON j.lga_id = l.id
      LEFT JOIN production_batches pb ON j.production_batch_id = pb.id
      WHERE 1=1
    `;
    
    const values = [];
    let valueIndex = 1;
    
    if (filters.status) {
      query += ` AND j.status = $${valueIndex}`;
      values.push(filters.status);
      valueIndex++;
    }
    
    if (filters.lga_id) {
      query += ` AND j.lga_id = $${valueIndex}`;
      values.push(filters.lga_id);
      valueIndex++;
    }
    
    if (filters.production_batch) {
      query += ` AND j.production_batch_id = $${valueIndex}`;
      values.push(filters.production_batch);
      valueIndex++;
    }
    
    const countQuery = query.replace(
      'SELECT j.*, r.first_name, r.last_name, r.phone as rider_phone, l.name as lga_name, pb.batch_number',
      'SELECT COUNT(*)'
    );
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);
    
    const offset = (page - 1) * limit;
    query += ` ORDER BY j.created_at DESC LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    return {
      jackets: result.rows,
      total
    };
  } catch (error) {
    logger.error('Get jackets service error:', error);
    throw error;
  }
};

const updateStatus = async (id, status, notes, userId) => {
  try {
    const query = `
      UPDATE jackets 
      SET status = $1, notes = COALESCE(notes || E'\\n' || $2, $2), 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [status, notes || '', id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    logger.info(`Jacket ${id} status updated to ${status} by user ${userId}`);
    
    return result.rows[0];
  } catch (error) {
    logger.error('Update jacket status service error:', error);
    throw error;
  }
};

const createBatch = async (batchData) => {
  try {
    const lgaResult = await pool.query('SELECT code FROM lgas WHERE id = $1', [batchData.lga_id]);
    if (lgaResult.rows.length === 0) {
      throw new Error('Invalid LGA ID');
    }
    
    const lgaCode = lgaResult.rows[0].code;
    const year = new Date().getFullYear();
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM production_batches WHERE EXTRACT(YEAR FROM created_at) = $1',
      [year]
    );
    
    const sequence = (parseInt(countResult.rows[0].count) + 1).toString().padStart(3, '0');
    const batchNumber = `BATCH-${year}-${lgaCode}-${sequence}`;
    
    const query = `
      INSERT INTO production_batches (
        batch_number, lga_id, quantity, supplier_info, cost_per_unit,
        total_cost, production_start_date, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      batchNumber,
      batchData.lga_id,
      batchData.quantity,
      JSON.stringify(batchData.supplier_info || {}),
      batchData.cost_per_unit,
      batchData.cost_per_unit * batchData.quantity,
      batchData.production_start_date,
      batchData.notes || null,
      batchData.created_by
    ];
    
    const result = await pool.query(query, values);
    
    return result.rows[0];
  } catch (error) {
    logger.error('Create batch service error:', error);
    throw error;
  }
};

const getBatch = async (batchId) => {
  try {
    const batchQuery = `
      SELECT pb.*, l.name as lga_name, 
             u.first_name || ' ' || u.last_name as created_by_name
      FROM production_batches pb
      LEFT JOIN lgas l ON pb.lga_id = l.id
      LEFT JOIN users u ON pb.created_by = u.id
      WHERE pb.id = $1
    `;
    
    const jacketsQuery = `
      SELECT j.*, r.first_name, r.last_name, r.phone as rider_phone
      FROM jackets j
      LEFT JOIN riders r ON j.rider_id = r.id
      WHERE j.production_batch_id = $1
      ORDER BY j.jacket_number
    `;
    
    const [batchResult, jacketsResult] = await Promise.all([
      pool.query(batchQuery, [batchId]),
      pool.query(jacketsQuery, [batchId])
    ]);
    
    if (batchResult.rows.length === 0) {
      return null;
    }
    
    const batch = batchResult.rows[0];
    batch.jackets = jacketsResult.rows;
    
    return batch;
  } catch (error) {
    logger.error('Get batch service error:', error);
    throw error;
  }
};

const distribute = async (id, distributionData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const jacketResult = await client.query(
      'SELECT * FROM jackets WHERE id = $1',
      [id]
    );
    
    if (jacketResult.rows.length === 0) {
      return null;
    }
    
    const jacket = jacketResult.rows[0];
    
    if (jacket.status !== 'quality_checked') {
      throw new Error('Jacket not ready for distribution');
    }
    
    const query = `
      UPDATE jackets 
      SET status = 'distributed', 
          distributed_by = $1,
          distribution_date = $2,
          rider_confirmation = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    
    const values = [
      distributionData.distributed_by,
      distributionData.distribution_date || new Date(),
      distributionData.rider_confirmation || false,
      id
    ];
    
    const result = await client.query(query, values);
    
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Distribute jacket service error:', error);
    throw error;
  } finally {
    client.release();
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