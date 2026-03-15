import { connectDb } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";

export async function audit(input: {
  entityType: "MEMBER" | "UNION";
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  performedBy: string;
  changes?: any;
}) {
  await connectDb();
  await AuditLog.create({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    performedBy: input.performedBy,
    timestamp: new Date(),
    changes: input.changes ?? null,
  });
}
