# Route Management

## Legacy Compatibility

The conductor/POS app may depend on the legacy route tables:

- `Routes_Forward`
- `Routes_Reverse`

The Web Admin reads these paths but does not edit or delete them by default.

## Admin-Managed Routes

Editable admin route records are saved to:

```text
AdminRoutes
```

Preferred shape:

```json
{
  "routeId": "fvr-to-pitx-via-gma",
  "routeName": "FVR to PITX via GMA",
  "origin": "FVR Terminal",
  "destination": "PITX",
  "direction": "forward",
  "isViceVersa": true,
  "reverseRouteId": "gma-kamuning-to-fvr-terminal",
  "status": "active",
  "mapReferenceUrl": "https://maps.app.goo.gl/afMZornDfTm4Rpzh9",
  "distanceKm": 0,
  "estimatedDurationMinutes": 0,
  "baseFare": 0,
  "farePerKm": 0,
  "stops": [],
  "waypoints": [],
  "assignedBusId": "",
  "assignedTripScheduleId": "",
  "createdAt": "",
  "updatedAt": ""
}
```

## Default Routes

The production UI shows only two route groups by default:

- FVR <-> PITX via GMA
- FVR <-> ST. CRUZ

Current route IDs:

- `fvr-to-pitx-via-gma`
- `pitx-to-fvr-via-gma`
- `fvr-to-st-cruz`
- `st-cruz-to-fvr`

Route lines come from `AdminRoutes/{routeId}/waypoints` or Supabase `route_waypoints`. Google Maps links are stored as references only.

## API

- `GET /api/routes`
- `GET /api/routes/:id`
- `GET /api/routes/:id/waypoints`
- `GET /api/routes/:id/stops`
- `POST /api/routes`
- `PATCH /api/routes/:id`
- `PATCH /api/routes/:id/status`
- `POST /api/routes/:id/sync-to-supabase`
- `GET /api/routes/legacy/forward`
- `GET /api/routes/legacy/reverse`

Legacy fare matrix rows stay hidden behind the advanced Route Config option and are not used as main Live Map route lines.
