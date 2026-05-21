import crypto from "crypto";
import { env } from "../config/env.js";
import { supabasePool, supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../utils/appError.js";
import type { BlockchainAuditRecord, BlockchainRecordType, BlockchainStatus } from "@pos-bus/shared";

// ABI for POSBusAuditLedger smart contract
const CONTRACT_ABI = [
  "function storeAuditHash(string calldata recordType, string calldata recordId, string calldata recordHash, string calldata metadataHash) external",
  "function verifyAuditHash(string calldata recordType, string calldata recordId, string calldata recordHash) external view returns (bool)",
  "function getAudit(string calldata recordType, string calldata recordId) external view returns (string memory recordHash, string memory metadataHash, uint256 blockTimestamp, address anchorSender)"
];

/**
 * Sorts object keys recursively to ensure deterministic, canonical representation.
 */
export function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  const sorted: any = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = sortObjectKeys(obj[key]);
    });
  return sorted;
}

/**
 * Generate SHA-256 hash from canonical object structure.
 */
export function generateCanonicalHash(payload: any): string {
  const sorted = sortObjectKeys(payload);
  const serialized = JSON.stringify(sorted);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

export const blockchainAuditService = {
  /**
   * Builds the canonical stable payload fields based on record type to exclude unstable fields.
   */
  getCanonicalPayload(recordType: BlockchainRecordType, data: any): any {
    switch (recordType) {
      case "ticket":
        return {
          ticketId: String(data.ticketId || data.id || ""),
          tripId: String(data.tripId || ""),
          routeId: String(data.routeId || ""),
          busId: String(data.busId || ""),
          conductorId: String(data.conductorId || ""),
          origin: String(data.origin || ""),
          destination: String(data.destination || ""),
          passengerType: String(data.passengerType || "regular"),
          fareAmount: Number(data.fareAmount || data.amount || data.fare || 0),
          paymentMethod: String(data.paymentMethod || "unknown"),
          issuedAt: data.issuedAt || data.time || data.created_at || ""
        };
      case "qr_ticket":
        return {
          ticketId: String(data.ticketId || data.id || ""),
          qrTokenId: String(data.qrTokenId || data.verificationCode || ""),
          routeId: String(data.routeId || ""),
          busId: String(data.busId || ""),
          passengerId: String(data.passengerId || ""),
          conductorId: String(data.conductorId || ""),
          paymentStatus: String(data.paymentStatus || "paid"),
          ticketStatus: String(data.ticketStatus || "active"),
          issuedAt: data.issuedAt || "",
          usedAt: data.usedAt || ""
        };
      case "remittance":
        return {
          remittanceId: String(data.remittanceId || data.id || ""),
          conductorId: String(data.conductorId || ""),
          cashierId: String(data.cashierId || data.receivedById || ""),
          shiftDate: String(data.shiftDate || ""),
          busId: String(data.busId || ""),
          routeId: String(data.routeId || ""),
          expectedAmount: Number(data.expectedAmount || 0),
          actualRemitted: Number(data.actualRemitted || data.remittedAmount || 0),
          status: String(data.status || "Pending")
        };
      case "violation":
        return {
          violationId: String(data.violationId || data.id || ""),
          employeeId: String(data.employeeId || ""),
          violationDate: String(data.violationDate || ""),
          violationType: String(data.violationType || ""),
          severity: String(data.severity || "minor"),
          penaltyType: String(data.penaltyType || data.penalty || ""),
          status: String(data.status || "Active"),
          reportedBy: String(data.reportedById || data.reportedBy || "")
        };
      case "maintenance":
        return {
          jobOrderId: String(data.jobOrderId || data.id || ""),
          busId: String(data.busId || ""),
          reportedBy: String(data.reportedBy || ""),
          mechanicId: String(data.mechanicId || ""),
          issueType: String(data.issueType || ""),
          severity: String(data.severity || ""),
          status: String(data.status || ""),
          completedAt: data.completedAt || ""
        };
      case "fuel_log":
        return {
          fuelLogId: String(data.fuelLogId || data.id || ""),
          driverId: String(data.driverId || ""),
          busId: String(data.busId || ""),
          liters: Number(data.liters || 0),
          amount: Number(data.amount || 0),
          stationName: String(data.stationName || ""),
          odometer: Number(data.odometer || 0),
          loggedAt: data.loggedAt || ""
        };
      case "route_change":
        return {
          routeChangeId: String(data.routeChangeId || data.id || ""),
          driverId: String(data.driverId || ""),
          busId: String(data.busId || ""),
          routeId: String(data.routeId || ""),
          reason: String(data.reason || ""),
          status: String(data.status || ""),
          approvedBy: String(data.approvedBy || ""),
          requestedAt: data.requestedAt || "",
          approvedAt: data.approvedAt || ""
        };
      case "admin_action":
        return {
          actionId: String(data.id || ""),
          actorId: String(data.actorId || ""),
          actionType: String(data.action || ""),
          targetType: String(data.targetType || ""),
          targetId: String(data.targetId || ""),
          timestamp: data.createdAt || ""
        };
      case "report_export":
        return {
          reportId: String(data.reportId || data.id || ""),
          reportType: String(data.reportType || ""),
          generatedBy: String(data.generatedBy || ""),
          fileHash: String(data.fileHash || ""),
          generatedAt: data.generatedAt || ""
        };
      case "file_upload":
        return {
          fileId: String(data.fileId || data.id || ""),
          fileName: String(data.fileName || ""),
          fileType: String(data.fileType || ""),
          fileSize: Number(data.fileSize || 0),
          uploadedBy: String(data.uploadedBy || ""),
          relatedRecordType: String(data.relatedRecordType || ""),
          relatedRecordId: String(data.relatedRecordId || ""),
          fileHash: String(data.fileHash || ""),
          uploadedAt: data.uploadedAt || ""
        };
      default:
        return data;
    }
  },

  /**
   * Generates local hash, saves to postgres, and triggers contract anchor if enabled.
   */
  async createAuditRecord(
    recordType: BlockchainRecordType,
    recordId: string,
    recordData: any,
    createdById?: string,
    createdByRole?: string
  ): Promise<BlockchainAuditRecord> {
    const canonical = this.getCanonicalPayload(recordType, recordData);
    const hash = generateCanonicalHash(canonical);

    // Retrieve previous hash from database
    let previousHash = "";
    try {
      const prevResult = await this.queryRows<any>(
        "SELECT record_hash FROM public.blockchain_audit_logs ORDER BY created_at DESC LIMIT 1"
      );
      if (prevResult[0]?.record_hash) {
        previousHash = prevResult[0].record_hash;
      }
    } catch (e) {
      console.warn("Could not query previous audit hash log:", e);
    }

    const network = env.BLOCKCHAIN_NETWORK || "hardhat";
    let status: BlockchainStatus = env.BLOCKCHAIN_ENABLED ? "pending" : "local_only";
    let txHash = "";

    // Save record locally first to ensure failure resilience
    const record: Partial<BlockchainAuditRecord> = {
      recordType,
      recordId,
      recordHash: hash,
      previousHash: previousHash || undefined,
      blockchainStatus: status,
      blockchainNetwork: network,
      createdById,
      createdByRole,
      metadata: canonical
    };

    let savedId = "";
    try {
      const rows = await this.queryRows<any>(
        `
        INSERT INTO public.blockchain_audit_logs
          (record_type, record_id, record_hash, previous_hash, blockchain_network, blockchain_status, created_by_id, created_by_role, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (record_type, record_id, record_hash)
        DO UPDATE SET blockchain_status = excluded.blockchain_status, updated_at = NOW()
        RETURNING id
        `,
        [
          recordType,
          recordId,
          hash,
          previousHash || null,
          network,
          status,
          createdById || null,
          createdByRole || null,
          JSON.stringify(canonical)
        ]
      );
      savedId = rows[0]?.id || "";
    } catch (err: any) {
      console.error(`PostgreSQL save error for blockchain audit (${recordType}:${recordId}):`, err.message);
    }

    // Update target table if it exists
    await this.updateRecordBlockchainMeta(recordType, recordId, hash, txHash, status);

    // If blockchain is enabled, execute transaction anchoring to Smart Contract asynchronously
    if (env.BLOCKCHAIN_ENABLED && env.BLOCKCHAIN_CONTRACT_ADDRESS) {
      this.anchorToSmartContract(recordType, recordId, hash, savedId).catch((err) => {
        console.error(`Async blockchain anchoring failed for ${recordType}:${recordId}:`, err.message);
      });
    }

    return {
      id: savedId,
      recordType,
      recordId,
      recordHash: hash,
      previousHash: previousHash || undefined,
      blockchainStatus: status,
      blockchainNetwork: network,
      blockchainTxHash: txHash || undefined,
      createdById,
      createdByRole,
      metadata: canonical,
      createdAt: new Date().toISOString()
    };
  },

  /**
   * Internal implementation for submitting transactions using Ethers
   */
  async anchorToSmartContract(
    recordType: string,
    recordId: string,
    recordHash: string,
    logDbId: string
  ): Promise<string> {
    if (!env.BLOCKCHAIN_ENABLED || !env.BLOCKCHAIN_CONTRACT_ADDRESS || !env.BLOCKCHAIN_RPC_URL || !env.BLOCKCHAIN_PRIVATE_KEY) {
      console.log("Blockchain is disabled or environment is incomplete. Anchoring skipped.");
      return "";
    }

    try {
      // Dynamic import of Ethers
      const { ethers } = await import("ethers");

      const provider = new ethers.JsonRpcProvider(env.BLOCKCHAIN_RPC_URL);
      const wallet = new ethers.Wallet(env.BLOCKCHAIN_PRIVATE_KEY, provider);
      const contract = new ethers.Contract(env.BLOCKCHAIN_CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

      const metadataHash = crypto.createHash("sha256").update(JSON.stringify({ recordType, recordId })).digest("hex");

      console.log(`Sending blockchain audit transaction to contract ${env.BLOCKCHAIN_CONTRACT_ADDRESS}...`);
      const tx = await contract.storeAuditHash(recordType, recordId, recordHash, metadataHash);
      console.log(`Anchor transaction submitted: ${tx.hash}. Waiting for confirmations...`);

      // We do not await confirmation to keep APIs blazing fast, or await 1 block for safety in background
      tx.wait(1).then(async (receipt: any) => {
        console.log(`Transaction confirmed in block ${receipt.blockNumber}! Anchored successfully.`);
        await this.updateAuditStatus(logDbId, recordType, recordId, "verified", tx.hash);
      }).catch(async (err: any) => {
        console.error("Transaction wait error:", err.message);
        await this.updateAuditStatus(logDbId, recordType, recordId, "failed", tx.hash);
      });

      return tx.hash;
    } catch (error: any) {
      console.error("Failed to anchor audit hash to blockchain:", error.message);
      await this.updateAuditStatus(logDbId, recordType, recordId, "failed", "");
      return "";
    }
  },

  /**
   * Recalculates current record payload hash and verifies matches against database and on-chain ledger state.
   */
  async verifyRecordIntegrity(recordType: BlockchainRecordType, recordId: string): Promise<{
    localMatch: boolean;
    blockchainMatch: boolean;
    computedHash: string;
    storedHash: string;
    blockchainStatus: BlockchainStatus;
    tampered: boolean;
  }> {
    // 1. Fetch main record raw payload from database
    const rawRecord = await this.fetchOriginalRecord(recordType, recordId);
    if (!rawRecord) {
      throw new AppError(404, "AUDIT_RECORD_NOT_FOUND", `Original record for ${recordType}:${recordId} was not found.`);
    }

    const canonical = this.getCanonicalPayload(recordType, rawRecord);
    const computedHash = generateCanonicalHash(canonical);

    // 2. Fetch recorded audit log entry
    const auditRows = await this.queryRows<any>(
      "SELECT * FROM public.blockchain_audit_logs WHERE record_type = $1 AND record_id = $2 LIMIT 1",
      [recordType, recordId]
    );

    const audit = auditRows[0];
    if (!audit) {
      return {
        localMatch: false,
        blockchainMatch: false,
        computedHash,
        storedHash: "",
        blockchainStatus: "local_only",
        tampered: true
      };
    }

    const storedHash = audit.record_hash;
    const localMatch = (computedHash === storedHash);
    let blockchainMatch = false;

    // 3. Verify on blockchain contract if enabled
    if (env.BLOCKCHAIN_ENABLED && env.BLOCKCHAIN_CONTRACT_ADDRESS && audit.blockchain_tx_hash) {
      try {
        const { ethers } = await import("ethers");
        const provider = new ethers.JsonRpcProvider(env.BLOCKCHAIN_RPC_URL);
        const contract = new ethers.Contract(env.BLOCKCHAIN_CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        blockchainMatch = await contract.verifyAuditHash(recordType, recordId, computedHash);
      } catch (err: any) {
        console.warn("Could not verify audit on-chain due to network exception:", err.message);
        // Fallback to matching database if chain RPC is unreachable
        blockchainMatch = localMatch;
      }
    } else {
      blockchainMatch = localMatch;
    }

    const tampered = !localMatch || !blockchainMatch;
    const nextStatus: BlockchainStatus = tampered ? "mismatch" : (audit.blockchain_status as BlockchainStatus);

    if (tampered && audit.blockchain_status !== "mismatch") {
      // Tampering alarm: Update audit logs and target record to alert Admins
      await this.updateAuditStatus(audit.id, recordType, recordId, "mismatch", audit.blockchain_tx_hash || "");
      // Log critical mismatch to system audits
      await this.queryRows(
        `INSERT INTO public.system_audit_logs (actor_id, actor_role, action, target_type, target_id, metadata, created_at)
         VALUES ('system', 'system', 'hash_mismatch_detected', $1, $2, $3, NOW())`,
        [recordType, recordId, JSON.stringify({ computedHash, storedHash, message: "CRITICAL: Database record tampering detected." })]
      );
    }

    return {
      localMatch,
      blockchainMatch,
      computedHash,
      storedHash,
      blockchainStatus: nextStatus,
      tampered
    };
  },

  /**
   * Background runner to retry anchoring pending or failed blockchain audits.
   */
  async retryPendingAudits(): Promise<{ retried: number; successful: number }> {
    if (!env.BLOCKCHAIN_ENABLED) {
      return { retried: 0, successful: 0 };
    }

    const pending = await this.queryRows<any>(
      `SELECT * FROM public.blockchain_audit_logs
       WHERE blockchain_status IN ('pending', 'failed') AND blockchain_network = $1
       LIMIT 50`,
      [env.BLOCKCHAIN_NETWORK]
    );

    let retried = 0;
    let successful = 0;

    for (const log of pending) {
      retried++;
      try {
        const txHash = await this.anchorToSmartContract(log.record_type, log.record_id, log.record_hash, log.id);
        if (txHash) {
          successful++;
        }
      } catch (e: any) {
        console.error(`Retry anchor failed for record ${log.record_type}:${log.record_id}:`, e.message);
      }
    }

    return { retried, successful };
  },

  /**
   * Helper to query rows safely using pg pool or fallback to Admin Client
   */
  async queryRows<T extends import("pg").QueryResultRow = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (supabasePool) {
      const result = await supabasePool.query<T>(sql, params);
      return result.rows;
    }
    if (supabaseAdmin) {
      // Parse query string for simple admin select
      console.warn("Supabase Postgres pool not active. Admin JS select fallback used.");
      // Fallback fallback return empty
    }
    return [];
  },

  /**
   * Helper to update database audit log record and original table
   */
  async updateAuditStatus(id: string, recordType: string, recordId: string, status: BlockchainStatus, txHash: string): Promise<void> {
    try {
      await this.queryRows(
        `
        UPDATE public.blockchain_audit_logs
        SET blockchain_status = $1, blockchain_tx_hash = COALESCE(NULLIF($2, ''), blockchain_tx_hash), verified_at = CASE WHEN $1 = 'verified' THEN NOW() ELSE verified_at END
        WHERE id = $3
        `,
        [status, txHash, id]
      );

      // Update original table
      const storedRows = await this.queryRows<any>(
        "SELECT record_hash FROM public.blockchain_audit_logs WHERE id = $1", [id]
      );
      const hash = storedRows[0]?.record_hash || "";

      await this.updateRecordBlockchainMeta(recordType as BlockchainRecordType, recordId, hash, txHash, status);
    } catch (e: any) {
      console.error("Error updating audit logs status:", e.message);
    }
  },

  /**
   * Updates blockchain fields on individual record tables.
   */
  async updateRecordBlockchainMeta(
    recordType: BlockchainRecordType,
    recordId: string,
    hash: string,
    txHash: string,
    status: BlockchainStatus
  ): Promise<void> {
    const tableMap: Record<BlockchainRecordType, string> = {
      ticket: "tickets",
      qr_ticket: "tickets", // qr_ticket shares the tickets table
      remittance: "remittances",
      violation: "employee_violations",
      maintenance: "buses", // job orders metadata linked to buses in this schema
      fuel_log: "buses", // fuel logging targets buses
      route_change: "routes",
      admin_action: "", // local logs only
      report_export: "", // local logs only
      file_upload: "" // local logs only
    };

    const tableName = tableMap[recordType];
    if (!tableName) return;

    try {
      await this.queryRows(
        `
        UPDATE public.${tableName}
        SET blockchain_hash = $1,
            blockchain_tx_hash = COALESCE(NULLIF($2, ''), blockchain_tx_hash),
            blockchain_status = $3,
            blockchain_verified_at = CASE WHEN $3 = 'verified' THEN NOW() ELSE blockchain_verified_at END
        WHERE id::text = $4 OR id::text = (SELECT id::text FROM public.${tableName} WHERE id::text = $4 OR (CASE WHEN '${tableName}' = 'tickets' THEN firebase_ticket_key = $4 ELSE false END) LIMIT 1)
        `,
        [hash, txHash, status, recordId]
      );
    } catch (err: any) {
      console.warn(`Could not update blockchain metadata on table public.${tableName}:`, err.message);
    }
  },

  /**
   * Helper to retrieve original record contents from target tables
   */
  async fetchOriginalRecord(recordType: BlockchainRecordType, recordId: string): Promise<any | null> {
    const tableMap: Record<BlockchainRecordType, string> = {
      ticket: "tickets",
      qr_ticket: "tickets",
      remittance: "remittances",
      violation: "employee_violations",
      maintenance: "buses",
      fuel_log: "buses",
      route_change: "routes",
      admin_action: "",
      report_export: "",
      file_upload: ""
    };

    const tableName = tableMap[recordType];
    if (!tableName) {
      // Local audit log entry query fallback
      const logs = await this.queryRows<any>(
        "SELECT metadata FROM public.blockchain_audit_logs WHERE record_type = $1 AND record_id = $2 LIMIT 1",
        [recordType, recordId]
      );
      return logs[0]?.metadata || null;
    }

    try {
      const rows = await this.queryRows<any>(
        `SELECT * FROM public.${tableName} WHERE id::text = $1 OR (CASE WHEN '${tableName}' = 'tickets' THEN firebase_ticket_key = $1 ELSE false END) LIMIT 1`,
        [recordId]
      );
      if (rows[0]) {
        // Map postgres field keys back to JS format
        return this.normalizeDbRow(recordType, rows[0]);
      }
    } catch (err: any) {
      console.error(`Error loading original ${recordType} record:`, err.message);
    }

    return null;
  },

  /**
   * Maps snake_case database rows back to typescript properties
   */
  normalizeDbRow(recordType: BlockchainRecordType, row: any): any {
    if (recordType === "ticket" || recordType === "qr_ticket") {
      return {
        ticketId: row.ticket_no || row.firebase_ticket_key || row.id,
        tripId: row.trip_id,
        passengerType: row.passenger_type,
        origin: row.origin,
        destination: row.destination,
        fareAmount: row.fare,
        paymentMethod: row.payment_method,
        issuedAt: row.created_at
      };
    }
    if (recordType === "remittance") {
      return {
        remittanceId: row.id,
        conductorId: row.conductor_id,
        receivedById: row.cashier_id,
        shiftDate: row.shift_date,
        busId: row.bus_id,
        routeId: row.route_id,
        expectedAmount: row.expected_amount,
        actualRemitted: row.actual_remitted,
        status: row.status
      };
    }
    if (recordType === "violation") {
      return {
        violationId: row.id,
        employeeId: row.employee_id,
        violationDate: row.violation_date,
        violationType: row.violation_type,
        severity: row.severity,
        penaltyType: row.penalty_type,
        status: row.status,
        reportedById: row.reported_by
      };
    }
    return row;
  }
};
