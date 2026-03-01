import { MemberModel } from '@/server/models/Member'

export async function canReadMember(memberId: string, userId: string, role: 'PENDING' | 'USER' | 'ADMIN') {
  const member = await MemberModel.findById(memberId).lean()
  if (!member) return { ok: false, code: 'NOT_FOUND' as const }

  if (member.visibility === 'PUBLIC') return { ok: true, member }
  if (role === 'ADMIN') return { ok: true, member }
  if (String(member.ownerUserId) === String(userId)) return { ok: true, member }

  return { ok: false, code: 'FORBIDDEN' as const }
}

export async function canWriteMember(memberId: string, userId: string, role: 'PENDING' | 'USER' | 'ADMIN') {
  const member = await MemberModel.findById(memberId).lean()
  if (!member) return { ok: false, code: 'NOT_FOUND' as const }

  if (role === 'ADMIN') return { ok: true, member }
  if (String(member.ownerUserId) === String(userId)) return { ok: true, member }

  return { ok: false, code: 'FORBIDDEN' as const }
}
