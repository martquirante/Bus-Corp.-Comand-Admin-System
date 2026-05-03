import { supabaseService } from "./supabase.service.js";
import { routeSyncService } from "./routeSync.service.js";
import { firebaseService } from "./firebase.service.js";

export const sqlSyncService = {
  async status() {
    const supabase = await supabaseService.status();
    return {
      configured: supabase.configured,
      status: supabase.status,
      mode: supabase.mode,
      target: "supabase-postgresql",
      liveSource: "firebase-realtime-database",
      supportedTables: [
        "routes",
        "route_stops",
        "route_waypoints",
        "employees",
        "buses",
        "tickets",
        "payments",
        "expenses",
        "critical_alerts",
        "notifications",
        "pos_device_status",
        "firebase_sync_logs"
      ]
    };
  },

  async syncRealtimeSnapshot(actor = "system") {
    const status = await this.status();
    const routes = await routeSyncService.syncFirebaseRoutesToSupabase();

    if (!supabaseService.isConfigured()) {
      return {
        synced: false,
        reason: "Supabase is not configured on the backend.",
        status,
        routes
      };
    }

    await supabaseService.logSync("FirebaseRealtimeDatabase", "firebase_sync_logs", "success");

    return {
      synced: true,
      actor,
      source: firebaseService.source(),
      status,
      routes
    };
  },

  async syncFirebaseToSupabase(actor = "system") {
    return this.syncRealtimeSnapshot(actor);
  },

  startAutoSync() {
    return null;
  }
};
