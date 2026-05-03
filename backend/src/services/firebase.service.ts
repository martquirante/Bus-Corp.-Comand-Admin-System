import type { ApiEnvelope } from "@pos-bus/shared";
import { firebasePaths } from "@pos-bus/shared";
import { env } from "../config/env.js";
import { isFirebaseReady, realtimeDb } from "../config/firebase.js";
import { AppError } from "../utils/appError.js";
import { demoRootData } from "./demoData.js";

type RootData = Record<string, unknown>;
type Source = ApiEnvelope<unknown>["source"];

const resolvePath = (path: string) => path.replace(/^\/+|\/+$/g, "");

const getDemoPath = (path: string): unknown => {
  if (path === "/" || path === "") return demoRootData;
  return resolvePath(path)
    .split("/")
    .filter(Boolean)
    .reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object" && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, demoRootData);
};

const databaseUrl = () => env.FIREBASE_DATABASE_URL?.replace(/\/+$/, "");

const hasRtdbRest = () => Boolean(databaseUrl());

const pathToRestUrl = (path: string) => {
  const baseUrl = databaseUrl();
  if (!baseUrl) {
    throw new AppError(
      503,
      "FIREBASE_DATABASE_URL_MISSING",
      "FIREBASE_DATABASE_URL is required for Realtime Database REST access."
    );
  }

  const cleanPath = resolvePath(path);
  return cleanPath ? `${baseUrl}/${cleanPath}.json` : `${baseUrl}/.json`;
};

const readRestPath = async <T>(path: string): Promise<T | null> => {
  const response = await fetch(pathToRestUrl(path), {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new AppError(
      response.status,
      "RTDB_REST_READ_FAILED",
      `Realtime Database REST read failed for ${path}.`,
      await response.text()
    );
  }

  return (await response.json()) as T | null;
};

const writeRestPath = async <T>(method: "PUT" | "PATCH" | "POST" | "DELETE", path: string, payload?: T) => {
  const response = await fetch(pathToRestUrl(path), {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new AppError(
      response.status,
      "RTDB_REST_WRITE_FAILED",
      `Realtime Database REST write failed for ${path}.`,
      await response.text()
    );
  }

  return response.json();
};

const requireReadableSource = () => {
  if (realtimeDb || hasRtdbRest() || env.ENABLE_DEMO_FALLBACK) return;

  throw new AppError(
    503,
    "FIREBASE_NOT_CONFIGURED",
    "Configure Firebase Admin credentials or FIREBASE_DATABASE_URL to read Realtime Database data."
  );
};

const currentSource = (): Source => {
  if (isFirebaseReady) return "firebase";
  if (hasRtdbRest()) return "rtdb-rest";
  return "demo";
};

export const firebaseService = {
  source: currentSource,

  async getRootData(): Promise<RootData> {
    requireReadableSource();

    if (realtimeDb) {
      try {
        const snapshot = await realtimeDb.ref(firebasePaths.root).get();
        return (snapshot.val() || {}) as RootData;
      } catch (error) {
        if (!hasRtdbRest()) throw error;
      }
    }

    if (hasRtdbRest()) {
      return ((await readRestPath<RootData>(firebasePaths.root)) || {}) as RootData;
    }

    if (env.ENABLE_DEMO_FALLBACK) return demoRootData;
    return {};
  },

  async getPath<T>(path: string): Promise<T | null> {
    requireReadableSource();

    if (realtimeDb) {
      try {
        const snapshot = await realtimeDb.ref(path).get();
        return snapshot.exists() ? (snapshot.val() as T) : null;
      } catch (error) {
        if (!hasRtdbRest()) throw error;
      }
    }

    if (hasRtdbRest()) return readRestPath<T>(path);

    if (env.ENABLE_DEMO_FALLBACK) {
      return (getDemoPath(path) as T | undefined) ?? null;
    }

    return null;
  },

  async setPath<T>(path: string, payload: T): Promise<T> {
    if (realtimeDb) {
      await realtimeDb.ref(path).set(payload);
      return payload;
    }

    if (hasRtdbRest()) {
      await writeRestPath("PUT", path, payload);
      return payload;
    }

    throw new AppError(503, "FIREBASE_NOT_CONFIGURED", "Realtime Database writes require Firebase configuration.");
  },

  async updatePath<T extends Record<string, unknown>>(path: string, payload: T): Promise<T> {
    if (realtimeDb) {
      await realtimeDb.ref(path).update(payload);
      return payload;
    }

    if (hasRtdbRest()) {
      await writeRestPath("PATCH", path, payload);
      return payload;
    }

    throw new AppError(503, "FIREBASE_NOT_CONFIGURED", "Realtime Database writes require Firebase configuration.");
  },

  async pushPath<T>(path: string, payload: T): Promise<{ key: string; value: T }> {
    if (realtimeDb) {
      const ref = realtimeDb.ref(path).push();
      await ref.set(payload);
      return { key: ref.key || "", value: payload };
    }

    if (hasRtdbRest()) {
      const result = (await writeRestPath("POST", path, payload)) as { name?: string };
      return { key: result.name || "", value: payload };
    }

    throw new AppError(503, "FIREBASE_NOT_CONFIGURED", "Realtime Database writes require Firebase configuration.");
  },

  async removePath(path: string): Promise<void> {
    if (realtimeDb) {
      await realtimeDb.ref(path).remove();
      return;
    }

    if (hasRtdbRest()) {
      await writeRestPath("DELETE", path);
      return;
    }

    throw new AppError(503, "FIREBASE_NOT_CONFIGURED", "Realtime Database writes require Firebase configuration.");
  },

  async auditAction(action: string, actor: string, metadata: Record<string, unknown>) {
    try {
      await this.pushPath(firebasePaths.auditLogs, {
        action,
        actor,
        metadata,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn("Audit log write skipped:", error instanceof Error ? error.message : error);
    }
  }
};
