import type { Request, Response } from "express";
import { firebasePaths } from "@pos-bus/shared";
import { firebaseService } from "../services/firebase.service.js";
import { realtimeDbService } from "../services/realtimeDb.service.js";
import { envelope } from "../utils/envelope.js";

export const expensesController = {
  async list(_req: Request, res: Response) {
    res.json(envelope((await realtimeDbService.getPath(firebasePaths.expenses)) || {}, firebaseService.source()));
  },

  async create(req: Request, res: Response) {
    const payload = {
      ...req.body,
      createdAt: Date.now(),
      createdBy: req.user?.email || "admin"
    };
    const result = await realtimeDbService.pushPath(firebasePaths.expenses, payload);
    res.status(201).json(envelope({ ...result.value, id: result.key }, firebaseService.source()));
  },

  async patch(req: Request, res: Response) {
    await realtimeDbService.updatePath(`${firebasePaths.expenses}/${req.params.id}`, {
      ...req.body,
      updatedAt: Date.now(),
      updatedBy: req.user?.email || "admin"
    });
    res.json(envelope({ id: req.params.id, ...req.body }, firebaseService.source()));
  }
};
