import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(3)
});

export const routeDirectionSchema = z.enum(["forward", "reverse"]);

export const routeConfigSchema = z.object({
  direction: routeDirectionSchema.default("forward"),
  origin: z.string().min(2),
  destination: z.string().min(2),
  price: z.coerce.number().positive(),
  distance: z.coerce.number().positive().optional()
});

export const adminAccountSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["SuperAdmin", "Admin", "Conductor", "Driver", "Inspector"]).default("Conductor"),
  status: z.enum(["pending", "active", "inactive"]).default("active"),
  password: z.string().min(4).optional()
});

export const accountPatchSchema = adminAccountSchema.partial();

export const transactionQuerySchema = z.object({
  bus: z.string().optional(),
  type: z.string().optional(),
  route: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(250)
});

export const revenueQuerySchema = z.object({
  period: z.enum(["today", "week", "month", "all"]).default("all")
});
