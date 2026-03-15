import mongoose, { Schema, Model } from "mongoose";

export type MemberDoc = mongoose.Document & {
  treeId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  sex: "M" | "F" | "X";
  birthDate?: Date;
  deathDate?: Date;

  photoUrl?: string;
  professions?: string[];
  addresses?: string[];
  phones?: string[];
  emails?: string[];
  notes?: string;

  visibility: "PUBLIC" | "PRIVATE";
  createdBy: mongoose.Types.ObjectId;

  unions: mongoose.Types.ObjectId[];
  parentUnion?: mongoose.Types.ObjectId;

  version: number;
  createdAt: Date;
  updatedAt: Date;
};

const MemberSchema = new Schema<MemberDoc>(
  {
    treeId: { type: Schema.Types.ObjectId, required: true, ref: "Tree", index: true },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    sex: { type: String, required: true, enum: ["M", "F", "X"] },

    birthDate: { type: Date },
    deathDate: { type: Date },

    photoUrl: { type: String },
    professions: { type: [String], default: [] },
    addresses: { type: [String], default: [] },
    phones: { type: [String], default: [] },
    emails: { type: [String], default: [] },
    notes: { type: String },

    visibility: { type: String, required: true, enum: ["PUBLIC", "PRIVATE"], index: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },

    unions: { type: [Schema.Types.ObjectId], required: true, ref: "Union", default: [] },
    parentUnion: { type: Schema.Types.ObjectId, ref: "Union", default: undefined },

    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

MemberSchema.index({ treeId: 1, lastName: 1 });
MemberSchema.index({ treeId: 1, visibility: 1 });
MemberSchema.index({ treeId: 1, createdBy: 1 });

export const Member: Model<MemberDoc> =
  mongoose.models.Member || mongoose.model<MemberDoc>("Member", MemberSchema);
