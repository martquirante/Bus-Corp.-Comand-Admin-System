import { env } from "./config/env.js";
import { isFirebaseReady } from "./config/firebase.js";
import { app } from "./app.js";
import { sqlSyncService } from "./services/sqlSync.service.js";

app.listen(env.PORT, env.HOST, () => {
  console.log(
    `POS Bus Admin API listening on http://${env.HOST}:${env.PORT} (${isFirebaseReady ? "firebase-admin" : "firebase-rtdb-rest"})`
  );

  const syncTimer = sqlSyncService.startAutoSync();
  if (syncTimer) {
    console.log(`[sql-sync] Auto sync enabled every ${env.SQL_SYNC_INTERVAL_MS}ms.`);
  }
});
