import { verifyJwt } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";

export type AuthUser = {
  userId: string;
  role: "ADMIN" | "USER";
  treeId?: string | null;
};

export async function requireAuth(
  req: Request
): Promise<{ ok: true; user: AuthUser } | { ok: false; res: Response }> {
  const header = req.headers.get("authorization") || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return { ok: false, res: jsonError("Unauthorized", 401) };
  }

  try {
    const payload = verifyJwt(token);
    if (!payload) return { ok: false, res: jsonError("Unauthorized", 401) };

    await connectDb();

    const dbUser = await User.findById(payload.userId).lean();
    if (!dbUser) return { ok: false, res: jsonError("Unauthorized", 401) };

    return {
      ok: true,
      user: {
        userId: dbUser._id.toString(),
        role: dbUser.role,
        treeId: dbUser.treeId ? dbUser.treeId.toString() : null,
      },
    };
  } catch {
    return { ok: false, res: jsonError("Unauthorized", 401) };
  }
}
