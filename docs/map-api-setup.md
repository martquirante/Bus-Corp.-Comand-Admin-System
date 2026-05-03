# Map API Setup

## Legacy Inspection

The old `dashboard.js` used:

- Leaflet for browser maps.
- OpenStreetMap tiles: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`.
- Google traffic tile overlay: `https://mt0.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}`.
- Esri satellite tiles.
- OSRM public route API for plotted route line previews.
- Nominatim search for Philippine location search.

No Mapbox token or Google Maps JavaScript browser API key was found in the inspected legacy files.

## New Frontend Env

```text
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

These are intentionally blank by default. The current command-center map loads Leaflet from CDN and uses OpenStreetMap public tiles, so Mapbox/Google browser keys are not required for the temporary legacy-compatible map.

## Behavior

- If POS device GPS exists, fleet markers are positioned from `POS_Devices.*.LiveStatus.lat/lng`.
- If GPS is missing, markers are staged near HQ and the map shows "No live GPS data yet".
- Street, satellite, and traffic controls mirror the old dashboard behavior.
- Nominatim is used for Philippine location search.
- Google Maps short links are stored/displayed as `mapReferenceUrl`; they are not treated as coordinates.
