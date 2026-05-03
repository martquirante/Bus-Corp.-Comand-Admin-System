import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (env.NODE_ENV === "test") {
    next();
    return;
  }

  const started = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - started;
    console.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
};
