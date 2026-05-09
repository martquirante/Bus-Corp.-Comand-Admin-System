import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(3)
});

export const routeDirectionSchema = z.enum(["forward", "reverse"]);

export const routeConfigSchema = z.object({
  direction: routeDirectionSchema.default("forward"),
  routeName: z.string().min(2).optional(),
  origin: z.string().min(2),
  destination: z.string().min(2),
  price: z.coerce.number().positive().optional(),
  distance: z.coerce.number().positive().optional(),
  distanceKm: z.coerce.number().positive().optional(),
  estimatedDurationMinutes: z.coerce.number().int().positive().optional(),
  baseFare: z.coerce.number().nonnegative().optional(),
  farePerKm: z.coerce.number().nonnegative().optional(),
  status: z.enum(["active", "inactive", "archived"]).default("active").optional(),
  isViceVersa: z.coerce.boolean().default(false).optional(),
  reverseRouteId: z.string().optional(),
  mapReferenceUrl: z.string().url().or(z.literal("")).optional(),
  plannedByAdmin: z.coerce.boolean().optional(),
  assignedBusId: z.string().optional(),
  assignedTripScheduleId: z.string().optional(),
  stops: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        lat: z.coerce.number().optional(),
        lng: z.coerce.number().optional(),
        sequence: z.coerce.number().int().optional()
      })
    )
    .optional(),
  waypoints: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        lat: z.coerce.number().optional(),
        lng: z.coerce.number().optional(),
        sequence: z.coerce.number().int().optional()
      })
    )
    .optional()
});

export const adminAccountSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  role: z
    .enum(["SuperAdmin", "Admin", "Conductor", "Driver", "Inspector", "Mechanic", "Passenger"])
    .default("Conductor"),
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
