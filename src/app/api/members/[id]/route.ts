import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { Member } from "@/models/Member";
import { Union } from "@/models/Union";
import { audit } from "@/lib/audit";
import { jsonOk, jsonError } from "@/lib/http";

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  sex: z.enum(["M", "F", "X"]).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  birthDate: z.string().optional().nullable(),
  deathDate: z.string().optional().nullable(),

  photoUrl: z.string().url().optional().nullable(),
  professions: z.array(z.string()).optional(),
  addresses: z.array(z.string()).optional(),
  phones: z.array(z.string()).optional(),
  emails: z.array(z.string().email()).optional(),
  notes: z.string().optional().nullable(),

  version: z.number().int().nonnegative(),
});

function canRead(auth: any, m: any) {
  if (auth.user.role === "ADMIN") return true;
  if (m.visibility === "PUBLIC") return true;
  return String(m.createdBy) === String(auth.user.userId);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { id } = await ctx.params;
  await connectDb();

  const m = await Member.findOne({ _id: id, treeId: auth.user.treeId }).lean();
  if (!m) return jsonError("Not found", 404);
  if (!canRead(auth, m)) return jsonError("Forbidden", 403);

  return jsonOk({
    id: String(m._id),
    firstName: m.firstName,
    lastName: m.lastName,
    sex: m.sex,
    birthDate: m.birthDate ?? null,
    deathDate: m.deathDate ?? null,
    photoUrl: m.photoUrl ?? null,
    professions: m.professions ?? [],
    addresses: m.addresses ?? [],
    phones: m.phones ?? [],
    emails: m.emails ?? [],
    notes: m.notes ?? null,
    visibility: m.visibility,
    createdBy: String(m.createdBy),
    unions: (m.unions ?? []).map((x: any) => String(x)),
    parentUnion: m.parentUnion ? String(m.parentUnion) : null,
    version: m.version,
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

  const current = await Member.findOne({ _id: id, treeId: auth.user.treeId }).lean();
  if (!current) return jsonError("Not found", 404);
  if (!canRead(auth, current)) return jsonError("Forbidden", 403);

  const set: any = { ...parsed.data };
  delete set.version;

  if ("birthDate" in set) set.birthDate = set.birthDate ? new Date(set.birthDate) : null;
  if ("deathDate" in set) set.deathDate = set.deathDate ? new Date(set.deathDate) : null;

  const updated = await Member.findOneAndUpdate(
    { _id: id, treeId: auth.user.treeId, version: parsed.data.version },
    { $set: set, $inc: { version: 1 } },
    { new: true }
  );

  if (!updated) return jsonError("Version conflict", 409);

  await audit({
    entityType: "MEMBER",
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

  const m = await Member.findOne({ _id: id, treeId: auth.user.treeId }).lean();
  if (!m) return jsonError("Not found", 404);
  if (!canRead(auth, m)) return jsonError("Forbidden", 403);

  if ((m.unions ?? []).length > 0) return jsonError("Member has unions", 400);

  if (m.parentUnion) {
    await Union.updateOne(
      { _id: m.parentUnion, treeId: auth.user.treeId },
      { $pull: { children: m._id }, $inc: { version: 1 } }
    );
  }

  const deleted = await Member.findOneAndDelete({ _id: id, treeId: auth.user.treeId });
  if (!deleted) return jsonError("Not found", 404);

  await audit({
    entityType: "MEMBER",
    entityId: deleted._id.toString(),
    action: "DELETE",
    performedBy: auth.user.userId,
    changes: { id },
  });

  return jsonOk({ id: deleted._id.toString() });
}
