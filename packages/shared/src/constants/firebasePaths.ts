export const firebasePaths = {
  root: "/",
  assistanceRequests: "AssistanceRequests",
  config: "Config",
  posDevices: "POS_Devices",
  expenses: "Expenses",
  messages: "messages",
  routesForward: "Routes_Forward",
  routesReverse: "Routes_Reverse",
  adminRoutes: "AdminRoutes",
  usersPending: "Users/Pending",
  usersActive: "Users/Active",
  superAdmins: "SuperAdmins",
  globalSettings: "Config/GlobalSettings",
  notificationReads: "AdminNotificationReads",
  criticalAlertState: "AdminCriticalAlertState",
  employees: "AdminEmployees",
  buses: "AdminBuses",
  chatConversations: "AdminChatConversations",
  routeSuggestions: "AdminRouteSuggestions",
  auditLogs: "AuditLogs/AdminActions"
} as const;

export const routePathByDirection = {
  forward: firebasePaths.routesForward,
  reverse: firebasePaths.routesReverse
} as const;
