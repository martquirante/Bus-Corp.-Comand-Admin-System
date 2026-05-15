import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { apiRateLimit } from "./middleware/rateLimit.middleware.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";
import { fleetRoutes } from "./routes/fleet.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { reportsRoutes } from "./routes/reports.routes.js";
import { routesRoutes } from "./routes/routes.routes.js";
import { transactionsRoutes } from "./routes/transactions.routes.js";
import { legacyRoutes } from "./routes/legacy.routes.js";
import { notificationsRoutes } from "./routes/notifications.routes.js";
import { syncRoutes } from "./routes/sync.routes.js";
import { realtimeRoutes } from "./routes/realtime.routes.js";
import { criticalAlertsRoutes } from "./routes/criticalAlerts.routes.js";
import { employeesRoutes } from "./routes/employees.routes.js";
import { busesRoutes } from "./routes/buses.routes.js";
import { messagesRoutes } from "./routes/messages.routes.js";
import { liveMapRoutes } from "./routes/liveMap.routes.js";
import { expensesRoutes } from "./routes/expenses.routes.js";
import { analyticsRoutes } from "./routes/analytics.routes.js";
import { storageRoutes } from "./routes/storage.routes.js";
import { requestLogger } from "./middleware/requestLogger.middleware.js";
import { remittancesRoutes } from "./routes/remittances.routes.js";
import { employeeViolationsRoutes } from "./routes/employeeViolations.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.ADMIN_WEB_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use(apiRateLimit);

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "pos-bus-admin-api",
    message: "Use /api/health for backend health checks.",
    health: "/api/health"
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/fleet", fleetRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/routes", routesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/legacy", legacyRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api/critical-alerts", criticalAlertsRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/buses", busesRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/live-map", liveMapRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/remittances", remittancesRoutes);
app.use("/api/employee-violations", employeeViolationsRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
