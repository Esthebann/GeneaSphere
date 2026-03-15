import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { User } from "@/models/User";
import { hashPassword } from "@/lib/password";
import { jsonCreated, jsonError } from "@/lib/http";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
  isValidated: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  if (auth.user.role !== "ADMIN") return jsonError("Forbidden", 403);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid body", 400);

  await connectDb();

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await User.findOne({ email }).lean();
  if (existing) return jsonError("Email already used", 409);

  const passwordHash = await hashPassword(parsed.data.password);

  const created = await User.create({
    email,
    passwordHash,
    role: parsed.data.role,
    isValidated: parsed.data.isValidated,
  });

  return jsonCreated({
    id: created._id.toString(),
    email: created.email,
    role: created.role,
    isValidated: created.isValidated,
  });
}
