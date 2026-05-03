import type { Request, Response } from "express";
import { firebaseService } from "../services/firebase.service.js";
import { sqlSyncService } from "../services/sqlSync.service.js";
import { envelope } from "../utils/envelope.js";

export const syncController = {
  async getStatus(_req: Request, res: Response) {
    res.json(envelope(await sqlSyncService.status(), firebaseService.source()));
  },

  async syncRealtimeToSql(req: Request, res: Response) {
    const result = await sqlSyncService.syncRealtimeSnapshot(req.user?.email || "system");
    res.json(envelope(result, firebaseService.source()));
  },

  async syncFirebaseToSupabase(req: Request, res: Response) {
    const result = await sqlSyncService.syncFirebaseToSupabase(req.user?.email || "system");
    res.json(envelope(result, firebaseService.source()));
  }
};
