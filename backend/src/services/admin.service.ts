import type { AdminAccount } from "@pos-bus/shared";
import { firebasePaths } from "@pos-bus/shared";
import { firebaseService } from "./firebase.service.js";

type RawAdmin = {
  name?: string;
  fullName?: string;
  email?: string;
  role?: AdminAccount["role"];
  password?: string;
  dateApproved?: string;
};

const toSafeKey = (emailOrUser: string) => emailOrUser.trim().replace(/\./g, "_");

const normalize = (
  key: string,
  raw: RawAdmin,
  status: AdminAccount["status"]
): AdminAccount => ({
  id: key,
  fullName: raw.fullName || raw.name || key,
  email: raw.email || key.replace(/_/g, "."),
  role: raw.role || "Conductor",
  status,
  dateApproved: raw.dateApproved
});

export const adminService = {
  safeKey: toSafeKey,

  async getAccounts(): Promise<AdminAccount[]> {
    const [pending, active, superAdmins] = await Promise.all([
      firebaseService.getPath<Record<string, RawAdmin>>(firebasePaths.usersPending),
      firebaseService.getPath<Record<string, RawAdmin>>(firebasePaths.usersActive),
      firebaseService.getPath<Record<string, RawAdmin>>(firebasePaths.superAdmins)
    ]);

    return [
      ...Object.entries(pending || {}).map(([key, value]) => normalize(key, value, "pending")),
      ...Object.entries(active || {}).map(([key, value]) => normalize(key, value, "active")),
      ...Object.entries(superAdmins || {}).map(([key, value]) =>
        normalize(key, { ...value, role: "SuperAdmin" }, "active")
      )
    ].sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  async createAccount(
    payload: Omit<AdminAccount, "id"> & { password?: string },
    actor = "system"
  ): Promise<AdminAccount> {
    const id = toSafeKey(payload.email);
    const targetPath =
      payload.role === "SuperAdmin" ? `${firebasePaths.superAdmins}/${id}` : `${firebasePaths.usersActive}/${id}`;
    const value = {
      fullName: payload.fullName,
      name: payload.fullName,
      email: payload.email,
      role: payload.role,
      password: payload.password,
      dateApproved: payload.dateApproved || new Date().toISOString()
    };

    await firebaseService.setPath(targetPath, value);
    await firebaseService.auditAction("admin.create", actor, { id, role: payload.role });

    return normalize(id, value, "active");
  },

  async patchAccount(
    id: string,
    payload: Partial<AdminAccount> & { password?: string },
    actor = "system"
  ): Promise<AdminAccount> {
    const role = payload.role || "Conductor";
    const targetPath =
      role === "SuperAdmin" ? `${firebasePaths.superAdmins}/${id}` : `${firebasePaths.usersActive}/${id}`;

    await firebaseService.updatePath(targetPath, {
      ...payload,
      updatedAt: new Date().toISOString()
    });
    await firebaseService.auditAction("admin.patch", actor, { id, role });

    return normalize(id, payload as RawAdmin, payload.status || "active");
  }
};
