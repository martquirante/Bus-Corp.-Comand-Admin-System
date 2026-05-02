export type ThemeMode = "light" | "dark";

export type BusOperationalStatus =
  | "online"
  | "offline"
  | "idle"
  | "moving"
  | "fast"
  | "turning-left"
  | "turning-right"
  | "sos";

export type PaymentMethod = "cash" | "gcash" | "mixed" | "unknown";

export interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  activeBuses: number;
  totalPassengers: number;
  cashTotal: number;
  gcashTotal: number;
  totalTransactions: number;
  emergencyCount: number;
  lastUpdated: string;
}

export interface FleetBus {
  id: string;
  busNumber: string;
  driver: string;
  conductor: string;
  route: string;
  status: BusOperationalStatus;
  online: boolean;
  emergency: boolean;
  speed: number;
  lat: number | null;
  lng: number | null;
  cash: number;
  gcash: number;
  total: number;
  passengers: number;
  lastUpdate: number;
  heading?: number;
}

export interface TransactionLog {
  id: string;
  time: number | string | null;
  busNumber: string;
  driver: string;
  conductor: string;
  origin: string;
  destination: string;
  route: string;
  passengerType: string;
  passengerCount: number;
  paymentMethod: PaymentMethod;
  amount: number;
  tripId?: string;
  deviceId?: string;
}

export interface RouteConfig {
  id: string;
  direction: "forward" | "reverse";
  origin: string;
  destination: string;
  price: number;
  distance?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface AdminAccount {
  id: string;
  fullName: string;
  email: string;
  role: "SuperAdmin" | "Admin" | "Conductor" | "Driver" | "Inspector";
  status: "pending" | "active" | "inactive";
  dateApproved?: string;
}

export interface RevenueReport {
  route: string;
  revenue: number;
  passengers: number;
}

export interface ApiEnvelope<T> {
  data: T;
  source: "firebase" | "demo";
  generatedAt: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
