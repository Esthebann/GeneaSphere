import bcrypt from "bcrypt";
import { Types } from "mongoose";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}
