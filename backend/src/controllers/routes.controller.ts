import type { Request, Response } from "express";
import { z } from "zod";
import { routeConfigSchema, routeDirectionSchema } from "@pos-bus/shared";
import { routeService } from "../services/route.service.js";
import { routeSyncService } from "../services/routeSync.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

const routeStatusSchema = z.object({
  status: z.enum(["active", "inactive", "archived"])
});

const waypointSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  sequence: z.coerce.number().int().optional()
});

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

  async updateLegacyRoute(req: Request, res: Response) {
    const direction = routeDirectionSchema.parse(req.params.direction);
    const key = String(req.params.key);
    const payload = routeConfigSchema.partial().parse(req.body);
    const route = await routeService.updateLegacyRoute(direction, key, payload, req.user?.email || "system");
    res.json(envelope(route, firebaseService.source()));
  },

  async createRoute(req: Request, res: Response) {
    const payload = routeConfigSchema.parse(req.body);
    const route = await routeService.createRoute(payload, req.user?.email || "system");
    res.status(201).json(envelope(route, firebaseService.source()));
  },

  async updateRoute(req: Request, res: Response) {
    const payload = routeConfigSchema.partial().parse(req.body);
    const route = await routeService.updateRoute(req.params.id, payload, req.user?.email || "system");
    res.json(envelope(route, firebaseService.source()));
  },

  async updateRouteStatus(req: Request, res: Response) {
    const payload = routeStatusSchema.parse(req.body);
    const route = await routeService.updateRouteStatus(req.params.id, payload.status, req.user?.email || "system");
    res.json(envelope(route, firebaseService.source()));
  },

  async addStop(req: Request, res: Response) {
    const stop = waypointSchema.parse(req.body);
    const route = await routeService.addStop(req.params.id, stop, req.user?.email || "system");
    res.status(201).json(envelope(route, firebaseService.source()));
  },

  async patchStop(req: Request, res: Response) {
    const stop = waypointSchema.partial().parse(req.body);
    const route = await routeService.patchStop(req.params.id, req.params.stopId, stop, req.user?.email || "system");
    res.json(envelope(route, firebaseService.source()));
  },

  async deleteStop(req: Request, res: Response) {
    const route = await routeService.deleteStop(req.params.id, req.params.stopId, req.user?.email || "system");
    res.json(envelope(route, firebaseService.source()));
  },

  async patchLine(req: Request, res: Response) {
    const payload = z.object({ waypoints: z.array(waypointSchema).default([]) }).parse(req.body);
    const route = await routeService.patchLine(req.params.id, payload.waypoints, req.user?.email || "system");
    res.json(envelope(route, firebaseService.source()));
  },

  async syncToSupabase(req: Request, res: Response) {
    const result = await routeSyncService.syncRouteToSupabase(req.params.id);
    res.json(envelope(result, firebaseService.source()));
  }
};
