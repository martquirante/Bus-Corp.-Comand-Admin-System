-- ============================================================================
-- Migration: Blockchain Audit Ledger & System Security Auditing
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for safety.
-- ============================================================================

-- Enable uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── blockchain_audit_logs table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blockchain_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_type TEXT NOT NULL,
    record_id TEXT NOT NULL,
    record_hash TEXT NOT NULL,
    previous_hash TEXT,
    blockchain_tx_hash TEXT,
    blockchain_network TEXT,
    blockchain_status TEXT NOT NULL DEFAULT 'pending',
    created_by_id TEXT,
    created_by_role TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_record_hash UNIQUE (record_type, record_id, record_hash)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blockchain_audit_record_type ON public.blockchain_audit_logs(record_type);
CREATE INDEX IF NOT EXISTS idx_blockchain_audit_record_id ON public.blockchain_audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_audit_record_hash ON public.blockchain_audit_logs(record_hash);
CREATE INDEX IF NOT EXISTS idx_blockchain_audit_status ON public.blockchain_audit_logs(blockchain_status);
CREATE INDEX IF NOT EXISTS idx_blockchain_audit_tx_hash ON public.blockchain_audit_logs(blockchain_tx_hash);
CREATE INDEX IF NOT EXISTS idx_blockchain_audit_created_at ON public.blockchain_audit_logs(created_at);

-- ─── system_audit_logs table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_audit_action ON public.system_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_audit_actor_id ON public.system_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_target ON public.system_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_created_at ON public.system_audit_logs(created_at);

-- ─── Add blockchain metadata columns to existing tables ──────────────────
-- We use ALTER TABLE ... ADD COLUMN IF NOT EXISTS for idempotency and safe updates.

-- 1. tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS blockchain_hash TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS blockchain_status TEXT DEFAULT 'pending';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS blockchain_verified_at TIMESTAMP WITH TIME ZONE;

-- 2. payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS blockchain_hash TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS blockchain_status TEXT DEFAULT 'pending';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS blockchain_verified_at TIMESTAMP WITH TIME ZONE;

-- 3. remittances table
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS blockchain_hash TEXT;
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS blockchain_status TEXT DEFAULT 'pending';
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS blockchain_verified_at TIMESTAMP WITH TIME ZONE;

-- 4. employee_violations table
ALTER TABLE public.employee_violations ADD COLUMN IF NOT EXISTS blockchain_hash TEXT;
ALTER TABLE public.employee_violations ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;
ALTER TABLE public.employee_violations ADD COLUMN IF NOT EXISTS blockchain_status TEXT DEFAULT 'pending';
ALTER TABLE public.employee_violations ADD COLUMN IF NOT EXISTS blockchain_verified_at TIMESTAMP WITH TIME ZONE;

-- 5. buses table
ALTER TABLE public.buses ADD COLUMN IF NOT EXISTS blockchain_hash TEXT;
ALTER TABLE public.buses ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;
ALTER TABLE public.buses ADD COLUMN IF NOT EXISTS blockchain_status TEXT DEFAULT 'pending';
ALTER TABLE public.buses ADD COLUMN IF NOT EXISTS blockchain_verified_at TIMESTAMP WITH TIME ZONE;

-- 6. employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS blockchain_hash TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS blockchain_status TEXT DEFAULT 'pending';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS blockchain_verified_at TIMESTAMP WITH TIME ZONE;

-- 7. routes table
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS blockchain_hash TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS blockchain_status TEXT DEFAULT 'pending';
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS blockchain_verified_at TIMESTAMP WITH TIME ZONE;
