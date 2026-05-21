import { supabasePool } from "../config/supabase.js";
import type { Request } from "express";

// Failed login in-memory registry
const loginTracker = new Map<string, { attempts: number; lockUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

export const securityAuditService = {
  /**
   * Logs a security action to public.system_audit_logs.
   */
  async logAction(
    actorId: string,
    actorRole: string,
    action: string,
    targetType?: string,
    targetId?: string,
    metadata: Record<string, any> = {},
    req?: Request
  ): Promise<void> {
    const ipAddress = req?.ip || req?.socket?.remoteAddress || "";
    const userAgent = req?.headers["user-agent"] || "";

    try {
      if (supabasePool) {
        await supabasePool.query(
          `
          INSERT INTO public.system_audit_logs
            (actor_id, actor_role, action, target_type, target_id, ip_address, user_agent, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `,
          [
            actorId || null,
            actorRole || null,
            action,
            targetType || null,
            targetId || null,
            ipAddress || null,
            userAgent || null,
            JSON.stringify(metadata)
          ]
        );
      }
      console.log(`[AUDIT LOG] Action: ${action} | Actor: ${actorId} (${actorRole}) | Target: ${targetType}:${targetId}`);
    } catch (err: any) {
      console.error("Failed to write system audit log:", err.message);
    }
  },

  /**
   * Tracks a failed login. Returns lock expiration timestamp if locked out.
   */
  trackFailedLogin(email: string): { attempts: number; lockUntil: number } {
    const normalized = email.toLowerCase().trim();
    const current = loginTracker.get(normalized) || { attempts: 0, lockUntil: 0 };

    current.attempts += 1;
    if (current.attempts >= MAX_LOGIN_ATTEMPTS) {
      current.lockUntil = Date.now() + LOCK_DURATION_MS;
      console.warn(`[SECURITY LOCKOUT] Account locked out: ${normalized}. Attempts: ${current.attempts}.`);
    }

    loginTracker.set(normalized, current);
    return current;
  },

  /**
   * Checks if an email account is currently locked out.
   */
  checkLockout(email: string): { isLocked: boolean; remainingSeconds: number } {
    const normalized = email.toLowerCase().trim();
    const current = loginTracker.get(normalized);

    if (!current || current.lockUntil === 0) {
      return { isLocked: false, remainingSeconds: 0 };
    }

    const now = Date.now();
    if (now > current.lockUntil) {
      // Lock has expired, reset
      loginTracker.delete(normalized);
      return { isLocked: false, remainingSeconds: 0 };
    }

    const remaining = Math.ceil((current.lockUntil - now) / 1000);
    return { isLocked: true, remainingSeconds: remaining };
  },

  /**
   * Resets failed attempts after a successful login.
   */
  resetFailedLogins(email: string): void {
    const normalized = email.toLowerCase().trim();
    loginTracker.delete(normalized);
  }
};
