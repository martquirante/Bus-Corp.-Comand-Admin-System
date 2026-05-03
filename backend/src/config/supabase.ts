import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

export const supabaseDbUrl = env.SUPABASE_DB_URL || env.DATABASE_URL;

export const hasSupabaseServiceRole = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
export const hasSupabasePostgresUrl = Boolean(supabaseDbUrl);

export const supabaseAdmin: SupabaseClient | null = hasSupabaseServiceRole
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || "", {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export const supabasePool = hasSupabasePostgresUrl
  ? new Pool({
      connectionString: supabaseDbUrl,
      ssl: { rejectUnauthorized: false },
      max: 3
    })
  : null;

export const supabaseMode = () => {
  if (supabaseAdmin) return "service-role";
  if (supabasePool) return "postgres";
  return "not-configured";
};
