import { Router } from "express";
import { isFirebaseReady } from "../config/firebase.js";

export const healthRoutes = Router();

healthRoutes.get("/", (_req, res) => {
  res.json({
    data: {
      status: "ok",
      service: "pos-bus-admin-api",
      firebase: isFirebaseReady ? "connected" : "demo-fallback",
      uptime: process.uptime()
    },
    source: isFirebaseReady ? "firebase" : "demo",
    generatedAt: new Date().toISOString()
  });
});
