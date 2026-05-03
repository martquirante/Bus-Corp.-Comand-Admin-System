import type { Request, Response } from "express";
import type { LegacyPathKey } from "../services/legacy.service.js";
import { legacyService } from "../services/legacy.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

const sendLegacyPath =
  (key: LegacyPathKey) =>
  async (_req: Request, res: Response) => {
    const data = await legacyService.getLegacyPath(key);
    res.json(envelope(data ?? {}, firebaseService.source()));
  };

export const legacyController = {
  getAssistanceRequests: sendLegacyPath("assistanceRequests"),
  getConfig: sendLegacyPath("config"),
  getExpenses: sendLegacyPath("expenses"),
  getPosDevices: sendLegacyPath("posDevices"),
  getRoutesForward: sendLegacyPath("routesForward"),
  getRoutesReverse: sendLegacyPath("routesReverse"),
  getMessages: sendLegacyPath("messages"),

  async patchConfig(req: Request, res: Response) {
    const data = await legacyService.patchConfig(req.body, req.user?.email || "system");
    res.json(envelope(data, firebaseService.source()));
  },

  async patchAssistanceRequest(req: Request, res: Response) {
    const data = await legacyService.patchAssistanceRequest(
      req.params.id,
      req.body,
      req.user?.email || "system"
    );
    res.json(envelope(data, firebaseService.source()));
  },

  async postMessage(req: Request, res: Response) {
    const data = await legacyService.postMessage(req.body, req.user?.email || "system");
    res.status(201).json(envelope(data, firebaseService.source()));
  },

  async patchMessage(req: Request, res: Response) {
    const data = await legacyService.patchMessage(req.params.id, req.body, req.user?.email || "system");
    res.json(envelope(data, firebaseService.source()));
  }
};
