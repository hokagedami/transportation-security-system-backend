#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tss_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initializeDatabase() {
  try {
    console.log('🚀 Starting database initialization...');
    
    // Read and execute schema file
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Creating database schema...');
    await pool.query(schema);
    
    // Insert sample LGAs
    console.log('🏢 Inserting sample LGA data...');
    const lgaData = [
      ['Abeokuta North', 'ABN'],
      ['Abeokuta South', 'ABS'],
      ['Ado-Odo/Ota', 'ADO'],
      ['Ewekoro', 'EWE'],
      ['Ifo', 'IFO'],
      ['Ijebu East', 'IJE'],
      ['Ijebu North', 'IJN'],
      ['Ijebu North East', 'INE'],
      ['Ijebu Ode', 'IJO'],
      ['Ikenne', 'IKE'],
      ['Imeko Afon', 'IMA'],
      ['Ipokia', 'IPO'],
      ['Obafemi Owode', 'OBO'],
      ['Odeda', 'ODE'],
      ['Odogbolu', 'ODO'],
      ['Ogun Waterside', 'OGW'],
      ['Remo North', 'REN'],
      ['Sagamu', 'SAG'],
      ['Yewa North', 'YEN'],
      ['Yewa South', 'YES']
    ];
    
    for (const [name, code] of lgaData) {
      await pool.query(
        'INSERT INTO lgas (name, code) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [name, code]
      );
    }
    
    // Create admin user
    console.log('👤 Creating admin user...');
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    
    await pool.query(`
      INSERT INTO users (username, email, password_hash, first_name, last_name, role, lga_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'admin',
      'admin@tss.gov.ng',
      adminPasswordHash,
      'System',
      'Administrator',
      'super_admin',
      1
    ]);
    
    // Create test users for each role
    console.log('👥 Creating test users...');
    const testUsers = [
      ['lga_admin', 'lga@tss.gov.ng', 'LGA', 'Administrator', 'lga_admin', 2],
      ['finance', 'finance@tss.gov.ng', 'Finance', 'Officer', 'finance_officer', 1],
      ['field', 'field@tss.gov.ng', 'Field', 'Officer', 'field_officer', 3],
      ['viewer', 'viewer@tss.gov.ng', 'Read Only', 'User', 'viewer', 1]
    ];
    
    for (const [username, email, firstName, lastName, role, lgaId] of testUsers) {
      const passwordHash = await bcrypt.hash('password123', 10);
      await pool.query(`
        INSERT INTO users (username, email, password_hash, first_name, last_name, role, lga_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (username) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          updated_at = CURRENT_TIMESTAMP
      `, [username, email, passwordHash, firstName, lastName, role, lgaId]);
    }
    
    // Create additional tables if they exist in schema
    console.log('📊 Creating additional tables...');
    
    // Check if we need to create riders table
    const ridersTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'riders'
      );
    `);
    
    if (!ridersTableExists.rows[0].exists) {
      await pool.query(`
        CREATE TABLE riders (
          id SERIAL PRIMARY KEY,
          rider_id VARCHAR(20) NOT NULL UNIQUE,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          phone VARCHAR(20) NOT NULL,
          email VARCHAR(255),
          address TEXT,
          lga_id INTEGER REFERENCES lgas(id),
          status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    
    // Verify data
    console.log('✅ Verifying database setup...');
    const lgaCount = await pool.query('SELECT COUNT(*) FROM lgas');
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    
    console.log(`📈 Database initialized successfully!`);
    console.log(`   • LGAs: ${lgaCount.rows[0].count}`);
    console.log(`   • Users: ${userCount.rows[0].count}`);
    console.log('');
    console.log('🔐 Login credentials:');
    console.log('   • Username: admin | Password: admin123 (Super Admin)');
    console.log('   • Username: lga_admin | Password: password123 (LGA Admin)');
    console.log('   • Username: finance | Password: password123 (Finance Officer)');
    console.log('   • Username: field | Password: password123 (Field Officer)');
    console.log('   • Username: viewer | Password: password123 (Viewer)');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check if database is accessible
async function waitForDatabase(maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('🔗 Database connection established');
      return;
    } catch (error) {
      console.log(`⏳ Waiting for database... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Could not connect to database after maximum retries');
}

// Main execution
async function main() {
  try {
    await waitForDatabase();
    await initializeDatabase();
  } catch (error) {
    console.error('💥 Initialization failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { initializeDatabase, waitForDatabase };