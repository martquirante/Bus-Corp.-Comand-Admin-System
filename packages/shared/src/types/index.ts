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

export type AdminRole =
  | "SuperAdmin"
  | "Admin"
  | "Conductor"
  | "Driver"
  | "Inspector"
  | "Mechanic"
  | "Passenger";

export type RouteStatus = "active" | "inactive" | "archived";

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
  routeName?: string;
  origin: string;
  destination: string;
  price: number;
  distance?: number;
  distanceKm?: number;
  estimatedDurationMinutes?: number;
  baseFare?: number;
  farePerKm?: number;
  status?: RouteStatus;
  isViceVersa?: boolean;
  reverseRouteId?: string;
  mapReferenceUrl?: string;
  assignedBusId?: string;
  assignedTripScheduleId?: string;
  stops?: RouteWaypoint[];
  waypoints?: RouteWaypoint[];
  source?: "legacy" | "admin" | "default" | "supabase";
  legacyPath?: "Routes_Forward" | "Routes_Reverse";
  legacyKey?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface RouteWaypoint {
  id?: string;
  name?: string;
  lat?: number;
  lng?: number;
  sequence?: number;
  type?: "origin" | "stop" | "destination" | "waypoint";
}

export interface AdminAccount {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  status: "pending" | "active" | "inactive";
  dateApproved?: string;
}

export interface RevenueReport {
  route: string;
  revenue: number;
  passengers: number;
}

export interface LegacyMessage {
  id: string;
  title: string;
  body: string;
  sender?: string;
  status?: string;
  timestamp: number;
}

export interface LegacyAssistanceRequest {
  id: string;
  requester: string;
  busNumber?: string;
  reason: string;
  status: string;
  timestamp: number;
}

export interface LegacyNotification {
  id: string;
  source: "messages" | "AssistanceRequests" | "POS_Devices" | "Expenses";
  sourceKey: string;
  type: "message" | "assistance" | "device" | "expense";
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  actionTarget?: string;
}

export interface CriticalAlert {
  id: string;
  stateKey: string;
  source: "AssistanceRequests" | "POS_Devices" | "messages";
  sourceKey: string;
  severity: "critical" | "warning";
  title: string;
  issueType: string;
  message: string;
  status: string;
  priority?: string;
  timestamp: number;
  busNumber?: string;
  deviceId?: string;
  driver?: string;
  conductor?: string;
  reporter?: string;
  reporterRole?: string;
  route?: string;
  contact?: string;
  locationText?: string;
  lat?: number | null;
  lng?: number | null;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolvedAt?: number;
  resolvedBy?: string;
  dismissedAt?: number;
  dismissedBy?: string;
}

export interface EmployeeRecord {
  id: string;
  employeeNumber: string;
  fullName: string;
  role: "admin" | "conductor" | "driver" | "inspector" | "mechanic";
  phone?: string;
  address?: string;
  email?: string;
  salaryRate?: number;
  salaryType?: "daily" | "monthly" | "trip" | "hourly";
  dateHired?: string;
  status: "active" | "inactive" | "pending";
  assignedBusId?: string;
  assignedRouteId?: string;
  pairedEmployeeId?: string;
  profilePhotoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BusFleetRecord {
  id: string;
  busNumber: string;
  plateNumber?: string;
  busType?: string;
  routeLine?: string;
  seatingCapacity?: number;
  standingCapacity?: number;
  currentPassengerCount?: number;
  status: "active" | "maintenance" | "inactive" | "offline";
  assignedDriverId?: string;
  assignedConductorId?: string;
  assignedRouteId?: string;
  registrationNotes?: string;
  ltfrbRouteNote?: string;
  insuranceInfo?: string;
  permitInfo?: string;
  lastMaintenance?: string;
  odometer?: number;
  fuelType?: string;
  photoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  timestamp: number;
  read?: boolean;
}

export interface ChatConversation {
  id: string;
  title: string;
  targetType: "employee" | "admin" | "customer";
  targetId?: string;
  lastMessage?: string;
  lastMessageAt?: number;
  unreadCount?: number;
}

export interface DashboardSummary {
  totalPosDevices: number;
  onlinePosDevices: number;
  offlinePosDevices: number;
  assistanceRequestCount: number;
  pendingAssistanceRequestCount: number;
  totalMessages: number;
  recentMessages: LegacyMessage[];
  expenseTotal: number;
  routeCount: number;
  recentAssistanceRequests: LegacyAssistanceRequest[];
  deviceHealth: FleetBus[];
  importantAlerts: LegacyNotification[];
  notificationSummary: {
    total: number;
    unread: number;
    critical: number;
  };
  liveRouteMapStatus: {
    routesForward: number;
    routesReverse: number;
    adminRoutes: number;
    busesWithGps: number;
    mapProviderConfigured: boolean;
    message: string;
  };
  stats: DashboardStats;
  databaseStatus?: {
    firebase: string;
    supabase: string;
    mode: string;
    auth?: string;
  };
  structuredTotals?: {
    employees: number;
    buses: number;
    routes: number;
    expenses: number;
    notifications: number;
    criticalAlerts: number;
    trips?: number;
    tickets?: number;
    payments?: number;
  };
  revenue?: {
    gross: number;
    expenses: number;
    net: number;
    source: "supabase.payments";
  };
  counts?: {
    transactions: number;
    payments: number;
    trips: number;
    passengers: number;
    buses: number;
    employees: number;
  };
  live?: {
    activeBuses: number;
    posDevices: number;
    currentPax: number;
    sosAlerts: number;
    assistanceRequests: number;
    source: "firebase.POS_Devices.LiveStatus";
  };
  status?: {
    firebase: string;
    supabase: string;
    auth: string;
  };
  lastUpdated: string;
}

export interface ApiEnvelope<T> {
  data: T;
  source: "firebase" | "rtdb-rest" | "demo";
  generatedAt: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
