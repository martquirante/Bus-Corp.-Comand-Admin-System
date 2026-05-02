import { buildRevenueReport } from "./dataTransform.service.js";
import { firebaseService } from "./firebase.service.js";

export const reportService = {
  async getRevenueReport() {
    const root = await firebaseService.getRootData();
    return buildRevenueReport(root);
  }
};
