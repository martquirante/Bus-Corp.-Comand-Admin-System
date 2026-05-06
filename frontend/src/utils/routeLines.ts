import type { RouteConfig } from "@pos-bus/shared";

export type MainRouteLineId = "fvr-pitx" | "fvr-stcruz" | "hidden";

export type MainRouteLine = {
  id: MainRouteLineId;
  label: string;
  shortLabel: string;
  description: string;
  chips: string[];
  routes: RouteConfig[];
};

// ─── Google Maps reference links per route line ──────────────────────────────
// These are stored as metadata only – they do NOT auto-overwrite waypoints.
// Admin must click "Recalculate path" + "Save route path" for that.
export const ROUTE_GOOGLE_MAP_REFS: Record<"fvr-pitx" | "fvr-stcruz", string> = {
  "fvr-pitx": "https://maps.app.goo.gl/afMZornDfTm4Rpzh9",
  "fvr-stcruz": "https://maps.app.goo.gl/aAXkcU3hhThpB9RG7"
};

const normalize = (value?: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/pitix/g, "pitx")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeRouteLabel = (value?: string) =>
  String(value || "")
    .replace(/PITIX/gi, "PITX")
    .replace(/St\.? ?Cruz/gi, "ST. CRUZ")
    .replace(/FVR Terminal/gi, "FVR")
    .trim();

const PITX_KEYWORDS = ["pitx", "pitix"];
const STCRUZ_KEYWORDS = [
  "st cruz",
  "st. cruz",
  "st-cruz",
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
  "san jose del monte"
];

export function getFareStopLineId(route: RouteConfig): MainRouteLineId | "unknown" {
  const haystack = String(
    [
      route.id,
      route.routeName,
      route.origin,
      route.destination,
      route.legacyKey,
      route.legacyPath
    ].join(" ")
  ).toLowerCase();

  if (PITX_KEYWORDS.some((kw) => haystack.includes(kw))) return "fvr-pitx";
  if (STCRUZ_KEYWORDS.some((kw) => haystack.includes(kw))) return "fvr-stcruz";
  return "unknown";
}

export function filterFareStopsBySelectedLine(
  fareMatrixRows: RouteConfig[],
  selectedLineId: MainRouteLineId
) {
  return fareMatrixRows.filter((row) => getFareStopLineId(row) === selectedLineId);
}

export function getMainRouteLineId(route: RouteConfig): MainRouteLineId {
  const haystack = normalize(
    [
      route.id,
      route.routeName,
      route.origin,
      route.destination,
      ...(route.stops || []).map((stop) => stop.name),
      ...(route.waypoints || []).map((point) => point.name)
    ].join(" ")
  );

  if (PITX_KEYWORDS.some((kw) => haystack.includes(kw))) return "fvr-pitx";
  if (STCRUZ_KEYWORDS.some((kw) => haystack.includes(kw))) return "fvr-stcruz";
  return "hidden";
}

export function isVisibleMainRoute(route: RouteConfig) {
  const status = route.status || "active";
  return status === "active" && getMainRouteLineId(route) !== "hidden";
}

export function groupMainRouteLines(routes: RouteConfig[]): MainRouteLine[] {
  const visibleRoutes = routes.filter(isVisibleMainRoute);
  const hiddenRoutes = routes.filter((route) => !isVisibleMainRoute(route));

  return [
    {
      id: "fvr-pitx",
      label: "FVR ↔ PITX",
      shortLabel: "FVR - PITX - FVR",
      description: "Main loop via GMA / PITX corridor",
      chips: ["FVR", "PITX", "FVR"],
      routes: visibleRoutes.filter((route) => getMainRouteLineId(route) === "fvr-pitx")
    },
    {
      id: "fvr-stcruz",
      label: "FVR ↔ MUZON ↔ ST. CRUZ",
      shortLabel: "FVR - MUZON - ST. CRUZ - FVR",
      description: "Main loop via Muzon and ST. CRUZ",
      chips: ["FVR", "MUZON", "ST. CRUZ", "FVR"],
      routes: visibleRoutes.filter((route) => getMainRouteLineId(route) === "fvr-stcruz")
    },
    {
      id: "hidden",
      label: "Hidden / extra route lines",
      shortLabel: "Advanced route list",
      description: "Inactive, archived, or extra admin route records",
      chips: ["Advanced"],
      routes: hiddenRoutes
    }
  ];
}

export function getPrimaryRouteForLine(
  line: MainRouteLine,
  direction: RouteConfig["direction"]
) {
  return (
    line.routes.find((route) => route.direction === direction) ||
    line.routes[0] ||
    null
  );
}

export function getRouteStopsLabel(route?: RouteConfig | null) {
  if (!route) return "No route selected";
  const stops = route.stops?.length
    ? route.stops.map((stop) => stop.name).filter(Boolean)
    : [route.origin, route.destination];
  return stops.map(normalizeRouteLabel).join(" → ");
}

export function getRouteDisplayName(route: RouteConfig) {
  return normalizeRouteLabel(
    route.routeName || `${route.origin} to ${route.destination}`
  );
}