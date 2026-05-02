import type { Request, Response } from "express";
import { accountPatchSchema, adminAccountSchema } from "@pos-bus/shared";
import { adminService } from "../services/admin.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

export const adminController = {
  async getAccounts(_req: Request, res: Response) {
    const accounts = await adminService.getAccounts();
    res.json(envelope(accounts, firebaseService.source()));
  },

  async createAccount(req: Request, res: Response) {
    const payload = adminAccountSchema.parse(req.body);
    const account = await adminService.createAccount(payload, req.user?.email || "system");
    res.status(201).json(envelope(account, firebaseService.source()));
  },

  async patchAccount(req: Request, res: Response) {
    const payload = accountPatchSchema.parse(req.body);
    const account = await adminService.patchAccount(req.params.id, payload, req.user?.email || "system");
    res.json(envelope(account, firebaseService.source()));
  }
};
