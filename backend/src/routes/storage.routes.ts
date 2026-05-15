import express, { Router } from "express";
import { storageController } from "../controllers/storage.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const storageRoutes = Router();

storageRoutes.use(requireAuth);
storageRoutes.get("/employee/:employeeId/assets", asyncHandler(storageController.getEmployeeAssets));
storageRoutes.post(
  "/employee/:employeeId/:kind",
  express.raw({ type: "*/*", limit: "15mb" }),
  asyncHandler(storageController.uploadEmployeeAsset)
);
storageRoutes.post(
  "/bus/:busId/photo",
  express.raw({ type: "*/*", limit: "15mb" }),
  asyncHandler(storageController.uploadBusPhoto)
);
storageRoutes.post(
  "/bus/:busId/documents/:docType",
  express.raw({ type: "*/*", limit: "15mb" }),
  asyncHandler(storageController.uploadBusDocument)
);
