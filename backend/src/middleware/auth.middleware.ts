import type { NextFunction, Request, Response } from "express";
import { canBypassReadAuth } from "../config/env.js";
import { firebaseAdmin, isFirebaseReady } from "../config/firebase.js";
import { sessionToken } from "../utils/sessionToken.js";

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

  // Always accept valid backend session JWT (issued by this server)
  const backendSession = token ? sessionToken.verify(token) : null;
  if (backendSession) {
    req.user = backendSession;
    next();
    return;
  }

  // Dev bypass mode: allow all requests without Firebase
  if (canBypassReadAuth()) {
    req.user = devBypassUser;
    next();
    return;
  }

  // Production: require a valid Firebase ID token
  if (!token) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authorization header is missing. Provide a valid session token."
      }
    });
    return;
  }

  if (!isFirebaseReady) {
    res.status(503).json({
      error: {
        code: "FIREBASE_NOT_CONFIGURED",
        message: "Firebase Admin SDK is not configured. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in backend/.env."
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
        message: "The supplied token is invalid or expired."
      }
    });
  }
};
