import { connectDb } from '@/server/db/mongoose'
import { MemberModel } from '@/server/models/Member'
import { UnionModel } from '@/server/models/Union'
import { UserModel } from '@/server/models/User'

type LinkType = 'BIOLOGICAL' | 'ADOPTED' | 'FOSTER'

function m(firstName: string, lastName: string, sex: 'M' | 'F' | 'X', visibility: 'PUBLIC' | 'PRIVATE', ownerUserId: string, notes?: string) {
  return { firstName, lastName, sex, visibility, ownerUserId, notes }
}

async function union(createdByUserId: string, status: string, partners: any[], children: { childMemberId: any; linkType: LinkType }[]) {
  return UnionModel.create({ createdByUserId, status, partners, children })
}

export async function seedDemoForAdmin(userId: string) {
  await connectDb()

  const user = await UserModel.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')

  await MemberModel.deleteMany({ ownerUserId: userId })
  await UnionModel.deleteMany({ createdByUserId: userId })

  const L = 'Volle'
  const PUB: 'PUBLIC' = 'PUBLIC'
  const PRIV: 'PRIVATE' = 'PRIVATE'

  // Root
  const root = await MemberModel.create(m('Esthebann', L, 'M', PRIV, userId, 'Profil (root)'))
  user.profileMemberId = root._id
  await user.save()

  // Generation -1 (parents + remarriage)
  const pere = await MemberModel.create(m('Paul', L, 'M', PUB, userId))
  const mere = await MemberModel.create(m('Marie', L, 'F', PUB, userId))
  const belleMere = await MemberModel.create(m('Clara', 'Morel', 'F', PUB, userId, 'Remariage du père'))
  const demiFrere = await MemberModel.create(m('Léo', L, 'M', PUB, userId, 'Demi-frère (même père)'))

  // Union parents -> root + fratrie
  const soeur = await MemberModel.create(m('Emma', L, 'F', PUB, userId, 'Soeur'))
  await union(userId, 'MARRIAGE', [pere._id, mere._id], [
    { childMemberId: root._id, linkType: 'BIOLOGICAL' },
    { childMemberId: soeur._id, linkType: 'BIOLOGICAL' }
  ])

  // Remariage du père -> demi-frère
  await union(userId, 'MARRIAGE', [pere._id, belleMere._id], [
    { childMemberId: demiFrere._id, linkType: 'BIOLOGICAL' }
  ])

  // Generation 0 (root with multiple partners + one unknown parent union)
  const conjointA = await MemberModel.create(m('Il', 'Lee', 'F', PUB, userId, 'Conjointe A'))
  const conjointB = await MemberModel.create(m('Nora', 'Ex', 'F', PUB, userId, 'Conjointe B'))
  const conjointC = await MemberModel.create(m('Yanis', 'Roux', 'M', PUB, userId, 'Conjoint C (remariage)'))

  // Children with A (bio + adopted)
  const a1 = await MemberModel.create(m('Cousin', 'Z', 'X', PUB, userId, 'Enfant biologique'))
  const a2 = await MemberModel.create(m('Alex', 'Z', 'M', PUB, userId, 'Adopté (lien gras)'))
  const a3 = await MemberModel.create(m('Mina', 'Z', 'F', PUB, userId, 'Foster (pointillé)'))
  await union(userId, 'MARRIAGE', [root._id, conjointA._id], [
    { childMemberId: a1._id, linkType: 'BIOLOGICAL' },
    { childMemberId: a2._id, linkType: 'ADOPTED' },
    { childMemberId: a3._id, linkType: 'FOSTER' }
  ])

  // Children with B (previous union -> half-sibling) + divorce
  const b1 = await MemberModel.create(m('Milo', 'Ex', 'M', PUB, userId, 'Enfant union précédente'))
  await union(userId, 'DIVORCED', [root._id, conjointB._id], [
    { childMemberId: b1._id, linkType: 'BIOLOGICAL' }
  ])

  // Remariage with C (new bio child)
  const c1 = await MemberModel.create(m('Sacha', 'Roux', 'X', PUB, userId, 'Nouvelle union après divorce'))
  await union(userId, 'MARRIAGE', [root._id, conjointC._id], [
    { childMemberId: c1._id, linkType: 'BIOLOGICAL' }
  ])

  // Case: parent unknown (union with 1 partner only) -> child
  const mysteryChild = await MemberModel.create(m('Noah', 'Mystery', 'M', PUB, userId, 'Parent inconnu (union à 1 partenaire)'))
  await union(userId, 'UNION', [conjointB._id], [
    { childMemberId: mysteryChild._id, linkType: 'BIOLOGICAL' }
  ])

  // Generation +1 (grandchildren) to stress depth
  const partnerA1 = await MemberModel.create(m('Jade', 'Petit', 'F', PUB, userId))
  const gc1 = await MemberModel.create(m('Lina', 'Petit', 'F', PUB, userId, 'Petite-fille'))
  const gc2 = await MemberModel.create(m('Noé', 'Petit', 'M', PUB, userId, 'Petit-fils (adopté)'))
  await union(userId, 'PACS', [a1._id, partnerA1._id], [
    { childMemberId: gc1._id, linkType: 'BIOLOGICAL' },
    { childMemberId: gc2._id, linkType: 'ADOPTED' }
  ])

  const partnerB1 = await MemberModel.create(m('Hugo', 'Martin', 'M', PUB, userId))
  const gc3 = await MemberModel.create(m('Zoé', 'Martin', 'F', PUB, userId))
  await union(userId, 'UNION', [b1._id, partnerB1._id], [
    { childMemberId: gc3._id, linkType: 'BIOLOGICAL' }
  ])

  // Generation +2 (one more level)
  const partnerGC1 = await MemberModel.create(m('Liam', 'Stone', 'M', PUB, userId))
  const ggc1 = await MemberModel.create(m('Iris', 'Stone', 'F', PUB, userId, 'Arrière petite-fille'))
  await union(userId, 'UNION', [gc1._id, partnerGC1._id], [
    { childMemberId: ggc1._id, linkType: 'BIOLOGICAL' }
  ])

  return { ok: true }
}
