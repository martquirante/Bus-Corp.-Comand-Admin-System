import type { Request, Response } from "express";
import { transactionQuerySchema } from "@pos-bus/shared";
import { transactionService } from "../services/transaction.service.js";
import { firebaseService } from "../services/firebase.service.js";
import { notFound } from "../utils/appError.js";
import { envelope } from "../utils/envelope.js";

export const transactionsController = {
  async getTransactions(req: Request, res: Response) {
    const filters = transactionQuerySchema.parse(req.query);
    const transactions = await transactionService.getTransactions(filters);
    res.json(envelope(transactions, firebaseService.source()));
  },

  async getTransactionById(req: Request, res: Response) {
    const transaction = await transactionService.getTransactionById(req.params.id);
    if (!transaction) throw notFound("Transaction was not found.");
    res.json(envelope(transaction, firebaseService.source()));
  }
};
