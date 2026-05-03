import type { LegacyNotification } from "@pos-bus/shared";
import { firebasePaths } from "@pos-bus/shared";
import { extractFleet } from "./dataTransform.service.js";
import { firebaseService } from "./firebase.service.js";
import { realtimeDbService } from "./realtimeDb.service.js";
import { supabaseService } from "./supabase.service.js";

type AnyRecord = Record<string, any>;
type ReadState = Record<string, { read?: boolean; readAt?: number }>;

const demoReads = new Set<string>();

const toRecord = (value: unknown): AnyRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "string") {
    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) return parsedDate;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const timestampOf = (item: AnyRecord) =>
  toNumber(item.timestamp ?? item.createdAt ?? item.updatedAt ?? item.date ?? item.time, Date.now());

const readKey = (id: string) => Buffer.from(id).toString("base64url");

const readFlag = (id: string, reads: ReadState) =>
  firebaseService.source() === "demo" ? demoReads.has(id) : Boolean(reads[readKey(id)]?.read);

const severityFromStatus = (status: unknown): LegacyNotification["severity"] => {
  const normalized = String(status || "").toLowerCase();
  if (["sos", "emergency", "urgent", "critical"].some((word) => normalized.includes(word))) {
    return "critical";
  }
  if (["pending", "open", "offline", "warning", "failed"].some((word) => normalized.includes(word))) {
    return "warning";
  }
  return "info";
};

const deriveNotifications = (root: AnyRecord, reads: ReadState): LegacyNotification[] => {
  const notifications: LegacyNotification[] = [];

  Object.entries(toRecord(root[firebasePaths.messages])).forEach(([key, rawValue]) => {
    const item = toRecord(rawValue);
    const id = `messages:${key}`;
    notifications.push({
      id,
      source: "messages",
      sourceKey: key,
      type: "message",
      severity: severityFromStatus(item.priority || item.status),
      title: String(item.title || item.subject || "New message"),
      body: String(item.message || item.body || item.text || item.content || "Message received."),
      timestamp: timestampOf(item),
      read: readFlag(id, reads)
    });
  });

  Object.entries(toRecord(root[firebasePaths.assistanceRequests])).forEach(([key, rawValue]) => {
    const item = toRecord(rawValue);
    const id = `assistance:${key}`;
    const bus = item.busNumber || item.busNo || item.bus;
    notifications.push({
      id,
      source: "AssistanceRequests",
      sourceKey: key,
      type: "assistance",
      severity: severityFromStatus(item.status || "pending"),
      title: bus ? `Assistance request from ${bus}` : "Assistance request",
      body: String(item.reason || item.message || item.type || "Assistance requested."),
      timestamp: timestampOf(item),
      read: readFlag(id, reads),
      actionTarget: bus ? String(bus) : undefined
    });
  });

  extractFleet(root).forEach((bus) => {
    if (bus.emergency) {
      const id = `device:${bus.id}:sos`;
      notifications.push({
        id,
        source: "POS_Devices",
        sourceKey: bus.id,
        type: "device",
        severity: "critical",
        title: `SOS active: ${bus.busNumber}`,
        body: `${bus.driver || "Driver"} needs immediate attention on ${bus.route || "unassigned route"}.`,
        timestamp: bus.lastUpdate || Date.now(),
        read: readFlag(id, reads),
        actionTarget: bus.busNumber
      });
    } else if (!bus.online) {
      const id = `device:${bus.id}:offline`;
      notifications.push({
        id,
        source: "POS_Devices",
        sourceKey: bus.id,
        type: "device",
        severity: "warning",
        title: `Offline POS device: ${bus.busNumber}`,
        body: `No LiveStatus update within the 5-minute health window.`,
        timestamp: bus.lastUpdate || Date.now(),
        read: readFlag(id, reads),
        actionTarget: bus.busNumber
      });
    }
  });

  Object.entries(toRecord(root[firebasePaths.expenses])).forEach(([key, rawValue]) => {
    const item = toRecord(rawValue);
    const amount = Number(item.amount || 0);
    if (amount < 10000) return;

    const id = `expenses:${key}`;
    notifications.push({
      id,
      source: "Expenses",
      sourceKey: key,
      type: "expense",
      severity: "info",
      title: "High expense logged",
      body: `${item.type || "Expense"} for ${item.bus || "General"}: PHP ${amount.toLocaleString("en-PH")}`,
      timestamp: timestampOf(item),
      read: readFlag(id, reads)
    });
  });

  return notifications.sort((a, b) => b.timestamp - a.timestamp);
};

export const notificationService = {
  async getNotifications(rootData?: AnyRecord): Promise<LegacyNotification[]> {
    const [root, reads] = await Promise.all([
      rootData ? Promise.resolve(rootData) : firebaseService.getRootData(),
      realtimeDbService.getPath<ReadState>(firebasePaths.notificationReads)
    ]);

    let archivedNotifications: LegacyNotification[] = [];
    try {
      archivedNotifications = await supabaseService.listNotifications();
    } catch (error) {
      console.warn("[notifications] Supabase notification archive skipped.", error);
    }

    return [...deriveNotifications(root, reads || {}), ...archivedNotifications].sort((a, b) => b.timestamp - a.timestamp);
  },

  async getUnreadCount(): Promise<{ count: number }> {
    const notifications = await this.getNotifications();
    return { count: notifications.filter((notification) => !notification.read).length };
  },

  async markRead(id: string): Promise<{ id: string; read: true }> {
    if (firebaseService.source() === "demo") {
      demoReads.add(id);
      return { id, read: true };
    }

    await realtimeDbService.setPath(`${firebasePaths.notificationReads}/${readKey(id)}`, {
      read: true,
      readAt: Date.now(),
      sourceId: id
    });

    return { id, read: true };
  },

  async markAllRead(): Promise<{ updated: number }> {
    const notifications = await this.getNotifications();

    if (firebaseService.source() === "demo") {
      notifications.forEach((notification) => demoReads.add(notification.id));
      return { updated: notifications.length };
    }

    const patch = Object.fromEntries(
      notifications.map((notification) => [
        readKey(notification.id),
        { read: true, readAt: Date.now(), sourceId: notification.id }
      ])
    );
    await realtimeDbService.updatePath(firebasePaths.notificationReads, patch);
    return { updated: notifications.length };
  }
};
