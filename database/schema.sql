-- TSS Database Schema
-- ==================

-- Create database if not exists
-- CREATE DATABASE tss_db;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS verifications CASCADE;
DROP TABLE IF EXISTS sms_logs CASCADE;
DROP TABLE IF EXISTS jackets CASCADE;
DROP TABLE IF EXISTS production_batches CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS riders CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS lgas CASCADE;

-- LGAs table
CREATE TABLE lgas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(3) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'admin', 'lga_admin', 'finance_officer', 'field_officer', 'viewer')),
    lga_id INTEGER REFERENCES lgas(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    refresh_token VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Riders table
CREATE TABLE riders (
    id SERIAL PRIMARY KEY,
    jacket_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    lga_id INTEGER NOT NULL REFERENCES lgas(id),
    vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('motorcycle', 'tricycle')),
    vehicle_plate VARCHAR(20),
    address TEXT,
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    photo_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
    registration_date DATE DEFAULT CURRENT_DATE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_riders_jacket_number (jacket_number),
    INDEX idx_riders_lga_id (lga_id),
    INDEX idx_riders_status (status),
    INDEX idx_riders_phone (phone)
);

-- Payments table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(100) UNIQUE NOT NULL,
    rider_id INTEGER NOT NULL REFERENCES riders(id),
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(50) NOT NULL CHECK (method IN ('paystack', 'flutterwave', 'bank_transfer', 'pos', 'cash', 'mobile_money')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    gateway_response JSON,
    verified_by INTEGER REFERENCES users(id),
    verified_at TIMESTAMP,
    verification_notes TEXT,
    email VARCHAR(255),
    phone VARCHAR(20),
    name VARCHAR(200),
    lga_id INTEGER REFERENCES lgas(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_payments_reference (reference),
    INDEX idx_payments_rider_id (rider_id),
    INDEX idx_payments_status (status)
);

-- Production batches table
CREATE TABLE production_batches (
    id SERIAL PRIMARY KEY,
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    lga_id INTEGER REFERENCES lgas(id),
    quantity INTEGER NOT NULL,
    supplier_info JSON,
    cost_per_unit DECIMAL(10, 2),
    total_cost DECIMAL(12, 2),
    production_start_date DATE,
    production_end_date DATE,
    quality_check_date DATE,
    quality_check_by INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_production', 'quality_check', 'completed', 'cancelled')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jackets table
CREATE TABLE jackets (
    id SERIAL PRIMARY KEY,
    jacket_number VARCHAR(20) UNIQUE NOT NULL,
    rider_id INTEGER REFERENCES riders(id),
    production_batch_id INTEGER REFERENCES production_batches(id),
    payment_reference VARCHAR(100) REFERENCES payments(reference),
    lga_id INTEGER NOT NULL REFERENCES lgas(id),
    status VARCHAR(20) DEFAULT 'ordered' CHECK (status IN ('ordered', 'produced', 'quality_checked', 'distributed', 'lost', 'damaged', 'returned')),
    distributed_by INTEGER REFERENCES users(id),
    distribution_date DATE,
    rider_confirmation BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_jackets_jacket_number (jacket_number),
    INDEX idx_jackets_rider_id (rider_id),
    INDEX idx_jackets_status (status)
);

-- SMS logs table
CREATE TABLE sms_logs (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(50),
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    status VARCHAR(20) CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    gateway_response JSON,
    cost DECIMAL(8, 2),
    rider_id INTEGER REFERENCES riders(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sms_logs_phone (phone),
    INDEX idx_sms_logs_created_at (created_at)
);

-- Verifications table
CREATE TABLE verifications (
    id SERIAL PRIMARY KEY,
    jacket_number VARCHAR(20),
    rider_id INTEGER REFERENCES riders(id),
    verifier_phone VARCHAR(20),
    verification_method VARCHAR(50) CHECK (verification_method IN ('sms', 'web', 'mobile_app', 'api')),
    location_data JSON,
    user_agent TEXT,
    ip_address VARCHAR(45),
    result VARCHAR(20) CHECK (result IN ('valid', 'invalid', 'not_found')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_verifications_jacket_number (jacket_number),
    INDEX idx_verifications_created_at (created_at)
);

-- Incidents table
CREATE TABLE incidents (
    id SERIAL PRIMARY KEY,
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    jacket_number VARCHAR(20),
    rider_id INTEGER REFERENCES riders(id),
    reporter_name VARCHAR(200),
    reporter_phone VARCHAR(20) NOT NULL,
    incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN ('misconduct', 'accident', 'theft', 'fraud', 'complaint', 'lost_jacket', 'other')),
    description TEXT NOT NULL,
    location TEXT,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed', 'escalated')),
    assigned_to INTEGER REFERENCES users(id),
    resolution_notes TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_incidents_reference_number (reference_number),
    INDEX idx_incidents_rider_id (rider_id),
    INDEX idx_incidents_status (status)
);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create update triggers for all tables
CREATE TRIGGER update_lgas_updated_at BEFORE UPDATE ON lgas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_riders_updated_at BEFORE UPDATE ON riders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_batches_updated_at BEFORE UPDATE ON production_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jackets_updated_at BEFORE UPDATE ON jackets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial LGA data
INSERT INTO lgas (name, code) VALUES
('Abeokuta North', 'ABN'),
('Abeokuta South', 'ABS'),
('Ado-Odo/Ota', 'ADO'),
('Ewekoro', 'EWK'),
('Ifo', 'IFO'),
('Ijebu East', 'IJE'),
('Ijebu North', 'IJN'),
('Ijebu North East', 'INE'),
('Ijebu Ode', 'IJO'),
('Ikenne', 'IKN'),
('Imeko Afon', 'IMA'),
('Ipokia', 'IPK'),
('Obafemi Owode', 'OBO'),
('Odeda', 'ODD'),
('Odogbolu', 'ODG'),
('Ogun Waterside', 'OGW'),
('Remo North', 'RMN'),
('Sagamu', 'SGM'),
('Yewa North', 'YWN'),
('Yewa South', 'YWS');

-- Insert default super admin user (password: admin123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role) VALUES
('admin', 'admin@ogunstate.gov.ng', '$2a$10$YourHashedPasswordHere', 'System', 'Administrator', 'super_admin');