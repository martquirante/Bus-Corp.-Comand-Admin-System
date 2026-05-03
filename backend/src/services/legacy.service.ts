import { firebasePaths } from "@pos-bus/shared";
import { realtimeDbService } from "./realtimeDb.service.js";
import { firebaseService } from "./firebase.service.js";

const legacyPathMap = {
  assistanceRequests: firebasePaths.assistanceRequests,
  config: firebasePaths.config,
  expenses: firebasePaths.expenses,
  posDevices: firebasePaths.posDevices,
  routesForward: firebasePaths.routesForward,
  routesReverse: firebasePaths.routesReverse,
  messages: firebasePaths.messages
} as const;

export type LegacyPathKey = keyof typeof legacyPathMap;

export const legacyService = {
  pathFor(key: LegacyPathKey) {
    return legacyPathMap[key];
  },

  async getLegacyPath<T>(key: LegacyPathKey): Promise<T | null> {
    return realtimeDbService.getPath<T>(legacyPathMap[key]);
  },

  async patchConfig(payload: Record<string, unknown>, actor = "system") {
    const result = await realtimeDbService.updatePath(firebasePaths.config, payload);
    await firebaseService.auditAction("legacy.config.patch", actor, { keys: Object.keys(payload) });
    return result;
  },

  async patchAssistanceRequest(id: string, payload: Record<string, unknown>, actor = "system") {
    const result = await realtimeDbService.updatePath(`${firebasePaths.assistanceRequests}/${id}`, {
      ...payload,
      updatedAt: Date.now()
    });
    await firebaseService.auditAction("legacy.assistance.patch", actor, { id });
    return result;
  },

  async postMessage(payload: Record<string, unknown>, actor = "system") {
    const result = await realtimeDbService.pushPath(firebasePaths.messages, {
      ...payload,
      createdAt: payload.createdAt || Date.now(),
      createdBy: payload.createdBy || actor
    });
    await firebaseService.auditAction("legacy.messages.create", actor, { id: result.key });
    return result;
  },

  async patchMessage(id: string, payload: Record<string, unknown>, actor = "system") {
    const result = await realtimeDbService.updatePath(`${firebasePaths.messages}/${id}`, {
      ...payload,
      updatedAt: Date.now()
    });
    await firebaseService.auditAction("legacy.messages.patch", actor, { id });
    return result;
  }
};
