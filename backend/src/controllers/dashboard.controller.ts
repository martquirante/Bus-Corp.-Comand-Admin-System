import type { Request, Response } from "express";
import { dashboardService } from "../services/dashboard.service.js";
import { databaseBridgeService } from "../services/databaseBridge.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

export const dashboardController = {
  async getStats(_req: Request, res: Response) {
    const stats = await dashboardService.getStats();
    res.json(envelope(stats, firebaseService.source()));
  },

  async getSummary(_req: Request, res: Response) {
    const summary = await databaseBridgeService.getDashboard();
    res.json(envelope(summary, firebaseService.source()));
  },

  async getDashboard(_req: Request, res: Response) {
    const summary = await databaseBridgeService.getDashboard();
    res.json(envelope(summary, firebaseService.source()));
  }
};
