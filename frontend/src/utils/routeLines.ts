import type { RouteConfig } from "@pos-bus/shared";

export type MainRouteLineId = "fvr-pitx" | "fvr-stcruz" | "hidden";

type RouteAny = RouteConfig & Record<string, any>;
type PointAny = Record<string, any>;

export type MainRouteLine = {
  id: MainRouteLineId;
  label: string;
  shortLabel: string;
  description: string;
  chips: string[];
  routes: RouteConfig[];
};

const PITX_KEYWORDS = [
  "pitx",
  "pitix",
  "fvr pitx",
  "fvr pitx fvr",
  "gma",
  "kamuning",
  "quezon ave",
  "edsa",
  "cubao",
  "ortigas",
  "guadalupe",
  "ayala",
  "magallanes"
];

const STCRUZ_KEYWORDS = [
  "st cruz",
  "st. cruz",
  "st-cruz",
  "stcruz",
  "muzon",
  "sampol",
  "area e",
  "motorpol",
  "proper",
  "new city hall",
  "kaypian",
  "san jose",
  "sapang palay",
  "sjdm",
  "san jose del monte",
  "marilao",
  "balintawak",
  "lacson",
  "frenza",
  "luma de gato",
  "st cruz terminal",
  "sta cruz",
  "santa cruz"
];

const normalize = (value?: string | number | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/pitix/g, "pitx")
    .replace(/st\.?\s*cruz/g, "st cruz")
    .replace(/sta\.?\s*cruz/g, "st cruz")
    .replace(/santa\s+cruz/g, "st cruz")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeRouteLabel = (value?: string | number | null) =>
  String(value || "")
    .replace(/PITIX/gi, "PITX")
    .replace(/Pitix/gi, "PITX")
    .replace(/St\.? ?Cruz/gi, "ST. CRUZ")
    .replace(/Sta\.? ?Cruz/gi, "ST. CRUZ")
    .replace(/Santa Cruz/gi, "ST. CRUZ")
    .replace(/FVR Terminal/gi, "FVR")
    .trim();

export const normalizeMainRouteLineId = (
  value?: string | number | null
): MainRouteLineId | null => {
  const lineId = normalize(value);
  const compact = lineId.replace(/\s+/g, "");

  if (
    compact === "fvrpitx" ||
    compact === "fvrpitix" ||
    compact === "fvrpitxfvr" ||
    compact === "fvrpitixfvr" ||
    compact === "pitx" ||
    compact === "pitix" ||
    lineId.includes("pitx") ||
    lineId.includes("gma") ||
    lineId.includes("kamuning")
  ) {
    return "fvr-pitx";
  }

  if (
    compact === "fvrstcruz" ||
    compact === "fvrstcruzfvr" ||
    compact === "fvrmuzonstcruz" ||
    compact === "fvrmuzonstcruzfvr" ||
    compact === "stcruz" ||
    compact === "muzon" ||
    lineId.includes("st cruz") ||
    lineId.includes("muzon")
  ) {
    return "fvr-stcruz";
  }

  if (lineId === "hidden") return "hidden";

  return null;
};

export const getMainRouteLineIdFromText = (
  ...values: Array<string | number | null | undefined>
): MainRouteLineId => {
  const haystack = normalize(values.filter(Boolean).join(" "));

  if (hasAnyKeyword(haystack, PITX_KEYWORDS)) return "fvr-pitx";
  if (hasAnyKeyword(haystack, STCRUZ_KEYWORDS)) return "fvr-stcruz";

  return "hidden";
};

const normalizeLineId = normalizeMainRouteLineId;

const getRouteExtra = (route: RouteConfig) => route as RouteAny;

export const isDefaultRoutePlaceholder = (route: RouteConfig) =>
  getRouteExtra(route).source === "default";

const buildRouteSearchText = (route: RouteConfig) => {
  const extra = getRouteExtra(route);

  const stops = ((route.stops || []) as PointAny[]).map((stop) =>
    [
      stop.id,
      stop.name,
      stop.origin,
      stop.destination,
      stop.lineId,
      stop.legacyKey
    ].join(" ")
  );

  const waypoints = ((route.waypoints || []) as PointAny[]).map((point) =>
    [
      point.id,
      point.name,
      point.origin,
      point.destination,
      point.lineId,
      point.legacyKey
    ].join(" ")
  );

  return normalize(
    [
      route.id,
      extra.lineId,
      extra.routeGroup,
      route.routeName,
      route.origin,
      route.destination,
      route.legacyKey,
      route.legacyPath,
      ...stops,
      ...waypoints
    ].join(" ")
  );
};

const hasAnyKeyword = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(normalize(keyword)));

const getExplicitLineId = (route: RouteConfig): MainRouteLineId | null => {
  const extra = getRouteExtra(route);

  const fromLineId = normalizeLineId(extra.lineId);
  if (fromLineId) return fromLineId;

  const fromRouteGroup = normalizeLineId(extra.routeGroup);
  if (fromRouteGroup) return fromRouteGroup;

  return null;
};

export function getFareStopLineId(route: RouteConfig): MainRouteLineId | "unknown" {
  const explicit = getExplicitLineId(route);

  if (explicit === "fvr-pitx" || explicit === "fvr-stcruz") {
    return explicit;
  }

  const haystack = buildRouteSearchText(route);

  if (hasAnyKeyword(haystack, PITX_KEYWORDS)) {
    return "fvr-pitx";
  }

  if (hasAnyKeyword(haystack, STCRUZ_KEYWORDS)) {
    return "fvr-stcruz";
  }

  return "unknown";
}

export function filterFareStopsBySelectedLine(
  fareMatrixRows: RouteConfig[],
  selectedLineId: MainRouteLineId
) {
  return fareMatrixRows.filter((row) => {
    const rowLineId = getFareStopLineId(row);

    if (selectedLineId === "hidden") {
      return rowLineId === "unknown";
    }

    return rowLineId === selectedLineId;
  });
}

export function filterFareStopsBySelectedLineAndDirection(
  fareMatrixRows: RouteConfig[],
  selectedLineId: MainRouteLineId,
  direction: RouteConfig["direction"]
) {
  return filterFareStopsBySelectedLine(fareMatrixRows, selectedLineId).filter(
    (row) => row.direction === direction
  );
}

export function getMainRouteLineId(route: RouteConfig): MainRouteLineId {
  const explicit = getExplicitLineId(route);

  if (explicit) {
    return explicit;
  }

  const haystack = buildRouteSearchText(route);

  if (hasAnyKeyword(haystack, PITX_KEYWORDS)) {
    return "fvr-pitx";
  }

  if (hasAnyKeyword(haystack, STCRUZ_KEYWORDS)) {
    return "fvr-stcruz";
  }

  return "hidden";
}

export function isVisibleMainRoute(route: RouteConfig) {
  if (isDefaultRoutePlaceholder(route)) return false;

  const status = route.status || "active";
  return status === "active" && getMainRouteLineId(route) !== "hidden";
}

export function groupMainRouteLines(routes: RouteConfig[]): MainRouteLine[] {
  const savedRoutes = routes.filter((route) => !isDefaultRoutePlaceholder(route));
  const visibleRoutes = savedRoutes.filter(isVisibleMainRoute);
  const hiddenRoutes = savedRoutes.filter((route) => !isVisibleMainRoute(route));

  return [
    {
      id: "fvr-pitx",
      label: "FVR <-> PITX",
      shortLabel: "FVR - PITX - FVR",
      description: "Main loop via GMA / PITX corridor",
      chips: ["FVR", "PITX", "FVR"],
      routes: visibleRoutes.filter((route) => getMainRouteLineId(route) === "fvr-pitx")
    },
    {
      id: "fvr-stcruz",
      label: "FVR <-> MUZON <-> ST. CRUZ",
      shortLabel: "FVR - MUZON - ST. CRUZ - FVR",
      description: "Main loop via Muzon and ST. CRUZ",
      chips: ["FVR", "MUZON", "ST. CRUZ", "FVR"],
      routes: visibleRoutes.filter((route) => getMainRouteLineId(route) === "fvr-stcruz")
    },
    {
      id: "hidden",
      label: "Hidden / extra route lines",
      shortLabel: "Advanced route list",
      description: "Inactive, archived, unlinked, or extra admin route records",
      chips: ["Advanced"],
      routes: hiddenRoutes
    }
  ];
}

/**
 * IMPORTANT:
 * Do not fallback to line.routes[0].
 *
 * If admin selected Reverse but no reverse AdminRoute exists yet, returning
 * the forward route makes the map show wrong Start/End markers. Returning null
 * is safer because the UI can show "missing route direction" instead.
 */
export function getPrimaryRouteForLine(
  line: MainRouteLine | undefined | null,
  direction: RouteConfig["direction"]
) {
  if (!line) return null;

  return line.routes.find((route) => route.direction === direction) || null;
}

export function getRouteStopsLabel(route?: RouteConfig | null) {
  if (!route) return "No route selected";

  const stops = route.stops?.length
    ? route.stops.map((stop) => stop.name).filter(Boolean)
    : [route.origin, route.destination];

  return stops.map(normalizeRouteLabel).join(" -> ");
}

export function getRouteDisplayName(route: RouteConfig) {
  return normalizeRouteLabel(
    route.routeName || `${route.origin} to ${route.destination}`
  );
}

export function getRouteLineLabel(lineId?: MainRouteLineId | string | null) {
  const normalized = normalizeLineId(lineId || "");

  if (normalized === "fvr-pitx") return "FVR <-> PITX";
  if (normalized === "fvr-stcruz") return "FVR <-> MUZON <-> ST. CRUZ";
  if (normalized === "hidden") return "Hidden / extra route line";

  return "Unlinked route line";
}

export function getRouteLineShortLabel(lineId?: MainRouteLineId | string | null) {
  const normalized = normalizeLineId(lineId || "");

  if (normalized === "fvr-pitx") return "FVR - PITX - FVR";
  if (normalized === "fvr-stcruz") return "FVR - MUZON - ST. CRUZ - FVR";
  if (normalized === "hidden") return "Advanced route list";

  return "Unlinked route";
}
