import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

export const apiRateLimit = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  limit: env.API_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => {
    const path = req.originalUrl || req.path || "";
    const cleanPath = path.split("?")[0];
    return (
      cleanPath === "/api/health" ||
      cleanPath === "/api/status" ||
      cleanPath === "/api/blockchain/status" ||
      cleanPath === "/health" ||
      cleanPath === "/"
    );
  },
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please slow down and try again."
    }
  }
});

export const healthRateLimit = rateLimit({
  windowMs: 60000, // 1 minute window
  limit: (process.env.NODE_ENV === "development" || env.NODE_ENV === "development") ? 240 : 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Health check is temporarily rate-limited. Please wait a few seconds."
    }
  }
});
