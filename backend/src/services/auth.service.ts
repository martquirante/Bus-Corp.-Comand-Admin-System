import { firebasePaths } from "@pos-bus/shared";
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

const LEGACY_BOOTSTRAP_EMAIL = "admin@santrans.com";
const LEGACY_BOOTSTRAP_PASSWORD = "admin123";

export const authService = {
  async createSession(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const safeUser = adminService.safeKey(normalizedEmail);
    const admin = await firebaseService.getPath<SuperAdminRecord>(
      `${firebasePaths.superAdmins}/${safeUser}`
    );

    const legacyBootstrapLogin =
      !admin && normalizedEmail === LEGACY_BOOTSTRAP_EMAIL && password === LEGACY_BOOTSTRAP_PASSWORD;

    if (admin?.password === password || legacyBootstrapLogin) {
      const fullName = admin?.name || admin?.fullName || "System Owner";
      const user = {
        id: safeUser,
        fullName,
        email: normalizedEmail,
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
