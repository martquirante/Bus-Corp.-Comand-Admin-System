import type { Request, Response, NextFunction } from "express";
import { canBypassReadAuth } from "../config/env.js";
import { sessionToken } from "../utils/sessionToken.js";

const devBypassUser = {
  uid: "dev-admin",
  id: "dev-admin",
  fullName: "Local Dev Admin",
  email: "dev.admin@local",
  role: "SuperAdmin" as const,
  status: "active" as const
};

export const allowSseSession = (req: Request, res: Response, next: NextFunction) => {
  if (canBypassReadAuth()) {
    req.user = devBypassUser;
    next();
    return;
  }

  const token = String(req.query.token || "");
  const session = token ? sessionToken.verify(token) : null;

  if (!session) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "A valid session token query parameter is required for realtime streams."
      }
    });
    return;
  }

  req.user = session;
  next();
};
