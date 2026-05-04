import { Router } from "express";
import { isFirebaseReady } from "../config/firebase.js";
import { authModeLabel, env } from "../config/env.js";
import { firebaseService } from "../services/firebase.service.js";
import { supabaseService } from "../services/supabase.service.js";

export const healthRoutes = Router();

healthRoutes.get("/", async (_req, res) => {
  const source = firebaseService.source();
  const supabase = await supabaseService.status();
  res.json({
    data: {
      status: "ok",
      service: "pos-bus-admin-api",
      firebase: isFirebaseReady ? "connected" : env.FIREBASE_DATABASE_URL ? "rtdb-rest" : "not-configured",
      supabase: supabase.status,
      supabaseMode: supabase.mode,
      auth: authModeLabel(),
      currentMode: "firebase-live-supabase-structured",
      uptime: process.uptime()
    },
    source,
    generatedAt: new Date().toISOString()
  });
});
