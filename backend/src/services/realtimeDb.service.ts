import { AppError } from "../utils/appError.js";
import { firebaseService } from "./firebase.service.js";

const normalizePath = (path: string) => {
  const trimmed = path.trim();
  if (trimmed === "/" || trimmed === "") return "/";
  return trimmed.replace(/^\/+|\/+$/g, "");
};

const validatePath = (path: string) => {
  const normalized = normalizePath(path);

  if (normalized.includes("..") || normalized.includes("//")) {
    throw new AppError(400, "INVALID_FIREBASE_PATH", "Firebase path is not valid.");
  }

  const segments = normalized.split("/").filter(Boolean);
  const invalidSegment = segments.find((segment) => /[#$\[\]]/.test(segment));
  if (invalidSegment) {
    throw new AppError(400, "INVALID_FIREBASE_PATH", "Firebase path contains unsupported key characters.");
  }

  return normalized;
};

export const realtimeDbService = {
  async getPath<T>(path: string): Promise<T | null> {
    return firebaseService.getPath<T>(validatePath(path));
  },

  async setPath<T>(path: string, data: T): Promise<T> {
    return firebaseService.setPath(validatePath(path), data);
  },

  async updatePath<T extends Record<string, unknown>>(path: string, data: T): Promise<T> {
    return firebaseService.updatePath(validatePath(path), data);
  },

  async pushPath<T>(path: string, data: T): Promise<{ key: string; value: T }> {
    return firebaseService.pushPath(validatePath(path), data);
  },

  async deletePath(path: string): Promise<void> {
    return firebaseService.removePath(validatePath(path));
  }
};
