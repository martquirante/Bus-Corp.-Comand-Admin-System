import type { Request, Response } from "express";
import { violationService } from "../services/adminResource.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

const actor = (req: Request) => req.user?.email || req.user?.fullName || "admin";

export const employeeViolationsController = {
  async list(req: Request, res: Response) {
    const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json(envelope(await violationService.list(employeeId, status), firebaseService.source()));
  },

  async listForEmployee(req: Request, res: Response) {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json(envelope(await violationService.list(req.params.employeeId, status), firebaseService.source()));
  },

  async create(req: Request, res: Response) {
    res.status(201).json(envelope(await violationService.create(req.body, actor(req)), firebaseService.source()));
  },

  async patchStatus(req: Request, res: Response) {
    const { status, resolutionNotes } = req.body || {};
    res.json(envelope(
      await violationService.patch(req.params.id, { status, resolutionNotes }, actor(req)),
      firebaseService.source()
    ));
  },

  async patch(req: Request, res: Response) {
    res.json(envelope(await violationService.patch(req.params.id, req.body, actor(req)), firebaseService.source()));
  }
};
