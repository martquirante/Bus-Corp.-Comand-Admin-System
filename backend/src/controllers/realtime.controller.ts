import type { Request, Response } from "express";
import { databaseBridgeService } from "../services/databaseBridge.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { criticalAlertService } from "../services/criticalAlert.service.js";
import { envelope } from "../utils/envelope.js";
import { prepareSse, sendSse } from "../utils/sse.js";

const streamIntervalMs = 3000;

export const realtimeController = {
  async streamDashboard(req: Request, res: Response) {
    prepareSse(res);

    let lastPayload = "";
    const sendSummary = async () => {
      const summary = await databaseBridgeService.getDashboard();
      const payload = envelope(summary, firebaseService.source());
      const serialized = JSON.stringify(payload);
      if (serialized !== lastPayload) {
        lastPayload = serialized;
        sendSse(res, "dashboard", payload);
      } else {
        sendSse(res, "heartbeat", { generatedAt: new Date().toISOString() });
      }
    };

    await sendSummary();
    const timer = setInterval(() => void sendSummary().catch((error) => sendSse(res, "error", {
      message: error instanceof Error ? error.message : "Realtime dashboard stream failed."
    })), streamIntervalMs);

    req.on("close", () => clearInterval(timer));
  },

  async streamCriticalAlerts(req: Request, res: Response) {
    prepareSse(res);

    let lastPayload = "";
    const sendAlerts = async () => {
      const alerts = await criticalAlertService.getActiveAlerts();
      const payload = envelope(alerts, firebaseService.source());
      const serialized = JSON.stringify(payload);
      if (serialized !== lastPayload) {
        lastPayload = serialized;
        sendSse(res, "critical-alerts", payload);
      } else {
        sendSse(res, "heartbeat", { generatedAt: new Date().toISOString() });
      }
    };

    await sendAlerts();
    const timer = setInterval(() => void sendAlerts().catch((error) => sendSse(res, "error", {
      message: error instanceof Error ? error.message : "Critical alert stream failed."
    })), streamIntervalMs);

    req.on("close", () => clearInterval(timer));
  }
};
