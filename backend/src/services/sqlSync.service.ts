import { supabaseService } from "./supabase.service.js";
import { routeSyncService } from "./routeSync.service.js";
import { firebaseService } from "./firebase.service.js";
import { extractTransactions } from "./dataTransform.service.js";

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
    const [routes, transactions] = await Promise.all([
      routeSyncService.syncFirebaseRoutesToSupabase(),
      this.syncTransactionsToSupabase(actor)
    ]);

    if (!supabaseService.isConfigured()) {
      return {
        synced: false,
        reason: "Supabase is not configured on the backend.",
        status,
        routes,
        transactions
      };
    }

    await supabaseService.logSync("FirebaseRealtimeDatabase", "firebase_sync_logs", "success");

    return {
      synced: true,
      actor,
      source: firebaseService.source(),
      status,
      routes,
      transactions
    };
  },

  async syncFirebaseToSupabase(actor = "system") {
    return this.syncRealtimeSnapshot(actor);
  },

  async syncTransactionsToSupabase(actor = "system") {
    const root = await firebaseService.getRootData();
    const transactions = extractTransactions(root);
    const result = await supabaseService.syncTransactions(transactions);

    if (result.synced) {
      await supabaseService.logSync("POS_Devices/*/Trips/*/Transactions", "trips,tickets,payments", "success");
    }

    return {
      actor,
      source: firebaseService.source(),
      firebaseTransactions: transactions.length,
      ...result
    };
  },

  startAutoSync() {
    return null;
  }
};
