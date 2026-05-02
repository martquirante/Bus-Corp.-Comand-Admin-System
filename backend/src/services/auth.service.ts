import { firebasePaths } from "@pos-bus/shared";
import { env } from "../config/env.js";
import { AppError } from "../utils/appError.js";
import { sessionToken } from "../utils/sessionToken.js";
import { adminService } from "./admin.service.js";
import { firebaseService } from "./firebase.service.js";

type SuperAdminRecord = {
  name?: string;
  fullName?: string;
  email?: string;
  password?: string;
  role?: "SuperAdmin" | "Admin";
};

export const authService = {
  async createSession(email: string, password: string) {
    const safeUser = adminService.safeKey(email);
    const admin = await firebaseService.getPath<SuperAdminRecord>(
      `${firebasePaths.superAdmins}/${safeUser}`
    );

    const demoLogin =
      env.ENABLE_DEMO_FALLBACK && email === env.DEMO_ADMIN_EMAIL && password === env.DEMO_ADMIN_PASSWORD;

    if (admin?.password === password || demoLogin) {
      const fullName = admin?.name || admin?.fullName || "System Owner";
      const user = {
        id: safeUser,
        fullName,
        email,
        role: admin?.role || "SuperAdmin",
        status: "active" as const
      };

      return {
        token: sessionToken.create(user),
        user
      };
    }

    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid admin credentials.");
  }
};
