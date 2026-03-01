import { connectDb } from '@/server/db/mongoose'
import { MemberModel } from '@/server/models/Member'

type Role = 'PENDING' | 'USER' | 'ADMIN'

function toDateOrUndefined(s?: string) {
  if (!s) return undefined
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}

export async function createMember(input: any, ownerUserId: string) {
  await connectDb()

  const doc = await MemberModel.create({
    firstName: input.firstName,
    lastName: input.lastName,
    sex: input.sex,
    photoUrl: input.photoUrl,
    birthDate: toDateOrUndefined(input.birthDate),
    deathDate: toDateOrUndefined(input.deathDate),
    professions: input.professions || [],
    contacts: {
      addresses: input.contacts?.addresses || [],
      phones: input.contacts?.phones || [],
      emails: input.contacts?.emails || []
    },
    notes: input.notes,
    visibility: input.visibility || 'PUBLIC',
    ownerUserId
  })

  return serializeMember(doc)
}

export async function getMember(memberId: string) {
  await connectDb()
  const doc = await MemberModel.findById(memberId).lean()
  if (!doc) return null
  return serializeMember(doc)
}

export async function updateMember(memberId: string, patch: any) {
  await connectDb()

  const update: any = {}
  if (patch.firstName !== undefined) update.firstName = patch.firstName
  if (patch.lastName !== undefined) update.lastName = patch.lastName
  if (patch.sex !== undefined) update.sex = patch.sex
  if (patch.photoUrl !== undefined) update.photoUrl = patch.photoUrl
  if (patch.birthDate !== undefined) update.birthDate = toDateOrUndefined(patch.birthDate)
  if (patch.deathDate !== undefined) update.deathDate = toDateOrUndefined(patch.deathDate)
  if (patch.professions !== undefined) update.professions = patch.professions
  if (patch.contacts !== undefined) {
    update.contacts = {
      addresses: patch.contacts.addresses || [],
      phones: patch.contacts.phones || [],
      emails: patch.contacts.emails || []
    }
  }
  if (patch.notes !== undefined) update.notes = patch.notes
  if (patch.visibility !== undefined) update.visibility = patch.visibility

  const doc = await MemberModel.findByIdAndUpdate(memberId, { $set: update }, { new: true }).lean()
  if (!doc) return null
  return serializeMember(doc)
}

export async function deleteMember(memberId: string) {
  await connectDb()
  const res = await MemberModel.deleteOne({ _id: memberId })
  return res.deletedCount === 1
}

export async function searchMembers(q: string, userId: string, role: Role) {
  await connectDb()

  const query = q.trim()
  if (!query) return []

  const regex = new RegExp(query.replace(/[.*+?^${}()|\\]/g, '\\$&'), 'i')

  const candidates = await MemberModel.find({
    $or: [{ firstName: regex }, { lastName: regex }]
  }).limit(30).lean()

  return candidates
    .filter(m => {
      if (m.visibility === 'PUBLIC') return true
      if (role === 'ADMIN') return true
      if (String(m.ownerUserId) === String(userId)) return true
      return false
    })
    .map(serializeMember)
}

function serializeMember(m: any) {
  return {
    id: String(m._id),
    firstName: m.firstName,
    lastName: m.lastName,
    sex: m.sex,
    photoUrl: m.photoUrl,
    birthDate: m.birthDate ? new Date(m.birthDate).toISOString() : null,
    deathDate: m.deathDate ? new Date(m.deathDate).toISOString() : null,
    professions: m.professions || [],
    contacts: m.contacts || { addresses: [], phones: [], emails: [] },
    notes: m.notes || '',
    visibility: m.visibility,
    ownerUserId: String(m.ownerUserId),
    createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    updatedAt: m.updatedAt ? new Date(m.updatedAt).toISOString() : null
  }
}
