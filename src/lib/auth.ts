import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { env } from "@/lib/env";

export type JwtPayload = {
  userId: string;
  role: "ADMIN" | "USER";
  treeId: string;
};

export function signJwt(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "24h" });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: NextRequest): { ok: true; user: JwtPayload } | { ok: false; status: number; error: string } {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false, status: 401, error: "Unauthorized" };

  const payload = verifyJwt(m[1]);
  if (!payload) return { ok: false, status: 401, error: "Unauthorized" };

  if (!payload.treeId) return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true, user: payload };
}
