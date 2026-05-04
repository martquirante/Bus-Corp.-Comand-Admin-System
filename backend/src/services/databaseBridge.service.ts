import { isFirebaseReady } from "../config/firebase.js";
import { authModeLabel, env } from "../config/env.js";
import { dashboardService } from "./dashboard.service.js";
import { firebaseService } from "./firebase.service.js";
import { supabaseService } from "./supabase.service.js";

export const databaseBridgeService = {
  async status() {
    const supabase = await supabaseService.status();
    return {
      firebase: isFirebaseReady ? "connected" : env.FIREBASE_DATABASE_URL ? "rtdb-rest" : "not-configured",
      firebaseSource: firebaseService.source(),
      supabase: supabase.status,
      supabaseMode: supabase.mode,
      mode: "firebase-live-supabase-structured",
      auth: authModeLabel()
    };
  },

  async getDashboard() {
    const [summary, bridgeStatus] = await Promise.all([dashboardService.getSummary(), this.status()]);

    let structuredTotals;
    try {
      structuredTotals = await supabaseService.getStructuredSummary();
    } catch (error) {
      structuredTotals = {
        employees: 0,
        buses: 0,
        routes: 0,
        expenses: 0,
        notifications: 0,
        criticalAlerts: 0,
        trips: 0,
        tickets: 0,
        payments: 0
      };
      console.warn("[database-bridge] Supabase structured summary skipped.", error);
    }

    const currentPax = summary.deviceHealth.reduce((sum, bus) => sum + bus.passengers, 0);

    return {
      ...summary,
      databaseStatus: {
        firebase: bridgeStatus.firebase,
        supabase: bridgeStatus.supabase,
        mode: bridgeStatus.mode,
        auth: bridgeStatus.auth
      },
      structuredTotals,
      revenue: {
        gross: summary.stats.totalRevenue,
        expenses: summary.stats.totalExpenses,
        net: summary.stats.netProfit,
        source: "supabase.payments" as const
      },
      counts: {
        transactions: summary.stats.totalTransactions,
        payments: summary.stats.totalTransactions,
        trips: structuredTotals.trips || 0,
        passengers: summary.stats.totalPassengers,
        buses: structuredTotals.buses,
        employees: structuredTotals.employees
      },
      live: {
        activeBuses: summary.stats.activeBuses,
        posDevices: summary.totalPosDevices,
        currentPax,
        sosAlerts: summary.stats.emergencyCount,
        assistanceRequests: summary.assistanceRequestCount,
        source: "firebase.POS_Devices.LiveStatus" as const
      },
      status: {
        firebase: bridgeStatus.firebase,
        supabase: bridgeStatus.supabase,
        auth: bridgeStatus.auth
      }
    };
  }
};
