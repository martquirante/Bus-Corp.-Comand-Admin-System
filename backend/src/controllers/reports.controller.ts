import type { Request, Response } from "express";
import { reportService } from "../services/report.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

export const reportsController = {
  async getRevenue(_req: Request, res: Response) {
    const report = await reportService.getRevenueReport();
    res.json(envelope(report, firebaseService.source()));
  }
};
