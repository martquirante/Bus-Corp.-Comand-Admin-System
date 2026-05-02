import { Router } from "express";
import { loginSchema } from "@pos-bus/shared";
import { authController } from "../controllers/auth.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.middleware.js";

export const authRoutes = Router();

authRoutes.post("/session", validate(loginSchema), asyncHandler(authController.createSession));
