import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { User } from "@/models/User";
import { jsonOk, jsonError } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  if (auth.user.role !== "ADMIN") return jsonError("Forbidden", 403);

  await connectDb();

  const users = await User.find({})
    .sort({ createdAt: 1 })
    .select({ email: 1, role: 1, isValidated: 1, createdAt: 1 })
    .lean();

  return jsonOk({
    users: users.map((u: any) => ({
      id: u._id.toString(),
      email: u.email,
      role: u.role,
      isValidated: !!u.isValidated,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    })),
  });
}
