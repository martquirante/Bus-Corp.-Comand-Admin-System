import crypto from "node:crypto";
import type { AdminAccount } from "@pos-bus/shared";
import { env } from "../config/env.js";

type SessionUser = Pick<AdminAccount, "id" | "fullName" | "email" | "role" | "status">;

const base64url = (value: string | Buffer) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const decodeBase64url = (value: string) => {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
};

const sign = (payload: string) =>
  base64url(crypto.createHmac("sha256", env.SESSION_SECRET).update(payload).digest());

export const sessionToken = {
  create(user: SessionUser) {
    const header = base64url(JSON.stringify({ alg: "HS256", typ: "POSBUS" }));
    const body = base64url(
      JSON.stringify({
        ...user,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8
      })
    );
    const signature = sign(`${header}.${body}`);
    return `${header}.${body}.${signature}`;
  },

  verify(token: string): SessionUser | null {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;

    const expected = sign(`${header}.${body}`);
    if (signature.length !== expected.length) return null;
    const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return null;

    const payload = JSON.parse(decodeBase64url(body)) as SessionUser & { exp: number };
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: payload.id,
      fullName: payload.fullName,
      email: payload.email,
      role: payload.role,
      status: payload.status
    };
  }
};
