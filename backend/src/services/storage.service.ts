import type { EmployeeAssetInfo, EmployeeAssetKey, EmployeeAssetsResponse, EmployeeRecord } from "@pos-bus/shared";
import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../utils/appError.js";
import { employeeService } from "./adminResource.service.js";

type UploadKind = "photo" | "signature" | "id-front" | "id-back" | "id-pdf" | "qr";

type AssetConfig = {
  key: EmployeeAssetKey;
  fileName: string;
  pathField: keyof EmployeeRecord;
  urlField: keyof EmployeeRecord;
  contentType: string;
};

const employeeBucket = "employee-files";
const signedUrlTtlSeconds = 60 * 60;

const assetConfig: Record<UploadKind, AssetConfig> = {
  photo: {
    key: "photo",
    fileName: "photo.png",
    pathField: "photoPath",
    urlField: "photoUrl",
    contentType: "image/png"
  },
  signature: {
    key: "signature",
    fileName: "signature.png",
    pathField: "signaturePath",
    urlField: "signatureUrl",
    contentType: "image/png"
  },
  "id-front": {
    key: "idFront",
    fileName: "id-front.png",
    pathField: "idFrontPath",
    urlField: "idFrontUrl",
    contentType: "image/png"
  },
  "id-back": {
    key: "idBack",
    fileName: "id-back.png",
    pathField: "idBackPath",
    urlField: "idBackUrl",
    contentType: "image/png"
  },
  "id-pdf": {
    key: "idPdf",
    fileName: "id.pdf",
    pathField: "idPdfPath",
    urlField: "idPdfUrl",
    contentType: "application/pdf"
  },
  qr: {
    key: "qr",
    fileName: "qr.png",
    pathField: "qrPath",
    urlField: "qrUrl",
    contentType: "image/png"
  }
};

const sanitizeFolder = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

const storageFolderForEmployee = (employee: EmployeeRecord) =>
  employee.storageFolder || `employees/${sanitizeFolder(employee.employeeNumber || employee.id)}`;

const requireStorageClient = () => {
  if (!supabaseAdmin) {
    throw new AppError(503, "SUPABASE_STORAGE_NOT_CONFIGURED", "Supabase service role is required for private employee storage.");
  }
  return supabaseAdmin.storage.from(employeeBucket);
};

const signedUrlForPath = async (path?: string): Promise<EmployeeAssetInfo | undefined> => {
  if (!path) return undefined;
  const bucket = requireStorageClient();
  const { data, error } = await bucket.createSignedUrl(path, signedUrlTtlSeconds);
  if (error) throw new AppError(502, "SUPABASE_SIGNED_URL_FAILED", error.message);
  return {
    path,
    signedUrl: data.signedUrl,
    expiresIn: signedUrlTtlSeconds
  };
};

const employeeAssetPaths = (employee: EmployeeRecord) => ({
  photo: employee.photoPath,
  signature: employee.signaturePath,
  idFront: employee.idFrontPath,
  idBack: employee.idBackPath,
  idPdf: employee.idPdfPath,
  qr: employee.qrPath
});

const attachSignedUrl = (employee: EmployeeRecord, key: EmployeeAssetKey, signedUrl?: string): EmployeeRecord => {
  if (!signedUrl) return employee;
  if (key === "photo") return { ...employee, photoUrl: signedUrl, profilePhotoUrl: signedUrl };
  if (key === "signature") return { ...employee, signatureUrl: signedUrl };
  if (key === "idFront") return { ...employee, idFrontUrl: signedUrl };
  if (key === "idBack") return { ...employee, idBackUrl: signedUrl };
  if (key === "idPdf") return { ...employee, idPdfUrl: signedUrl };
  return { ...employee, qrUrl: signedUrl };
};

export const storageService = {
  async getEmployeeAssets(employeeId: string): Promise<EmployeeAssetsResponse> {
    const employee = await employeeService.get(employeeId);
    if (!employee) throw new AppError(404, "EMPLOYEE_NOT_FOUND", "Employee record was not found.");

    const entries = await Promise.all(
      Object.entries(employeeAssetPaths(employee)).map(async ([key, path]) => [
        key,
        await signedUrlForPath(path)
      ] as const)
    );

    const assets = Object.fromEntries(entries.filter(([, info]) => Boolean(info))) as EmployeeAssetsResponse["assets"];
    const employeeWithUrls = Object.entries(assets).reduce(
      (current, [key, info]) => attachSignedUrl(current, key as EmployeeAssetKey, info?.signedUrl),
      employee
    );

    return {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      storageFolder: storageFolderForEmployee(employee),
      assets,
      employee: employeeWithUrls
    };
  },

  async uploadEmployeeAsset(
    employeeId: string,
    kind: UploadKind,
    body: Buffer,
    contentType: string | undefined,
    actor: string
  ): Promise<EmployeeAssetsResponse> {
    const employee = await employeeService.get(employeeId);
    if (!employee) throw new AppError(404, "EMPLOYEE_NOT_FOUND", "Employee record was not found.");
    if (!body.length) throw new AppError(400, "EMPTY_UPLOAD", "Uploaded file is empty.");

    const config = assetConfig[kind];
    const storageFolder = storageFolderForEmployee(employee);
    const path = `${storageFolder}/${config.fileName}`;
    const bucket = requireStorageClient();

    const { error } = await bucket.upload(path, body, {
      contentType: contentType || config.contentType,
      cacheControl: "0",
      upsert: true
    });
    if (error) throw new AppError(502, "SUPABASE_UPLOAD_FAILED", error.message);

    const signed = await signedUrlForPath(path);
    const patch = {
      storageFolder,
      [config.pathField]: path
    } as Partial<EmployeeRecord>;
    const updated = await employeeService.patch(employee.id, patch, actor);
    const employeeWithUrl = attachSignedUrl(updated, config.key, signed?.signedUrl);

    return {
      employeeId: updated.id,
      employeeNumber: updated.employeeNumber,
      storageFolder,
      assets: {
        [config.key]: {
          ...signed,
          contentType: contentType || config.contentType
        }
      },
      employee: employeeWithUrl
    };
  }
};

export type { UploadKind as EmployeeUploadKind };
