import type { Request, Response } from "express";
import { firebasePaths } from "@pos-bus/shared";
import { fleetService } from "../services/fleet.service.js";
import { routeService } from "../services/route.service.js";
import { realtimeDbService } from "../services/realtimeDb.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

const terminals = [
  { id: "gma", name: "GMA Terminal", address: "J2QR+FP Quezon City, Metro Manila", lat: 14.6387, lng: 121.0418 },
  { id: "st-cruz", name: "ST. CRUZ Terminal", address: "JX3J+XP Manila, Metro Manila", lat: 14.6049, lng: 120.9818 },
  { id: "muzon", name: "Muzon Terminal", address: "San Jose del Monte-Marilao Road, SJDM, Bulacan", lat: 14.8137, lng: 121.0377 },
  { id: "fvr-hq", name: "FVR Terminal / HQ", address: "V25X+F5P, Balasing - San Jose Rd, Norzagaray, Bulacan", lat: 14.8078, lng: 121.0111 }
];

const actor = (req: Request) => req.user?.email || "admin";

export const liveMapController = {
  async overview(_req: Request, res: Response) {
    const [buses, routes] = await Promise.all([fleetService.getLiveFleet(), routeService.getRoutes()]);
    res.json(envelope({ buses, routes, terminals }, firebaseService.source()));
  },

  async buses(_req: Request, res: Response) {
    res.json(envelope(await fleetService.getLiveFleet(), firebaseService.source()));
  },

  async terminals(_req: Request, res: Response) {
    res.json(envelope(terminals, firebaseService.source()));
  },

  async routes(_req: Request, res: Response) {
    res.json(envelope(await routeService.getRoutes(), firebaseService.source()));
  },

  async suggestRoute(req: Request, res: Response) {
    const payload = {
      ...req.body,
      status: "pending",
      suggestedBy: actor(req),
      createdAt: new Date().toISOString()
    };
    const result = await realtimeDbService.pushPath(firebasePaths.routeSuggestions, payload);
    res.status(201).json(envelope({ ...result.value, id: result.key }, firebaseService.source()));
  },

  async approveSuggestion(req: Request, res: Response) {
    await realtimeDbService.updatePath(`${firebasePaths.routeSuggestions}/${req.params.id}`, {
      status: "approved",
      reviewedBy: actor(req),
      reviewedAt: new Date().toISOString()
    });
    res.json(envelope({ id: req.params.id, status: "approved" }, firebaseService.source()));
  },

  async rejectSuggestion(req: Request, res: Response) {
    await realtimeDbService.updatePath(`${firebasePaths.routeSuggestions}/${req.params.id}`, {
      status: "rejected",
      reviewedBy: actor(req),
      reviewedAt: new Date().toISOString()
    });
    res.json(envelope({ id: req.params.id, status: "rejected" }, firebaseService.source()));
  }
};
