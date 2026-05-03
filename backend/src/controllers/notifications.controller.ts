import type { Request, Response } from "express";
import { notificationService } from "../services/notification.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { envelope } from "../utils/envelope.js";

export const notificationsController = {
  async getNotifications(_req: Request, res: Response) {
    const notifications = await notificationService.getNotifications();
    res.json(envelope(notifications, firebaseService.source()));
  },

  async getUnreadCount(_req: Request, res: Response) {
    const count = await notificationService.getUnreadCount();
    res.json(envelope(count, firebaseService.source()));
  },

  async markRead(req: Request, res: Response) {
    const result = await notificationService.markRead(decodeURIComponent(req.params.id));
    res.json(envelope(result, firebaseService.source()));
  },

  async markAllRead(_req: Request, res: Response) {
    const result = await notificationService.markAllRead();
    res.json(envelope(result, firebaseService.source()));
  }
};
