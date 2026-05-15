import type {
  AdminAccount,
  ApiEnvelope,
  BusFleetRecord,
  ChatConversation,
  ChatMessage,
  CriticalAlert,
  DashboardSummary,
  DashboardStats,
  EmployeeAssetsResponse,
  EmployeeRecord,
  EmployeeViolationRecord,
  FleetBus,
  LegacyAssistanceRequest,
  LegacyMessage,
  LegacyNotification,
  RemittanceRecord,
  RevenueReport,
  RouteConfig,
  TransactionLog
} from "@pos-bus/shared";

const normalizeApiBaseUrl = (value?: string) => {
  const base = (value || "http://localhost:5000").replace(/\/+$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
};

const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
const SESSION_KEY = "posBusAdminSession";

type SessionPayload = {
  token: string;
  user: AdminAccount;
};

type HealthPayload = {
  status: "ok";
  service: string;
  firebase: "connected" | "rtdb-rest" | "not-configured";
  supabase: "connected" | "not-configured" | "error";
  supabaseMode: "service-role" | "postgres" | "not-configured";
  auth: "dev-bypass" | "protected";
  currentMode: string;
  uptime: number;
};

type SqlSyncStatus = {
  configured: boolean;
  status: string;
  mode: string;
  target: string;
  liveSource: string;
  supportedTables: string[];
};

type SqlSyncResult = {
  synced: boolean;
  reason?: string;
  snapshotId?: string;
  createdAt?: string;
  summary: Record<string, unknown>;
};

type RouteWaypointPayload = NonNullable<RouteConfig["waypoints"]>[number] & {
  lineId?: string;
  direction?: RouteConfig["direction"];
  origin?: string;
  destination?: string;
};

export type RoutePathPayload = {
  waypoints: RouteWaypointPayload[];
  routeName?: string;
  origin?: string;
  destination?: string;
  direction?: RouteConfig["direction"];
  reverseRouteId?: string;
  status?: RouteConfig["status"];
  price?: number;
  baseFare?: number;
  isViceVersa?: boolean;
  // Line metadata is persisted with the path so Route Config and Live Fleet Map
  // can match the saved road path without falling back to legacy fare stops.
  lineId?: string;
  routeGroup?: string;
  distanceKm?: number;
  estimatedDurationMinutes?: number;
  trafficDurationMinutes?: number;
  encodedPolyline?: string;

  /**
   * Keep this as string instead of RouteConfig["routeGeometrySource"]
   * so frontend does not break if @pos-bus/shared/dist is stale.
   */
  routeGeometrySource?: string;
  plannedByAdmin?: boolean;

  mapReferenceUrl?: string;
};

export type RouteRecalculatePayload = {
  origin?: string;
  destination?: string;
  waypoints?: RouteWaypointPayload[];
  mapReferenceUrl?: string;
};

export type RouteRecalculateResult = {
  preview: boolean;
  routeId: string;
  waypoints: RouteWaypointPayload[];
  distanceKm?: number;
  estimatedDurationMinutes?: number;
  trafficDurationMinutes?: number;
  encodedPolyline?: string;
  routeGeometrySource?: string;
  message?: string;
};

const getToken = () => {
  if (typeof window === "undefined") return "";

  const stored = window.localStorage.getItem(SESSION_KEY);
  if (!stored) return "";

  try {
    return (JSON.parse(stored) as SessionPayload).token || "";
  } catch {
    return "";
  }
};

export const getSessionToken = getToken;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || "API request failed.");
  }

  return payload as ApiEnvelope<T>;
}

async function apiUpload<T>(path: string, file: Blob, contentType?: string): Promise<ApiEnvelope<T>> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": contentType || file.type || "application/octet-stream"
    },
    body: file,
    cache: "no-store"
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || "API upload failed.");
  }

  return payload as ApiEnvelope<T>;
}

export const sessionStorageKey = SESSION_KEY;
export const apiBaseUrl = API_BASE_URL;

export const api = {
  async health() {
    return apiFetch<HealthPayload>("/health");
  },

  async syncStatus() {
    return apiFetch<SqlSyncStatus>("/sync/status");
  },

  async syncRealtimeToSql() {
    return apiFetch<SqlSyncResult>("/sync/firebase-to-supabase", {
      method: "POST"
    });
  },

  async login(email: string, password: string) {
    return apiFetch<SessionPayload>("/auth/session", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  async stats() {
    return apiFetch<DashboardStats>("/dashboard/stats");
  },

  async getDashboardSummary() {
    return apiFetch<DashboardSummary>("/dashboard/summary");
  },

  async dashboard() {
    return apiFetch<DashboardSummary>("/dashboard");
  },

  async fleet() {
    return apiFetch<FleetBus[]>("/fleet/live");
  },

  async transactions(filters?: Partial<{ bus: string; type: string; route: string; limit: number }>) {
    const query = new URLSearchParams();

    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });

    return apiFetch<TransactionLog[]>(`/transactions${query.size ? `?${query}` : ""}`);
  },

  async routes(direction?: RouteConfig["direction"]) {
    return apiFetch<RouteConfig[]>(`/routes${direction ? `?direction=${direction}` : ""}`);
  },

  async getRoute(id: string) {
    return apiFetch<RouteConfig | null>(`/routes/${encodeURIComponent(id)}`);
  },

  async getRouteWaypoints(id: string) {
    return apiFetch<RouteWaypointPayload[]>(
      `/routes/${encodeURIComponent(id)}/waypoints`
    );
  },

  async getRouteStops(id: string) {
    return apiFetch<RouteWaypointPayload[]>(
      `/routes/${encodeURIComponent(id)}/stops`
    );
  },

  async syncRouteToSupabase(id: string) {
    return apiFetch<Record<string, unknown>>(
      `/routes/${encodeURIComponent(id)}/sync-to-supabase`,
      {
        method: "POST"
      }
    );
  },

  async getLegacyRoutesForward() {
    return apiFetch<RouteConfig[]>("/routes/legacy/forward");
  },

  async getLegacyRoutesReverse() {
    return apiFetch<RouteConfig[]>("/routes/legacy/reverse");
  },

  async updateLegacyRoute(
    direction: RouteConfig["direction"],
    key: string,
    payload: Partial<RouteConfig> & Record<string, unknown>
  ) {
    return apiFetch<RouteConfig>(
      `/routes/legacy/${encodeURIComponent(direction)}/${encodeURIComponent(key)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      }
    );
  },

  async createLegacyRoute(
    direction: RouteConfig["direction"],
    payload: Partial<RouteConfig> & Record<string, unknown>
  ) {
    return apiFetch<RouteConfig>(`/routes/legacy/${encodeURIComponent(direction)}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async deleteLegacyRoute(direction: RouteConfig["direction"], key: string) {
    return apiFetch<{ deleted: true; direction: string; key: string }>(
      `/routes/legacy/${encodeURIComponent(direction)}/${encodeURIComponent(key)}`,
      {
        method: "DELETE"
      }
    );
  },

  async createRoute(payload: Omit<RouteConfig, "id"> & Record<string, unknown>) {
    return apiFetch<RouteConfig>("/routes", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async updateRoute(id: string, payload: Partial<RouteConfig> & Record<string, unknown>) {
    return apiFetch<RouteConfig>(`/routes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  async updateRoutePath(id: string, payload: RoutePathPayload) {
    return apiFetch<RouteConfig>(`/routes/${encodeURIComponent(id)}/path`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  async recalculateRoutePath(id: string, payload: RouteRecalculatePayload) {
    return apiFetch<RouteRecalculateResult>(
      `/routes/${encodeURIComponent(id)}/recalculate-path`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
  },

  async updateRouteReference(id: string, mapReferenceUrl: string) {
    return apiFetch<RouteConfig>(`/routes/${encodeURIComponent(id)}/reference`, {
      method: "PATCH",
      body: JSON.stringify({
        mapReferenceUrl
      })
    });
  },

  async updateRouteStatus(id: string, status: RouteConfig["status"]) {
    return apiFetch<RouteConfig>(`/routes/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  },

  async getAssistanceRequests() {
    return apiFetch<Record<string, LegacyAssistanceRequest>>("/legacy/assistance-requests");
  },

  async getConfig() {
    return apiFetch<Record<string, unknown>>("/legacy/config");
  },

  async getExpenses() {
    return apiFetch<Record<string, unknown>>("/legacy/expenses");
  },

  async expenses() {
    return apiFetch<Record<string, unknown>>("/expenses");
  },

  async createExpense(payload: Record<string, unknown>) {
    return apiFetch<Record<string, unknown>>("/expenses", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async getPosDevices() {
    return apiFetch<Record<string, unknown>>("/legacy/pos-devices");
  },

  async getRoutesForward() {
    return apiFetch<Record<string, unknown>>("/legacy/routes-forward");
  },

  async getRoutesReverse() {
    return apiFetch<Record<string, unknown>>("/legacy/routes-reverse");
  },

  async getMessages() {
    return apiFetch<Record<string, LegacyMessage>>("/legacy/messages");
  },

  async getNotifications() {
    return apiFetch<LegacyNotification[]>("/notifications");
  },

  async getUnreadNotificationCount() {
    return apiFetch<{ count: number }>("/notifications/unread-count");
  },

  async getCriticalAlerts() {
    return apiFetch<CriticalAlert[]>("/critical-alerts");
  },

  async getActiveCriticalAlerts() {
    return apiFetch<CriticalAlert[]>("/critical-alerts/active");
  },

  async acknowledgeCriticalAlert(id: string) {
    return apiFetch<{ id: string; acknowledgedAt: number; acknowledgedBy: string }>(
      `/critical-alerts/${encodeURIComponent(id)}/acknowledge`,
      {
        method: "PATCH"
      }
    );
  },

  async resolveCriticalAlert(id: string) {
    return apiFetch<{ id: string; resolvedAt: number; resolvedBy: string }>(
      `/critical-alerts/${encodeURIComponent(id)}/resolve`,
      {
        method: "PATCH"
      }
    );
  },

  async dismissCriticalAlert(id: string) {
    return apiFetch<{ id: string; dismissedAt: number; dismissedBy: string }>(
      `/critical-alerts/${encodeURIComponent(id)}/dismiss`,
      {
        method: "PATCH"
      }
    );
  },

  async markNotificationRead(id: string) {
    return apiFetch<{ id: string; read: true }>(
      `/notifications/${encodeURIComponent(id)}/read`,
      {
        method: "PATCH"
      }
    );
  },

  async markAllNotificationsRead() {
    return apiFetch<{ updated: number }>("/notifications/read-all", {
      method: "PATCH"
    });
  },

  async revenueReport() {
    return apiFetch<RevenueReport[]>("/reports/revenue");
  },

  async analyticsSummary() {
    return apiFetch<Record<string, unknown>>("/analytics/summary");
  },

  async adminAccounts() {
    return apiFetch<AdminAccount[]>("/admin/accounts");
  },

  async createAdmin(payload: Omit<AdminAccount, "id"> & { password?: string }) {
    return apiFetch<AdminAccount>("/admin/accounts", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async patchAdmin(id: string, payload: Partial<AdminAccount> & { password?: string }) {
    return apiFetch<AdminAccount>(`/admin/accounts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  async employees() {
    return apiFetch<EmployeeRecord[]>("/employees");
  },

  async createEmployee(payload: Partial<EmployeeRecord>) {
    return apiFetch<EmployeeRecord>("/employees", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async patchEmployee(id: string, payload: Partial<EmployeeRecord>) {
    return apiFetch<EmployeeRecord>(`/employees/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  async uploadEmployeePhoto(employeeId: string, file: Blob) {
    return apiUpload<EmployeeAssetsResponse>(`/storage/employee/${encodeURIComponent(employeeId)}/photo`, file, file.type || "image/png");
  },

  async uploadEmployeeSignature(employeeId: string, file: Blob) {
    return apiUpload<EmployeeAssetsResponse>(
      `/storage/employee/${encodeURIComponent(employeeId)}/signature`,
      file,
      file.type || "image/png"
    );
  },

  async uploadEmployeeIdFront(employeeId: string, file: Blob) {
    return apiUpload<EmployeeAssetsResponse>(
      `/storage/employee/${encodeURIComponent(employeeId)}/id-front`,
      file,
      "image/png"
    );
  },

  async uploadEmployeeIdBack(employeeId: string, file: Blob) {
    return apiUpload<EmployeeAssetsResponse>(
      `/storage/employee/${encodeURIComponent(employeeId)}/id-back`,
      file,
      "image/png"
    );
  },

  async uploadEmployeeIdPdf(employeeId: string, file: Blob) {
    return apiUpload<EmployeeAssetsResponse>(
      `/storage/employee/${encodeURIComponent(employeeId)}/id-pdf`,
      file,
      "application/pdf"
    );
  },

  async uploadEmployeeQr(employeeId: string, file: Blob) {
    return apiUpload<EmployeeAssetsResponse>(`/storage/employee/${encodeURIComponent(employeeId)}/qr`, file, "image/png");
  },

  async getEmployeeAssets(employeeId: string) {
    return apiFetch<EmployeeAssetsResponse>(`/storage/employee/${encodeURIComponent(employeeId)}/assets`);
  },

  async buses() {
    return apiFetch<BusFleetRecord[]>("/buses");
  },

  async createBus(payload: Partial<BusFleetRecord>) {
    return apiFetch<BusFleetRecord>("/buses", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async patchBus(id: string, payload: Partial<BusFleetRecord>) {
    return apiFetch<BusFleetRecord>(`/buses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  async chatConversations() {
    return apiFetch<ChatConversation[]>("/messages/conversations");
  },

  async chatMessages(conversationId: string) {
    return apiFetch<ChatMessage[]>(
      `/messages/conversations/${encodeURIComponent(conversationId)}`
    );
  },

  async sendChatMessage(conversationId: string, payload: Partial<ChatMessage>) {
    return apiFetch<ChatMessage>(
      `/messages/conversations/${encodeURIComponent(conversationId)}/send`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
  },

  // ─── Bus Photo Upload ──────────────────────────────────────────────────

  async uploadBusPhoto(busId: string, file: Blob) {
    return apiUpload<{ busId: string; photoPath: string; photoUrl: string }>(
      `/storage/bus/${encodeURIComponent(busId)}/photo`,
      file,
      file.type || "image/png"
    );
  },

  async uploadBusDocument(busId: string, docType: string, file: Blob) {
    return apiUpload<{ busId: string; docType: string; docPath: string; docUrl: string }>(
      `/storage/bus/${encodeURIComponent(busId)}/documents/${encodeURIComponent(docType)}`,
      file,
      file.type || "application/pdf"
    );
  },

  // ─── Remittances ──────────────────────────────────────────────────────

  async remittances(filters?: Partial<{ conductorId: string; status: string; date: string }>) {
    const query = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    return apiFetch<RemittanceRecord[]>(`/remittances${query.size ? `?${query}` : ""}`);
  },

  async createRemittance(payload: Partial<RemittanceRecord>) {
    return apiFetch<RemittanceRecord>("/remittances", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async patchRemittance(id: string, payload: Partial<RemittanceRecord>) {
    return apiFetch<RemittanceRecord>(`/remittances/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  async receiveRemittance(id: string, payload?: { cashierId?: string; notes?: string }) {
    return apiFetch<RemittanceRecord>(`/remittances/${encodeURIComponent(id)}/receive`, {
      method: "PATCH",
      body: JSON.stringify(payload || {})
    });
  },

  async rejectRemittance(id: string, payload?: { notes?: string }) {
    return apiFetch<RemittanceRecord>(`/remittances/${encodeURIComponent(id)}/reject`, {
      method: "PATCH",
      body: JSON.stringify(payload || {})
    });
  },

  // ─── Employee Violations ───────────────────────────────────────────────

  async employeeViolations(filters?: Partial<{ employeeId: string; status: string; severity: string }>) {
    const query = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    return apiFetch<EmployeeViolationRecord[]>(`/employee-violations${query.size ? `?${query}` : ""}`);
  },

  async getEmployeeViolations(employeeId: string) {
    return apiFetch<EmployeeViolationRecord[]>(`/employees/${encodeURIComponent(employeeId)}/violations`);
  },

  async createViolation(payload: Partial<EmployeeViolationRecord>) {
    return apiFetch<EmployeeViolationRecord>("/employee-violations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async patchViolation(id: string, payload: Partial<EmployeeViolationRecord>) {
    return apiFetch<EmployeeViolationRecord>(`/employee-violations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  async patchViolationStatus(id: string, payload: Pick<Partial<EmployeeViolationRecord>, "status" | "resolutionNotes">) {
    return apiFetch<EmployeeViolationRecord>(`/employee-violations/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  }
};
