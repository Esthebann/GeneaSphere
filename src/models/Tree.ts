import mongoose, { Schema, Model } from "mongoose";

export type TreeDoc = mongoose.Document & {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const TreeSchema = new Schema<TreeDoc>(
  {
    name: { type: String, required: true, default: "My tree" },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
  },
  { timestamps: true }
);

export const Tree: Model<TreeDoc> = mongoose.models.Tree || mongoose.model<TreeDoc>("Tree", TreeSchema);
