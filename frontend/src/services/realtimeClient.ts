"use client";

import type { ApiEnvelope, CriticalAlert, DashboardSummary } from "@pos-bus/shared";
import { apiBaseUrl, getSessionToken } from "@/services/api";

type StreamHandlers<T> = {
  onData: (payload: ApiEnvelope<T>) => void;
  onError?: (message: string) => void;
};

const streamUrl = (path: string) => {
  const token = getSessionToken();
  if (!token) return `${apiBaseUrl}${path}`;
  return `${apiBaseUrl}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
};

const createStream = <T>(path: string, eventName: string, handlers: StreamHandlers<T>) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const source = new EventSource(streamUrl(path), { withCredentials: false });

  source.addEventListener(eventName, (event) => {
    try {
      handlers.onData(JSON.parse((event as MessageEvent).data) as ApiEnvelope<T>);
    } catch {
      handlers.onError?.("Realtime payload could not be parsed.");
    }
  });

  source.addEventListener("error", () => {
    handlers.onError?.("Realtime stream disconnected. Polling fallback remains available.");
  });

  return () => source.close();
};

export const realtimeClient = {
  streamDashboard(handlers: StreamHandlers<DashboardSummary>) {
    return createStream<DashboardSummary>("/realtime/dashboard/stream", "dashboard", handlers);
  },

  streamCriticalAlerts(handlers: StreamHandlers<CriticalAlert[]>) {
    return createStream<CriticalAlert[]>("/realtime/critical-alerts/stream", "critical-alerts", handlers);
  }
};
