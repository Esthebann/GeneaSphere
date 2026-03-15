import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Member } from "@/models/Member";
import { Union } from "@/models/Union";
import { audit } from "@/lib/audit";
import { jsonCreated, jsonError } from "@/lib/http";

const bodySchema = z.object({
  partnerIds: z.array(z.string().min(1)).min(1),
  status: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  await connectDb();

  const partners = await Member.find({
    treeId: auth.user.treeId,
    _id: { $in: parsed.data.partnerIds },
  }).lean();
  if (partners.length !== parsed.data.partnerIds.length) return jsonError("Invalid partnerIds", 400);

  const created = await Union.create({
    treeId: auth.user.treeId,

    partners: parsed.data.partnerIds,
    children: [],
    status: parsed.data.status ?? undefined,
    createdBy: auth.user.userId,
    version: 0,
  });

  await Member.updateMany(
    { _id: { $in: parsed.data.partnerIds }, treeId: auth.user.treeId },
    { $addToSet: { unions: created._id } }
  );

  await audit({
    entityType: "UNION",
    entityId: created._id.toString(),
    action: "CREATE",
    performedBy: auth.user.userId,
    changes: parsed.data,
  });

  return jsonCreated({ id: created._id.toString(), version: created.version });
}
