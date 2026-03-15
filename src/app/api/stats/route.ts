import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/middlewares/authGuard'
import { connectDb } from '@/server/db/mongoose'
import { UserModel } from '@/server/models/User'
import { MemberModel } from '@/server/models/Member'
import { UnionModel } from '@/server/models/Union'
import mongoose from 'mongoose'

type Role = 'PENDING' | 'USER' | 'ADMIN'

function isReadableMember(m: any, userId: string, role: Role) {
  if (!m) return false
  if (m.visibility === 'PUBLIC') return true
  if (role === 'ADMIN') return true
  return String(m.ownerUserId) === String(userId)
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const role = auth.role as Role

    await connectDb()

    const user = await UserModel.findById(auth.userId).lean()
    if (!user) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    if (!user.profileMemberId) return NextResponse.json({ error: 'NO_PROFILE_MEMBER' }, { status: 400 })

    const rootId = String(user.profileMemberId)

    const allMembers = await MemberModel.find({}).lean()
    const readable = allMembers.filter(m => isReadableMember(m, auth.userId, role))

    const total = readable.length
    const men = readable.filter(m => m.sex === 'M').length
    const women = readable.filter(m => m.sex === 'F').length
    const other = total - men - women

    const lifeRows = readable
      .filter(m => m.birthDate && m.deathDate)
      .map(m => {
        const b = new Date(m.birthDate).getTime()
        const d = new Date(m.deathDate).getTime()
        const years = (d - b) / (1000 * 60 * 60 * 24 * 365.25)
        return Number.isFinite(years) && years > 0 && years < 140 ? years : null
      })
      .filter(x => typeof x === 'number') as number[]

    const avgLife = lifeRows.length ? lifeRows.reduce((a, b) => a + b, 0) / lifeRows.length : null

    const unions = await UnionModel.find({}).lean()

    const childLinks: Array<{ parent: string; child: string }> = []
    const partnerLinks: Array<{ member: string; union: string }> = []

    for (const u of unions as any[]) {
      const uid = String(u._id)
      for (const p of (u.partners || [])) partnerLinks.push({ member: String(p), union: uid })
      for (const c of (u.children || [])) childLinks.push({ parent: uid, child: String(c.childMemberId) })
    }

    const partnersByUnion = new Map<string, string[]>()
    for (const pl of partnerLinks) {
      const arr = partnersByUnion.get(pl.union) || []
      arr.push(pl.member)
      partnersByUnion.set(pl.union, arr)
    }

    const childrenByUnion = new Map<string, string[]>()
    for (const cl of childLinks) {
      const arr = childrenByUnion.get(cl.parent) || []
      arr.push(cl.child)
      childrenByUnion.set(cl.parent, arr)
    }

    const unionsByPartner = new Map<string, string[]>()
    for (const pl of partnerLinks) {
      const arr = unionsByPartner.get(pl.member) || []
      arr.push(pl.union)
      unionsByPartner.set(pl.member, arr)
    }

    const gen = new Map<string, number>()
    gen.set(rootId, 0)

    const q: string[] = [rootId]
    const seen = new Set<string>([rootId])

    while (q.length) {
      const cur = q.shift() as string
      const g = gen.get(cur) ?? 0
      const uids = unionsByPartner.get(cur) || []
      for (const uid of uids) {
        const kids = childrenByUnion.get(uid) || []
        for (const kid of kids) {
          if (!gen.has(kid)) gen.set(kid, g + 1)
          if (!seen.has(kid)) {
            seen.add(kid)
            q.push(kid)
          }
        }
      }
      if (seen.size > 800) break
    }

    const maxGen = gen.size ? Math.max(...Array.from(gen.values())) : 0
    const generations = maxGen + 1

    const childrenPerGen = new Map<number, number>()
    const unionsCountPerGen = new Map<number, number>()

    for (const [uid, kids] of childrenByUnion.entries()) {
      const parents = partnersByUnion.get(uid) || []
      const parentGens = parents.map(pid => gen.get(pid)).filter(x => typeof x === 'number') as number[]
      if (!parentGens.length) continue
      const ug = Math.min(...parentGens)
      childrenPerGen.set(ug, (childrenPerGen.get(ug) || 0) + kids.length)
      unionsCountPerGen.set(ug, (unionsCountPerGen.get(ug) || 0) + 1)
    }

    const genKeys = Array.from(childrenPerGen.keys()).sort((a, b) => a - b)
    const avgChildrenPerGen = genKeys.length
      ? genKeys.reduce((acc, g) => acc + (childrenPerGen.get(g)! / Math.max(1, unionsCountPerGen.get(g) || 1)), 0) / genKeys.length
      : null

    return NextResponse.json(
      {
        rootMemberId: rootId,
        totalMembers: total,
        men,
        women,
        other,
        avgLifeExpectancyYears: avgLife,
        generations,
        avgChildrenPerGeneration: avgChildrenPerGen
      },
      { status: 200 }
    )
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
