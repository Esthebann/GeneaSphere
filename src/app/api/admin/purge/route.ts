import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Member } from "@/models/Member";
import { Union } from "@/models/Union";
import { AuditLog } from "@/models/AuditLog";
import { jsonOk, jsonError } from "@/lib/http";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  if (auth.user.role !== "ADMIN") return jsonError("Forbidden", 403);

  await connectDb();

  const body = (await req.json().catch(() => ({}))) as any;
  const scope = body?.scope === "ALL" ? "ALL" : "MINE";

  const filter = scope === "ALL" ? {} : { createdBy: auth.user.userId };

  const unions = await Union.find(filter, { _id: 1 }).lean();
  const members = await Member.find(filter, { _id: 1 }).lean();

  const unionIds = unions.map((u: any) => u._id);
  const memberIds = members.map((m: any) => m._id);

  const unionsRes = await Union.deleteMany(filter);
  const membersRes = await Member.deleteMany(filter);

  await AuditLog.deleteMany({
    $or: [
      { entityType: "UNION", entityId: { $in: unionIds } },
      { entityType: "MEMBER", entityId: { $in: memberIds } },
    ],
  });

  return jsonOk({
    scope,
    deletedUnions: unionsRes.deletedCount ?? 0,
    deletedMembers: membersRes.deletedCount ?? 0,
  });
}
