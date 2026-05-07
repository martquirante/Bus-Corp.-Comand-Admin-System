import type { Request, Response } from "express";
import { z } from "zod";
import { routeConfigSchema, routeDirectionSchema } from "@pos-bus/shared";
import { routeService } from "../services/route.service.js";
import { routeSyncService } from "../services/routeSync.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

type RouteExtraFields = {
  trafficDurationMinutes?: number;
  encodedPolyline?: string;
  routeGeometrySource?: string;
};

const routeStatusSchema = z.object({
  status: z.enum(["active", "inactive", "archived"])
});

const waypointSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  sequence: z.coerce.number().int().optional(),
  type: z.enum(["origin", "stop", "destination", "waypoint"]).optional(),

  // Optional fare stop / map marker metadata.
  fare: z.coerce.number().optional(),
  source: z.string().optional(),
  legacyKey: z.string().optional(),
  lineId: z.string().optional(),
  direction: z.enum(["forward", "reverse"]).optional(),
  origin: z.string().optional(),
  destination: z.string().optional()
});

const routePatchSchema = routeConfigSchema.partial().passthrough();

const routePathSchema = z.object({
  waypoints: z.array(waypointSchema).default([]),
  routeName: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  direction: routeDirectionSchema.optional(),
  reverseRouteId: z.string().optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  price: z.coerce.number().optional(),
  baseFare: z.coerce.number().optional(),
  isViceVersa: z.boolean().optional(),
  lineId: z.string().optional(),
  routeGroup: z.string().optional(),
  distanceKm: z.coerce.number().optional(),
  estimatedDurationMinutes: z.coerce.number().optional(),
  trafficDurationMinutes: z.coerce.number().optional(),
  encodedPolyline: z.string().optional(),
  routeGeometrySource: z.string().optional(),
  mapReferenceUrl: z.string().optional(),
  googleMapReferenceUrl: z.string().optional()
});

const routeReferenceSchema = z.object({
  mapReferenceUrl: z.string().optional(),
  googleMapReferenceUrl: z.string().optional()
});

const recalculateRoutePathSchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  waypoints: z.array(waypointSchema).optional(),
  mapReferenceUrl: z.string().optional(),
  googleMapReferenceUrl: z.string().optional()
});

const createRouteSchema = routeConfigSchema.passthrough();

export const routesController = {
  async getRoutes(req: Request, res: Response) {
    const direction = req.query.direction
      ? routeDirectionSchema.parse(req.query.direction)
      : undefined;

    const routes = await routeService.getRoutes(direction);
    res.json(envelope(routes, firebaseService.source()));
  },

  async getRoute(req: Request, res: Response) {
    const route = await routeService.getRouteById(req.params.id);
    res.json(envelope(route, firebaseService.source()));
  },

  async getRouteWaypoints(req: Request, res: Response) {
    const waypoints = await routeService.getRouteWaypoints(req.params.id);
    res.json(envelope(waypoints, firebaseService.source()));
  },

  async getRouteStops(req: Request, res: Response) {
    const stops = await routeService.getRouteStops(req.params.id);
    res.json(envelope(stops, firebaseService.source()));
  },

  async getLegacyForward(_req: Request, res: Response) {
    const routes = await routeService.getLegacyRoutes("forward");
    res.json(envelope(routes, firebaseService.source()));
  },

  async getLegacyReverse(_req: Request, res: Response) {
    const routes = await routeService.getLegacyRoutes("reverse");
    res.json(envelope(routes, firebaseService.source()));
  },

  /**
   * POST /api/routes/legacy/:direction
   *
   * Creates a new conductor fare stop row.
   *
   * direction = forward  -> Firebase Routes_Forward
   * direction = reverse  -> Firebase Routes_Reverse
   *
   * This must NOT create an AdminRoutes route line.
   */
  async createLegacyRoute(req: Request, res: Response) {
    const direction = routeDirectionSchema.parse(req.params.direction);
    const payload = routePatchSchema.parse(req.body);

    const route = await routeService.createLegacyRoute(
      direction,
      payload,
      req.user?.email || "system"
    );

    res.status(201).json(envelope(route, firebaseService.source()));
  },

  /**
   * PATCH /api/routes/legacy/:direction/:key
   *
   * Updates an existing conductor fare stop row.
   */
  async updateLegacyRoute(req: Request, res: Response) {
    const direction = routeDirectionSchema.parse(req.params.direction);
    const key = String(req.params.key);
    const payload = routePatchSchema.parse(req.body);

    const route = await routeService.updateLegacyRoute(
      direction,
      key,
      payload,
      req.user?.email || "system"
    );

    res.json(envelope(route, firebaseService.source()));
  },

  /**
   * DELETE /api/routes/legacy/:direction/:key
   *
   * Deletes a conductor fare stop row from Routes_Forward or Routes_Reverse.
   * This must NOT delete AdminRoutes.
   */
  async deleteLegacyRoute(req: Request, res: Response) {
    const direction = routeDirectionSchema.parse(req.params.direction);
    const key = String(req.params.key);

    const result = await routeService.deleteLegacyRoute(
      direction,
      key,
      req.user?.email || "system"
    );

    res.json(envelope(result, firebaseService.source()));
  },

  async createRoute(req: Request, res: Response) {
    const payload = createRouteSchema.parse(req.body);

    const route = await routeService.createRoute(
      payload,
      req.user?.email || "system"
    );

    res.status(201).json(envelope(route, firebaseService.source()));
  },

  async updateRoute(req: Request, res: Response) {
    const payload = routePatchSchema.parse(req.body);

    const route = await routeService.updateRoute(
      req.params.id,
      payload,
      req.user?.email || "system"
    );

    res.json(envelope(route, firebaseService.source()));
  },

  async updateRouteStatus(req: Request, res: Response) {
    const payload = routeStatusSchema.parse(req.body);

    const route = await routeService.updateRouteStatus(
      req.params.id,
      payload.status,
      req.user?.email || "system"
    );

    res.json(envelope(route, firebaseService.source()));
  },

  /**
   * PATCH /api/routes/:id/path
   *
   * Saves curated or manually edited route waypoints/polyline to Firebase AdminRoutes.
   * This is the path used by Route Config and Live Fleet Map.
   */
  async updateRoutePath(req: Request, res: Response) {
    const payload = routePathSchema.parse(req.body);

    const route = await routeService.updateRoutePath(
      req.params.id,
      payload,
      req.user?.email || "system"
    );

    res.json(envelope(route, firebaseService.source()));
  },

  /**
   * PATCH /api/routes/:id/reference
   *
   * Saves Google Maps link as reference metadata only.
   * This does NOT overwrite saved waypoints.
   */
  async updateRouteReference(req: Request, res: Response) {
    const payload = routeReferenceSchema.parse(req.body);

    const googleMapReferenceUrl =
      payload.googleMapReferenceUrl || payload.mapReferenceUrl || "";

    const route = await routeService.updateRouteReference(
      req.params.id,
      googleMapReferenceUrl,
      req.user?.email || "system"
    );

    res.json(envelope(route, firebaseService.source()));
  },

  /**
   * POST /api/routes/:id/recalculate-path
   *
   * Preview-only endpoint. It should not overwrite AdminRoutes unless the admin
   * later calls PATCH /api/routes/:id/path.
   *
   * For now this safely returns the existing/sent waypoints as preview.
   * Actual provider routing can be added later in route.service/routing.service.
   */
  async recalculateRoutePath(req: Request, res: Response) {
    const payload = recalculateRoutePathSchema.parse(req.body);
    const route = await routeService.getRouteById(req.params.id);
    const routeExtra = route as (NonNullable<typeof route> & RouteExtraFields) | null;

    const waypoints = payload.waypoints?.length
      ? payload.waypoints
      : route?.waypoints || [];

    res.json(
      envelope(
        {
          preview: true,
          routeId: req.params.id,
          waypoints,
          distanceKm: route?.distanceKm,
          estimatedDurationMinutes: route?.estimatedDurationMinutes,
          trafficDurationMinutes: routeExtra?.trafficDurationMinutes,
          encodedPolyline: routeExtra?.encodedPolyline,
          routeGeometrySource: routeExtra?.routeGeometrySource || "manual",
          message:
            "Route recalculation is preview-only. Review the path and click Save route path to update Firebase AdminRoutes."
        },
        firebaseService.source()
      )
    );
  },

  async addStop(req: Request, res: Response) {
    const stop = waypointSchema.parse(req.body);

    const route = await routeService.addStop(
      req.params.id,
      stop,
      req.user?.email || "system"
    );

    res.status(201).json(envelope(route, firebaseService.source()));
  },

  async patchStop(req: Request, res: Response) {
    const stop = waypointSchema.partial().parse(req.body);

    const route = await routeService.patchStop(
      req.params.id,
      req.params.stopId,
      stop,
      req.user?.email || "system"
    );

    res.json(envelope(route, firebaseService.source()));
  },

  async deleteStop(req: Request, res: Response) {
    const route = await routeService.deleteStop(
      req.params.id,
      req.params.stopId,
      req.user?.email || "system"
    );

    res.json(envelope(route, firebaseService.source()));
  },

  async patchLine(req: Request, res: Response) {
    const payload = z
      .object({
        waypoints: z.array(waypointSchema).default([])
      })
      .parse(req.body);

    const route = await routeService.patchLine(
      req.params.id,
      payload.waypoints,
      req.user?.email || "system"
    );

    res.json(envelope(route, firebaseService.source()));
  },

  async syncToSupabase(req: Request, res: Response) {
    const result = await routeSyncService.syncRouteToSupabase(req.params.id);
    res.json(envelope(result, firebaseService.source()));
  }
};
