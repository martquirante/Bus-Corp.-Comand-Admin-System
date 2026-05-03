import { firebasePaths } from "@pos-bus/shared";
import type { BusFleetRecord, ChatConversation, ChatMessage, EmployeeRecord } from "@pos-bus/shared";
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

export const employeeService = {
  async list() {
    const rows = await supabaseService.listEmployees();
    return rows.length ? rows : listCollection<EmployeeRecord>(firebasePaths.employees);
  },

  async create(payload: Partial<EmployeeRecord>, actor: string) {
    void firebaseService.auditAction("employee_create", actor, { employeeNumber: payload.employeeNumber });
    const row = await supabaseService.createEmployee(payload);
    if (row) return row;

    return createRecord<Partial<EmployeeRecord>>(firebasePaths.employees, {
      ...payload,
      status: payload.status || "active"
    });
  },

  async patch(id: string, payload: Partial<EmployeeRecord>, actor: string) {
    void firebaseService.auditAction("employee_patch", actor, { id });
    const row = await supabaseService.patchEmployee(id, payload);
    if (row) return row;

    return patchRecord<EmployeeRecord>(firebasePaths.employees, id, payload);
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
