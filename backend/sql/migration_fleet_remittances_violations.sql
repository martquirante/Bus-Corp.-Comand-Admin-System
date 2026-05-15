-- ============================================================================
-- Migration: Fleet + Remittances + Violations optional column additions
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for safety.
-- ============================================================================

-- Enable uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── buses table: add missing optional columns ────────────────────────────
ALTER TABLE buses ADD COLUMN IF NOT EXISTS route_line         VARCHAR(255);
ALTER TABLE buses ADD COLUMN IF NOT EXISTS assigned_driver_name   VARCHAR(255);
ALTER TABLE buses ADD COLUMN IF NOT EXISTS assigned_conductor_name VARCHAR(255);
ALTER TABLE buses ADD COLUMN IF NOT EXISTS next_maintenance_at  TIMESTAMP WITH TIME ZONE;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS photo_path          TEXT;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS notes               TEXT;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS last_maintenance_at  TIMESTAMP WITH TIME ZONE;

-- ─── remittances table: add optional columns (your base table already exists) ─
ALTER TABLE remittances ADD COLUMN IF NOT EXISTS bus_id          UUID REFERENCES buses(id);
ALTER TABLE remittances ADD COLUMN IF NOT EXISTS route_id        UUID;
ALTER TABLE remittances ADD COLUMN IF NOT EXISTS ticket_count    INTEGER DEFAULT 0;
ALTER TABLE remittances ADD COLUMN IF NOT EXISTS submitted_at    TIMESTAMP WITH TIME ZONE;
ALTER TABLE remittances ADD COLUMN IF NOT EXISTS received_at     TIMESTAMP WITH TIME ZONE;
ALTER TABLE remittances ADD COLUMN IF NOT EXISTS proof_image_url TEXT;
ALTER TABLE remittances ADD COLUMN IF NOT EXISTS proof_image_path TEXT;
ALTER TABLE remittances ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ─── employee_violations table: add optional columns ─────────────────────
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'minor';
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS penalty_type VARCHAR(100);
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS penalty_details TEXT;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS suspension_days INTEGER DEFAULT 0;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS salary_deduction_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS deduction_reason TEXT;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS penalty_start_date DATE;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS penalty_end_date DATE;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS evidence_notes TEXT;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS bus_id UUID REFERENCES buses(id);
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS route_id UUID;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS remittance_id UUID REFERENCES remittances(id);
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS incident_time TIME;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS employee_number TEXT;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS employee_role TEXT;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS bus_number TEXT;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS route_name TEXT;
ALTER TABLE employee_violations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE employee_violations
SET penalty_type = penalty
WHERE (penalty_type IS NULL OR penalty_type = '')
  AND penalty IS NOT NULL
  AND penalty <> '';

-- ─── Indexes for performance ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_remittances_conductor_id   ON remittances(conductor_id);
CREATE INDEX IF NOT EXISTS idx_remittances_shift_date     ON remittances(shift_date);
CREATE INDEX IF NOT EXISTS idx_remittances_status         ON remittances(status);
CREATE INDEX IF NOT EXISTS idx_violations_employee_id     ON employee_violations(employee_id);
CREATE INDEX IF NOT EXISTS idx_violations_status          ON employee_violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_violation_date  ON employee_violations(violation_date);
CREATE INDEX IF NOT EXISTS idx_violations_severity        ON employee_violations(severity);
CREATE INDEX IF NOT EXISTS idx_violations_penalty_end     ON employee_violations(penalty_end_date);
