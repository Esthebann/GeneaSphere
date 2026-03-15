import { Types } from "mongoose";

export function canAccessMember(
  member: { visibility: "PUBLIC" | "PRIVATE"; createdBy: Types.ObjectId },
  user: { userId: string; role: "ADMIN" | "USER" }
): boolean {
  if (member.visibility === "PUBLIC") return true;
  if (user.role === "ADMIN") return true;
  return member.createdBy.toString() === user.userId;
}
