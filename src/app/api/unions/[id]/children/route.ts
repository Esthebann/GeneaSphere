import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { Union } from "@/models/Union";
import { Member } from "@/models/Member";
import { audit } from "@/lib/audit";
import { jsonOk, jsonError } from "@/lib/http";

const bodySchema = z.object({
  childId: z.string().min(1),
  version: z.number().int().nonnegative(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return jsonError(auth.error, auth.status);

    const { id: unionId } = await ctx.params;

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid body", 400);

    await connectDb();

    const treeId = auth.user.treeId;
    if (!treeId) return jsonError("User has no treeId", 400);

    const child = await Member.findOne({ _id: parsed.data.childId, treeId });
    if (!child) return jsonError("Child not found", 404);

    if (child.parentUnion) return jsonError("Child already has parents (parentUnion set)", 400);

    const updated = await Union.findOneAndUpdate(
      { _id: unionId, treeId, version: parsed.data.version },
      { $addToSet: { children: child._id }, $inc: { version: 1 } },
      { new: true }
    );

    if (!updated) return jsonError("Version conflict", 409);

    child.parentUnion = updated._id;
    child.version += 1;
    await child.save();

    try {
      await audit({
        entityType: "UNION",
        entityId: updated._id.toString(),
        action: "UPDATE",
        performedBy: auth.user.userId,
        changes: { addChild: parsed.data.childId },
      });
    } catch (e) {
      console.error("audit failed", e);
    }

    return jsonOk({ unionId: updated._id.toString(), version: updated.version });
  } catch (e: any) {
    console.error("/api/unions/[id]/children fatal", e);
    return jsonError(e?.message ? `Internal error: ${e.message}` : "Internal error", 500);
  }
}
