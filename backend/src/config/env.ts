import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  ADMIN_WEB_ORIGIN: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().default("local-development-session-secret"),
  FIREBASE_PROJECT_ID: z.string().default("santranspos"),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_DATABASE_URL: z.string().url().default("https://santranspos-default-rtdb.firebaseio.com"),
  ENABLE_DEMO_FALLBACK: z.coerce.boolean().default(false),
  DEMO_ADMIN_EMAIL: z.string().default("admin@posticketing.com"),
  DEMO_ADMIN_PASSWORD: z.string().default("admin123"),
  SUPABASE_URL: z.string().url().default("https://qortxdtzoeprjzsijtwn.supabase.co"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_DB_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  SQL_SYNC_INTERVAL_MS: z.coerce.number().int().nonnegative().default(60000),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(160)
});

export const env = envSchema.parse(process.env);

export const firebaseCredentialConfig = {
  projectId: env.FIREBASE_PROJECT_ID,
  clientEmail: env.FIREBASE_CLIENT_EMAIL,
  privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  databaseURL: env.FIREBASE_DATABASE_URL
};

export const hasFirebaseCredentials = Boolean(
  firebaseCredentialConfig.projectId &&
    firebaseCredentialConfig.clientEmail &&
    firebaseCredentialConfig.privateKey &&
    firebaseCredentialConfig.databaseURL
);
