import { connectDb } from '@/server/db/mongoose'
import { UserModel } from '@/server/models/User'
import { MemberModel } from '@/server/models/Member'
import { UnionModel } from '@/server/models/Union'
import mongoose from 'mongoose'

type Role = 'PENDING' | 'USER' | 'ADMIN'

function canReadMemberDoc(m: any, userId: string, role: Role) {
  if (!m) return false
  if (m.visibility === 'PUBLIC') return true
  if (role === 'ADMIN') return true
  if (String(m.ownerUserId) === String(userId)) return true
  return false
}

function memberNode(m: any, readable: boolean) {
  if (!readable) {
    return {
      id: String(m._id),
      type: 'MEMBER',
      label: 'Privé',
      sex: m.sex || 'X',
      visibility: m.visibility || 'PRIVATE'
    }
  }
  return {
    id: String(m._id),
    type: 'MEMBER',
    label: (m.firstName || '') + ' ' + (m.lastName || ''),
    sex: m.sex,
    visibility: m.visibility
  }
}

function unionNode(u: any) {
  return {
    id: String(u._id),
    type: 'UNION',
    status: u.status,
    startDate: u.startDate ? new Date(u.startDate).toISOString() : null,
    endDate: u.endDate ? new Date(u.endDate).toISOString() : null
  }
}

export async function getRootGraph(userId: string, role: Role) {
  await connectDb()

  const user = await UserModel.findById(userId).lean()
  if (!user) throw new Error('NOT_FOUND')
  if (!user.profileMemberId) throw new Error('NO_PROFILE_MEMBER')

  const rootId = String(user.profileMemberId)
  const rootObj = new mongoose.Types.ObjectId(rootId)

  const unionsAsPartner = await UnionModel.find({ partners: rootObj }).lean()
  const unionsAsChild = await UnionModel.find({ 'children.childMemberId': rootObj }).lean()

  const unionIds = new Set<string>()
  for (const u of unionsAsPartner) unionIds.add(String(u._id))
  for (const u of unionsAsChild) unionIds.add(String(u._id))

  const unions = await UnionModel.find({
    _id: { $in: Array.from(unionIds).map(id => new mongoose.Types.ObjectId(id)) }
  }).lean()

  const memberIds = new Set<string>()
  memberIds.add(rootId)
  for (const u of unions) {
    for (const p of u.partners || []) memberIds.add(String(p))
    for (const c of u.children || []) memberIds.add(String(c.childMemberId))
  }

  const members = await MemberModel.find({
    _id: { $in: Array.from(memberIds).map(id => new mongoose.Types.ObjectId(id)) }
  }).lean()

  const memberById = new Map<string, any>()
  for (const m of members) memberById.set(String(m._id), m)

  const nodes: any[] = []
  const links: any[] = []

  for (const mId of memberIds) {
    const m = memberById.get(mId)
    if (!m) continue
    const readable = canReadMemberDoc(m, userId, role)
    nodes.push(memberNode(m, readable))
  }

  for (const u of unions) {
    nodes.push(unionNode(u))
    for (const p of u.partners || []) {
      links.push({ source: String(p), target: String(u._id), type: 'PARTNER' })
    }
    for (const c of u.children || []) {
      links.push({ source: String(u._id), target: String(c.childMemberId), type: 'CHILD', linkType: c.linkType })
    }
  }

  return { rootMemberId: rootId, nodes, links }
}

type Mode = 'both' | 'ancestors' | 'descendants'

export async function getSubGraph(userId: string, role: Role, depth: number, mode: Mode) {
  await connectDb()

  const user = await UserModel.findById(userId).lean()
  if (!user) throw new Error('NOT_FOUND')
  if (!user.profileMemberId) throw new Error('NO_PROFILE_MEMBER')

  const rootId = String(user.profileMemberId)

  const maxDepth = Number.isFinite(depth) ? Math.max(0, Math.min(6, depth)) : 2
  const useMode: Mode = mode || 'both'

  const memberIds = new Set<string>()
  const unionIds = new Set<string>()

  memberIds.add(rootId)

  const qAnc: Array<{ id: string; d: number }> = []
  const qDesc: Array<{ id: string; d: number }> = []

  if (useMode === 'both' || useMode === 'ancestors') qAnc.push({ id: rootId, d: 0 })
  if (useMode === 'both' || useMode === 'descendants') qDesc.push({ id: rootId, d: 0 })

  const visitedAncMembers = new Set<string>()
  const visitedDescMembers = new Set<string>()

  const safetyMaxUnions = 300
  const safetyMaxMembers = 600

  while (qAnc.length > 0) {
    const cur = qAnc.shift()!
    if (cur.d >= maxDepth) continue
    if (visitedAncMembers.has(cur.id)) continue
    visitedAncMembers.add(cur.id)

    const unionsWhereChild = await UnionModel.find({ 'children.childMemberId': new mongoose.Types.ObjectId(cur.id) }).lean()

    for (const u of unionsWhereChild) {
      const uid = String(u._id)
      unionIds.add(uid)
      for (const p of u.partners || []) {
        const pid = String(p)
        memberIds.add(pid)
        qAnc.push({ id: pid, d: cur.d + 1 })
      }
      if (unionIds.size > safetyMaxUnions || memberIds.size > safetyMaxMembers) break
    }
    if (unionIds.size > safetyMaxUnions || memberIds.size > safetyMaxMembers) break
  }

  while (qDesc.length > 0) {
    const cur = qDesc.shift()!
    if (cur.d >= maxDepth) continue
    if (visitedDescMembers.has(cur.id)) continue
    visitedDescMembers.add(cur.id)

    const unionsWherePartner = await UnionModel.find({ partners: new mongoose.Types.ObjectId(cur.id) }).lean()

    for (const u of unionsWherePartner) {
      const uid = String(u._id)
      unionIds.add(uid)
      for (const c of u.children || []) {
        const cid = String(c.childMemberId)
        memberIds.add(cid)
        qDesc.push({ id: cid, d: cur.d + 1 })
      }
      if (unionIds.size > safetyMaxUnions || memberIds.size > safetyMaxMembers) break
    }
    if (unionIds.size > safetyMaxUnions || memberIds.size > safetyMaxMembers) break
  }

  const unions = await UnionModel.find({
    _id: { $in: Array.from(unionIds).map(id => new mongoose.Types.ObjectId(id)) }
  }).lean()

  for (const u of unions) {
    for (const p of u.partners || []) memberIds.add(String(p))
    for (const c of u.children || []) memberIds.add(String(c.childMemberId))
  }

  const members = await MemberModel.find({
    _id: { $in: Array.from(memberIds).map(id => new mongoose.Types.ObjectId(id)) }
  }).lean()

  const memberById = new Map<string, any>()
  for (const m of members) memberById.set(String(m._id), m)

  const nodes: any[] = []
  const links: any[] = []

  for (const mId of memberIds) {
    const m = memberById.get(mId)
    if (!m) continue
    const readable = canReadMemberDoc(m, userId, role)
    nodes.push(memberNode(m, readable))
  }

  for (const u of unions) {
    nodes.push(unionNode(u))
    for (const p of u.partners || []) {
      links.push({ source: String(p), target: String(u._id), type: 'PARTNER' })
    }
    for (const c of u.children || []) {
      links.push({ source: String(u._id), target: String(c.childMemberId), type: 'CHILD', linkType: c.linkType })
    }
  }

  return { rootMemberId: rootId, depth: maxDepth, mode: useMode, nodes, links }
}
