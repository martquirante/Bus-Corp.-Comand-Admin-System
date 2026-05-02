import { firebasePaths } from "@pos-bus/shared";
import { env } from "../config/env.js";
import { isFirebaseReady, realtimeDb } from "../config/firebase.js";
import { AppError } from "../utils/appError.js";
import { demoRootData } from "./demoData.js";

type RootData = typeof demoRootData & Record<string, unknown>;

const resolvePath = (path: string) => path.replace(/^\/+/, "");

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

const requireWritableDatabase = () => {
  if (!realtimeDb) {
    throw new AppError(
      503,
      "FIREBASE_NOT_CONFIGURED",
      "Firebase Admin credentials are not configured. Writes are disabled outside Firebase-backed environments."
    );
  }

  return realtimeDb;
};

export const firebaseService = {
  source: (): "firebase" | "demo" => (isFirebaseReady ? "firebase" : "demo"),

  async getRootData(): Promise<RootData> {
    if (!realtimeDb) return demoRootData;

    try {
      const snapshot = await realtimeDb.ref(firebasePaths.root).get();
      return (snapshot.val() || {}) as RootData;
    } catch (error) {
      if (env.ENABLE_DEMO_FALLBACK) return demoRootData;
      throw error;
    }
  },

  async getPath<T>(path: string): Promise<T | null> {
    if (!realtimeDb) {
      return (getDemoPath(path) as T | undefined) ?? null;
    }

    const snapshot = await realtimeDb.ref(path).get();
    return snapshot.exists() ? (snapshot.val() as T) : null;
  },

  async setPath<T>(path: string, payload: T): Promise<T> {
    const db = requireWritableDatabase();
    await db.ref(path).set(payload);
    return payload;
  },

  async updatePath<T extends Record<string, unknown>>(path: string, payload: T): Promise<T> {
    const db = requireWritableDatabase();
    await db.ref(path).update(payload);
    return payload;
  },

  async pushPath<T>(path: string, payload: T): Promise<{ key: string; value: T }> {
    const db = requireWritableDatabase();
    const ref = db.ref(path).push();
    await ref.set(payload);
    return { key: ref.key || "", value: payload };
  },

  async removePath(path: string): Promise<void> {
    const db = requireWritableDatabase();
    await db.ref(path).remove();
  },

  async auditAction(action: string, actor: string, metadata: Record<string, unknown>) {
    if (!realtimeDb) return;

    await realtimeDb.ref(firebasePaths.auditLogs).push({
      action,
      actor,
      metadata,
      timestamp: Date.now()
    });
  }
};
