import { connectDb } from '@/server/db/mongoose'
import { MemberModel } from '@/server/models/Member'
import { getSubGraph } from '@/server/services/graphService'

type Role = 'PENDING' | 'USER' | 'ADMIN'

function yearsBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime()
  return ms / (1000 * 60 * 60 * 24 * 365.2425)
}

export async function computeStats(userId: string, role: Role) {
  await connectDb()

  const filter: any = role === 'ADMIN'
    ? {}
    : {
        $or: [
          { visibility: 'PUBLIC' },
          { visibility: 'PRIVATE', ownerUserId: userId }
        ]
      }

  const members = await MemberModel.find(filter).lean()

  const total = members.length
  const men = members.filter(m => m.sex === 'M').length
  const women = members.filter(m => m.sex === 'F').length

  const lifeYears: number[] = []
  for (const m of members) {
    if (m.birthDate && m.deathDate) {
      const y = yearsBetween(new Date(m.birthDate), new Date(m.deathDate))
      if (Number.isFinite(y) && y >= 0 && y <= 130) lifeYears.push(y)
    }
  }

  const avgLifeExpectancy = lifeYears.length
    ? Number((lifeYears.reduce((a, b) => a + b, 0) / lifeYears.length).toFixed(2))
    : null

  const sub = await getSubGraph(userId, role, 6, 'both')

  const memberLevels = new Map<string, number>()
  memberLevels.set(sub.rootMemberId, 0)

  const unionsByPartner = new Map<string, string[]>()
  const childrenByUnion = new Map<string, string[]>()

  for (const n of sub.nodes) {
    if (n.type === 'UNION') {
      childrenByUnion.set(n.id, [])
    }
  }

  for (const l of sub.links) {
    if (l.type === 'PARTNER') {
      const arr = unionsByPartner.get(l.source) || []
      arr.push(l.target)
      unionsByPartner.set(l.source, arr)
    }
    if (l.type === 'CHILD') {
      const arr = childrenByUnion.get(l.source) || []
      arr.push(l.target)
      childrenByUnion.set(l.source, arr)
    }
  }

  const q: Array<{ id: string; lvl: number }> = [{ id: sub.rootMemberId, lvl: 0 }]
  const visited = new Set<string>()

  while (q.length) {
    const cur = q.shift()!
    if (visited.has(cur.id)) continue
    visited.add(cur.id)

    const uids = unionsByPartner.get(cur.id) || []
    for (const uid of uids) {
      const kids = childrenByUnion.get(uid) || []
      for (const k of kids) {
        const nextLvl = cur.lvl + 1
        const prev = memberLevels.get(k)
        if (prev === undefined || nextLvl < prev) {
          memberLevels.set(k, nextLvl)
          q.push({ id: k, lvl: nextLvl })
        }
      }
    }
  }

  let generationsCount = 1
  for (const v of memberLevels.values()) {
    if (v + 1 > generationsCount) generationsCount = v + 1
  }

  const childrenCountsByGen = new Map<number, number[]>()
  for (const [pid, lvl] of memberLevels.entries()) {
    const uids = unionsByPartner.get(pid) || []
    let count = 0
    for (const uid of uids) count += (childrenByUnion.get(uid) || []).length
    const arr = childrenCountsByGen.get(lvl) || []
    arr.push(count)
    childrenCountsByGen.set(lvl, arr)
  }

  const avgs: number[] = []
  for (const arr of childrenCountsByGen.values()) {
    if (arr.length) avgs.push(arr.reduce((a, b) => a + b, 0) / arr.length)
  }

  const avgChildrenPerGen = avgs.length ? Number((avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2)) : 0

  return {
    totalMembers: total,
    men,
    women,
    avgLifeExpectancy,
    avgChildrenPerGeneration: avgChildrenPerGen,
    generationsCount
  }
}
