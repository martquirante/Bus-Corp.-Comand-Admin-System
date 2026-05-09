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

export type RouteDirection = "forward" | "reverse";

export type MainRouteLineId = "fvr-pitx" | "fvr-stcruz" | "hidden" | string;

export type BusType = "aircon" | "ordinary";

export type PassengerFareType = "regular" | "student" | "senior" | "pwd" | "discounted";

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
  busType?: BusType | string;
  assignedRouteId?: string;
  lineId?: MainRouteLineId;
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
  busType?: BusType | string;
  lineId?: MainRouteLineId;
}

/**
 * Main route config model.
 *
 * Important:
 * - AdminRoutes uses this for actual map route lines / saved waypoints.
 * - Routes_Forward and Routes_Reverse can also normalize into this shape
 *   for conductor fare stop matrix rows.
 */
export interface RouteConfig {
  id: string;
  direction: RouteDirection;

  /**
   * Main route grouping used by Route Config, Fare Stop Matrix, and Live Fleet Map.
   *
   * fvr-pitx:
   * - FVR -> PITX
   * - PITX -> FVR
   *
   * fvr-stcruz:
   * - FVR -> MUZON -> ST. CRUZ
   * - ST. CRUZ -> MUZON -> FVR
   *
   * hidden:
   * - extra/legacy/advanced route records
   */
  lineId?: MainRouteLineId;

  /**
   * Optional legacy/fallback grouping label.
   * Useful for old Firebase rows that existed before lineId.
   */
  routeGroup?: string;

  routeName?: string;
  origin: string;
  destination: string;
  price: number;

  /**
   * Distance fields.
   * distance is kept for legacy compatibility.
   * distanceKm should be the preferred field.
   */
  distance?: number;
  distanceKm?: number;

  /**
   * Duration in minutes.
   * UI should format this as:
   * 45 min
   * 1 hr 10 min
   * 2 hr
   */
  estimatedDurationMinutes?: number;

  /**
   * Optional traffic-aware estimate in minutes.
   */
  trafficDurationMinutes?: number;

  baseFare?: number;

  /**
   * Kept only for backwards compatibility.
   * New UI should not expose farePerKm as a main field.
   */
  farePerKm?: number;

  status?: RouteStatus;
  isViceVersa?: boolean;
  reverseRouteId?: string;

  /**
   * Optional non-Google map reference metadata.
   * This must not overwrite saved waypoints.
   */
  mapReferenceUrl?: string;

  assignedBusId?: string;
  assignedTripScheduleId?: string;

  /**
   * Ordered fare/drop-off stops.
   */
  stops?: RouteWaypoint[];

  /**
   * Actual map geometry points for route polyline.
   */
  waypoints?: RouteWaypoint[];

  /**
   * Optional encoded polyline if routing provider returns one.
   * Saved waypoints remain the safer fallback.
   */
  encodedPolyline?: string;

  /**
   * Optional raw provider/source info for route geometry.
   */
  routeGeometrySource?: "manual" | "osrm" | "openrouteservice" | "supabase" | "firebase" | string;

  /**
   * Main route line was explicitly planned and saved by an admin user.
   * Old seeded/reference routes should not appear as live Route Config lines
   * unless this flag or a road-snapped geometry source is present.
   */
  plannedByAdmin?: boolean;

  /**
   * Tells the UI/backend where this normalized record came from.
   */
  source?: "legacy" | "admin" | "default" | "supabase";

  /**
   * For conductor fare matrix rows from Firebase.
   */
  legacyPath?: "Routes_Forward" | "Routes_Reverse";
  legacyKey?: string;

  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface RouteWaypoint {
  id?: string;
  name?: string;
  lat?: number;
  lng?: number;
  sequence?: number;
  type?: "origin" | "stop" | "destination" | "waypoint";

  /**
   * Optional fare stop/drop-off metadata.
   * Useful when displaying fare stops on the map.
   */
  fare?: number;
  source?: "AdminRoutes" | "Routes_Forward" | "Routes_Reverse" | string;
  legacyKey?: string;
  lineId?: MainRouteLineId;
  direction?: RouteDirection;

  /**
   * For marker display and matching against fare matrix rows.
   */
  origin?: string;
  destination?: string;
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

  /**
   * Used for LTFRB fare computation.
   * Default should be aircon if missing.
   */
  busType?: BusType | string;

  routeLine?: string;
  lineId?: MainRouteLineId;

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
