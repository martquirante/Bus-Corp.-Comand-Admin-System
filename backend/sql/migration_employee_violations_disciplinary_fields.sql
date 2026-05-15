-- ============================================================================
-- Migration: Employee Violations disciplinary/action tracking fields
-- Run this in Supabase SQL Editor. Safe to run multiple times.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE INDEX IF NOT EXISTS idx_violations_employee_id ON employee_violations(employee_id);
CREATE INDEX IF NOT EXISTS idx_violations_status ON employee_violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON employee_violations(severity);
CREATE INDEX IF NOT EXISTS idx_violations_violation_date ON employee_violations(violation_date);
CREATE INDEX IF NOT EXISTS idx_violations_penalty_end_date ON employee_violations(penalty_end_date);
