import type { Request, Response } from "express";
import { criticalAlertService } from "../services/criticalAlert.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

const actor = (req: Request) => req.user?.email || req.user?.fullName || "admin";

export const criticalAlertsController = {
  async getAlerts(_req: Request, res: Response) {
    const alerts = await criticalAlertService.getAlerts();
    res.json(envelope(alerts, firebaseService.source()));
  },

  async getActiveAlerts(_req: Request, res: Response) {
    const alerts = await criticalAlertService.getActiveAlerts();
    res.json(envelope(alerts, firebaseService.source()));
  },

  async acknowledge(req: Request, res: Response) {
    const result = await criticalAlertService.acknowledge(req.params.id, actor(req));
    res.json(envelope(result, firebaseService.source()));
  },

  async resolve(req: Request, res: Response) {
    const result = await criticalAlertService.resolve(req.params.id, actor(req));
    res.json(envelope(result, firebaseService.source()));
  },

  async dismiss(req: Request, res: Response) {
    const result = await criticalAlertService.dismiss(req.params.id, actor(req));
    res.json(envelope(result, firebaseService.source()));
  }
};
