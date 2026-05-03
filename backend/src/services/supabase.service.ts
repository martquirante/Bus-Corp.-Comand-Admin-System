import type {
  BusFleetRecord,
  CriticalAlert,
  EmployeeRecord,
  LegacyNotification,
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
  | "tickets"
  | "payments"
  | "expenses"
  | "critical_alerts"
  | "notifications"
  | "conversations"
  | "chat_messages"
  | "firebase_sync_logs";

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
  "tickets",
  "payments",
  "expenses",
  "critical_alerts",
  "notifications",
  "conversations",
  "chat_messages",
  "firebase_sync_logs"
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

const employeeFromRow = (row: AnyRecord): EmployeeRecord => ({
  id: String(row.id),
  employeeNumber: String(row.employee_no || row.employeeNumber || row.id),
  fullName: String(row.full_name || row.fullName || "Unnamed employee"),
  role: row.role || "conductor",
  phone: row.phone || undefined,
  address: row.address || undefined,
  email: row.email || undefined,
  salaryRate: row.salary_rate ? toNumber(row.salary_rate) : undefined,
  salaryType: row.salary_type || undefined,
  dateHired: row.date_hired || undefined,
  status: row.status === "suspended" ? "inactive" : row.status || "active",
  profilePhotoUrl: row.profile_photo_url || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const busFromRow = (row: AnyRecord): BusFleetRecord => ({
  id: String(row.id),
  busNumber: String(row.bus_no || row.busNumber || row.id),
  plateNumber: row.plate_no || undefined,
  busType: row.bus_type || undefined,
  seatingCapacity: row.seat_capacity ? toNumber(row.seat_capacity) : undefined,
  standingCapacity: row.standing_capacity ? toNumber(row.standing_capacity) : undefined,
  currentPassengerCount: row.current_passenger_count ? toNumber(row.current_passenger_count) : undefined,
  status: ["maintenance", "offline"].includes(row.status)
    ? row.status
    : row.status === "out_of_service"
      ? "inactive"
      : "active",
  assignedDriverId: row.assigned_driver_id || undefined,
  assignedConductorId: row.assigned_conductor_id || undefined,
  assignedRouteId: row.assigned_route_id || undefined,
  registrationNotes: row.registration_no || undefined,
  insuranceInfo: row.insurance_info || undefined,
  permitInfo: row.permit_info || undefined,
  lastMaintenance: row.last_maintenance_at || undefined,
  odometer: row.odometer_km ? toNumber(row.odometer_km) : undefined,
  fuelType: row.fuel_type || undefined,
  photoUrl: row.main_photo_url || undefined,
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
  busNumber: row.bus_no || row.busNumber || "N/A",
  driver: row.driver_name || "N/A",
  conductor: row.conductor_name || "N/A",
  origin: row.origin || "N/A",
  destination: row.destination || "N/A",
  route: row.route_name || `${row.origin || "N/A"} -> ${row.destination || "N/A"}`,
  passengerType: row.passenger_type || "regular",
  passengerCount: toNumber(row.passenger_count, 1),
  paymentMethod: row.payment_method || "unknown",
  amount: toNumber(row.fare),
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
  if (supabaseAdmin) {
    await supabaseAdmin.from("firebase_sync_logs").insert(payload);
    return;
  }

  if (supabasePool) {
    await supabasePool.query(
      "insert into public.firebase_sync_logs (source_path, source_key, target_table, sync_status, error_message, synced_at) values ($1,$2,$3,$4,$5,$6)",
      [
        payload.source_path,
        payload.source_key || null,
        payload.target_table || null,
        payload.sync_status || "success",
        payload.error_message || null,
        payload.synced_at || new Date().toISOString()
      ]
    );
  }
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
    const { data, error } = await supabaseAdmin
      .from("employees")
      .insert({
        employee_no: payload.employeeNumber,
        full_name: payload.fullName,
        role: payload.role,
        phone: payload.phone || null,
        email: payload.email || null,
        address: payload.address || null,
        salary_rate: payload.salaryRate || null,
        salary_type: payload.salaryType || null,
        date_hired: payload.dateHired || null,
        status: payload.status || "active",
        profile_photo_url: payload.profilePhotoUrl || null
      })
      .select("*")
      .single();
    if (error) throw new AppError(502, "SUPABASE_EMPLOYEE_CREATE_FAILED", error.message);
    return employeeFromRow(data);
  },

  async patchEmployee(id: string, payload: Partial<EmployeeRecord>) {
    if (!supabaseAdmin) return null;
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
    if (payload.profilePhotoUrl !== undefined) patch.profile_photo_url = payload.profilePhotoUrl;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin.from("employees").update(patch).eq("id", id).select("*").single();
    if (error) throw new AppError(502, "SUPABASE_EMPLOYEE_PATCH_FAILED", error.message);
    return employeeFromRow(data);
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
    if (payload.assignedConductorId !== undefined) patch.assigned_conductor_id = payload.assignedConductorId || null;
    if (payload.assignedRouteId !== undefined) patch.assigned_route_id = payload.assignedRouteId || null;
    if (payload.registrationNotes !== undefined) patch.registration_no = payload.registrationNotes;
    if (payload.insuranceInfo !== undefined) patch.insurance_info = payload.insuranceInfo;
    if (payload.permitInfo !== undefined) patch.permit_info = payload.permitInfo;
    if (payload.odometer !== undefined) patch.odometer_km = payload.odometer;
    if (payload.fuelType !== undefined) patch.fuel_type = payload.fuelType;
    if (payload.photoUrl !== undefined) patch.main_photo_url = payload.photoUrl;
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
    return (await rowsFromTable<AnyRecord>("tickets", { order: { column: "created_at", ascending: false }, limit })).map(transactionFromTicket);
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
    const [employees, buses, routes, expenses, notifications, criticalAlerts] = await Promise.all([
      this.listEmployees(),
      this.listBuses(),
      this.listRoutes(),
      this.listExpenses(),
      this.listNotifications(),
      this.listCriticalAlerts()
    ]);

    return {
      employees: employees.length,
      buses: buses.length,
      routes: routes.length,
      expenses: expenses.length,
      notifications: notifications.length,
      criticalAlerts: criticalAlerts.length
    };
  },

  async getAnalyticsSummary() {
    const [tickets, expenses] = await Promise.all([this.listTransactions(1000), this.listExpenses()]);
    const grossRevenue = tickets.reduce((sum, ticket) => sum + ticket.amount, 0);
    const expenseTotal = expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);

    return {
      grossRevenue,
      expenseTotal,
      netProfit: grossRevenue - expenseTotal,
      ticketCount: tickets.length,
      passengerCount: tickets.reduce((sum, ticket) => sum + ticket.passengerCount, 0)
    };
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
  }
};
