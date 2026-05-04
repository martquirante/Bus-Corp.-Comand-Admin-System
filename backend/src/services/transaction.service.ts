import type { TransactionLog } from "@pos-bus/shared";
import { extractTransactions } from "./dataTransform.service.js";
import { firebaseService } from "./firebase.service.js";
import { supabaseService } from "./supabase.service.js";

export interface TransactionFilters {
  bus?: string;
  type?: string;
  route?: string;
  limit: number;
}

const includes = (value: string, needle?: string) =>
  !needle || value.toLowerCase().includes(needle.toLowerCase());

export const transactionService = {
  async getTransactions(filters: TransactionFilters): Promise<TransactionLog[]> {
    try {
      const sqlTransactions = await supabaseService.listTransactions(filters.limit);
      if (sqlTransactions.length) {
        return sqlTransactions
          .filter((tx) => includes(tx.busNumber, filters.bus))
          .filter((tx) => includes(tx.passengerType, filters.type))
          .filter((tx) => includes(tx.route, filters.route))
          .slice(0, filters.limit);
      }
    } catch (error) {
      console.warn("[transactions] Supabase read skipped.", error);
    }

    const root = await firebaseService.getRootData();
    return extractTransactions(root)
      .filter((tx) => includes(tx.busNumber, filters.bus))
      .filter((tx) => includes(tx.passengerType, filters.type))
      .filter((tx) => includes(tx.route, filters.route))
      .slice(0, filters.limit);
  },

  async getTransactionById(id: string): Promise<TransactionLog | null> {
    const root = await firebaseService.getRootData();
    return extractTransactions(root).find((tx) => tx.id === id) || null;
  }
};
