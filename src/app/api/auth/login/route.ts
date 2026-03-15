import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { Tree } from "@/models/Tree";
import { verifyPassword } from "@/lib/password";
import { signJwt } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/http";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  await connectDb();

  const email = parsed.data.email.toLowerCase().trim();
  const user = await User.findOne({ email });
  if (!user) return jsonError("Invalid credentials", 401);

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return jsonError("Invalid credentials", 401);

  if (!user.isValidated) return jsonError("Account not validated", 403);

  if (!user.treeId) {
    const tree = await Tree.create({ name: "My tree", createdBy: user._id });
    user.treeId = tree._id;
    await user.save();
  }

  const token = signJwt({
    userId: user._id.toString(),
    role: user.role,
    treeId: user.treeId.toString(),
  });

  return jsonOk({
    token,
    user: { userId: user._id.toString(), role: user.role },
    treeId: user.treeId.toString(),
  });
}
