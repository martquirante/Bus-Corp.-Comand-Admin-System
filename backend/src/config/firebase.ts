import admin from "firebase-admin";
import { firebaseCredentialConfig, hasFirebaseCredentials } from "./env.js";

let firebaseApp: admin.app.App | null = null;

if (hasFirebaseCredentials && admin.apps.length === 0) {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: firebaseCredentialConfig.projectId,
      clientEmail: firebaseCredentialConfig.clientEmail,
      privateKey: firebaseCredentialConfig.privateKey
    }),
    databaseURL: firebaseCredentialConfig.databaseURL
  });
} else if (admin.apps.length > 0) {
  firebaseApp = admin.app();
}

export const firebaseAdmin = admin;
export const app = firebaseApp;
export const isFirebaseReady = Boolean(firebaseApp);
export const realtimeDb = firebaseApp ? admin.database(firebaseApp) : null;
