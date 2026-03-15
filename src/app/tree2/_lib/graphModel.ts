export type GraphNode = {
  id: string
  type: 'MEMBER' | 'UNION'
  label?: string
  sex?: 'M' | 'F' | 'X'
  visibility?: 'PUBLIC' | 'PRIVATE'
  status?: string
}

export type GraphLink = {
  source: string
  target: string
  type: 'PARTNER' | 'CHILD'
  linkType?: 'BIOLOGICAL' | 'ADOPTED' | 'FOSTER'
}

export type Graph = {
  rootMemberId: string
  nodes: GraphNode[]
  links: GraphLink[]
}

export type Index = {
  nodeById: Map<string, GraphNode>

  partnersOfUnion: Map<string, string[]>
  childrenOfUnion: Map<string, { childId: string, linkType: GraphLink['linkType'] }[]>

  unionsByPartner: Map<string, string[]>
  unionsByChild: Map<string, string[]>
}

export function buildIndex(g: Graph): Index {
  const nodeById = new Map<string, GraphNode>(g.nodes.map(n => [n.id, n]))

  const partnersOfUnion = new Map<string, string[]>()
  const childrenOfUnion = new Map<string, { childId: string, linkType: GraphLink['linkType'] }[]>()

  const unionsByPartner = new Map<string, string[]>()
  const unionsByChild = new Map<string, string[]>()

  for (const n of g.nodes) {
    if (n.type === 'UNION') {
      partnersOfUnion.set(n.id, [])
      childrenOfUnion.set(n.id, [])
    }
  }

  for (const l of g.links) {
    if (l.type === 'PARTNER') {
      if (!partnersOfUnion.has(l.target)) partnersOfUnion.set(l.target, [])
      partnersOfUnion.get(l.target)!.push(l.source)

      if (!unionsByPartner.has(l.source)) unionsByPartner.set(l.source, [])
      unionsByPartner.get(l.source)!.push(l.target)
    } else {
      if (!childrenOfUnion.has(l.source)) childrenOfUnion.set(l.source, [])
      childrenOfUnion.get(l.source)!.push({ childId: l.target, linkType: l.linkType })

      if (!unionsByChild.has(l.target)) unionsByChild.set(l.target, [])
      unionsByChild.get(l.target)!.push(l.source)
    }
  }

  return { nodeById, partnersOfUnion, childrenOfUnion, unionsByPartner, unionsByChild }
}

export type Role = 'FOCUS' | 'PARENT' | 'ENFANT' | 'CONJOINT' | 'FRATRIE' | 'AUTRE'

export function directRoles(g: Graph, focusId: string): Map<string, Role> {
  const idx = buildIndex(g)
  const m = new Map<string, Role>()
  m.set(focusId, 'FOCUS')

  const focusPartnerUnions = idx.unionsByPartner.get(focusId) || []
  const focusChildUnions = idx.unionsByChild.get(focusId) || []

  for (const uid of focusPartnerUnions) {
    for (const p of idx.partnersOfUnion.get(uid) || []) if (p !== focusId) m.set(p, 'CONJOINT')
    for (const c of idx.childrenOfUnion.get(uid) || []) m.set(c.childId, 'ENFANT')
  }

  for (const uid of focusChildUnions) {
    for (const p of idx.partnersOfUnion.get(uid) || []) m.set(p, 'PARENT')
  }

  for (const uid of focusChildUnions) {
    for (const c of idx.childrenOfUnion.get(uid) || []) if (c.childId !== focusId) m.set(c.childId, 'FRATRIE')
  }

  return m
}
