import type { AdminAccount } from "@pos-bus/shared";
import { firebasePaths } from "@pos-bus/shared";
import { firebaseService } from "./firebase.service.js";
import { employeeService } from "./adminResource.service.js";
import { AppError } from "../utils/appError.js";

type RawAdmin = {
  name?: string;
  fullName?: string;
  email?: string;
  role?: AdminAccount["role"];
  password?: string;
  dateApproved?: string;
  status?: AdminAccount["status"];
  employeeId?: string;
  employeeNumber?: string;
  updatedAt?: string;
};

const toSafeKey = (emailOrUser: string) => emailOrUser.trim().replace(/\./g, "_");
const createRoles = new Set<AdminAccount["role"]>(["Admin", "Driver", "Conductor", "Inspector"]);

const normalize = (
  key: string,
  raw: RawAdmin,
  status: AdminAccount["status"]
): AdminAccount => ({
  id: key,
  fullName: raw.fullName || raw.name || key,
  email: raw.email || key.replace(/_/g, "."),
  role: raw.role || "Conductor",
  status: raw.status || status,
  dateApproved: raw.dateApproved,
  employeeId: raw.employeeId,
  employeeNumber: raw.employeeNumber
});

const accountPaths = [
  { path: firebasePaths.usersPending, status: "pending" as const },
  { path: firebasePaths.usersActive, status: "active" as const },
  { path: firebasePaths.superAdmins, status: "active" as const }
];

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

  async getAccount(id: string): Promise<{ account: AdminAccount; raw: RawAdmin; path: string } | null> {
    for (const item of accountPaths) {
      const raw = await firebaseService.getPath<RawAdmin>(`${item.path}/${id}`);
      if (raw) {
        const role = item.path === firebasePaths.superAdmins ? "SuperAdmin" : raw.role;
        return {
          account: normalize(id, { ...raw, role }, raw.status || item.status),
          raw,
          path: item.path
        };
      }
    }
    return null;
  },

  async createAccount(
    payload: Omit<AdminAccount, "id"> & { password?: string },
    actor = "system"
  ): Promise<AdminAccount> {
    if (!createRoles.has(payload.role)) {
      throw new AppError(400, "ADMIN_ROLE_NOT_CREATABLE", "SuperAdmin and unsupported roles cannot be created from Admin Tools.");
    }

    const id = toSafeKey(payload.email);
    const targetPath = `${firebasePaths.usersActive}/${id}`;
    const value = {
      fullName: payload.fullName,
      name: payload.fullName,
      email: payload.email,
      role: payload.role,
      password: payload.password,
      status: payload.status || "active",
      dateApproved: payload.dateApproved || new Date().toISOString()
    };

    await firebaseService.setPath(targetPath, value);
    await firebaseService.auditAction("admin.create", actor, { id, role: payload.role });

    const account = normalize(id, value, value.status as AdminAccount["status"]);
    const employee = await employeeService.upsertForAccount(account, actor);
    if (employee) {
      await firebaseService.updatePath(targetPath, {
        employeeId: employee.id,
        employeeNumber: employee.employeeNumber,
        updatedAt: new Date().toISOString()
      });
      return { ...account, employeeId: employee.id, employeeNumber: employee.employeeNumber };
    }

    return account;
  },

  async patchAccount(
    id: string,
    payload: Partial<AdminAccount> & { password?: string },
    actor = "system"
  ): Promise<AdminAccount> {
    const existing = await this.getAccount(id);
    if (!existing) {
      throw new AppError(404, "ADMIN_ACCOUNT_NOT_FOUND", "Admin account was not found.");
    }
    if (payload.role && payload.role !== "SuperAdmin" && !createRoles.has(payload.role)) {
      throw new AppError(400, "ADMIN_ROLE_NOT_ALLOWED", "Role is not allowed for Admin Tools accounts.");
    }
    if (existing.account.role !== "SuperAdmin" && payload.role === "SuperAdmin") {
      throw new AppError(400, "SUPERADMIN_ROLE_LOCKED", "SuperAdmin cannot be assigned from Admin Tools.");
    }

    const nextRaw: RawAdmin = {
      ...existing.raw,
      ...payload,
      fullName: payload.fullName || existing.account.fullName,
      name: payload.fullName || existing.account.fullName,
      email: payload.email || existing.account.email,
      role: payload.role || existing.account.role,
      status: payload.status || existing.account.status,
      updatedAt: new Date().toISOString()
    };

    await firebaseService.updatePath(`${existing.path}/${id}`, nextRaw);
    await firebaseService.auditAction("admin.patch", actor, { id, role: nextRaw.role });

    const account = normalize(id, nextRaw, nextRaw.status || existing.account.status);
    const employee = await employeeService.upsertForAccount(account, actor);
    if (employee) {
      await firebaseService.updatePath(`${existing.path}/${id}`, {
        employeeId: employee.id,
        employeeNumber: employee.employeeNumber,
        updatedAt: new Date().toISOString()
      });
      return { ...account, employeeId: employee.id, employeeNumber: employee.employeeNumber };
    }

    return account;
  }
};
