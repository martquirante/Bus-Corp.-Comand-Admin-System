import type { TransactionLog } from "@pos-bus/shared";
import { extractTransactions } from "./dataTransform.service.js";
import { firebaseService } from "./firebase.service.js";

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
