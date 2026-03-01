import mongoose, { Schema, type InferSchemaType } from 'mongoose'

export type UnionStatus = 'MARRIAGE' | 'PACS' | 'UNION' | 'DIVORCED' | 'SEPARATED' | 'OTHER'
export type ChildLinkType = 'BIOLOGICAL' | 'ADOPTED' | 'FOSTER'

const UnionSchema = new Schema(
  {
    status: { type: String, required: true, enum: ['MARRIAGE', 'PACS', 'UNION', 'DIVORCED', 'SEPARATED', 'OTHER'], default: 'UNION' },
    startDate: { type: Date, required: false },
    endDate: { type: Date, required: false },
    createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    partners: [{ type: Schema.Types.ObjectId, ref: 'Member', required: false }],
    children: [
      {
        childMemberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
        linkType: { type: String, required: true, enum: ['BIOLOGICAL', 'ADOPTED', 'FOSTER'], default: 'BIOLOGICAL' }
      }
    ]
  },
  { timestamps: true }
)

export type UnionDoc = InferSchemaType<typeof UnionSchema> & { _id: mongoose.Types.ObjectId }

export const UnionModel = mongoose.models.Union ?? mongoose.model('Union', UnionSchema)
