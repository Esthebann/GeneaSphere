import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Member } from "@/models/Member";
import { audit } from "@/lib/audit";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http";

const bodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  sex: z.enum(["M", "F", "X"]),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),

  birthDate: z.string().datetime().optional(),
  deathDate: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  await connectDb();

  const rows = await Member.find({ treeId: auth.user.treeId }).lean();
  return jsonOk({
    members: rows.map((m: any) => ({
      id: m._id.toString(),
      firstName: m.firstName,
      lastName: m.lastName,
      sex: m.sex,
      birthDate: m.birthDate ?? null,
      deathDate: m.deathDate ?? null,
      visibility: m.visibility,
      unions: (m.unions ?? []).map((x: any) => x.toString()),
      parentUnion: m.parentUnion ? m.parentUnion.toString() : null,
      version: m.version ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  await connectDb();

  const created = await Member.create({
    treeId: auth.user.treeId,

    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    sex: parsed.data.sex,
    visibility: parsed.data.visibility,
    birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : undefined,
    deathDate: parsed.data.deathDate ? new Date(parsed.data.deathDate) : undefined,
    createdBy: auth.user.userId,
    unions: [],
    version: 0,
  });

  await audit({
    entityType: "MEMBER",
    entityId: created._id.toString(),
    action: "CREATE",
    performedBy: auth.user.userId,
    changes: parsed.data,
  });

  return jsonCreated({ id: created._id.toString(), version: created.version });
}
