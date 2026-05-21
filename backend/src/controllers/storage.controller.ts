import type { Request, Response } from "express";
import crypto from "crypto";
import { storageService, type EmployeeUploadKind } from "../services/storage.service.js";
import { blockchainAuditService } from "../services/blockchainAudit.service.js";
import { envelope } from "../utils/envelope.js";

const actor = (req: Request) => req.user?.email || req.user?.fullName || "admin";

const uploadKinds = new Set<EmployeeUploadKind>(["photo", "signature", "id-front", "id-back", "id-pdf", "qr"]);

const requestBodyBuffer = (body: unknown) => {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  return Buffer.alloc(0);
};

export const storageController = {
  async getEmployeeAssets(req: Request, res: Response) {
    const assets = await storageService.getEmployeeAssets(req.params.employeeId);
    res.json(envelope(assets, "firebase"));
  },

  async uploadEmployeeAsset(req: Request, res: Response) {
    const kind = req.params.kind as EmployeeUploadKind;
    if (!uploadKinds.has(kind)) {
      res.status(404).json({
        error: {
          code: "EMPLOYEE_STORAGE_KIND_NOT_FOUND",
          message: "Employee storage asset type was not found."
        }
      });
      return;
    }

    const buffer = requestBodyBuffer(req.body);
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const assets = await storageService.uploadEmployeeAsset(
      req.params.employeeId,
      kind,
      buffer,
      req.header("content-type") || undefined,
      actor(req)
    );

    // Anchor file audit proof
    try {
      const fileId = `file-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await blockchainAuditService.createAuditRecord(
        "file_upload",
        fileId,
        {
          fileName: `${kind}-${req.params.employeeId}`,
          fileType: req.header("content-type") || "image/png",
          fileSize: buffer.length,
          uploadedBy: actor(req),
          relatedRecordType: "employee",
          relatedRecordId: req.params.employeeId,
          fileHash,
          uploadedAt: new Date().toISOString()
        },
        req.user?.email,
        req.user?.role
      );
    } catch (err: any) {
      console.warn("[storage-audit] File upload audit skipped.", err.message);
    }

    res.status(201).json(envelope(assets, "firebase"));
  },

  async uploadBusPhoto(req: Request, res: Response) {
    const { busId } = req.params;
    const buffer = requestBodyBuffer(req.body);
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const result = await storageService.uploadBusPhoto(
      busId,
      buffer,
      req.header("content-type") || undefined,
      actor(req)
    );

    // Anchor file audit proof
    try {
      const fileId = `file-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await blockchainAuditService.createAuditRecord(
        "file_upload",
        fileId,
        {
          fileName: `photo-${busId}`,
          fileType: req.header("content-type") || "image/png",
          fileSize: buffer.length,
          uploadedBy: actor(req),
          relatedRecordType: "bus",
          relatedRecordId: busId,
          fileHash,
          uploadedAt: new Date().toISOString()
        },
        req.user?.email,
        req.user?.role
      );
    } catch (err: any) {
      console.warn("[storage-audit] Bus photo audit skipped.", err.message);
    }

    res.status(201).json(envelope(result, "firebase"));
  },

  async uploadBusDocument(req: Request, res: Response) {
    const { busId, docType } = req.params;
    const buffer = requestBodyBuffer(req.body);
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const result = await storageService.uploadBusDocument(
      busId,
      docType,
      buffer,
      req.header("content-type") || undefined,
      actor(req)
    );

    // Anchor file audit proof
    try {
      const fileId = `file-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await blockchainAuditService.createAuditRecord(
        "file_upload",
        fileId,
        {
          fileName: `${docType}-${busId}`,
          fileType: req.header("content-type") || "application/pdf",
          fileSize: buffer.length,
          uploadedBy: actor(req),
          relatedRecordType: "bus",
          relatedRecordId: busId,
          fileHash,
          uploadedAt: new Date().toISOString()
        },
        req.user?.email,
        req.user?.role
      );
    } catch (err: any) {
      console.warn("[storage-audit] Bus doc audit skipped.", err.message);
    }

    res.status(201).json(envelope(result, "firebase"));
  }
};
