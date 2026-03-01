import mongoose, { Schema, type InferSchemaType } from 'mongoose'

export type UserRole = 'PENDING' | 'USER' | 'ADMIN'

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['PENDING', 'USER', 'ADMIN'], default: 'PENDING' },
    isValidated: { type: Boolean, required: true, default: false },
    profileMemberId: { type: Schema.Types.ObjectId, required: false }
  },
  { timestamps: true }
)

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId }

export const UserModel = mongoose.models.User ?? mongoose.model('User', UserSchema)
