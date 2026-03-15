import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { User } from "@/models/User";
import { jsonOk, jsonError } from "@/lib/http";

const bodySchema = z.object({
  role: z.enum(["ADMIN", "USER"]),
});

function getId(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/");
  return parts[parts.length - 2] || "";
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  if (auth.user.role !== "ADMIN") return jsonError("Forbidden", 403);

  const id = getId(req);
  if (!id) return jsonError("Invalid id", 400);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid body", 400);

  await connectDb();

  if (id === auth.user.userId && parsed.data.role !== "ADMIN") {
    return jsonError("Cannot remove own admin", 400);
  }

  const updated = await User.findByIdAndUpdate(id, { $set: { role: parsed.data.role } }, { new: true });
  if (!updated) return jsonError("Not found", 404);

  return jsonOk({ id: updated._id.toString(), role: updated.role });
}
