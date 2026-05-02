import type { Request, Response } from "express";
import { fleetService } from "../services/fleet.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

export const fleetController = {
  async getLiveFleet(_req: Request, res: Response) {
    const fleet = await fleetService.getLiveFleet();
    res.json(envelope(fleet, firebaseService.source()));
  }
};
