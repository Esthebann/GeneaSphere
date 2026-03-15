import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Member } from "@/models/Member";
import { jsonOk, jsonError } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return jsonOk({ results: [] });

  await connectDb();

  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const filter: any = {
    $or: [{ firstName: rx }, { lastName: rx }],
  };

  if (auth.user.role !== "ADMIN") {
    filter.$and = [
      {
        $or: [
          { visibility: "PUBLIC" },
          { $and: [{ visibility: "PRIVATE" }, { createdBy: auth.user.userId }] },
        ],
      },
    ];
  }

  const docs = await Member.find({ ...filter, treeId: auth.user.treeId })
    .sort({ lastName: 1, firstName: 1 })
    .limit(20)
    .select({ firstName: 1, lastName: 1, sex: 1, visibility: 1, parentUnion: 1 })
    .lean();

  const results = docs.map((m: any) => ({
    id: m._id.toString(),
    firstName: m.firstName,
    lastName: m.lastName,
    sex: m.sex,
    visibility: m.visibility,
    parentUnion: m.parentUnion ? m.parentUnion.toString() : null,
  }));

  return jsonOk({ results });
}
