import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Member } from "@/models/Member";
import { Union } from "@/models/Union";
import { jsonOk, jsonError } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  await connectDb();

  const members = await Member.find({ treeId: auth.user.treeId }).lean();
  const unions = await Union.find({ treeId: auth.user.treeId }).lean();

  return jsonOk({
    members: members.map((m: any) => ({
      id: m._id.toString(),
      firstName: m.firstName,
      lastName: m.lastName,
      sex: m.sex,
      birthDate: m.birthDate ?? null,
      deathDate: m.deathDate ?? null,
      visibility: m.visibility,
      createdBy: m.createdBy.toString(),
      unions: (m.unions ?? []).map((x: any) => x.toString()),
      parentUnion: m.parentUnion ? m.parentUnion.toString() : null,
      version: m.version ?? 0,
    })),
    unions: unions.map((u: any) => ({
      id: u._id.toString(),
      partners: (u.partners ?? []).map((x: any) => x.toString()),
      children: (u.children ?? []).map((x: any) => x.toString()),
      status: u.status ?? null,
      startDate: u.startDate ?? null,
      endDate: u.endDate ?? null,
      version: u.version ?? 0,
    })),
  });
}
