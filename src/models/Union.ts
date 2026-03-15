import mongoose, { Schema, Model } from "mongoose";

export type UnionDoc = mongoose.Document & {
  treeId: mongoose.Types.ObjectId;
  partners: mongoose.Types.ObjectId[];
  children: mongoose.Types.ObjectId[];

  status?: string;
  startDate?: Date;
  endDate?: Date;

  createdBy: mongoose.Types.ObjectId;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

const UnionSchema = new Schema<UnionDoc>(
  {
    treeId: { type: Schema.Types.ObjectId, required: true, ref: "Tree", index: true },

    partners: { type: [Schema.Types.ObjectId], required: true, ref: "Member" },
    children: { type: [Schema.Types.ObjectId], required: true, ref: "Member", default: [] },

    status: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

UnionSchema.index({ treeId: 1, partners: 1 });
UnionSchema.index({ treeId: 1, children: 1 });

export const Union: Model<UnionDoc> =
  mongoose.models.Union || mongoose.model<UnionDoc>("Union", UnionSchema);
