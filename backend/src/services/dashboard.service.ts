import type {
  DashboardSummary,
  LegacyAssistanceRequest,
  LegacyMessage
} from "@pos-bus/shared";
import { firebasePaths } from "@pos-bus/shared";
import { buildDashboardStats, extractExpensesTotal, extractFleet } from "./dataTransform.service.js";
import { firebaseService } from "./firebase.service.js";
import { notificationService } from "./notification.service.js";

type AnyRecord = Record<string, any>;

const toRecord = (value: unknown): AnyRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};

const toArray = <T>(value: unknown, mapper: (key: string, item: AnyRecord) => T): T[] =>
  Object.entries(toRecord(value)).map(([key, item]) => mapper(key, toRecord(item)));

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "string") {
    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) return parsedDate;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const timestampOf = (item: AnyRecord) =>
  toNumber(item.timestamp ?? item.createdAt ?? item.updatedAt ?? item.date ?? item.time, 0);

const recentFirst = <T extends { timestamp: number }>(items: T[], limit: number) =>
  items.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);

const normalizeMessage = (id: string, item: AnyRecord): LegacyMessage => ({
  id,
  title: String(item.title || item.subject || item.sender || "Message"),
  body: String(item.message || item.body || item.text || item.content || "No message body."),
  sender: item.sender || item.from || item.createdBy,
  status: item.status,
  timestamp: timestampOf(item)
});

const normalizeAssistance = (id: string, item: AnyRecord): LegacyAssistanceRequest => ({
  id,
  requester: String(item.requester || item.name || item.driver || item.conductor || "Unknown requester"),
  busNumber: item.busNumber || item.busNo || item.bus,
  reason: String(item.reason || item.message || item.type || "Assistance requested"),
  status: String(item.status || item.state || "pending"),
  timestamp: timestampOf(item)
});

const countMap = (value: unknown) => Object.keys(toRecord(value)).length;

const isPending = (status: string) => {
  const normalized = status.toLowerCase();
  return ["pending", "open", "new", "active", "unread"].some((word) => normalized.includes(word));
};

export const dashboardService = {
  async getStats() {
    const root = await firebaseService.getRootData();
    return buildDashboardStats(root);
  },

  async getSummary(): Promise<DashboardSummary> {
    const root = await firebaseService.getRootData();
    const stats = buildDashboardStats(root);
    const fleet = extractFleet(root);
    const assistance = recentFirst(
      toArray(root[firebasePaths.assistanceRequests], normalizeAssistance),
      8
    );
    const messages = recentFirst(toArray(root[firebasePaths.messages], normalizeMessage), 8);
    const notifications = await notificationService.getNotifications(root);
    const routeCount = countMap(root[firebasePaths.adminRoutes]);
    const busesWithGps = fleet.filter((bus) => bus.lat !== null && bus.lng !== null).length;

    return {
      totalPosDevices: countMap(root[firebasePaths.posDevices]),
      onlinePosDevices: fleet.filter((bus) => bus.online).length,
      offlinePosDevices: fleet.filter((bus) => !bus.online).length,
      assistanceRequestCount: countMap(root[firebasePaths.assistanceRequests]),
      pendingAssistanceRequestCount: assistance.filter((request) => isPending(request.status)).length,
      totalMessages: countMap(root[firebasePaths.messages]),
      recentMessages: messages,
      expenseTotal: extractExpensesTotal(root),
      routeCount,
      recentAssistanceRequests: assistance,
      deviceHealth: fleet,
      importantAlerts: notifications.filter((item) => item.severity !== "info").slice(0, 8),
      notificationSummary: {
        total: notifications.length,
        unread: notifications.filter((item) => !item.read).length,
        critical: notifications.filter((item) => item.severity === "critical").length
      },
      liveRouteMapStatus: {
        routesForward: countMap(root[firebasePaths.routesForward]),
        routesReverse: countMap(root[firebasePaths.routesReverse]),
        adminRoutes: countMap(root[firebasePaths.adminRoutes]),
        busesWithGps,
        mapProviderConfigured: false,
        message:
          busesWithGps > 0
            ? "Live GPS coordinates detected from POS_Devices."
            : "No live GPS data yet. Showing command-center route preview."
      },
      stats,
      lastUpdated: new Date().toISOString()
    };
  }
};
