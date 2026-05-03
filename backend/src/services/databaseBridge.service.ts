import { isFirebaseReady } from "../config/firebase.js";
import { env } from "../config/env.js";
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
      mode: "firebase-live-supabase-structured"
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
        criticalAlerts: 0
      };
      console.warn("[database-bridge] Supabase structured summary skipped.", error);
    }

    return {
      ...summary,
      databaseStatus: {
        firebase: bridgeStatus.firebase,
        supabase: bridgeStatus.supabase,
        mode: bridgeStatus.mode
      },
      structuredTotals
    };
  }
};
