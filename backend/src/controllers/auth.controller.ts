import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

export const authController = {
  async createSession(req: Request, res: Response) {
    const { email, password } = req.body as { email: string; password: string };
    const session = await authService.createSession(email, password);
    res.json(envelope(session, firebaseService.source()));
  }
};
