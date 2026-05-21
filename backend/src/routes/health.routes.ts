import { Router } from "express";
import { isFirebaseReady } from "../config/firebase.js";
import { authModeLabel, env } from "../config/env.js";
import { firebaseService } from "../services/firebase.service.js";
import { supabaseService } from "../services/supabase.service.js";

export const healthRoutes = Router();

healthRoutes.get("/", async (_req, res) => {
  try {
    let source = "demo";
    try {
      source = firebaseService.source();
    } catch (e) {}

    let supabaseStatus = "not-configured";
    let supabaseModeVal = "not-configured";
    try {
      const supabase = await supabaseService.status();
      supabaseStatus = supabase.status;
      supabaseModeVal = supabase.mode;
    } catch (e) {
      supabaseStatus = "error";
    }

    if (supabaseStatus === "not-configured") {
      supabaseStatus = "needs_backend_env";
    }

    const firebaseStatus = isFirebaseReady 
      ? "connected" 
      : env.FIREBASE_DATABASE_URL 
        ? "rtdb-rest" 
        : "not-configured";

    const data = {
      status: "ok",
      service: "pos-bus-admin-api",
      firebase: firebaseStatus,
      supabase: supabaseStatus,
      supabaseMode: supabaseModeVal,
      auth: authModeLabel(),
      currentMode: "firebase-live-supabase-structured",
      uptime: process.uptime()
    };

    res.json({
      ok: true,
      api: "available",
      firebase: firebaseStatus === "connected" || firebaseStatus === "rtdb-rest" ? "available" : "not-configured",
      supabase: supabaseStatus,
      auth: authModeLabel(),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      data,
      source,
      generatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    res.json({
      ok: true,
      api: "available",
      firebase: "unknown",
      supabase: "error",
      auth: "unknown",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: err.message
    });
  }
});
