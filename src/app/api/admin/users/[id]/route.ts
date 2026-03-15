import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { User } from "@/models/User";
import { jsonOk, jsonError } from "@/lib/http";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  if (auth.user.role !== "ADMIN") return jsonError("Forbidden", 403);

  const { id } = await ctx.params;

  if (id === auth.user.userId) return jsonError("Cannot delete self", 400);

  await connectDb();

  const deleted = await User.findByIdAndDelete(id);
  if (!deleted) return jsonError("Not found", 404);

  return jsonOk({ id: deleted._id.toString() });
}
