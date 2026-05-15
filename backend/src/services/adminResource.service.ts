import { firebasePaths } from "@pos-bus/shared";
import type { AdminAccount, BusFleetRecord, ChatConversation, ChatMessage, EmployeeRecord, EmployeeRole, EmployeeViolationRecord, RemittanceRecord } from "@pos-bus/shared";
import { realtimeDbService } from "./realtimeDb.service.js";
import { firebaseService } from "./firebase.service.js";
import { supabaseService } from "./supabase.service.js";

type AnyRecord = Record<string, any>;
type CollectionRecord<T> = T & { id: string };

const toRecord = (value: unknown): AnyRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};

const listCollection = async <T>(path: string): Promise<Array<CollectionRecord<T>>> => {
  const raw = await realtimeDbService.getPath<Record<string, T>>(path);
  return Object.entries(raw || {}).map(([id, value]) => ({ ...(toRecord(value) as T), id }));
};

const createRecord = async <T extends AnyRecord>(path: string, payload: T) => {
  const now = new Date().toISOString();
  const result = await realtimeDbService.pushPath(path, {
    ...payload,
    createdAt: payload.createdAt || now,
    updatedAt: now
  });
  return { ...result.value, id: result.key };
};

const patchRecord = async <T extends AnyRecord>(path: string, id: string, payload: Partial<T>) => {
  const now = new Date().toISOString();
  await realtimeDbService.updatePath(`${path}/${id}`, {
    ...payload,
    updatedAt: now
  });
  const updated = await realtimeDbService.getPath<T>(`${path}/${id}`);
  return { ...(updated || ({} as T)), id };
};

const setRecord = async <T extends AnyRecord>(path: string, id: string, payload: Partial<T>) => {
  const now = new Date().toISOString();
  const current = await realtimeDbService.getPath<Partial<T>>(`${path}/${id}`);
  const next = {
    ...(current || {}),
    ...payload,
    createdAt: (current as AnyRecord | null)?.createdAt || (payload as AnyRecord).createdAt || now,
    updatedAt: now
  };

  await realtimeDbService.setPath(`${path}/${id}`, next);
  return { ...next, id };
};

const compactMerge = <T extends AnyRecord>(base: T, next: T) => {
  const merged = { ...base };
  Object.entries(next).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      merged[key as keyof T] = value as T[keyof T];
    }
  });
  return merged;
};

const employeeMatchKeys = (employee: Partial<EmployeeRecord>) =>
  [
    employee.id,
    employee.accountId,
    employee.email?.toLowerCase(),
    employee.employeeNumber?.toLowerCase()
  ].filter(Boolean) as string[];

const mergeEmployeeSources = (firebaseRows: EmployeeRecord[], supabaseRows: EmployeeRecord[]) => {
  const rows: EmployeeRecord[] = [];
  const index = new Map<string, number>();

  const add = (employee: EmployeeRecord) => {
    const keys = employeeMatchKeys(employee);
    const match = keys.map((key) => index.get(key)).find((value) => value !== undefined);

    if (match !== undefined) {
      rows[match] = compactMerge(rows[match], employee);
    } else {
      rows.push(employee);
      const rowIndex = rows.length - 1;
      keys.forEach((key) => index.set(key, rowIndex));
    }
  };

  firebaseRows.forEach(add);
  supabaseRows.forEach(add);

  return rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
};

const accountRoleToEmployeeRole = (role: AdminAccount["role"]): EmployeeRole | null => {
  const value = role.toLowerCase();
  if (value === "admin" || value === "driver" || value === "conductor" || value === "inspector") {
    return value;
  }
  return null;
};

const defaultSalaryForRole = (role: EmployeeRole) => {
  if (role === "driver") return { salaryRate: 12, salaryType: "commission" as const };
  if (role === "conductor") return { salaryRate: 10, salaryType: "commission" as const };
  return { salaryRate: 0, salaryType: "daily" as const };
};

const employeeNumberFromAccount = (account: Pick<AdminAccount, "id" | "email">) => {
  const seed = (account.id || account.email || "employee")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()
    .slice(0, 6)
    .padEnd(6, "0");
  return `EMP-${seed}`;
};

const employeePayloadForAccount = (account: AdminAccount, existing?: EmployeeRecord): Partial<EmployeeRecord> | null => {
  const role = accountRoleToEmployeeRole(account.role);
  if (!role) return null;

  const defaultSalary = defaultSalaryForRole(role);
  const shouldApplyRoleDefault =
    !existing ||
    existing.salaryRate === undefined ||
    existing.salaryType === undefined ||
    (existing.role !== role && (!existing.salaryRate || existing.salaryRate === 0));

  return {
    accountId: account.id,
    employeeNumber: existing?.employeeNumber || account.employeeNumber || employeeNumberFromAccount(account),
    fullName: account.fullName,
    email: account.email,
    role,
    status: account.status === "inactive" ? "inactive" : account.status === "pending" ? "pending" : "active",
    salaryRate: shouldApplyRoleDefault ? defaultSalary.salaryRate : existing.salaryRate,
    salaryType: shouldApplyRoleDefault ? defaultSalary.salaryType : existing.salaryType,
    storageFolder: existing?.storageFolder || `employees/${existing?.employeeNumber || account.employeeNumber || employeeNumberFromAccount(account)}`
  };
};

export const employeeService = {
  async list() {
    const [supabaseRows, firebaseRows] = await Promise.all([
      supabaseService.listEmployees().catch(() => []),
      listCollection<EmployeeRecord>(firebasePaths.employees)
    ]);
    return mergeEmployeeSources(firebaseRows, supabaseRows);
  },

  async get(id: string) {
    const rows = await this.list();
    return rows.find((employee) => employee.id === id || employee.accountId === id || employee.employeeNumber === id) || null;
  },

  async create(payload: Partial<EmployeeRecord>, actor: string) {
    void firebaseService.auditAction("employee_create", actor, { employeeNumber: payload.employeeNumber });
    const normalized = {
      ...payload,
      status: payload.status || "active",
      storageFolder: payload.storageFolder || (payload.employeeNumber ? `employees/${payload.employeeNumber}` : undefined)
    };
    const row = await supabaseService.createEmployee(normalized);
    if (row) {
      await setRecord<EmployeeRecord>(firebasePaths.employees, row.id, compactMerge(normalized as EmployeeRecord, row));
      return compactMerge(normalized as EmployeeRecord, row);
    }

    return createRecord<Partial<EmployeeRecord>>(firebasePaths.employees, {
      ...normalized
    });
  },

  async patch(id: string, payload: Partial<EmployeeRecord>, actor: string) {
    void firebaseService.auditAction("employee_patch", actor, { id });
    const row = await supabaseService.patchEmployee(id, payload);
    if (row) {
      const merged = compactMerge(row, payload as EmployeeRecord);
      await setRecord<EmployeeRecord>(firebasePaths.employees, row.id, merged);
      return merged;
    }

    return patchRecord<EmployeeRecord>(firebasePaths.employees, id, payload);
  },

  async upsertForAccount(account: AdminAccount, actor: string) {
    const employees = await this.list();
    const existing = employees.find(
      (employee) =>
        employee.accountId === account.id ||
        employee.email?.toLowerCase() === account.email.toLowerCase() ||
        employee.employeeNumber === account.employeeNumber
    );
    const payload = employeePayloadForAccount(account, existing);
    if (!payload) return null;

    if (existing) {
      return this.patch(existing.id, payload, actor);
    }

    return this.create(payload, actor);
  }
};

export const busFleetService = {
  async list() {
    const rows = await supabaseService.listBuses();
    return rows.length ? rows : listCollection<BusFleetRecord>(firebasePaths.buses);
  },

  async create(payload: Partial<BusFleetRecord>, actor: string) {
    void firebaseService.auditAction("bus_create", actor, { busNumber: payload.busNumber });
    const row = await supabaseService.createBus(payload);
    if (row) return row;

    return createRecord<Partial<BusFleetRecord>>(firebasePaths.buses, {
      ...payload,
      status: payload.status || "active"
    });
  },

  async patch(id: string, payload: Partial<BusFleetRecord>, actor: string) {
    void firebaseService.auditAction("bus_patch", actor, { id });
    const row = await supabaseService.patchBus(id, payload);
    if (row) return row;

    return patchRecord<BusFleetRecord>(firebasePaths.buses, id, payload);
  }
};

export const chatService = {
  async conversations() {
    return listCollection<ChatConversation>(firebasePaths.chatConversations);
  },

  async messages(conversationId: string) {
    return listCollection<ChatMessage>(`${firebasePaths.chatConversations}/${conversationId}/messages`);
  },

  async send(conversationId: string, payload: Partial<ChatMessage>, actor: string) {
    const conversationPath = `${firebasePaths.chatConversations}/${conversationId}`;
    const body = String(payload.body || "").trim();
    const message = {
      conversationId,
      senderId: payload.senderId || actor,
      senderName: payload.senderName || actor,
      body,
      timestamp: Date.now(),
      read: false
    };

    const result = await realtimeDbService.pushPath(`${conversationPath}/messages`, message);
    await realtimeDbService.updatePath(conversationPath, {
      title: payload.senderName ? `Chat with ${payload.senderName}` : "Command conversation",
      targetType: payload.senderId === "customer" ? "customer" : "employee",
      lastMessage: body,
      lastMessageAt: message.timestamp
    });

    return { ...result.value, id: result.key };
  }
};

export const remittanceService = {
  async list() {
    const rows = await supabaseService.listRemittances().catch(() => []);
    if (rows.length) return rows;
    // Firebase fallback
    return listCollection<RemittanceRecord>(firebasePaths.remittances);
  },

  async create(payload: Partial<RemittanceRecord>, actor: string) {
    void firebaseService.auditAction("remittance_create", actor, { conductorId: payload.conductorId });
    const row = await supabaseService.createRemittance(payload);
    if (row) {
      await setRecord<RemittanceRecord>(firebasePaths.remittances, row.id, row);
      return row;
    }
    return createRecord<Partial<RemittanceRecord>>(firebasePaths.remittances, payload);
  },

  async patch(id: string, payload: Partial<RemittanceRecord>, actor: string) {
    void firebaseService.auditAction("remittance_patch", actor, { id });
    const row = await supabaseService.patchRemittance(id, payload);
    if (row) return row;
    return patchRecord<RemittanceRecord>(firebasePaths.remittances, id, payload);
  }
};

export const violationService = {
  async list(employeeId?: string, status?: string) {
    const rows = await supabaseService.listViolations(employeeId).catch(() => []);
    if (rows.length) return status ? rows.filter((v) => v.status === status) : rows;
    // Firebase fallback
    const all = await listCollection<EmployeeViolationRecord>(firebasePaths.employeeViolations);
    return all.filter((v) => {
      const matchEmployee = !employeeId || v.employeeId === employeeId;
      const matchStatus = !status || v.status === status;
      return matchEmployee && matchStatus;
    });
  },

  async create(payload: Partial<EmployeeViolationRecord>, actor: string) {
    void firebaseService.auditAction("violation_create", actor, { employeeId: payload.employeeId });
    const row = await supabaseService.createViolation(payload);
    if (row) {
      await setRecord<EmployeeViolationRecord>(firebasePaths.employeeViolations, row.id, row);
      return row;
    }
    return createRecord<Partial<EmployeeViolationRecord>>(firebasePaths.employeeViolations, payload);
  },

  async patch(id: string, payload: Partial<EmployeeViolationRecord>, actor: string) {
    void firebaseService.auditAction("violation_patch", actor, { id });
    const row = await supabaseService.patchViolation(id, payload);
    if (row) return row;
    return patchRecord<EmployeeViolationRecord>(firebasePaths.employeeViolations, id, payload);
  }
};
