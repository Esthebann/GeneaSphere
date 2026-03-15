import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { requireAuth } from "@/lib/middleware";
import { jsonOk, jsonError } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  if (auth.user.role !== "ADMIN") return jsonError("Forbidden", 403);

  await connectDb();

  const users = await User.find({ role: "USER", isValidated: false }, { email: 1, createdAt: 1 })
    .sort({ createdAt: 1 })
    .lean();

  return jsonOk({
    users: users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      createdAt: u.createdAt,
    })),
  });
}
