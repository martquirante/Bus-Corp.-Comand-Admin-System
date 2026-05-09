type TileLayerLike = {
  on?: (event: string, handler: () => void) => TileLayerLike;
  setUrl?: (url: string, noRedraw?: boolean) => TileLayerLike;
};

type TileLayerFactory<T extends TileLayerLike> = {
  tileLayer: (url: string, options?: Record<string, unknown>) => T;
  layerGroup?: (layers: unknown[]) => T;
};

/**
 * IMPORTANT:
 * Google Maps labels/POI names cannot be copied exactly without Google Maps API.
 *
 * Free fallback:
 * - Esri World Imagery for satellite
 * - Esri reference/transportation labels over satellite
 * - CartoDB labels fallback
 *
 * Do not hardcode MapTiler keys. Invalid MapTiler keys often return
 * "Invalid key" image tiles instead of tileerror, so fallback may not trigger.
 */
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim() || "";
const USE_MAPTILER = process.env.NEXT_PUBLIC_USE_MAPTILER === "true";

const ESRI_SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const ESRI_BOUNDARIES_AND_PLACES_LABEL_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

const ESRI_TRANSPORTATION_LABEL_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";

const CARTODB_LABEL_ONLY_URL =
  "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png";

const OSM_STREET_TILE_URL =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const mapTilerHybridTileUrl = (key: string) =>
  `https://api.maptiler.com/maps/hybrid/256/{z}/{x}/{y}.jpg?key=${encodeURIComponent(key)}`;

export const createStreetTileLayer = <T extends TileLayerLike>(
  L: TileLayerFactory<T>,
  options: Record<string, unknown> = {}
) => {
  return L.tileLayer(OSM_STREET_TILE_URL, {
    attribution: "(c) OpenStreetMap contributors",
    maxZoom: 19,
    maxNativeZoom: 19,
    ...options
  });
};

export const createSatelliteBaseTileLayer = <T extends TileLayerLike>(
  L: TileLayerFactory<T>,
  options: Record<string, unknown> = {}
) => {
  if (!USE_MAPTILER || !MAPTILER_KEY) {
    return L.tileLayer(ESRI_SATELLITE_TILE_URL, {
      attribution: "Tiles (c) Esri",
      maxZoom: 19,
      maxNativeZoom: 19,
      ...options
    });
  }

  const layer = L.tileLayer(mapTilerHybridTileUrl(MAPTILER_KEY), {
    attribution: "(c) MapTiler (c) OpenStreetMap contributors / fallback imagery (c) Esri",
    maxZoom: 22,
    maxNativeZoom: 20,
    ...options
  });

  let switchedToFallback = false;

  layer.on?.("tileerror", () => {
    if (switchedToFallback) return;

    switchedToFallback = true;
    layer.setUrl?.(ESRI_SATELLITE_TILE_URL, false);
  });

  return layer;
};

export const createSatelliteLabelLayers = <T extends TileLayerLike>(
  L: TileLayerFactory<T>,
  options: Record<string, unknown> = {}
) => {
  const placeLabels = L.tileLayer(ESRI_BOUNDARIES_AND_PLACES_LABEL_URL, {
    attribution: "Labels (c) Esri",
    maxZoom: 19,
    maxNativeZoom: 19,
    pane: "overlayPane",
    opacity: 0.92,
    ...options
  });

  const roadLabels = L.tileLayer(ESRI_TRANSPORTATION_LABEL_URL, {
    attribution: "Road labels (c) Esri",
    maxZoom: 19,
    maxNativeZoom: 19,
    pane: "overlayPane",
    opacity: 0.88,
    ...options
  });

  const cartoLabels = L.tileLayer(CARTODB_LABEL_ONLY_URL, {
    attribution: "(c) CARTO (c) OpenStreetMap contributors",
    maxZoom: 20,
    maxNativeZoom: 20,
    pane: "overlayPane",
    opacity: 0.75,
    ...options
  });

  return {
    placeLabels,
    roadLabels,
    cartoLabels
  };
};

/**
 * Backward-compatible function.
 * If the caller supports layerGroup, this returns satellite + labels together.
 * If not, it returns satellite only.
 */
export const createSatelliteHybridTileLayer = <T extends TileLayerLike>(
  L: TileLayerFactory<T>,
  options: Record<string, unknown> = {}
) => {
  const satellite = createSatelliteBaseTileLayer(L, options);

  if (!L.layerGroup) {
    return satellite;
  }

  const labels = createSatelliteLabelLayers(L);

  return L.layerGroup([
    satellite,
    labels.placeLabels,
    labels.roadLabels,
    labels.cartoLabels
  ]);
};
