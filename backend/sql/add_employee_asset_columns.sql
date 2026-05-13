-- ═══════════════════════════════════════════════════════════
-- ADD ASSET COLUMNS TO EMPLOYEES TABLE
-- ═══════════════════════════════════════════════════════════
-- Run this in Supabase Dashboard → SQL Editor
-- These columns are required for employee photo/signature persistence.
-- The "IF NOT EXISTS" style uses DO blocks to safely skip if already present.

DO $$
BEGIN
  -- photo_url (signed URL cache — optional but used by the app)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'photo_url') THEN
    ALTER TABLE public.employees ADD COLUMN photo_url text;
  END IF;

  -- photo_path (storage path — REQUIRED for photo persistence)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'photo_path') THEN
    ALTER TABLE public.employees ADD COLUMN photo_path text;
  END IF;

  -- signature_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'signature_url') THEN
    ALTER TABLE public.employees ADD COLUMN signature_url text;
  END IF;

  -- signature_path (REQUIRED for signature persistence)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'signature_path') THEN
    ALTER TABLE public.employees ADD COLUMN signature_path text;
  END IF;

  -- id_front_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'id_front_url') THEN
    ALTER TABLE public.employees ADD COLUMN id_front_url text;
  END IF;

  -- id_front_path
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'id_front_path') THEN
    ALTER TABLE public.employees ADD COLUMN id_front_path text;
  END IF;

  -- id_back_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'id_back_url') THEN
    ALTER TABLE public.employees ADD COLUMN id_back_url text;
  END IF;

  -- id_back_path
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'id_back_path') THEN
    ALTER TABLE public.employees ADD COLUMN id_back_path text;
  END IF;

  -- id_pdf_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'id_pdf_url') THEN
    ALTER TABLE public.employees ADD COLUMN id_pdf_url text;
  END IF;

  -- id_pdf_path
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'id_pdf_path') THEN
    ALTER TABLE public.employees ADD COLUMN id_pdf_path text;
  END IF;

  -- qr_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'qr_url') THEN
    ALTER TABLE public.employees ADD COLUMN qr_url text;
  END IF;

  -- qr_path
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'qr_path') THEN
    ALTER TABLE public.employees ADD COLUMN qr_path text;
  END IF;

  -- storage_folder (REQUIRED — where employee assets are stored)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'storage_folder') THEN
    ALTER TABLE public.employees ADD COLUMN storage_folder text;
  END IF;

  -- account_id (link to admin accounts)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'account_id') THEN
    ALTER TABLE public.employees ADD COLUMN account_id text;
  END IF;

  -- assigned_bus
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'assigned_bus') THEN
    ALTER TABLE public.employees ADD COLUMN assigned_bus text;
  END IF;

  -- assigned_route
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'assigned_route') THEN
    ALTER TABLE public.employees ADD COLUMN assigned_route text;
  END IF;

  -- assigned_bus_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'assigned_bus_id') THEN
    ALTER TABLE public.employees ADD COLUMN assigned_bus_id text;
  END IF;

  -- assigned_route_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'assigned_route_id') THEN
    ALTER TABLE public.employees ADD COLUMN assigned_route_id text;
  END IF;

  -- issued_date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'issued_date') THEN
    ALTER TABLE public.employees ADD COLUMN issued_date text;
  END IF;

  -- valid_until
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'valid_until') THEN
    ALTER TABLE public.employees ADD COLUMN valid_until text;
  END IF;
END $$;
