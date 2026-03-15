import { connectDb } from '@/server/db/mongoose'
import { UnionModel } from '@/server/models/Union'
import mongoose from 'mongoose'

async function partnersRelatedByFiliation(partnerA: string, partnerB: string, excludeUnionId?: string) {
  const aId = String(partnerA)
  const bId = String(partnerB)
  if (aId === bId) return true

  const unions = await UnionModel.find(excludeUnionId ? { _id: { $ne: new mongoose.Types.ObjectId(excludeUnionId) } } : {}).lean()

  const adj = new Map<string, { to: string; type: 'PARTNER' | 'CHILD' }[]>()
  function add(u: string, v: string, t: 'PARTNER' | 'CHILD') {
    if (!adj.has(u)) adj.set(u, [])
    adj.get(u)!.push({ to: v, type: t })
  }

  for (const u of unions as any[]) {
    const uid = String(u._id)

    for (const p of (u.partners || [])) {
      const pid = String(p)
      add(pid, uid, 'PARTNER')
      add(uid, pid, 'PARTNER')
    }

    for (const c of (u.children || [])) {
      const cid = String(c.childMemberId)
      add(uid, cid, 'CHILD')
      add(cid, uid, 'CHILD')
    }
  }

  const q: Array<{ id: string; d: number; seenChild: boolean }> = [{ id: aId, d: 0, seenChild: false }]
  const seen = new Set<string>([aId + '|0'])
  const maxHops = 14

  while (q.length) {
    const cur = q.shift()!
    if (cur.d > maxHops) continue

    if (cur.id === bId && cur.seenChild) return true

    const neigh = adj.get(cur.id) || []
    for (const e of neigh) {
      const nextSeen = cur.seenChild || (e.type === 'CHILD')
      const key = e.to + '|' + (nextSeen ? '1' : '0')
      if (seen.has(key)) continue
      seen.add(key)
      q.push({ id: e.to, d: cur.d + 1, seenChild: nextSeen })
    }
  }

  return false
}

function toDateOrUndefined(s?: string) {
  if (!s) return undefined
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}

async function isDescendantOf(childId: string, potentialAncestorId: string) {
  const child = new mongoose.Types.ObjectId(childId)
  const ancestor = new mongoose.Types.ObjectId(potentialAncestorId)

  const visitedUnions = new Set<string>()
  const visitedMembers = new Set<string>()
  const queue: mongoose.Types.ObjectId[] = [child]

  for (let steps = 0; steps < 5000; steps++) {
    const current = queue.shift()
    if (!current) return false

    const curId = current.toString()
    if (visitedMembers.has(curId)) continue
    visitedMembers.add(curId)

    if (curId === ancestor.toString()) return true

    const unionsWhereChild = await UnionModel.find({ 'children.childMemberId': current }, { _id: 1, partners: 1 }).lean()
    for (const u of unionsWhereChild) {
      const unionId = String(u._id)
      if (visitedUnions.has(unionId)) continue
      visitedUnions.add(unionId)

      const partners = (u.partners || []).map((x: any) => String(x))
      for (const p of partners) {
        if (!visitedMembers.has(p)) queue.push(new mongoose.Types.ObjectId(p))
      }
    }
  }

  return false
}

function arePartnersRelated(graph: { nodes:any[], links:any[] }, aId: string, bId: string, maxHops = 10) {
  if (aId === bId) return true

  // adj avec type d'arête
  const adj = new Map<string, { to: string, type: string }[]>()
  for (const n of graph.nodes) adj.set(String(n.id), [])
  for (const l of graph.links) {
    if (l.type !== 'PARTNER' && l.type !== 'CHILD') continue
    const u = String(l.source)
    const v = String(l.target)
    if (!adj.has(u)) adj.set(u, [])
    if (!adj.has(v)) adj.set(v, [])
    adj.get(u)!.push({ to: v, type: String(l.type) })
    adj.get(v)!.push({ to: u, type: String(l.type) })
  }

  // BFS avec état: a-t-on traversé au moins un lien CHILD ?
  const q = [{ id: aId, d: 0, seenChild: false }]
  const seen = new Set([aId + '|0'])

  while (q.length) {
    const cur = q.shift()
    if (!cur) break
    if (cur.d > maxHops) continue

    if (cur.id === bId && cur.seenChild) return true

    const neigh = adj.get(cur.id) || []
    for (const e of neigh) {
      const nextSeenChild = cur.seenChild || (e.type === 'CHILD')
      const key = e.to + '|' + (nextSeenChild ? '1' : '0')
      if (seen.has(key)) continue
      seen.add(key)
      q.push({ id: e.to, d: cur.d + 1, seenChild: nextSeenChild })
    }
  }

  return false
}

export async function upsertUnion(input: any, createdByUserId: string) {
  await connectDb()

  const startDate = toDateOrUndefined(input.startDate)
  const endDate = toDateOrUndefined(input.endDate)

  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw new Error('INVALID_UNION_DATES')
  }

  const partnerIds: string[] = Array.isArray(input.partnerIds) ? input.partnerIds : []
  const uniquePartners = Array.from(new Set(partnerIds)).filter(Boolean)

  if (uniquePartners.length > 2) {
    throw new Error('TOO_MANY_PARTNERS')
  }

  const children: { childMemberId: string; linkType: string }[] = Array.isArray(input.children) ? input.children : []
  const uniqueChildren = new Map<string, string>()
  for (const c of children) {
    if (!c?.childMemberId) continue
    if (!uniqueChildren.has(c.childMemberId)) uniqueChildren.set(c.childMemberId, c.linkType || 'BIOLOGICAL')
  }

  for (const childId of uniqueChildren.keys()) {
    for (const partnerId of uniquePartners) {
      if (childId === partnerId) throw new Error('CHILD_CANNOT_BE_PARTNER')
      const cycle = await isDescendantOf(partnerId, childId)
      if (cycle) throw new Error('CYCLE_DETECTED')
    }
  }

  const doc = await UnionModel.create({
    status: input.status || 'UNION',
    startDate,
    endDate,
    createdByUserId,
    partners: uniquePartners.map((id: string) => new mongoose.Types.ObjectId(id)),
    children: Array.from(uniqueChildren.entries()).map(([childMemberId, linkType]) => ({
      childMemberId: new mongoose.Types.ObjectId(childMemberId),
      linkType
    }))
  })

  return {
    id: String(doc._id),
    status: doc.status,
    startDate: doc.startDate ? new Date(doc.startDate).toISOString() : null,
    endDate: doc.endDate ? new Date(doc.endDate).toISOString() : null,
    partners: (doc.partners || []).map((x: any) => String(x)),
    children: (doc.children || []).map((c: any) => ({
      childMemberId: String(c.childMemberId),
      linkType: c.linkType
    }))
  }
}
