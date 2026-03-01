import { connectDb } from '@/server/db/mongoose'
import { UserModel } from '@/server/models/User'
import { MemberModel } from '@/server/models/Member'

export async function setupProfileMember(userId: string, input: { firstName: string; lastName: string; sex: 'M' | 'F' | 'X' }) {
  await connectDb()

  const user = await UserModel.findById(userId)
  if (!user) throw new Error('NOT_FOUND')

  if (user.profileMemberId) {
    return { ok: true, profileMemberId: String(user.profileMemberId), already: true }
  }

  const member = await MemberModel.create({
    firstName: input.firstName,
    lastName: input.lastName,
    sex: input.sex,
    visibility: 'PRIVATE',
    ownerUserId: user._id
  })

  user.profileMemberId = member._id
  await user.save()

  return { ok: true, profileMemberId: String(member._id), already: false }
}
