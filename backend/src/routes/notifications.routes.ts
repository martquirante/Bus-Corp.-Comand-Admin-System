import { Router } from "express";
import { notificationsController } from "../controllers/notifications.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const notificationsRoutes = Router();

notificationsRoutes.use(requireAuth);
notificationsRoutes.get("/", asyncHandler(notificationsController.getNotifications));
notificationsRoutes.get("/unread-count", asyncHandler(notificationsController.getUnreadCount));
notificationsRoutes.patch("/read-all", asyncHandler(notificationsController.markAllRead));
notificationsRoutes.patch("/:id/read", asyncHandler(notificationsController.markRead));
