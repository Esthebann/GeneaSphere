import mongoose, { Schema, Model } from "mongoose";

export type UserRole = "ADMIN" | "USER";

export type UserDoc = mongoose.Document & {
  email: string;
  passwordHash: string;
  role: UserRole;
  isValidated: boolean;
  treeId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ["ADMIN", "USER"] },
    isValidated: { type: Boolean, required: true, default: false },
    treeId: { type: Schema.Types.ObjectId, ref: "Tree", index: true, default: undefined },
  },
  { timestamps: true }
);

export const User: Model<UserDoc> = mongoose.models.User || mongoose.model<UserDoc>("User", UserSchema);
