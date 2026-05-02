import type { Request, Response } from "express";
import { dashboardService } from "../services/dashboard.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

export const dashboardController = {
  async getStats(_req: Request, res: Response) {
    const stats = await dashboardService.getStats();
    res.json(envelope(stats, firebaseService.source()));
  }
};
