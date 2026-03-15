import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { Tree } from "@/models/Tree";
import { hashPassword } from "@/lib/password";
import { signJwt } from "@/lib/auth";

export async function seedAdmin() {
  await connectDb();

  const passwordHash = await hashPassword("Password123!");

  const user = await User.create({
    email: "admin@test.dev",
    passwordHash,
    role: "ADMIN",
    isValidated: true,
  });

  const tree = await Tree.create({
    createdBy: user._id,
    name: "Test Tree",
  });

  // @ts-ignore
  user.treeId = tree._id;
  await user.save();

  const token = signJwt({
    userId: user._id.toString(),
    role: "ADMIN",
    treeId: tree._id.toString(),
  });

  return { user, token, tree };
}

export async function seedUserUnvalidated() {
  await connectDb();

  const passwordHash = await hashPassword("Password123!");

  const user = await User.create({
    email: "user@test.dev",
    passwordHash,
    role: "USER",
    isValidated: false,
  });

  const tree = await Tree.create({
    createdBy: user._id,
    name: "User Tree",
  });

  // @ts-ignore
  user.treeId = tree._id;
  await user.save();

  return { user, tree };
}
