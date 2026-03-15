import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/middleware";
import { connectDb } from "@/lib/db";
import { Member } from "@/models/Member";
import { Union } from "@/models/Union";
import { jsonOk, jsonError } from "@/lib/http";

const bodySchema = z.object({
  father: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    sex: z.literal("M"),
    visibility: z.enum(["PUBLIC", "PRIVATE"]),
  }),
  mother: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    sex: z.literal("F"),
    visibility: z.enum(["PUBLIC", "PRIVATE"]),
  }),
  childVersion: z.number().int().nonnegative(),
  status: z.string().min(1).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  if (!auth.user.treeId) return jsonError("No tree for this user", 400);

  const { id } = await ctx.params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid body", 400);

  await connectDb();

  const child = await Member.findOne({ _id: id, treeId: auth.user.treeId });
  if (!child) return jsonError("Not found", 404);

  if (child.version !== parsed.data.childVersion) return jsonError("Version conflict", 409);
  if (child.parentUnion) return jsonError("Parents already set", 400);

  const father = await Member.create({
    treeId: auth.user.treeId,
    ...parsed.data.father,
    createdBy: auth.user.userId,
    unions: [],    version: 0,
  });

  const mother = await Member.create({
    treeId: auth.user.treeId,
    ...parsed.data.mother,
    createdBy: auth.user.userId,
    unions: [],    version: 0,
  });

  const u = await Union.create({
    treeId: auth.user.treeId,
    partners: [father._id, mother._id],
    children: [child._id],
    status: parsed.data.status ?? "PARENTS",
    createdBy: auth.user.userId,
    version: 0,
  });
father.unions = [u._id];
  mother.unions = [u._id];
  await father.save();
  await mother.save();

  child.parentUnion = u._id;
  child.version = child.version + 1;
  await child.save();

  return jsonOk({
    unionId: u._id.toString(),
    fatherId: father._id.toString(),
    motherId: mother._id.toString(),
    childId: child._id.toString(),
  });
}
