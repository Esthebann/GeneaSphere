import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/middleware";
import { jsonOk } from "@/lib/http";
import { Member } from "@/models/Member";
import { Union } from "@/models/Union";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  await connectDb();

  const memberMatch =
    auth.user.role === "ADMIN"
      ? {}
      : {
          $or: [{ visibility: "PUBLIC" }, { createdBy: auth.user.userId }],
        };

  const membersAgg = await Member.aggregate([
    { $match: memberMatch },
    {
      $facet: {
        total: [{ $count: "value" }],
        sex: [{ $group: { _id: "$sex", value: { $sum: 1 } } }],
        avgChildren: [
          { $project: { unionsCount: { $size: { $ifNull: ["$unions", []] } } } },
          { $group: { _id: null, value: { $avg: "$unionsCount" } } },
        ],
        lifeExpectancy: [
          {
            $match: {
              birthDate: { $type: "date" },
              deathDate: { $type: "date" },
            },
          },
          {
            $project: {
              years: {
                $divide: [{ $subtract: ["$deathDate", "$birthDate"] }, 1000 * 60 * 60 * 24 * 365.25],
              },
            },
          },
          { $group: { _id: null, value: { $avg: "$years" } } },
        ],
      },
    },
  ]);

  const totalMembers = membersAgg?.[0]?.total?.[0]?.value ?? 0;

  const sexCounts = membersAgg?.[0]?.sex ?? [];
  const men = sexCounts.find((x: any) => x._id === "M")?.value ?? 0;
  const women = sexCounts.find((x: any) => x._id === "F")?.value ?? 0;

  const avgChildren = membersAgg?.[0]?.avgChildren?.[0]?.value ?? 0;
  const lifeExpectancy = membersAgg?.[0]?.lifeExpectancy?.[0]?.value ?? 0;

  const unions = await Union.find({ treeId: auth.user.treeId }, { partners: 1, children: 1 }).lean();

  const allowedMemberIds =
    auth.user.role === "ADMIN"
      ? null
      : new Set(
          (
            await Member.find(memberMatch, { _id: 1 }).lean()
          ).map((m: any) => m._id.toString())
        );

  const filteredUnions = unions.filter((u: any) => {
    const partnersOk = (u.partners || []).every((p: any) => (allowedMemberIds ? allowedMemberIds.has(p.toString()) : true));
    const childrenOk = (u.children || []).every((c: any) => (allowedMemberIds ? allowedMemberIds.has(c.toString()) : true));
    return partnersOk && childrenOk;
  });

  let totalChildren = 0;
  for (const u of filteredUnions) totalChildren += (u.children || []).length;

  const avgChildrenPerUnion = filteredUnions.length ? totalChildren / filteredUnions.length : 0;

  const memberMap = new Map<string, { parentUnion: string | null }>();
  const memberDocs = await Member.find(memberMatch, { parentUnion: 1 }).lean();
  for (const m of memberDocs) memberMap.set(m._id.toString(), { parentUnion: m.parentUnion ? m.parentUnion.toString() : null });

  const roots = [...memberMap.entries()].filter(([, v]) => !v.parentUnion).map(([id]) => id);

  const unionChildren = new Map<string, string[]>();
  for (const u of filteredUnions) unionChildren.set((u as any)._id.toString(), (u.children || []).map((c: any) => c.toString()));

  let generations = 0;
  let frontier = roots;
  const seen = new Set<string>(frontier);

  while (frontier.length) {
    generations += 1;
    const next: string[] = [];
    for (const mid of frontier) {
      for (const u of filteredUnions) {
        const partners = (u.partners || []).map((p: any) => p.toString());
        if (!partners.includes(mid)) continue;
        const children = (u.children || []).map((c: any) => c.toString());
        for (const cid of children) {
          if (!seen.has(cid)) {
            seen.add(cid);
            next.push(cid);
          }
        }
      }
    }
    frontier = next;
  }

  return jsonOk({
    totalMembers,
    men,
    women,
    avgUnionsPerMember: avgChildren,
    avgChildrenPerUnion,
    lifeExpectancyYears: lifeExpectancy,
    generations,
  });
}
