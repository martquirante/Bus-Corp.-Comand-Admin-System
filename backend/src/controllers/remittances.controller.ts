import type { Request, Response } from "express";
import { remittanceService } from "../services/adminResource.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

const actor = (req: Request) => req.user?.email || req.user?.fullName || "admin";

export const remittancesController = {
  async list(_req: Request, res: Response) {
    res.json(envelope(await remittanceService.list(), firebaseService.source()));
  },

  async create(req: Request, res: Response) {
    res.status(201).json(envelope(await remittanceService.create(req.body, actor(req)), firebaseService.source()));
  },

  async patch(req: Request, res: Response) {
    res.json(envelope(await remittanceService.patch(req.params.id, req.body, actor(req)), firebaseService.source()));
  },

  async receive(req: Request, res: Response) {
    const now = new Date().toISOString();
    const patch = {
      status: "Cleared" as const,
      receivedAt: now,
      cashierId: req.body?.cashierId,
      receivedById: req.body?.cashierId,
      notes: req.body?.notes
    };
    res.json(envelope(await remittanceService.patch(req.params.id, patch, actor(req)), firebaseService.source()));
  },

  async reject(req: Request, res: Response) {
    const patch = {
      status: "Pending" as const,
      notes: req.body?.notes
    };
    res.json(envelope(await remittanceService.patch(req.params.id, patch, actor(req)), firebaseService.source()));
  }
};
