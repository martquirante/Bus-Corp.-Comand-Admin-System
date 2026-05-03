# Realtime Routes

Only two production route groups should appear by default:

1. FVR <-> PITX via GMA
   - `fvr-to-pitx-via-gma`
   - `pitx-to-fvr-via-gma`

2. FVR <-> ST. CRUZ
   - `fvr-to-st-cruz`
   - `st-cruz-to-fvr`

## Route Line Sources

The map draws route polylines from:

- Firebase `AdminRoutes/{routeId}/waypoints`
- Supabase `route_waypoints`

Stops are read from:

- Firebase `AdminRoutes/{routeId}/stops`
- Supabase `route_stops`

Google Maps links are stored as references only. They are not used as route line geometry.

`Routes_Forward` and `Routes_Reverse` are still available through legacy endpoints, but the UI hides them behind the advanced legacy fare matrix view.
