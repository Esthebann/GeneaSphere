import mongoose, { Schema, Model, Types } from "mongoose";

export type EntityType = "MEMBER" | "UNION";
export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export type AuditLogDoc = {
  _id: Types.ObjectId;
  entityType: EntityType;
  entityId: Types.ObjectId;
  action: AuditAction;
  performedBy: Types.ObjectId;
  timestamp: Date;
  changes?: unknown;
};

const AuditLogSchema = new Schema<AuditLogDoc>(
  {
    entityType: { type: String, required: true, enum: ["MEMBER", "UNION"] },
    entityId: { type: Schema.Types.ObjectId, required: true },
    action: { type: String, required: true, enum: ["CREATE", "UPDATE", "DELETE"] },
    performedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    timestamp: { type: Date, required: true, default: () => new Date() },
    changes: { type: Schema.Types.Mixed },
  },
  { timestamps: false }
);

AuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

export const AuditLog: Model<AuditLogDoc> =
  mongoose.models.AuditLog || mongoose.model<AuditLogDoc>("AuditLog", AuditLogSchema);
