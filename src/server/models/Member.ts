import mongoose, { Schema, type InferSchemaType } from 'mongoose'

export type Sex = 'M' | 'F' | 'X'
export type Visibility = 'PUBLIC' | 'PRIVATE'

const MemberSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    sex: { type: String, required: true, enum: ['M', 'F', 'X'] },
    photoUrl: { type: String, required: false },
    birthDate: { type: Date, required: false },
    deathDate: { type: Date, required: false },
    professions: { type: [String], required: false, default: [] },
    contacts: {
      addresses: { type: [String], required: false, default: [] },
      phones: { type: [String], required: false, default: [] },
      emails: { type: [String], required: false, default: [] }
    },
    notes: { type: String, required: false },
    visibility: { type: String, required: true, enum: ['PUBLIC', 'PRIVATE'], default: 'PUBLIC' },
    ownerUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true }
  },
  { timestamps: true }
)

export type MemberDoc = InferSchemaType<typeof MemberSchema> & { _id: mongoose.Types.ObjectId }

export const MemberModel = mongoose.models.Member ?? mongoose.model('Member', MemberSchema)
