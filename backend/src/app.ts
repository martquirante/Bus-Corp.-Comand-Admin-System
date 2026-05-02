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
app.use(apiRateLimit);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/fleet", fleetRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/routes", routesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
