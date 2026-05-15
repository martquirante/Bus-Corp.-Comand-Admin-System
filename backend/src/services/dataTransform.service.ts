import type {
  BusOperationalStatus,
  DashboardStats,
  FleetBus,
  PaymentMethod,
  RevenueReport,
  TransactionLog
} from "@pos-bus/shared";

type AnyRecord = Record<string, any>;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toText = (value: unknown, fallback = "N/A") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const toOptionalText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return undefined;
};

const firstFiniteNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
};

const getLiveDistanceKm = (live: AnyRecord) =>
  firstFiniteNumber(
    live.odometerKm,
    live.odometer,
    live.totalDistanceKm,
    live.distanceTraveledKm,
    live.distanceTravelledKm,
    live.tripDistanceKm,
    live.distanceKm,
    live.mileageKm,
    live.kmRun,
    live.kilometersRun
  );

const isOnline = (lastUpdate: number) => Date.now() - lastUpdate < 300000;

const isValidCoordinate = (lat: unknown, lng: unknown) => {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return (
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180 &&
    !(parsedLat === 0 && parsedLng === 0)
  );
};

const getRouteFromTrips = (bus: AnyRecord) => {
  const trips = Object.values(bus.Trips || {}) as AnyRecord[];

  for (let tripIndex = trips.length - 1; tripIndex >= 0; tripIndex -= 1) {
    const transactions = Object.values(trips[tripIndex]?.Transactions || {}) as AnyRecord[];

    for (let txIndex = transactions.length - 1; txIndex >= 0; txIndex -= 1) {
      const tx = transactions[txIndex];
      if (tx?.origin && tx?.destination) {
        return `${tx.origin} -> ${tx.destination}`;
      }
    }
  }

  return null;
};

const getStatus = (live: AnyRecord, online: boolean): BusOperationalStatus => {
  if (live.emergencyStatus === true) return "sos";
  if (!online) return "offline";

  const action = String(live.action || live.motion || live.turnSignal || "").toLowerCase();
  if (action.includes("left")) return "turning-left";
  if (action.includes("right")) return "turning-right";

  const speed = toNumber(live.speed);
  if (speed <= 0) return "idle";
  if (speed >= 45) return "fast";
  return "moving";
};

export const extractFleet = (root: AnyRecord): FleetBus[] => {
  const devices = root.POS_Devices || {};
  const unique = new Map<string, FleetBus>();

  Object.entries(devices).forEach(([deviceId, busValue]) => {
    const bus = busValue as AnyRecord;
    const live = bus.LiveStatus as AnyRecord | undefined;
    if (!live) return;

    const lastUpdate = toNumber(live.lastUpdate);
    const online = isOnline(lastUpdate);
    const busNumber = toText(live.busNumber, deviceId);
    const hasValidGps = isValidCoordinate(live.lat, live.lng);
    const statusText = String(live.status || live.currentLoop || live.action || "").toLowerCase();
    const isSnapshotNode = deviceId.includes("_");
    const snapshotIsActive =
      hasValidGps && ["active", "moving", "running", "idle", "sos", "emergency"].some((word) => statusText.includes(word));
    if (isSnapshotNode && !snapshotIsActive) return;

    const cash = toNumber(live.totalCash);
    const gcash = toNumber(live.totalGcash);
    const passengers =
      toNumber(live.regularCount) + toNumber(live.studentCount) + toNumber(live.seniorCount);
    const liveDistanceKm = getLiveDistanceKm(live);

    const transformed: FleetBus = {
      id: deviceId,
      busNumber,
      driver: toText(live.driver),
      conductor: toText(live.conductor),
      route: getRouteFromTrips(bus) || toText(live.currentLoop, "Unassigned"),
      status: getStatus(live, online),
      online,
      emergency: live.emergencyStatus === true,
      speed: toNumber(live.speed),
      lat: hasValidGps ? Number(live.lat) : null,
      lng: hasValidGps ? Number(live.lng) : null,
      cash,
      gcash,
      total: cash + gcash,
      passengers,
      lastUpdate,
      heading: Number.isFinite(Number(live.heading)) ? Number(live.heading) : undefined,
      odometer: liveDistanceKm,
      distanceKm: liveDistanceKm,
      assignedRouteId: toOptionalText(
        live.assignedRouteId,
        live.routeId,
        live.currentRouteId,
        bus.assignedRouteId,
        bus.routeId
      ),
      lineId: toOptionalText(live.lineId, live.routeLineId, live.routeGroup, bus.lineId)
    };

    const existing = unique.get(busNumber);
    if (!existing || transformed.lastUpdate > existing.lastUpdate) {
      unique.set(busNumber, transformed);
    }
  });

  return Array.from(unique.values()).sort((a, b) => a.busNumber.localeCompare(b.busNumber));
};

export const extractTransactions = (root: AnyRecord): TransactionLog[] => {
  const devices = root.POS_Devices || {};
  const transactions: TransactionLog[] = [];

  Object.entries(devices).forEach(([deviceId, busValue]) => {
    const bus = busValue as AnyRecord;
    Object.entries(bus.Trips || {}).forEach(([tripId, tripValue]) => {
      const trip = tripValue as AnyRecord;
      Object.entries(trip.Transactions || {}).forEach(([txId, txValue]) => {
        const tx = txValue as AnyRecord;
        const origin = toText(tx.origin, "Unknown Origin");
        const destination = toText(tx.destination, "Unknown Destination");
        const payment = String(tx.paymentMethod || "").toLowerCase();

        transactions.push({
          id: `${deviceId}:${tripId}:${txId}`,
          time: tx.timestamp ?? null,
          busNumber: toText(tx.busNo || tx.busNumber, toText(bus.LiveStatus?.busNumber, deviceId)),
          driver: toText(tx.driver, toText(bus.LiveStatus?.driver)),
          conductor: toText(tx.conductor, toText(bus.LiveStatus?.conductor)),
          origin,
          destination,
          route: `${origin} -> ${destination}`,
          passengerType: toText(tx.passengerType, "Regular"),
          passengerCount: Math.max(1, toNumber(tx.passengerCount, 1)),
          paymentMethod: (["cash", "gcash", "mixed"].includes(payment) ? payment : "unknown") as PaymentMethod,
          amount: toNumber(tx.totalAmount || tx.amount),
          tripId,
          deviceId
        });
      });
    });
  });

  return transactions.sort((a, b) => toNumber(b.time) - toNumber(a.time));
};

export const extractExpensesTotal = (root: AnyRecord) =>
  (Object.values(root.Expenses || {}) as AnyRecord[]).reduce<number>((sum, expense) => {
    return sum + toNumber((expense as AnyRecord).amount);
  }, 0);

export const buildDashboardStats = (root: AnyRecord): DashboardStats => {
  const fleet = extractFleet(root);
  const transactions = extractTransactions(root);
  const totalExpenses = extractExpensesTotal(root);
  const cashTotal = fleet.reduce((sum, bus) => sum + bus.cash, 0);
  const gcashTotal = fleet.reduce((sum, bus) => sum + bus.gcash, 0);
  const totalRevenue = cashTotal + gcashTotal;

  return {
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    activeBuses: fleet.filter((bus) => bus.online).length,
    totalPassengers: fleet.reduce((sum, bus) => sum + bus.passengers, 0),
    cashTotal,
    gcashTotal,
    totalTransactions: transactions.length,
    emergencyCount: fleet.filter((bus) => bus.emergency).length,
    lastUpdated: new Date().toISOString()
  };
};

export const buildRevenueReport = (root: AnyRecord): RevenueReport[] => {
  const byRoute = new Map<string, RevenueReport>();

  extractTransactions(root).forEach((tx) => {
    const current = byRoute.get(tx.route) || {
      route: tx.route,
      revenue: 0,
      passengers: 0
    };

    current.revenue += tx.amount;
    current.passengers += tx.passengerCount;
    byRoute.set(tx.route, current);
  });

  return Array.from(byRoute.values()).sort((a, b) => b.revenue - a.revenue);
};
