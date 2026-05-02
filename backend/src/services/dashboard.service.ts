import { buildDashboardStats } from "./dataTransform.service.js";
import { firebaseService } from "./firebase.service.js";

export const dashboardService = {
  async getStats() {
    const root = await firebaseService.getRootData();
    return buildDashboardStats(root);
  }
};
