import type {
  BusFleetRecord,
  CriticalAlert,
  DashboardStats,
  EmployeeRecord,
  EmployeeViolationRecord,
  LegacyNotification,
  RemittanceRecord,
  RevenueReport,
  RouteConfig,
  RouteWaypoint,
  TransactionLog
} from "@pos-bus/shared";
import { supabaseAdmin, supabaseMode, supabasePool } from "../config/supabase.js";
import { AppError } from "../utils/appError.js";

type AnyRecord = Record<string, any>;
type TableName =
  | "app_users"
  | "employees"
  | "buses"
  | "pos_device_status"
  | "routes"
  | "route_stops"
  | "route_waypoints"
  | "trips"
  | "tickets"
  | "payments"
  | "expenses"
  | "critical_alerts"
  | "notifications"
  | "conversations"
  | "chat_messages"
  | "firebase_sync_logs"
  | "remittances"
  | "employee_violations";

type RowOptions = {
  eq?: { column: string; value: string };
  order?: { column: string; ascending?: boolean };
  limit?: number;
};

const tableNames = new Set<TableName>([
  "app_users",
  "employees",
  "buses",
  "pos_device_status",
  "routes",
  "route_stops",
  "route_waypoints",
  "trips",
  "tickets",
  "payments",
  "expenses",
  "critical_alerts",
  "notifications",
  "conversations",
  "chat_messages",
  "firebase_sync_logs",
  "remittances",
  "employee_violations"
]);

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toTimestamp = (value: unknown) => {
  if (!value) return Date.now();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const safeRouteStatus = (status?: string) => (status === "archived" ? "inactive" : status || "active");

const toIsoDate = (value: unknown) => {
  const timestamp = toTimestamp(value);
  return new Date(timestamp).toISOString();
};

const hasValue = (value: unknown) => value !== null && value !== undefined && value !== "";

const safeKey = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

const normalizePaymentMethod = (value: unknown) => {
  const method = String(value || "").toLowerCase();
  if (method === "cash" || method === "gcash" || method === "online") return method;
  return "other";
};

const canonicalTicketKey = (row: AnyRecord) =>
  String(row.ticket_no || row.firebase_ticket_key || row.id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const prefersTicketRow = (candidate: AnyRecord, current: AnyRecord) => {
  const candidateHasFullFirebaseKey = String(candidate.firebase_ticket_key || "").includes(":");
  const currentHasFullFirebaseKey = String(current.firebase_ticket_key || "").includes(":");
  if (candidateHasFullFirebaseKey !== currentHasFullFirebaseKey) return candidateHasFullFirebaseKey;

  return toTimestamp(candidate.updated_at || candidate.created_at) >= toTimestamp(current.updated_at || current.created_at);
};

const dedupeTicketRows = <T extends AnyRecord>(rows: T[]) => {
  const byKey = new Map<string, T>();

  rows.forEach((row) => {
    const key = canonicalTicketKey(row);
    const current = byKey.get(key);
    if (!current || prefersTicketRow(row, current)) byKey.set(key, row);
  });

  return [...byKey.values()];
};

const employeeFromRow = (row: AnyRecord): EmployeeRecord => ({
  id: String(row.id),
  accountId: row.account_id || row.accountId || undefined,
  employeeNumber: String(row.employee_no || row.employeeNumber || row.id),
  fullName: String(row.full_name || row.fullName || "Unnamed employee"),
  role: row.role || "conductor",
  phone: row.phone || undefined,
  address: row.address || undefined,
  email: row.email || undefined,
  salaryRate: hasValue(row.salary_rate) ? toNumber(row.salary_rate) : undefined,
  salaryType: row.salary_type || undefined,
  dateHired: row.date_hired || undefined,
  status: row.status === "suspended" ? "inactive" : row.status || "active",
  assignedBus: row.assigned_bus || row.assignedBus || undefined,
  assignedRoute: row.assigned_route || row.assignedRoute || undefined,
  assignedBusId: row.assigned_bus_id || row.assignedBusId || undefined,
  assignedRouteId: row.assigned_route_id || row.assignedRouteId || undefined,
  profilePhotoUrl: row.profile_photo_url || undefined,
  photoUrl: row.photo_url || row.profile_photo_url || undefined,
  photoPath: row.photo_path || undefined,
  signatureUrl: row.signature_url || undefined,
  signaturePath: row.signature_path || undefined,
  idFrontUrl: row.id_front_url || undefined,
  idFrontPath: row.id_front_path || undefined,
  idBackUrl: row.id_back_url || undefined,
  idBackPath: row.id_back_path || undefined,
  idPdfUrl: row.id_pdf_url || undefined,
  idPdfPath: row.id_pdf_path || undefined,
  qrUrl: row.qr_url || undefined,
  qrPath: row.qr_path || undefined,
  storageFolder: row.storage_folder || undefined,
  issuedDate: row.issued_date || undefined,
  validUntil: row.valid_until || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const legacyEmployeeRow = (payload: Partial<EmployeeRecord>) => ({
  employee_no: payload.employeeNumber,
  full_name: payload.fullName,
  role: payload.role,
  phone: payload.phone || null,
  email: payload.email || null,
  address: payload.address || null,
  salary_rate: hasValue(payload.salaryRate) ? payload.salaryRate : null,
  salary_type: payload.salaryType || null,
  date_hired: payload.dateHired || null,
  status: payload.status || "active",
  profile_photo_url: payload.profilePhotoUrl || payload.photoUrl || null
});

const employeeInsertRow = (payload: Partial<EmployeeRecord>) => ({
  ...legacyEmployeeRow(payload),
  account_id: payload.accountId || null,
  assigned_bus: payload.assignedBus || null,
  assigned_route: payload.assignedRoute || null,
  assigned_bus_id: payload.assignedBusId || null,
  assigned_route_id: payload.assignedRouteId || null,
  photo_url: payload.photoUrl || payload.profilePhotoUrl || null,
  photo_path: payload.photoPath || null,
  signature_url: payload.signatureUrl || null,
  signature_path: payload.signaturePath || null,
  id_front_url: payload.idFrontUrl || null,
  id_front_path: payload.idFrontPath || null,
  id_back_url: payload.idBackUrl || null,
  id_back_path: payload.idBackPath || null,
  id_pdf_url: payload.idPdfUrl || null,
  id_pdf_path: payload.idPdfPath || null,
  qr_url: payload.qrUrl || null,
  qr_path: payload.qrPath || null,
  storage_folder: payload.storageFolder || null,
  issued_date: payload.issuedDate || null,
  valid_until: payload.validUntil || null
});

const legacyEmployeePatch = (payload: Partial<EmployeeRecord>) => {
  const patch: AnyRecord = {};
  if (payload.employeeNumber !== undefined) patch.employee_no = payload.employeeNumber;
  if (payload.fullName !== undefined) patch.full_name = payload.fullName;
  if (payload.role !== undefined) patch.role = payload.role;
  if (payload.phone !== undefined) patch.phone = payload.phone;
  if (payload.email !== undefined) patch.email = payload.email;
  if (payload.address !== undefined) patch.address = payload.address;
  if (payload.salaryRate !== undefined) patch.salary_rate = payload.salaryRate;
  if (payload.salaryType !== undefined) patch.salary_type = payload.salaryType;
  if (payload.dateHired !== undefined) patch.date_hired = payload.dateHired;
  if (payload.status !== undefined) patch.status = payload.status === "pending" ? "inactive" : payload.status;
  if (payload.profilePhotoUrl !== undefined || payload.photoUrl !== undefined) {
    patch.profile_photo_url = payload.profilePhotoUrl || payload.photoUrl || null;
  }
  patch.updated_at = new Date().toISOString();
  return patch;
};

const employeePatch = (payload: Partial<EmployeeRecord>) => {
  const patch = legacyEmployeePatch(payload);
  if (payload.accountId !== undefined) patch.account_id = payload.accountId || null;
  if (payload.assignedBus !== undefined) patch.assigned_bus = payload.assignedBus || null;
  if (payload.assignedRoute !== undefined) patch.assigned_route = payload.assignedRoute || null;
  if (payload.assignedBusId !== undefined) patch.assigned_bus_id = payload.assignedBusId || null;
  if (payload.assignedRouteId !== undefined) patch.assigned_route_id = payload.assignedRouteId || null;
  if (payload.photoUrl !== undefined) patch.photo_url = payload.photoUrl || null;
  if (payload.photoPath !== undefined) patch.photo_path = payload.photoPath || null;
  if (payload.signatureUrl !== undefined) patch.signature_url = payload.signatureUrl || null;
  if (payload.signaturePath !== undefined) patch.signature_path = payload.signaturePath || null;
  if (payload.idFrontUrl !== undefined) patch.id_front_url = payload.idFrontUrl || null;
  if (payload.idFrontPath !== undefined) patch.id_front_path = payload.idFrontPath || null;
  if (payload.idBackUrl !== undefined) patch.id_back_url = payload.idBackUrl || null;
  if (payload.idBackPath !== undefined) patch.id_back_path = payload.idBackPath || null;
  if (payload.idPdfUrl !== undefined) patch.id_pdf_url = payload.idPdfUrl || null;
  if (payload.idPdfPath !== undefined) patch.id_pdf_path = payload.idPdfPath || null;
  if (payload.qrUrl !== undefined) patch.qr_url = payload.qrUrl || null;
  if (payload.qrPath !== undefined) patch.qr_path = payload.qrPath || null;
  if (payload.storageFolder !== undefined) patch.storage_folder = payload.storageFolder || null;
  if (payload.issuedDate !== undefined) patch.issued_date = payload.issuedDate || null;
  if (payload.validUntil !== undefined) patch.valid_until = payload.validUntil || null;
  return patch;
};

const busFromRow = (row: AnyRecord): BusFleetRecord => ({
  id: String(row.id),
  busNumber: String(row.bus_no || row.busNumber || row.id),
  plateNumber: row.plate_no || undefined,
  busType: row.bus_type || undefined,
  seatingCapacity: row.seat_capacity ? toNumber(row.seat_capacity) : undefined,
  standingCapacity: row.standing_capacity ? toNumber(row.standing_capacity) : undefined,
  currentPassengerCount: row.current_passenger_count ? toNumber(row.current_passenger_count) : undefined,
  status: ["maintenance", "offline", "available", "on-route"].includes(row.status)
    ? row.status
    : row.status === "out_of_service"
      ? "inactive"
      : "active",
  assignedDriverId: row.assigned_driver_id || undefined,
  assignedDriverName: row.assigned_driver_name || undefined,
  assignedConductorId: row.assigned_conductor_id || undefined,
  assignedConductorName: row.assigned_conductor_name || undefined,
  assignedRouteId: row.assigned_route_id || undefined,
  routeLine: row.route_line || undefined,
  registrationNotes: row.registration_no || undefined,
  registrationNumber: row.registration_no || undefined,
  insuranceInfo: row.insurance_info || undefined,
  permitInfo: row.permit_info || undefined,
  lastMaintenance: row.last_maintenance_at || undefined,
  nextMaintenance: row.next_maintenance_at || undefined,
  odometer: row.odometer_km ? toNumber(row.odometer_km) : undefined,
  fuelType: row.fuel_type || undefined,
  photoUrl: row.main_photo_url || undefined,
  photoPath: row.photo_path || undefined,
  notes: row.notes || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const waypointFromRow = (row: AnyRecord): RouteWaypoint => ({
  id: String(row.id),
  name: row.label || row.stop_name || undefined,
  lat: row.latitude === null || row.latitude === undefined ? undefined : toNumber(row.latitude),
  lng: row.longitude === null || row.longitude === undefined ? undefined : toNumber(row.longitude),
  sequence: toNumber(row.point_order ?? row.stop_order)
});

const routeFromRow = (row: AnyRecord, waypoints: RouteWaypoint[] = [], stops: RouteWaypoint[] = []): RouteConfig => ({
  id: String(row.route_code || row.id),
  routeName: row.route_name || row.routeName || "Unnamed route",
  origin: row.origin || "Unknown Origin",
  destination: row.destination || "Unknown Destination",
  direction: row.direction === "reverse" ? "reverse" : "forward",
  isViceVersa: Boolean(row.is_vice_versa),
  reverseRouteId: row.reverse_route_code || row.reverse_route_id || undefined,
  status: row.status === "suspended" ? "inactive" : row.status || "active",
  mapReferenceUrl: row.map_reference_url || undefined,
  distanceKm: row.distance_km ? toNumber(row.distance_km) : undefined,
  estimatedDurationMinutes: row.estimated_duration_minutes ? toNumber(row.estimated_duration_minutes) : undefined,
  baseFare: row.base_fare ? toNumber(row.base_fare) : 0,
  farePerKm: row.fare_per_km ? toNumber(row.fare_per_km) : 0,
  price: row.base_fare ? toNumber(row.base_fare) : 0,
  stops,
  waypoints,
  source: "supabase",
  legacyPath: row.firebase_legacy_path || undefined,
  legacyKey: row.firebase_legacy_key || row.route_code || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const transactionFromTicket = (row: AnyRecord): TransactionLog => ({
  id: String(row.id),
  time: row.issued_at || row.created_at || null,
  busNumber: row.bus_number || row.bus_no || row.busNumber || "N/A",
  driver: row.driver_name || "N/A",
  conductor: row.conductor_name || "N/A",
  origin: row.origin || "N/A",
  destination: row.destination || "N/A",
  route: row.route_name || `${row.origin || "N/A"} -> ${row.destination || "N/A"}`,
  passengerType: row.passenger_type || "regular",
  passengerCount: toNumber(row.passenger_count, 1),
  paymentMethod: row.official_payment_method || row.payment_method || "unknown",
  amount: toNumber(row.official_amount ?? row.fare),
  tripId: row.trip_id || undefined,
  deviceId: row.firebase_ticket_key || undefined
});

const criticalAlertFromRow = (row: AnyRecord): CriticalAlert => ({
  id: String(row.id),
  stateKey: `supabase:${row.id}`,
  source: "AssistanceRequests",
  sourceKey: String(row.source_key || row.id),
  severity: row.priority === "warning" ? "warning" : "critical",
  title: String(row.alert_title || "Critical alert"),
  issueType: String(row.issue_type || row.priority || "Emergency"),
  message: String(row.alert_message || ""),
  status: String(row.status || "active"),
  priority: row.priority,
  timestamp: toTimestamp(row.reported_at || row.created_at),
  busNumber: row.bus_number || undefined,
  deviceId: row.device_id || undefined,
  driver: row.driver_name || undefined,
  conductor: row.conductor_name || undefined,
  reporter: row.reporter_name || undefined,
  reporterRole: row.reporter_role || undefined,
  route: row.route_name || undefined,
  locationText: row.last_location || undefined,
  lat: row.latitude === null || row.latitude === undefined ? null : toNumber(row.latitude),
  lng: row.longitude === null || row.longitude === undefined ? null : toNumber(row.longitude),
  acknowledgedAt: row.acknowledged_at ? toTimestamp(row.acknowledged_at) : undefined,
  resolvedAt: row.resolved_at ? toTimestamp(row.resolved_at) : undefined
});

const notificationFromRow = (row: AnyRecord): LegacyNotification => ({
  id: String(row.id),
  source: row.source_path === "POS_Devices" ? "POS_Devices" : row.source_path === "Expenses" ? "Expenses" : "messages",
  sourceKey: String(row.source_key || row.id),
  type: row.type === "assistance" ? "assistance" : row.type === "device" ? "device" : row.type === "expense" ? "expense" : "message",
  severity: row.type === "critical" || row.type === "emergency" ? "critical" : row.type === "warning" ? "warning" : "info",
  title: String(row.title || "Notification"),
  body: String(row.message || ""),
  timestamp: toTimestamp(row.created_at),
  read: Boolean(row.is_read)
});

const normalizeRemittanceStatus = (status?: string): string => {
  if (!status) return "Pending";
  const s = status.toLowerCase();
  if (s === "cleared" || s === "received") return "Cleared";
  if (s === "short" || s === "shortage") return "Short";
  if (s === "over" || s === "overage") return "Over";
  return "Pending";
};

const remittanceFromRow = (row: AnyRecord): RemittanceRecord => {
  const expected = toNumber(row.expected_amount);
  const remitted = toNumber(row.actual_remitted);
  const shortageAmount = Math.max(expected - remitted, 0);
  const overageAmount = Math.max(remitted - expected, 0);
  const dbStatus = row.status || "Pending";
  // Normalize to typed union
  const status: RemittanceRecord["status"] =
    dbStatus === "Cleared" ? "Cleared" :
    dbStatus === "Short" ? "Short" :
    dbStatus === "Over" ? "Over" : "Pending";
  return {
    id: String(row.id),
    shiftDate: row.shift_date || "",
    conductorId: row.conductor_id || undefined,
    cashierId: row.cashier_id || undefined,
    receivedById: row.cashier_id || undefined,
    busId: row.bus_id || undefined,
    routeId: row.route_id || undefined,
    expectedAmount: expected,
    remittedAmount: remitted,
    shortageAmount,
    overageAmount,
    ticketCount: row.ticket_count ? toNumber(row.ticket_count) : undefined,
    status,
    notes: row.remarks || undefined,
    submittedAt: row.submitted_at || undefined,
    receivedAt: row.received_at || undefined,
    proofImageUrl: row.proof_image_url || undefined,
    proofImagePath: row.proof_image_path || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined
  };
};

const violationFromRow = (row: AnyRecord): EmployeeViolationRecord => ({
  id: String(row.id),
  employeeId: row.employee_id ? String(row.employee_id) : "",
  employeeName: row.employee_name || undefined,
  employeeNumber: row.employee_number || undefined,
  employeeRole: row.employee_role || undefined,
  role: row.employee_role || undefined,
  busId: row.bus_id || undefined,
  busNumber: row.bus_number || undefined,
  routeId: row.route_id || undefined,
  routeName: row.route_name || undefined,
  remittanceId: row.remittance_id || undefined,
  violationDate: row.violation_date || "",
  incidentTime: row.incident_time || undefined,
  violationType: row.violation_type || "",
  description: row.description || undefined,
  penalty: row.penalty || undefined,
  penaltyType: row.penalty_type || row.penalty || undefined,
  penaltyDetails: row.penalty_details || undefined,
  suspensionDays: hasValue(row.suspension_days) ? toNumber(row.suspension_days) : undefined,
  salaryDeductionAmount: hasValue(row.salary_deduction_amount) ? toNumber(row.salary_deduction_amount) : undefined,
  deductionReason: row.deduction_reason || undefined,
  penaltyStartDate: row.penalty_start_date || undefined,
  penaltyEndDate: row.penalty_end_date || undefined,
  evidenceNotes: row.evidence_notes || undefined,
  severity: row.severity || undefined,
  status: row.status || "Active",
  reportedById: row.reported_by || undefined,
  resolutionNotes: row.resolution_notes || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at || undefined
});

const ensureKnownTable = (table: TableName) => {
  if (!tableNames.has(table)) {
    throw new AppError(500, "SUPABASE_TABLE_NOT_ALLOWED", `Unexpected Supabase table: ${table}`);
  }
};

const rowsFromTable = async <T extends AnyRecord>(table: TableName, options: RowOptions = {}): Promise<T[]> => {
  ensureKnownTable(table);

  if (supabaseAdmin) {
    let query = supabaseAdmin.from(table).select("*");
    if (options.eq) query = query.eq(options.eq.column, options.eq.value);
    if (options.order) query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
    if (options.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) {
      throw new AppError(502, "SUPABASE_QUERY_FAILED", error.message, { table });
    }
    return (data || []) as T[];
  }

  if (supabasePool) {
    const values: string[] = [];
    const clauses: string[] = [];
    if (options.eq) {
      values.push(options.eq.value);
      clauses.push(`${options.eq.column} = $${values.length}`);
    }

    const where = clauses.length ? ` where ${clauses.join(" and ")}` : "";
    const order = options.order ? ` order by ${options.order.column} ${options.order.ascending === false ? "desc" : "asc"}` : "";
    const limit = options.limit ? ` limit ${Math.max(1, options.limit)}` : "";
    const result = await supabasePool.query<T>(`select * from public.${table}${where}${order}${limit}`, values);
    return result.rows;
  }

  return [];
};

const findRouteRow = async (id: string) => {
  const byCode = await rowsFromTable<AnyRecord>("routes", { eq: { column: "route_code", value: id }, limit: 1 });
  if (byCode[0]) return byCode[0];

  const byId = await rowsFromTable<AnyRecord>("routes", { eq: { column: "id", value: id }, limit: 1 });
  return byId[0] || null;
};

const routeDbId = async (id: string) => {
  const row = await findRouteRow(id);
  return row?.id ? String(row.id) : null;
};

const listRouteWaypointsByDbId = async (dbId: string) =>
  (await rowsFromTable<AnyRecord>("route_waypoints", {
    eq: { column: "route_id", value: dbId },
    order: { column: "point_order", ascending: true }
  })).map(waypointFromRow);

const listRouteStopsByDbId = async (dbId: string) =>
  (await rowsFromTable<AnyRecord>("route_stops", {
    eq: { column: "route_id", value: dbId },
    order: { column: "stop_order", ascending: true }
  })).map(waypointFromRow);

const upsertRouteRow = async (route: RouteConfig) => {
  const row = {
    route_code: route.id,
    route_name: route.routeName || `${route.origin} to ${route.destination}`,
    origin: route.origin,
    destination: route.destination,
    direction: route.direction,
    is_vice_versa: route.isViceVersa ?? true,
    status: safeRouteStatus(route.status),
    map_reference_url: route.mapReferenceUrl || null,
    distance_km: route.distanceKm ?? route.distance ?? null,
    estimated_duration_minutes: route.estimatedDurationMinutes ?? null,
    base_fare: route.baseFare ?? route.price ?? 0,
    fare_per_km: route.farePerKm ?? 0,
    firebase_legacy_path: "AdminRoutes",
    firebase_legacy_key: route.id,
    updated_at: new Date().toISOString()
  };

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("routes")
      .upsert(row, { onConflict: "route_code" })
      .select("*")
      .single();
    if (error) throw new AppError(502, "SUPABASE_ROUTE_UPSERT_FAILED", error.message);
    return data as AnyRecord;
  }

  if (supabasePool) {
    const result = await supabasePool.query<AnyRecord>(
      `
        insert into public.routes
          (route_code, route_name, origin, destination, direction, is_vice_versa, status,
           map_reference_url, distance_km, estimated_duration_minutes, base_fare, fare_per_km,
           firebase_legacy_path, firebase_legacy_key, updated_at)
        values
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        on conflict (route_code) do update set
          route_name = excluded.route_name,
          origin = excluded.origin,
          destination = excluded.destination,
          direction = excluded.direction,
          is_vice_versa = excluded.is_vice_versa,
          status = excluded.status,
          map_reference_url = excluded.map_reference_url,
          distance_km = excluded.distance_km,
          estimated_duration_minutes = excluded.estimated_duration_minutes,
          base_fare = excluded.base_fare,
          fare_per_km = excluded.fare_per_km,
          firebase_legacy_path = excluded.firebase_legacy_path,
          firebase_legacy_key = excluded.firebase_legacy_key,
          updated_at = excluded.updated_at
        returning *
      `,
      [
        row.route_code,
        row.route_name,
        row.origin,
        row.destination,
        row.direction,
        row.is_vice_versa,
        row.status,
        row.map_reference_url,
        row.distance_km,
        row.estimated_duration_minutes,
        row.base_fare,
        row.fare_per_km,
        row.firebase_legacy_path,
        row.firebase_legacy_key,
        row.updated_at
      ]
    );
    return result.rows[0];
  }

  return null;
};

const replaceRouteChildren = async (routeId: string, route: RouteConfig) => {
  const waypoints = (route.waypoints || []).filter((point) => typeof point.lat === "number" && typeof point.lng === "number");
  const stops = (route.stops || []).filter((point) => point.name || (typeof point.lat === "number" && typeof point.lng === "number"));

  if (supabaseAdmin) {
    await supabaseAdmin.from("route_waypoints").delete().eq("route_id", routeId);
    await supabaseAdmin.from("route_stops").delete().eq("route_id", routeId);

    if (waypoints.length) {
      const { error } = await supabaseAdmin.from("route_waypoints").insert(
        waypoints.map((point, index) => ({
          route_id: routeId,
          point_order: point.sequence ?? index + 1,
          latitude: point.lat,
          longitude: point.lng,
          label: point.name || null
        }))
      );
      if (error) throw new AppError(502, "SUPABASE_ROUTE_WAYPOINT_SYNC_FAILED", error.message);
    }

    if (stops.length) {
      const { error } = await supabaseAdmin.from("route_stops").insert(
        stops.map((point, index) => ({
          route_id: routeId,
          stop_name: point.name || `Stop ${index + 1}`,
          stop_order: point.sequence ?? index + 1,
          latitude: point.lat ?? null,
          longitude: point.lng ?? null,
          is_terminal: index === 0 || index === stops.length - 1
        }))
      );
      if (error) throw new AppError(502, "SUPABASE_ROUTE_STOP_SYNC_FAILED", error.message);
    }
  } else if (supabasePool) {
    await supabasePool.query("delete from public.route_waypoints where route_id = $1", [routeId]);
    await supabasePool.query("delete from public.route_stops where route_id = $1", [routeId]);

    for (const [index, point] of waypoints.entries()) {
      await supabasePool.query(
        "insert into public.route_waypoints (route_id, point_order, latitude, longitude, label) values ($1,$2,$3,$4,$5)",
        [routeId, point.sequence ?? index + 1, point.lat, point.lng, point.name || null]
      );
    }

    for (const [index, point] of stops.entries()) {
      await supabasePool.query(
        "insert into public.route_stops (route_id, stop_name, stop_order, latitude, longitude, is_terminal) values ($1,$2,$3,$4,$5,$6)",
        [routeId, point.name || `Stop ${index + 1}`, point.sequence ?? index + 1, point.lat ?? null, point.lng ?? null, index === 0 || index === stops.length - 1]
      );
    }
  }

  return { waypoints: waypoints.length, stops: stops.length };
};

const insertSyncLog = async (payload: AnyRecord) => {
  const row = {
    source_path: payload.source_path,
    source_key: payload.source_key || null,
    target_table: payload.target_table || null,
    sync_status: payload.sync_status || "success",
    error_message: payload.error_message || null,
    synced_at: payload.synced_at || new Date().toISOString()
  };

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from("firebase_sync_logs")
      .upsert(row, { onConflict: "source_path,source_key" });
    if (error) throw new AppError(502, "SUPABASE_SYNC_LOG_FAILED", error.message);
    return;
  }

  if (supabasePool) {
    await supabasePool.query(
      `
        insert into public.firebase_sync_logs
          (source_path, source_key, target_table, sync_status, error_message, synced_at)
        values
          ($1,$2,$3,$4,$5,$6)
        on conflict (source_path, source_key) do update set
          target_table = excluded.target_table,
          sync_status = excluded.sync_status,
          error_message = excluded.error_message,
          synced_at = excluded.synced_at
      `,
      [
        row.source_path,
        row.source_key,
        row.target_table,
        row.sync_status,
        row.error_message,
        row.synced_at
      ]
    );
  }
};

const officialPaymentRows = async () =>
  rowsFromTable<AnyRecord>("payments", { order: { column: "created_at", ascending: false } });

const officialTicketRows = async (limit = 1000) =>
  rowsFromTable<AnyRecord>("tickets", { order: { column: "created_at", ascending: false }, limit });

const queryRows = async <T extends AnyRecord>(sql: string, values: unknown[] = []) => {
  if (!supabasePool) return [];
  const result = await supabasePool.query<T>(sql, values);
  return result.rows;
};

const upsertTrip = async (tripNo: string, passengerCount: number, timestamp: string) => {
  const rows = await queryRows<{ id: string }>(
    `
      insert into public.trips
        (trip_no, status, departure_time, passenger_count, standing_count, firebase_trip_key, created_at, updated_at)
      values
        ($1, 'completed', $2, $3, 0, $1, $2, now())
      on conflict (trip_no) do update set
        passenger_count = excluded.passenger_count,
        updated_at = now()
      returning id
    `,
    [tripNo, timestamp, passengerCount]
  );

  return rows[0]?.id || null;
};

const upsertTicket = async (tx: TransactionLog, ticketNo: string, tripId: string | null, timestamp: string) => {
  const existing = await queryRows<{ id: string }>("select id from public.tickets where firebase_ticket_key = $1 limit 1", [tx.id]);
  if (existing[0]?.id) {
    const rows = await queryRows<{ id: string }>(
      `
        update public.tickets set
          trip_id = $2,
          passenger_type = $3,
          origin = $4,
          destination = $5,
          fare = $6,
          payment_method = $7,
          payment_status = 'paid',
          ticket_status = 'active',
          updated_at = now()
        where id = $1
        returning id
      `,
      [
        existing[0].id,
        tripId,
        tx.passengerType || "regular",
        tx.origin,
        tx.destination,
        tx.amount,
        normalizePaymentMethod(tx.paymentMethod)
      ]
    );

    return rows[0]?.id || existing[0].id;
  }

  const rows = await queryRows<{ id: string }>(
    `
      insert into public.tickets
        (ticket_no, trip_id, passenger_type, origin, destination, fare, payment_method, payment_status,
         ticket_status, firebase_ticket_key, created_at, updated_at)
      values
        ($1, $2, $3, $4, $5, $6, $7, 'paid', 'active', $8, $9, now())
      on conflict (ticket_no) do update set
        trip_id = excluded.trip_id,
        passenger_type = excluded.passenger_type,
        origin = excluded.origin,
        destination = excluded.destination,
        fare = excluded.fare,
        payment_method = excluded.payment_method,
        payment_status = excluded.payment_status,
        firebase_ticket_key = excluded.firebase_ticket_key,
        updated_at = now()
      returning id
    `,
    [
      ticketNo,
      tripId,
      tx.passengerType || "regular",
      tx.origin,
      tx.destination,
      tx.amount,
      normalizePaymentMethod(tx.paymentMethod),
      tx.id,
      timestamp
    ]
  );

  return rows[0]?.id || null;
};

const upsertPayment = async (tx: TransactionLog, ticketId: string | null, referenceNumber: string, timestamp: string) => {
  const existing = await queryRows<{ id: string }>("select id from public.payments where firebase_payment_key = $1 limit 1", [referenceNumber]);
  if (existing[0]?.id) {
    await queryRows(
      `
        update public.payments set
          ticket_id = $2,
          amount = $3,
          payment_method = $4,
          payment_status = 'paid',
          paid_at = $5,
          updated_at = now()
        where id = $1
      `,
      [existing[0].id, ticketId, tx.amount, normalizePaymentMethod(tx.paymentMethod), timestamp]
    );
    return;
  }

  await queryRows(
    `
      insert into public.payments
        (ticket_id, amount, payment_method, payment_status, reference_number, paid_at,
         firebase_payment_key, created_at, updated_at)
      values
        ($1, $2, $3, 'paid', $4, $5, $4, $5, now())
      on conflict (reference_number) do update set
        ticket_id = excluded.ticket_id,
        amount = excluded.amount,
        payment_method = excluded.payment_method,
        payment_status = excluded.payment_status,
        paid_at = excluded.paid_at,
        firebase_payment_key = excluded.firebase_payment_key,
        updated_at = now()
    `,
    [ticketId, tx.amount, normalizePaymentMethod(tx.paymentMethod), referenceNumber, timestamp]
  );
};

export const supabaseService = {
  mode: supabaseMode,

  isConfigured() {
    return supabaseMode() !== "not-configured";
  },

  async status() {
    if (!this.isConfigured()) {
      return {
        configured: false,
        status: "not-configured",
        mode: supabaseMode(),
        projectUrl: null
      };
    }

    try {
      await rowsFromTable("app_users", { limit: 1 });
      return {
        configured: true,
        status: "connected",
        mode: supabaseMode(),
        projectUrl: process.env.SUPABASE_URL || null
      };
    } catch (error) {
      return {
        configured: true,
        status: "error",
        mode: supabaseMode(),
        projectUrl: process.env.SUPABASE_URL || null,
        error: error instanceof Error ? error.message : "Supabase connection failed."
      };
    }
  },

  async listEmployees() {
    return (await rowsFromTable<AnyRecord>("employees", { order: { column: "full_name" } })).map(employeeFromRow);
  },

  async createEmployee(payload: Partial<EmployeeRecord>) {
    if (!supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin.from("employees").insert(employeeInsertRow(payload)).select("*").single();

    if (!error) return employeeFromRow(data);

    const fallback = await supabaseAdmin.from("employees").insert(legacyEmployeeRow(payload)).select("*").single();
    if (fallback.error) {
      throw new AppError(502, "SUPABASE_EMPLOYEE_CREATE_FAILED", fallback.error.message || error.message);
    }
    return employeeFromRow(fallback.data);
  },

  async patchEmployee(id: string, payload: Partial<EmployeeRecord>) {
    if (!supabaseAdmin) return null;

    // Try full patch first (includes all asset columns)
    const { data, error } = await supabaseAdmin.from("employees").update(employeePatch(payload)).eq("id", id).select("*").single();
    if (!error) return employeeFromRow(data);

    console.warn("[patchEmployee] Full patch failed, trying fallback:", error.message);

    // Full patch failed — try basic fields only (safe columns that always exist)
    const basicPatch = legacyEmployeePatch(payload);
    const basicResult = await supabaseAdmin.from("employees").update(basicPatch).eq("id", id).select("*").single();

    if (basicResult.error) {
      console.warn("[patchEmployee] Basic patch also failed:", basicResult.error.message);
    }

    // Now try asset-specific columns separately so missing columns don't block basic fields
    const assetPatch: AnyRecord = {};
    if (payload.photoPath !== undefined) assetPatch.photo_path = payload.photoPath || null;
    if (payload.photoUrl !== undefined) assetPatch.photo_url = payload.photoUrl || null;
    if (payload.signaturePath !== undefined) assetPatch.signature_path = payload.signaturePath || null;
    if (payload.signatureUrl !== undefined) assetPatch.signature_url = payload.signatureUrl || null;
    if (payload.idFrontPath !== undefined) assetPatch.id_front_path = payload.idFrontPath || null;
    if (payload.idFrontUrl !== undefined) assetPatch.id_front_url = payload.idFrontUrl || null;
    if (payload.idBackPath !== undefined) assetPatch.id_back_path = payload.idBackPath || null;
    if (payload.idBackUrl !== undefined) assetPatch.id_back_url = payload.idBackUrl || null;
    if (payload.idPdfPath !== undefined) assetPatch.id_pdf_path = payload.idPdfPath || null;
    if (payload.idPdfUrl !== undefined) assetPatch.id_pdf_url = payload.idPdfUrl || null;
    if (payload.qrPath !== undefined) assetPatch.qr_path = payload.qrPath || null;
    if (payload.qrUrl !== undefined) assetPatch.qr_url = payload.qrUrl || null;
    if (payload.storageFolder !== undefined) assetPatch.storage_folder = payload.storageFolder || null;
    if (payload.issuedDate !== undefined) assetPatch.issued_date = payload.issuedDate || null;
    if (payload.validUntil !== undefined) assetPatch.valid_until = payload.validUntil || null;
    if (payload.accountId !== undefined) assetPatch.account_id = payload.accountId || null;
    if (payload.assignedBus !== undefined) assetPatch.assigned_bus = payload.assignedBus || null;
    if (payload.assignedRoute !== undefined) assetPatch.assigned_route = payload.assignedRoute || null;
    if (payload.assignedBusId !== undefined) assetPatch.assigned_bus_id = payload.assignedBusId || null;
    if (payload.assignedRouteId !== undefined) assetPatch.assigned_route_id = payload.assignedRouteId || null;

    if (Object.keys(assetPatch).length > 0) {
      // Silently try — if the columns don't exist, we just skip
      const assetResult = await supabaseAdmin.from("employees").update(assetPatch).eq("id", id).select("*").single();
      if (!assetResult.error) return employeeFromRow(assetResult.data);
      console.warn("[patchEmployee] Asset columns patch failed (run the SQL migration):", assetResult.error.message);
    }

    if (basicResult.error) {
      throw new AppError(502, "SUPABASE_EMPLOYEE_PATCH_FAILED", basicResult.error.message || error.message);
    }
    return employeeFromRow(basicResult.data);
  },

  async listBuses() {
    return (await rowsFromTable<AnyRecord>("buses", { order: { column: "bus_no" } })).map(busFromRow);
  },

  async createBus(payload: Partial<BusFleetRecord>) {
    if (!supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin
      .from("buses")
      .insert({
        bus_no: payload.busNumber,
        plate_no: payload.plateNumber || null,
        bus_type: payload.busType || "aircon",
        status: payload.status === "inactive" ? "out_of_service" : payload.status || "idle",
        seat_capacity: payload.seatingCapacity || 0,
        standing_capacity: payload.standingCapacity || 0,
        current_passenger_count: payload.currentPassengerCount || 0,
        registration_no: payload.registrationNotes || null,
        insurance_info: payload.insuranceInfo || null,
        permit_info: payload.permitInfo || null,
        odometer_km: payload.odometer || null,
        fuel_type: payload.fuelType || null,
        main_photo_url: payload.photoUrl || null
      })
      .select("*")
      .single();
    if (error) throw new AppError(502, "SUPABASE_BUS_CREATE_FAILED", error.message);
    return busFromRow(data);
  },

  async patchBus(id: string, payload: Partial<BusFleetRecord>) {
    if (!supabaseAdmin) return null;
    const patch: AnyRecord = {};
    if (payload.busNumber !== undefined) patch.bus_no = payload.busNumber;
    if (payload.plateNumber !== undefined) patch.plate_no = payload.plateNumber;
    if (payload.busType !== undefined) patch.bus_type = payload.busType;
    if (payload.status !== undefined) patch.status = payload.status === "inactive" ? "out_of_service" : payload.status;
    if (payload.seatingCapacity !== undefined) patch.seat_capacity = payload.seatingCapacity;
    if (payload.standingCapacity !== undefined) patch.standing_capacity = payload.standingCapacity;
    if (payload.currentPassengerCount !== undefined) patch.current_passenger_count = payload.currentPassengerCount;
    if (payload.assignedDriverId !== undefined) patch.assigned_driver_id = payload.assignedDriverId || null;
    if (payload.assignedDriverName !== undefined) patch.assigned_driver_name = payload.assignedDriverName || null;
    if (payload.assignedConductorId !== undefined) patch.assigned_conductor_id = payload.assignedConductorId || null;
    if (payload.assignedConductorName !== undefined) patch.assigned_conductor_name = payload.assignedConductorName || null;
    if (payload.assignedRouteId !== undefined) patch.assigned_route_id = payload.assignedRouteId || null;
    if (payload.routeLine !== undefined) patch.route_line = payload.routeLine || null;
    if (payload.registrationNotes !== undefined) patch.registration_no = payload.registrationNotes;
    if (payload.registrationNumber !== undefined) patch.registration_no = payload.registrationNumber;
    if (payload.insuranceInfo !== undefined) patch.insurance_info = payload.insuranceInfo;
    if (payload.permitInfo !== undefined) patch.permit_info = payload.permitInfo;
    if (payload.lastMaintenance !== undefined) patch.last_maintenance_at = payload.lastMaintenance || null;
    if (payload.nextMaintenance !== undefined) patch.next_maintenance_at = payload.nextMaintenance || null;
    if (payload.odometer !== undefined) patch.odometer_km = payload.odometer;
    if (payload.fuelType !== undefined) patch.fuel_type = payload.fuelType;
    if (payload.photoUrl !== undefined) patch.main_photo_url = payload.photoUrl;
    if (payload.notes !== undefined) patch.notes = payload.notes || null;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin.from("buses").update(patch).eq("id", id).select("*").single();
    if (error) throw new AppError(502, "SUPABASE_BUS_PATCH_FAILED", error.message);
    return busFromRow(data);
  },

  async listRoutes() {
    const rows = await rowsFromTable<AnyRecord>("routes", { order: { column: "route_name" } });
    return Promise.all(
      rows.map(async (row) => {
        const dbId = String(row.id);
        const [waypoints, stops] = await Promise.all([listRouteWaypointsByDbId(dbId), listRouteStopsByDbId(dbId)]);
        return routeFromRow(row, waypoints, stops);
      })
    );
  },

  async getRoute(id: string) {
    const row = await findRouteRow(id);
    if (!row) return null;
    const [waypoints, stops] = await Promise.all([listRouteWaypointsByDbId(String(row.id)), listRouteStopsByDbId(String(row.id))]);
    return routeFromRow(row, waypoints, stops);
  },

  async listRouteWaypoints(id: string) {
    const dbId = await routeDbId(id);
    return dbId ? listRouteWaypointsByDbId(dbId) : [];
  },

  async listRouteStops(id: string) {
    const dbId = await routeDbId(id);
    return dbId ? listRouteStopsByDbId(dbId) : [];
  },

  async listTransactions(limit = 250) {
    if (supabasePool) {
      const rows = await queryRows<AnyRecord>(
        `
          select
            t.*,
            coalesce(p.amount, t.fare, 0) as official_amount,
            coalesce(p.payment_method::text, t.payment_method::text, 'unknown') as official_payment_method,
            coalesce(p.payment_status::text, t.payment_status::text, 'paid') as official_payment_status
          from public.tickets t
          left join public.payments p on p.ticket_id = t.id
          where lower(coalesce(p.payment_status::text, t.payment_status::text, 'paid')) = 'paid'
          order by coalesce(p.paid_at, t.created_at) desc
          limit $1
        `,
        [Math.max(1, limit)]
      );
      return dedupeTicketRows(rows).map(transactionFromTicket);
    }

    const rows = await rowsFromTable<AnyRecord>("tickets", { order: { column: "created_at", ascending: false }, limit });
    return dedupeTicketRows(rows.filter((row) => String(row.payment_status || "paid").toLowerCase() === "paid")).map(transactionFromTicket);
  },

  async listPayments() {
    return officialPaymentRows();
  },

  async listExpenses() {
    return rowsFromTable<AnyRecord>("expenses", { order: { column: "expense_date", ascending: false } });
  },

  async listCriticalAlerts() {
    return (await rowsFromTable<AnyRecord>("critical_alerts", { order: { column: "reported_at", ascending: false } })).map(criticalAlertFromRow);
  },

  async listNotifications() {
    return (await rowsFromTable<AnyRecord>("notifications", { order: { column: "created_at", ascending: false } })).map(notificationFromRow);
  },

  async listPosDeviceStatus() {
    return rowsFromTable<AnyRecord>("pos_device_status", { order: { column: "updated_at", ascending: false } });
  },

  async getStructuredSummary() {
    const [employees, buses, routes, expenses, notifications, criticalAlerts, trips, tickets, payments] = await Promise.all([
      this.listEmployees(),
      this.listBuses(),
      this.listRoutes(),
      this.listExpenses(),
      this.listNotifications(),
      this.listCriticalAlerts(),
      rowsFromTable<AnyRecord>("trips"),
      officialTicketRows(10000),
      this.listPayments()
    ]);

    return {
      employees: employees.length,
      buses: buses.length,
      routes: routes.length,
      expenses: expenses.length,
      notifications: notifications.length,
      criticalAlerts: criticalAlerts.length,
      trips: trips.length,
      tickets: tickets.length,
      payments: payments.length
    };
  },

  async getAnalyticsSummary() {
    const [transactions, expenses] = await Promise.all([this.listTransactions(10000), this.listExpenses()]);
    const grossRevenue = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const expenseTotal = expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);

    return {
      grossRevenue,
      expenseTotal,
      netProfit: grossRevenue - expenseTotal,
      ticketCount: transactions.length,
      passengerCount: transactions.reduce((sum, transaction) => sum + transaction.passengerCount, 0)
    };
  },

  async getOfficialDashboardStats(liveStats: Pick<DashboardStats, "activeBuses" | "emergencyCount" | "lastUpdated">): Promise<DashboardStats> {
    const [transactions, expenses] = await Promise.all([this.listTransactions(10000), this.listExpenses()]);
    const cashTotal = transactions
      .filter((transaction) => String(transaction.paymentMethod || "").toLowerCase() === "cash")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const gcashTotal = transactions
      .filter((transaction) => String(transaction.paymentMethod || "").toLowerCase() === "gcash")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const otherTotal = transactions
      .filter((transaction) => !["cash", "gcash"].includes(String(transaction.paymentMethod || "").toLowerCase()))
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
    const totalRevenue = cashTotal + gcashTotal + otherTotal;

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      activeBuses: liveStats.activeBuses,
      totalPassengers: transactions.reduce((sum, transaction) => sum + transaction.passengerCount, 0),
      cashTotal,
      gcashTotal,
      totalTransactions: transactions.length,
      emergencyCount: liveStats.emergencyCount,
      lastUpdated: new Date().toISOString()
    };
  },

  async getRouteRevenueReport() {
    const rows = await this.listTransactions(10000);
    const byRoute = new Map<string, RevenueReport>();

    rows.forEach((row) => {
      const report = {
        route: row.route,
        revenue: row.amount,
        passengers: row.passengerCount
      };
      const current = byRoute.get(report.route) || { route: report.route, revenue: 0, passengers: 0 };
      current.revenue += report.revenue;
      current.passengers += report.passengers;
      byRoute.set(report.route, current);
    });

    return [...byRoute.values()].sort((a, b) => b.revenue - a.revenue);
  },

  async syncRoute(route: RouteConfig) {
    if (!this.isConfigured()) {
      return {
        synced: false,
        reason: "Supabase is not configured on the backend.",
        routeId: route.id
      };
    }

    const routeRow = await upsertRouteRow(route);
    if (!routeRow?.id) {
      return {
        synced: false,
        reason: "Route row was not created.",
        routeId: route.id
      };
    }

    const childCounts = await replaceRouteChildren(String(routeRow.id), route);
    await insertSyncLog({
      source_path: "AdminRoutes",
      source_key: route.id,
      target_table: "routes",
      sync_status: "success",
      synced_at: new Date().toISOString()
    });

    return {
      synced: true,
      routeId: route.id,
      supabaseRouteId: routeRow.id,
      ...childCounts
    };
  },

  async logSync(sourcePath: string, targetTable: string, status = "success", errorMessage?: string) {
    if (!this.isConfigured()) return;
    await insertSyncLog({
      source_path: sourcePath,
      target_table: targetTable,
      sync_status: status,
      error_message: errorMessage || null,
      synced_at: new Date().toISOString()
    });
  },

  async syncTransactions(transactions: TransactionLog[]) {
    if (!supabasePool) {
      return {
        synced: false,
        reason: "SUPABASE_DB_URL is required for Firebase transaction sync.",
        trips: 0,
        tickets: 0,
        payments: 0
      };
    }

    const tripSummaries = new Map<string, { passengerCount: number; timestamp: string }>();
    transactions.forEach((tx) => {
      const tripNo = safeKey(`${tx.deviceId || "device"}-${tx.tripId || "trip"}`) || `trip-${Date.now()}`;
      const current = tripSummaries.get(tripNo) || { passengerCount: 0, timestamp: toIsoDate(tx.time) };
      current.passengerCount += Math.max(1, toNumber(tx.passengerCount, 1));
      const nextTime = toIsoDate(tx.time);
      if (Date.parse(nextTime) < Date.parse(current.timestamp)) current.timestamp = nextTime;
      tripSummaries.set(tripNo, current);
    });

    const tripIds = new Map<string, string | null>();
    for (const [tripNo, summary] of tripSummaries) {
      tripIds.set(tripNo, await upsertTrip(tripNo, summary.passengerCount, summary.timestamp));
    }

    let ticketCount = 0;
    let paymentCount = 0;
    for (const tx of transactions) {
      const tripNo = safeKey(`${tx.deviceId || "device"}-${tx.tripId || "trip"}`) || `trip-${Date.now()}`;
      const ticketNo = safeKey(tx.id) || `${tripNo}-${ticketCount + 1}`;
      const timestamp = toIsoDate(tx.time);
      const ticketId = await upsertTicket(tx, ticketNo, tripIds.get(tripNo) || null, timestamp);
      await upsertPayment(tx, ticketId, ticketNo, timestamp);
      ticketCount += 1;
      paymentCount += 1;
    }

    await insertSyncLog({
      source_path: "POS_Devices/*/Trips/*/Transactions",
      target_table: "trips,tickets,payments",
      sync_status: "success",
      synced_at: new Date().toISOString()
    });

    return {
      synced: true,
      trips: tripIds.size,
      tickets: ticketCount,
      payments: paymentCount
    };
  },

  // ─── Remittances ──────────────────────────────────────────────────────────

  async listRemittances(): Promise<RemittanceRecord[]> {
    try {
      const rows = await rowsFromTable<AnyRecord>("remittances", { order: { column: "shift_date", ascending: false } });
      return rows.map(remittanceFromRow);
    } catch {
      return [];
    }
  },

  async createRemittance(payload: Partial<RemittanceRecord>): Promise<RemittanceRecord | null> {
    if (!supabaseAdmin) return null;
    const row: AnyRecord = {
      conductor_id: payload.conductorId || null,
      cashier_id: payload.cashierId || payload.receivedById || null,
      shift_date: payload.shiftDate || new Date().toISOString().split("T")[0],
      expected_amount: toNumber(payload.expectedAmount),
      actual_remitted: toNumber(payload.remittedAmount),
      status: normalizeRemittanceStatus(payload.status),
      remarks: payload.notes || null
    };
    if (payload.busId !== undefined) row.bus_id = payload.busId || null;
    if (payload.routeId !== undefined) row.route_id = payload.routeId || null;
    if (payload.ticketCount !== undefined) row.ticket_count = payload.ticketCount;
    if (payload.submittedAt !== undefined) row.submitted_at = payload.submittedAt || null;
    if (payload.proofImageUrl !== undefined) row.proof_image_url = payload.proofImageUrl || null;
    if (payload.proofImagePath !== undefined) row.proof_image_path = payload.proofImagePath || null;

    const { data, error } = await supabaseAdmin.from("remittances").insert(row).select("*").single();
    if (error) throw new AppError(502, "SUPABASE_REMITTANCE_CREATE_FAILED", error.message);
    return remittanceFromRow(data);
  },

  async patchRemittance(id: string, payload: Partial<RemittanceRecord>): Promise<RemittanceRecord | null> {
    if (!supabaseAdmin) return null;
    const patch: AnyRecord = {};
    if (payload.conductorId !== undefined) patch.conductor_id = payload.conductorId || null;
    if (payload.cashierId !== undefined || payload.receivedById !== undefined) {
      patch.cashier_id = payload.cashierId || payload.receivedById || null;
    }
    if (payload.shiftDate !== undefined) patch.shift_date = payload.shiftDate;
    if (payload.expectedAmount !== undefined) patch.expected_amount = toNumber(payload.expectedAmount);
    if (payload.remittedAmount !== undefined) patch.actual_remitted = toNumber(payload.remittedAmount);
    if (payload.status !== undefined) patch.status = normalizeRemittanceStatus(payload.status);
    if (payload.notes !== undefined) patch.remarks = payload.notes || null;
    if (payload.busId !== undefined) patch.bus_id = payload.busId || null;
    if (payload.routeId !== undefined) patch.route_id = payload.routeId || null;
    if (payload.ticketCount !== undefined) patch.ticket_count = payload.ticketCount;
    if (payload.receivedAt !== undefined) patch.received_at = payload.receivedAt || null;
    if (payload.submittedAt !== undefined) patch.submitted_at = payload.submittedAt || null;
    if (payload.proofImageUrl !== undefined) patch.proof_image_url = payload.proofImageUrl || null;
    if (payload.proofImagePath !== undefined) patch.proof_image_path = payload.proofImagePath || null;
    if (hasValue(patch.updated_at === undefined)) patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin.from("remittances").update(patch).eq("id", id).select("*").single();
    if (error) throw new AppError(502, "SUPABASE_REMITTANCE_PATCH_FAILED", error.message);
    return remittanceFromRow(data);
  },

  // ─── Employee Violations ──────────────────────────────────────────────────

  async listViolations(employeeId?: string): Promise<EmployeeViolationRecord[]> {
    try {
      const rows = employeeId
        ? await rowsFromTable<AnyRecord>("employee_violations", {
            eq: { column: "employee_id", value: employeeId },
            order: { column: "violation_date", ascending: false }
          })
        : await rowsFromTable<AnyRecord>("employee_violations", { order: { column: "violation_date", ascending: false } });
      return rows.map(violationFromRow);
    } catch {
      return [];
    }
  },

  async createViolation(payload: Partial<EmployeeViolationRecord>): Promise<EmployeeViolationRecord | null> {
    if (!supabaseAdmin) return null;
    const row: AnyRecord = {
      employee_id: payload.employeeId,
      violation_date: payload.violationDate || new Date().toISOString().split("T")[0],
      violation_type: payload.violationType || "Other",
      description: payload.description || null,
      penalty: payload.penalty || null,
      penalty_type: payload.penaltyType || payload.penalty || null,
      penalty_details: payload.penaltyDetails || null,
      suspension_days: payload.suspensionDays ?? 0,
      salary_deduction_amount: payload.salaryDeductionAmount ?? 0,
      deduction_reason: payload.deductionReason || null,
      penalty_start_date: payload.penaltyStartDate || null,
      penalty_end_date: payload.penaltyEndDate || null,
      evidence_notes: payload.evidenceNotes || null,
      remittance_id: payload.remittanceId || null,
      incident_time: payload.incidentTime || null,
      employee_number: payload.employeeNumber || null,
      employee_name: payload.employeeName || null,
      employee_role: payload.employeeRole || payload.role || null,
      bus_id: payload.busId || null,
      bus_number: payload.busNumber || null,
      route_id: payload.routeId || null,
      route_name: payload.routeName || null,
      status: payload.status || "Active",
      reported_by: payload.reportedById || null
    };
    if (payload.severity !== undefined) row.severity = payload.severity || null;
    if (payload.resolutionNotes !== undefined) row.resolution_notes = payload.resolutionNotes || null;

    const { data, error } = await supabaseAdmin.from("employee_violations").insert(row).select("*").single();
    if (error) {
      const hint = error.message.toLowerCase().includes("column")
        ? " Run backend/sql/migration_employee_violations_disciplinary_fields.sql in Supabase SQL Editor."
        : "";
      throw new AppError(502, "SUPABASE_VIOLATION_CREATE_FAILED", `${error.message}${hint}`);
    }
    return violationFromRow(data);
  },

  async patchViolation(id: string, payload: Partial<EmployeeViolationRecord>): Promise<EmployeeViolationRecord | null> {
    if (!supabaseAdmin) return null;
    const patch: AnyRecord = {};
    if (payload.employeeId !== undefined) patch.employee_id = payload.employeeId;
    if (payload.employeeNumber !== undefined) patch.employee_number = payload.employeeNumber || null;
    if (payload.employeeName !== undefined) patch.employee_name = payload.employeeName || null;
    if (payload.employeeRole !== undefined || payload.role !== undefined) patch.employee_role = payload.employeeRole || payload.role || null;
    if (payload.busId !== undefined) patch.bus_id = payload.busId || null;
    if (payload.busNumber !== undefined) patch.bus_number = payload.busNumber || null;
    if (payload.routeId !== undefined) patch.route_id = payload.routeId || null;
    if (payload.routeName !== undefined) patch.route_name = payload.routeName || null;
    if (payload.remittanceId !== undefined) patch.remittance_id = payload.remittanceId || null;
    if (payload.violationDate !== undefined) patch.violation_date = payload.violationDate;
    if (payload.incidentTime !== undefined) patch.incident_time = payload.incidentTime || null;
    if (payload.violationType !== undefined) patch.violation_type = payload.violationType;
    if (payload.description !== undefined) patch.description = payload.description || null;
    if (payload.penalty !== undefined) patch.penalty = payload.penalty || null;
    if (payload.penaltyType !== undefined) patch.penalty_type = payload.penaltyType || null;
    if (payload.penaltyDetails !== undefined) patch.penalty_details = payload.penaltyDetails || null;
    if (payload.suspensionDays !== undefined) patch.suspension_days = payload.suspensionDays || 0;
    if (payload.salaryDeductionAmount !== undefined) patch.salary_deduction_amount = payload.salaryDeductionAmount || 0;
    if (payload.deductionReason !== undefined) patch.deduction_reason = payload.deductionReason || null;
    if (payload.penaltyStartDate !== undefined) patch.penalty_start_date = payload.penaltyStartDate || null;
    if (payload.penaltyEndDate !== undefined) patch.penalty_end_date = payload.penaltyEndDate || null;
    if (payload.evidenceNotes !== undefined) patch.evidence_notes = payload.evidenceNotes || null;
    if (payload.status !== undefined) patch.status = payload.status;
    if (payload.reportedById !== undefined) patch.reported_by = payload.reportedById || null;
    if (payload.severity !== undefined) patch.severity = payload.severity || null;
    if (payload.resolutionNotes !== undefined) patch.resolution_notes = payload.resolutionNotes || null;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin.from("employee_violations").update(patch).eq("id", id).select("*").single();
    if (error) {
      const hint = error.message.toLowerCase().includes("column")
        ? " Run backend/sql/migration_employee_violations_disciplinary_fields.sql in Supabase SQL Editor."
        : "";
      throw new AppError(502, "SUPABASE_VIOLATION_PATCH_FAILED", `${error.message}${hint}`);
    }
    return violationFromRow(data);
  }
};
