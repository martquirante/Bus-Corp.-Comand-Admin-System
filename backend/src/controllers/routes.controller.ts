import type { Request, Response } from "express";
import { routeConfigSchema, routeDirectionSchema } from "@pos-bus/shared";
import { routeService } from "../services/route.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

export const routesController = {
  async getRoutes(req: Request, res: Response) {
    const direction = req.query.direction
      ? routeDirectionSchema.parse(req.query.direction)
      : undefined;
    const routes = await routeService.getRoutes(direction);
    res.json(envelope(routes, firebaseService.source()));
  },

  async createRoute(req: Request, res: Response) {
    const payload = routeConfigSchema.parse(req.body);
    const route = await routeService.createRoute(payload, req.user?.email || "system");
    res.status(201).json(envelope(route, firebaseService.source()));
  },

  async updateRoute(req: Request, res: Response) {
    const direction = routeDirectionSchema.parse(req.body.direction || req.query.direction || "forward");
    const payload = routeConfigSchema.partial().parse(req.body);
    const route = await routeService.updateRoute(req.params.id, direction, payload, req.user?.email || "system");
    res.json(envelope(route, firebaseService.source()));
  }
};
