import type { Request, Response } from "express";
import { firebaseService } from "../services/firebase.service.js";
import { busFleetService, chatService, employeeService } from "../services/adminResource.service.js";
import { envelope } from "../utils/envelope.js";

const actor = (req: Request) => req.user?.email || req.user?.fullName || "admin";

export const employeeController = {
  async list(_req: Request, res: Response) {
    res.json(envelope(await employeeService.list(), firebaseService.source()));
  },

  async create(req: Request, res: Response) {
    res.status(201).json(envelope(await employeeService.create(req.body, actor(req)), firebaseService.source()));
  },

  async patch(req: Request, res: Response) {
    res.json(envelope(await employeeService.patch(req.params.id, req.body, actor(req)), firebaseService.source()));
  }
};

export const busFleetController = {
  async list(_req: Request, res: Response) {
    res.json(envelope(await busFleetService.list(), firebaseService.source()));
  },

  async create(req: Request, res: Response) {
    res.status(201).json(envelope(await busFleetService.create(req.body, actor(req)), firebaseService.source()));
  },

  async patch(req: Request, res: Response) {
    res.json(envelope(await busFleetService.patch(req.params.id, req.body, actor(req)), firebaseService.source()));
  }
};

export const chatController = {
  async conversations(_req: Request, res: Response) {
    res.json(envelope(await chatService.conversations(), firebaseService.source()));
  },

  async messages(req: Request, res: Response) {
    res.json(envelope(await chatService.messages(req.params.id), firebaseService.source()));
  },

  async send(req: Request, res: Response) {
    res.status(201).json(envelope(await chatService.send(req.params.id, req.body, actor(req)), firebaseService.source()));
  }
};
