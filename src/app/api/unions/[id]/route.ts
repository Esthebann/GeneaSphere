import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { Union } from "@/models/Union";
import { Member } from "@/models/Member";
import { audit } from "@/lib/audit";
import { jsonOk, jsonError } from "@/lib/http";

const patchSchema = z.object({
  status: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  version: z.number().int().nonnegative(),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { id } = await ctx.params;
  await connectDb();

  const u = await Union.findOne({ _id: id, treeId: auth.user.treeId }).lean();
  if (!u) return jsonError("Not found", 404);

  return jsonOk({
    id: String(u._id),
    partners: (u.partners ?? []).map((x: any) => String(x)),
    children: (u.children ?? []).map((x: any) => String(x)),
    status: u.status ?? null,
    startDate: u.startDate ?? null,
    endDate: u.endDate ?? null,
    version: u.version,
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid body", 400);

  await connectDb();

  const set: any = { ...parsed.data };
  delete set.version;

  if ("startDate" in set) set.startDate = set.startDate ? new Date(set.startDate) : null;
  if ("endDate" in set) set.endDate = set.endDate ? new Date(set.endDate) : null;

  const updated = await Union.findOneAndUpdate(
    { _id: id, treeId: auth.user.treeId, version: parsed.data.version },
    { $set: set, $inc: { version: 1 } },
    { new: true }
  );

  if (!updated) return jsonError("Version conflict", 409);

  await audit({
    entityType: "UNION",
    entityId: updated._id.toString(),
    action: "UPDATE",
    performedBy: auth.user.userId,
    changes: set,
  });

  return jsonOk({ id: updated._id.toString(), version: updated.version });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { id } = await ctx.params;
  await connectDb();

  const u = await Union.findOne({ _id: id, treeId: auth.user.treeId }).lean();
  if (!u) return jsonError("Not found", 404);

  await Member.updateMany(
    { _id: { $in: u.partners ?? [] }, treeId: auth.user.treeId },
    { $pull: { unions: u._id }, $inc: { version: 1 } }
  );

  await Member.updateMany(
    { _id: { $in: u.children ?? [] }, treeId: auth.user.treeId },
    { $set: { parentUnion: undefined }, $inc: { version: 1 } }
  );

  const deleted = await Union.findOneAndDelete({ _id: id, treeId: auth.user.treeId });
  if (!deleted) return jsonError("Not found", 404);

  await audit({
    entityType: "UNION",
    entityId: deleted._id.toString(),
    action: "DELETE",
    performedBy: auth.user.userId,
    changes: { id },
  });

  return jsonOk({ id: deleted._id.toString() });
}
