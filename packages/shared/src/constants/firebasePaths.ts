export const firebasePaths = {
  root: "/",
  posDevices: "POS_Devices",
  expenses: "Expenses",
  routesForward: "Routes_Forward",
  routesReverse: "Routes_Reverse",
  usersPending: "Users/Pending",
  usersActive: "Users/Active",
  superAdmins: "SuperAdmins",
  globalSettings: "Config/GlobalSettings",
  auditLogs: "AuditLogs/AdminActions"
} as const;

export const routePathByDirection = {
  forward: firebasePaths.routesForward,
  reverse: firebasePaths.routesReverse
} as const;
