import type { CriticalAlert } from "@pos-bus/shared";
import { firebasePaths } from "@pos-bus/shared";
import { extractFleet } from "./dataTransform.service.js";
import { firebaseService } from "./firebase.service.js";
import { realtimeDbService } from "./realtimeDb.service.js";
import { supabaseService } from "./supabase.service.js";

type AnyRecord = Record<string, any>;
type AlertState = Partial<Pick<CriticalAlert, "acknowledgedAt" | "acknowledgedBy" | "resolvedAt" | "resolvedBy" | "dismissedAt" | "dismissedBy">>;
type AlertStateMap = Record<string, AlertState>;

const criticalWords = [
  "sos",
  "s.o.s",
  "emergency",
  "critical",
  "urgent",
  "trouble",
  "breakdown",
  "accident",
  "collision",
  "stalled",
  "engine failure",
  "bus emergency"
];

const warningWords = ["assistance", "help", "pending", "open", "offline", "failed", "warning"];

const toRecord = (value: unknown): AnyRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};

const textOf = (...values: unknown[]) =>
  values
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(" ");

const normalized = (...values: unknown[]) => textOf(...values).toLowerCase();

const includesAny = (haystack: string, words: string[]) => words.some((word) => haystack.includes(word));

const toNumber = (value: unknown, fallback = Date.now()) => {
  if (typeof value === "string") {
    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) return parsedDate;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toCoordinate = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const stateKey = (id: string) => Buffer.from(id).toString("base64url");

const applyState = (alert: CriticalAlert, state: AlertStateMap): CriticalAlert => ({
  ...alert,
  ...(state[alert.stateKey] || {})
});

const itemTimestamp = (item: AnyRecord) =>
  toNumber(item.timestamp ?? item.createdAt ?? item.updatedAt ?? item.date ?? item.time ?? item.reportedAt, Date.now());

const severityForText = (text: string): CriticalAlert["severity"] =>
  includesAny(text, criticalWords) ? "critical" : "warning";

const assistanceAlerts = (root: AnyRecord, state: AlertStateMap): CriticalAlert[] =>
  Object.entries(toRecord(root[firebasePaths.assistanceRequests]))
    .map(([key, raw]) => {
      const item = toRecord(raw);
      const statusText = normalized(
        item.type,
        item.issueType,
        item.status,
        item.priority,
        item.reason,
        item.message,
        item.remarks,
        item.category
      );
      const isAttention = includesAny(statusText, criticalWords) || includesAny(statusText, warningWords);
      if (!isAttention) return null;

      const id = `assistance:${key}`;
      const busNumber = textOf(item.busNumber, item.busNo, item.bus).split(" ")[0] || undefined;
      return applyState(
        {
          id,
          stateKey: stateKey(id),
          source: "AssistanceRequests",
          sourceKey: key,
          severity: severityForText(statusText),
          title: busNumber ? `Bus assistance: ${busNumber}` : "Bus assistance request",
          issueType: textOf(item.issueType, item.type, item.category, "Assistance"),
          message: textOf(item.reason, item.message, item.remarks, "Assistance requested."),
          status: textOf(item.status, "pending"),
          priority: textOf(item.priority) || undefined,
          timestamp: itemTimestamp(item),
          busNumber,
          deviceId: textOf(item.deviceId, item.posDeviceId) || undefined,
          driver: textOf(item.driver, item.driverName) || undefined,
          conductor: textOf(item.conductor, item.conductorName) || undefined,
          reporter: textOf(item.requester, item.reporter, item.name) || undefined,
          reporterRole: textOf(item.role, item.reporterRole) || undefined,
          route: textOf(item.route, item.currentRoute) || undefined,
          contact: textOf(item.phone, item.contact, item.mobile) || undefined,
          locationText: textOf(item.location, item.lastLocation, item.address) || undefined,
          lat: toCoordinate(item.lat ?? item.latitude),
          lng: toCoordinate(item.lng ?? item.lon ?? item.longitude)
        },
        state
      );
    })
    .filter((alert): alert is CriticalAlert => Boolean(alert));

const deviceAlerts = (root: AnyRecord, state: AlertStateMap): CriticalAlert[] => {
  const alerts: CriticalAlert[] = [];
  const fleet = extractFleet(root);
  const fleetByDevice = new Map(fleet.map((bus) => [bus.id, bus]));

  Object.entries(toRecord(root[firebasePaths.posDevices])).forEach(([deviceId, raw]) => {
    const device = toRecord(raw);
    const live = toRecord(device.LiveStatus);
    const bus = fleetByDevice.get(deviceId);
    const issueText = normalized(
      live.emergencyStatus,
      live.status,
      live.priority,
      live.issueType,
      live.issue,
      live.trouble,
      live.alert,
      live.message,
      live.remarks
    );

    const emergencyFlag =
      live.emergencyStatus === true ||
      bus?.emergency ||
      includesAny(issueText, criticalWords);
    if (!emergencyFlag) return;

    const id = `device:${deviceId}:critical`;
    alerts.push(
      applyState(
        {
          id,
          stateKey: stateKey(id),
          source: "POS_Devices",
          sourceKey: deviceId,
          severity: "critical",
          title: `Bus emergency: ${bus?.busNumber || live.busNumber || deviceId}`,
          issueType: textOf(live.issueType, live.issue, live.status, "Bus Emergency"),
          message: textOf(live.message, live.remarks, live.trouble, "Device reported an emergency state."),
          status: textOf(live.status, live.emergencyStatus ? "sos" : "critical"),
          priority: textOf(live.priority, "critical"),
          timestamp: toNumber(live.lastUpdate ?? live.timestamp ?? live.updatedAt, Date.now()),
          busNumber: textOf(bus?.busNumber, live.busNumber, deviceId),
          deviceId,
          driver: textOf(bus?.driver, live.driver) || undefined,
          conductor: textOf(bus?.conductor, live.conductor) || undefined,
          reporter: textOf(live.reporter, live.driver, live.conductor) || undefined,
          reporterRole: textOf(live.reporterRole) || undefined,
          route: textOf(bus?.route, live.currentLoop, live.route) || undefined,
          contact: textOf(live.phone, live.contact) || undefined,
          locationText: textOf(live.location, live.lastLocation) || undefined,
          lat: toCoordinate(bus?.lat ?? live.lat ?? live.latitude),
          lng: toCoordinate(bus?.lng ?? live.lng ?? live.lon ?? live.longitude)
        },
        state
      )
    );
  });

  return alerts;
};

const messageAlerts = (root: AnyRecord, state: AlertStateMap): CriticalAlert[] =>
  Object.entries(toRecord(root[firebasePaths.messages]))
    .map(([key, raw]) => {
      const item = toRecord(raw);
      const messageText = normalized(item.type, item.issueType, item.status, item.priority, item.title, item.subject, item.message, item.body);
      if (!includesAny(messageText, criticalWords)) return null;

      const id = `message:${key}:critical`;
      return applyState(
        {
          id,
          stateKey: stateKey(id),
          source: "messages",
          sourceKey: key,
          severity: "critical",
          title: textOf(item.title, item.subject, "Critical message"),
          issueType: textOf(item.issueType, item.type, "Critical Message"),
          message: textOf(item.message, item.body, item.text, item.content, "Critical message received."),
          status: textOf(item.status, "critical"),
          priority: textOf(item.priority, "critical"),
          timestamp: itemTimestamp(item),
          busNumber: textOf(item.busNumber, item.busNo, item.bus) || undefined,
          deviceId: textOf(item.deviceId, item.posDeviceId) || undefined,
          driver: textOf(item.driver, item.driverName) || undefined,
          conductor: textOf(item.conductor, item.conductorName) || undefined,
          reporter: textOf(item.sender, item.reporter, item.name) || undefined,
          reporterRole: textOf(item.role, item.reporterRole) || undefined,
          route: textOf(item.route) || undefined,
          contact: textOf(item.phone, item.contact) || undefined,
          locationText: textOf(item.location, item.lastLocation) || undefined,
          lat: toCoordinate(item.lat ?? item.latitude),
          lng: toCoordinate(item.lng ?? item.lon ?? item.longitude)
        },
        state
      );
    })
    .filter((alert): alert is CriticalAlert => Boolean(alert));

export const criticalAlertService = {
  async getAlerts(): Promise<CriticalAlert[]> {
    const [root, state] = await Promise.all([
      firebaseService.getRootData(),
      realtimeDbService.getPath<AlertStateMap>(firebasePaths.criticalAlertState)
    ]);

    let archivedAlerts: CriticalAlert[] = [];
    try {
      archivedAlerts = await supabaseService.listCriticalAlerts();
    } catch (error) {
      console.warn("[critical-alerts] Supabase alert archive skipped.", error);
    }

    return [
      ...deviceAlerts(root, state || {}),
      ...assistanceAlerts(root, state || {}),
      ...messageAlerts(root, state || {}),
      ...archivedAlerts
    ].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
      return b.timestamp - a.timestamp;
    });
  },

  async getActiveAlerts() {
    const alerts = await this.getAlerts();
    return alerts.filter((alert) => {
      const status = alert.status.toLowerCase();
      return !alert.resolvedAt && !["resolved", "dismissed"].includes(status) && alert.severity === "critical";
    });
  },

  async acknowledge(id: string, actor: string) {
    const key = stateKey(id);
    const payload = { acknowledgedAt: Date.now(), acknowledgedBy: actor };
    await realtimeDbService.updatePath(`${firebasePaths.criticalAlertState}/${key}`, payload);
    await firebaseService.auditAction("critical_alert_acknowledge", actor, { id });
    return { id, ...payload };
  },

  async resolve(id: string, actor: string) {
    const key = stateKey(id);
    const payload = { resolvedAt: Date.now(), resolvedBy: actor };
    await realtimeDbService.updatePath(`${firebasePaths.criticalAlertState}/${key}`, payload);
    await firebaseService.auditAction("critical_alert_resolve", actor, { id });
    return { id, ...payload };
  },

  async dismiss(id: string, actor: string) {
    const key = stateKey(id);
    const payload = { dismissedAt: Date.now(), dismissedBy: actor };
    await realtimeDbService.updatePath(`${firebasePaths.criticalAlertState}/${key}`, payload);
    return { id, ...payload };
  }
};
