import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { Tree } from "@/models/Tree";
import { hashPassword } from "@/lib/password";
import { jsonCreated, jsonError } from "@/lib/http";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  await connectDb();

  const email = parsed.data.email.toLowerCase().trim();
  const exists = await User.findOne({ email }).lean();
  if (exists) return jsonError("Email already used", 409);

  const admins = await User.countDocuments({ role: "ADMIN" });
  const isFirstAdmin = admins === 0;

  const passwordHash = await hashPassword(parsed.data.password);

  const user = await User.create({
    email,
    passwordHash,
    role: isFirstAdmin ? "ADMIN" : "USER",
    isValidated: isFirstAdmin ? true : false,
  });

  const tree = await Tree.create({
    name: "My tree",
    createdBy: user._id,
  });

  user.treeId = tree._id;
  await user.save();

  return jsonCreated({
    userId: user._id.toString(),
    role: user.role,
    isValidated: user.isValidated,
  });
}
