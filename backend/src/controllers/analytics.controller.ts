import type { Request, Response } from "express";
import { firebaseService } from "../services/firebase.service.js";
import { supabaseService } from "../services/supabase.service.js";
import { dashboardService } from "../services/dashboard.service.js";
import { envelope } from "../utils/envelope.js";

export const analyticsController = {
  async getSummary(_req: Request, res: Response) {
    let summary;
    try {
      summary = await supabaseService.getAnalyticsSummary();
    } catch (error) {
      const dashboard = await dashboardService.getStats();
      summary = {
        grossRevenue: dashboard.totalRevenue,
        expenseTotal: dashboard.totalExpenses,
        netProfit: dashboard.netProfit,
        ticketCount: dashboard.totalTransactions,
        passengerCount: dashboard.totalPassengers,
        fallback: "firebase-realtime-database"
      };
      console.warn("[analytics] Supabase summary fallback used.", error);
    }

    res.json(envelope(summary, firebaseService.source()));
  }
};
