import { supabaseService } from "./supabase.service.js";

export const reportService = {
  async getRevenueReport() {
    try {
      return await supabaseService.getRouteRevenueReport();
    } catch (error) {
      console.warn("[reports] Supabase revenue report unavailable.", error);
      return [];
    }
  }
};
