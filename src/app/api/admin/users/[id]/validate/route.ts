import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { jsonOk, jsonError } from "@/lib/http";
import { requireAuth } from "@/lib/middleware";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  if (auth.user.role !== "ADMIN") return jsonError("Forbidden", 403);

  const { id } = await context.params;

  await connectDb();

  const updated = await User.findByIdAndUpdate(
    id,
    { $set: { isValidated: true } },
    { new: true }
  );

  if (!updated) return jsonError("Not found", 404);

  return jsonOk({
    userId: updated._id.toString(),
    isValidated: updated.isValidated,
  });
}
