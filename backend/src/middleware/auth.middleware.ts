import type { NextFunction, Request, Response } from "express";
import { canBypassReadAuth } from "../config/env.js";
import { firebaseAdmin, isFirebaseReady } from "../config/firebase.js";
import { sessionToken } from "../utils/sessionToken.js";

const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);

const devBypassUser = {
  uid: "dev-admin",
  id: "dev-admin",
  fullName: "Local Dev Admin",
  email: "dev.admin@local",
  role: "SuperAdmin" as const,
  status: "active" as const
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.header("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  const backendSession = token ? sessionToken.verify(token) : null;
  if (backendSession) {
    req.user = backendSession;
    next();
    return;
  }

  if (canBypassReadAuth() && readMethods.has(req.method)) {
    req.user = devBypassUser;
    next();
    return;
  }

  if (canBypassReadAuth() && !token) {
    res.status(401).json({
      error: {
        code: "ADMIN_SESSION_REQUIRED",
        message: "This action needs an admin session. Dev bypass only applies to read-only data."
      }
    });
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
