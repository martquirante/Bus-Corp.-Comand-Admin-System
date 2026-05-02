import type { NextFunction, Request, Response } from "express";
import type { AdminAccount } from "@pos-bus/shared";

export const requireRole =
  (...allowedRoles: AdminAccount["role"][]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Your admin role cannot perform this action."
        }
      });
      return;
    }

    next();
  };
