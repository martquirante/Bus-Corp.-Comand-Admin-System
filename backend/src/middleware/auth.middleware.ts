import type { NextFunction, Request, Response } from "express";
import { firebaseAdmin, isFirebaseReady } from "../config/firebase.js";
import { sessionToken } from "../utils/sessionToken.js";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.header("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  const backendSession = token ? sessionToken.verify(token) : null;
  if (backendSession) {
    req.user = backendSession;
    next();
    return;
  }

  if (!token || !isFirebaseReady) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "A valid Firebase bearer token is required."
      }
    });
    return;
  }

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      id: decoded.uid,
      fullName: decoded.name || decoded.email || "Admin",
      email: decoded.email || "",
      role: (decoded.role as "SuperAdmin" | "Admin") || "Admin",
      status: "active"
    };
    next();
  } catch {
    res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "The supplied Firebase token is invalid or expired."
      }
    });
  }
};
