import type { Request, Response } from "express";
import { storageService, type EmployeeUploadKind } from "../services/storage.service.js";
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

    const assets = await storageService.uploadEmployeeAsset(
      req.params.employeeId,
      kind,
      requestBodyBuffer(req.body),
      req.header("content-type") || undefined,
      actor(req)
    );
    res.status(201).json(envelope(assets, "firebase"));
  }
};
