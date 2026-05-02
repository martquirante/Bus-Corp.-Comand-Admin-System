import type {
  AdminAccount,
  ApiEnvelope,
  DashboardStats,
  FleetBus,
  RevenueReport,
  RouteConfig,
  TransactionLog
} from "@pos-bus/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const SESSION_KEY = "posBusAdminSession";

type SessionPayload = {
  token: string;
  user: AdminAccount;
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

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "API request failed.");
  }

  return payload as ApiEnvelope<T>;
}

export const sessionStorageKey = SESSION_KEY;

export const api = {
  async login(email: string, password: string) {
    return apiFetch<SessionPayload>("/auth/session", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  async stats() {
    return apiFetch<DashboardStats>("/dashboard/stats");
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

  async createRoute(payload: Omit<RouteConfig, "id">) {
    return apiFetch<RouteConfig>("/routes", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async updateRoute(id: string, payload: Partial<RouteConfig>) {
    return apiFetch<RouteConfig>(`/routes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  async revenueReport() {
    return apiFetch<RevenueReport[]>("/reports/revenue");
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

  async patchAdmin(id: string, payload: Partial<AdminAccount>) {
    return apiFetch<AdminAccount>(`/admin/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  }
};
