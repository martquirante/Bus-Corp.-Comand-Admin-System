import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { securityAuditService } from "../services/securityAudit.service.js";
import { envelope } from "../utils/envelope.js";

export const authController = {
  async createSession(req: Request, res: Response) {
    const { email, password } = req.body as { email: string; password: string };
    if (!email) {
      res.status(400).json({
        error: { code: "INVALID_REQUEST", message: "Email is required." }
      });
      return;
    }

    // Check if account is temporarily locked
    const lockout = securityAuditService.checkLockout(email);
    if (lockout.isLocked) {
      res.status(423).json({
        error: {
          code: "ACCOUNT_LOCKED",
          message: `Too many failed login attempts. This account has been temporarily locked. Please try again in ${lockout.remainingSeconds} seconds.`
        }
      });
      return;
    }

    try {
      const session = await authService.createSession(email, password);
      // Reset failed attempts upon successful authentication
      securityAuditService.resetFailedLogins(email);

      // Log successful login security audit
      await securityAuditService.logAction(
        session.user.email,
        session.user.role,
        "auth.login_success",
        "user",
        session.user.id,
        { ip: req.ip },
        req
      );

      res.json(envelope(session, firebaseService.source()));
    } catch (err: any) {
      // Increment failed attempts and track lockouts
      const status = securityAuditService.trackFailedLogin(email);

      // Log failed login audit
      await securityAuditService.logAction(
        email,
        "Unknown",
        "auth.login_failed",
        "user",
        undefined,
        { ip: req.ip, attempts: status.attempts, locked: status.attempts >= 5 },
        req
      );

      res.status(err.status || 401).json({
        error: {
          code: err.code || "UNAUTHORIZED",
          message: err.message || "Invalid credentials."
        }
      });
    }
  }
};

