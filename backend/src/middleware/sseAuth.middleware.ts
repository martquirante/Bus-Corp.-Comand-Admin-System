import type { Request, Response, NextFunction } from "express";
import { sessionToken } from "../utils/sessionToken.js";

export const allowSseSession = (req: Request, res: Response, next: NextFunction) => {
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
