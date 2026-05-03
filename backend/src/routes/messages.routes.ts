import { Router } from "express";
import { chatController } from "../controllers/adminResources.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const messagesRoutes = Router();

messagesRoutes.use(requireAuth);
messagesRoutes.get("/conversations", asyncHandler(chatController.conversations));
messagesRoutes.get("/conversations/:id", asyncHandler(chatController.messages));
messagesRoutes.post("/conversations/:id/send", asyncHandler(chatController.send));
