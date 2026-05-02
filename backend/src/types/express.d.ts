import type { AdminAccount } from "@pos-bus/shared";

declare global {
  namespace Express {
    interface Request {
      user?: Pick<AdminAccount, "id" | "fullName" | "email" | "role" | "status"> & {
        uid?: string;
      };
    }
  }
}

export {};
