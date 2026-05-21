import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { blockchainAuditService } from "../services/blockchainAudit.service.js";
import { securityAuditService } from "../services/securityAudit.service.js";
import { env } from "../config/env.js";
import { envelope } from "../utils/envelope.js";
import type { BlockchainRecordType } from "@pos-bus/shared";

const router = Router();

// Protect all blockchain endpoints with authentication
router.use(requireAuth);

/**
 * GET /api/blockchain/security-logs
 * Retrieves system security audit logs.
 */
router.get("/security-logs", async (req, res, next) => {
  try {
    const { limit = 100 } = req.query;
    const logs = await blockchainAuditService.queryRows<any>(
      "SELECT * FROM public.system_audit_logs ORDER BY created_at DESC LIMIT $1",
      [Number(limit)]
    );

    const formatted = logs.map(log => ({
      id: log.id,
      actorId: log.actor_id,
      actorRole: log.actor_role,
      action: log.action,
      resourceType: log.resource_type,
      resourceId: log.resource_id,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      details: log.details,
      createdAt: log.created_at
    }));

    res.json(envelope(formatted, "supabase"));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/blockchain/status
 * Returns system blockchain config status.
 */
router.get("/status", async (req, res, next) => {
  try {
    const counts = await blockchainAuditService.queryRows<any>(
      `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN blockchain_status = 'verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN blockchain_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN blockchain_status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN blockchain_status = 'local_only' THEN 1 ELSE 0 END) as local_only,
        SUM(CASE WHEN blockchain_status = 'mismatch' THEN 1 ELSE 0 END) as mismatch
      FROM public.blockchain_audit_logs
      `
    );

    const stats = counts[0] || { total: 0, verified: 0, pending: 0, failed: 0, local_only: 0, mismatch: 0 };

    res.json(envelope({
      enabled: env.BLOCKCHAIN_ENABLED,
      network: env.BLOCKCHAIN_NETWORK,
      contractAddress: env.BLOCKCHAIN_CONTRACT_ADDRESS || "Not Configured",
      rpcUrl: env.BLOCKCHAIN_RPC_URL ? "Configured" : "Not Configured",
      stats: {
        total: Number(stats.total || 0),
        verified: Number(stats.verified || 0),
        pending: Number(stats.pending || 0),
        failed: Number(stats.failed || 0),
        local_only: Number(stats.local_only || 0),
        mismatch: Number(stats.mismatch || 0)
      }
    }, "supabase"));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/blockchain/audits
 * Retrieves list of blockchain audit logs. Supports recordType and status filters.
 */
router.get("/audits", async (req, res, next) => {
  try {
    const { recordType, status, limit = 100 } = req.query;

    const values: any[] = [];
    const clauses: string[] = [];

    if (recordType) {
      values.push(recordType);
      clauses.push(`record_type = $${values.length}`);
    }
    if (status) {
      values.push(status);
      clauses.push(`blockchain_status = $${values.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    values.push(Number(limit));
    const query = `
      SELECT * FROM public.blockchain_audit_logs 
      ${where} 
      ORDER BY created_at DESC 
      LIMIT $${values.length}
    `;

    const logs = await blockchainAuditService.queryRows<any>(query, values);

    // Map logs back to TS standard camelCase
    const formatted = logs.map(log => ({
      id: log.id,
      recordType: log.record_type,
      recordId: log.record_id,
      recordHash: log.record_hash,
      previousHash: log.previous_hash,
      blockchainTxHash: log.blockchain_tx_hash,
      blockchainNetwork: log.blockchain_network,
      blockchainStatus: log.blockchain_status,
      createdById: log.created_by_id,
      createdByRole: log.created_by_role,
      metadata: log.metadata,
      createdAt: log.created_at,
      verifiedAt: log.verified_at
    }));

    res.json(envelope(formatted, "supabase"));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/blockchain/audits/:recordType/:recordId
 * Retrieves detailed audit log for a single resource.
 * Also handles ticket validation checks for Customer App.
 */
router.get("/audits/:recordType/:recordId", async (req, res, next) => {
  try {
    const { recordType, recordId } = req.params;

    const rows = await blockchainAuditService.queryRows<any>(
      "SELECT * FROM public.blockchain_audit_logs WHERE record_type = $1 AND record_id = $2 LIMIT 1",
      [recordType, recordId]
    );

    const log = rows[0];
    if (!log) {
      res.status(404).json({
        error: {
          code: "AUDIT_RECORD_NOT_FOUND",
          message: `No audit proof recorded for ${recordType}:${recordId}`
        }
      });
      return;
    }

    res.json(envelope({
      id: log.id,
      recordType: log.record_type,
      recordId: log.record_id,
      recordHash: log.record_hash,
      previousHash: log.previous_hash,
      blockchainTxHash: log.blockchain_tx_hash,
      blockchainNetwork: log.blockchain_network,
      blockchainStatus: log.blockchain_status,
      createdById: log.created_by_id,
      createdByRole: log.created_by_role,
      metadata: log.metadata,
      createdAt: log.created_at,
      verifiedAt: log.verified_at
    }, "supabase"));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/blockchain/audits/:recordType/:recordId/verify
 * Triggers a recalculation and audit integrity verification check.
 */
router.post("/audits/:recordType/:recordId/verify", async (req, res, next) => {
  try {
    const { recordType, recordId } = req.params;

    const result = await blockchainAuditService.verifyRecordIntegrity(
      recordType as BlockchainRecordType,
      recordId
    );

    // Audit the manual verification request
    await securityAuditService.logAction(
      req.user?.email || "anonymous",
      req.user?.role || "Admin",
      "blockchain.manual_verify",
      recordType,
      recordId,
      { tampered: result.tampered, computedHash: result.computedHash },
      req
    );

    res.json(envelope(result, "supabase"));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/blockchain/audits/:recordType/:recordId/anchor
 * Manually forces anchoring a record to the smart contract.
 */
router.post("/audits/:recordType/:recordId/anchor", async (req, res, next) => {
  try {
    const { recordType, recordId } = req.params;

    const rows = await blockchainAuditService.queryRows<any>(
      "SELECT * FROM public.blockchain_audit_logs WHERE record_type = $1 AND record_id = $2 LIMIT 1",
      [recordType, recordId]
    );

    const log = rows[0];
    if (!log) {
      res.status(404).json({
        error: {
          code: "AUDIT_NOT_FOUND",
          message: "No local audit log exists for this record. Create it first."
        }
      });
      return;
    }

    if (!env.BLOCKCHAIN_ENABLED) {
      res.status(400).json({
        error: {
          code: "BLOCKCHAIN_DISABLED",
          message: "Blockchain anchoring is disabled on this backend server."
        }
      });
      return;
    }

    const txHash = await blockchainAuditService.anchorToSmartContract(
      recordType,
      recordId,
      log.record_hash,
      log.id
    );

    await securityAuditService.logAction(
      req.user?.email || "anonymous",
      req.user?.role || "Admin",
      "blockchain.manual_anchor",
      recordType,
      recordId,
      { txHash },
      req
    );

    res.json(envelope({ txHash, status: txHash ? "anchoring" : "failed" }, "supabase"));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/blockchain/retry-pending
 * Enforces RBAC — Admin only! Triggers background retries for failed/pending anchors.
 */
router.post("/retry-pending", requireRole("SuperAdmin", "Admin"), async (req, res, next) => {
  try {
    const result = await blockchainAuditService.retryPendingAudits();

    await securityAuditService.logAction(
      req.user?.email || "anonymous",
      req.user?.role || "Admin",
      "blockchain.retry_pending",
      undefined,
      undefined,
      result,
      req
    );

    res.json(envelope(result, "supabase"));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/blockchain/verify-all-pending
 * Enforces RBAC — Admin only! Recalculates integrity check for all pending audits.
 */
router.post("/verify-all-pending", requireRole("SuperAdmin", "Admin"), async (req, res, next) => {
  try {
    const pending = await blockchainAuditService.queryRows<any>(
      "SELECT id, record_type, record_id FROM public.blockchain_audit_logs WHERE blockchain_status = 'pending'"
    );

    let verified = 0;
    let mismatches = 0;

    for (const log of pending) {
      try {
        const check = await blockchainAuditService.verifyRecordIntegrity(log.record_type, log.record_id);
        if (check.tampered) {
          mismatches++;
        } else {
          verified++;
        }
      } catch (err: any) {
        console.warn(`Verify failed for ${log.record_type}:${log.record_id}:`, err.message);
      }
    }

    await securityAuditService.logAction(
      req.user?.email || "anonymous",
      req.user?.role || "Admin",
      "blockchain.verify_all_pending",
      undefined,
      undefined,
      { pendingCount: pending.length, verified, mismatches },
      req
    );

    res.json(envelope({ pendingCount: pending.length, verified, mismatches }, "supabase"));
  } catch (error) {
    next(error);
  }
});

export default router;
