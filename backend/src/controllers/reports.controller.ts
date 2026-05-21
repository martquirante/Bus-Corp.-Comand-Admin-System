import type { Request, Response } from "express";
import { reportService } from "../services/report.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { blockchainAuditService } from "../services/blockchainAudit.service.js";
import { envelope } from "../utils/envelope.js";

export const reportsController = {
  async getRevenue(_req: Request, res: Response) {
    const report = await reportService.getRevenueReport();
    res.json(envelope(report, firebaseService.source()));
  },

  async auditReport(req: Request, res: Response) {
    const { reportType, fileHash, dataSummary } = req.body as { reportType: string; fileHash: string; dataSummary: any };
    if (!fileHash) {
      res.status(400).json({ error: { code: "INVALID_REQUEST", message: "fileHash is required." } });
      return;
    }

    const recordId = `rep-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const log = await blockchainAuditService.createAuditRecord(
      "report_export",
      recordId,
      {
        reportType,
        fileHash,
        dataSummary,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.email || "anonymous"
      },
      req.user?.email,
      req.user?.role
    );

    res.json(envelope(log, "supabase"));
  }
};
