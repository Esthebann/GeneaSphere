export type Mode = 'both' | 'ancestors' | 'descendants'

export type GraphNode = {
  id: string
  type: 'MEMBER' | 'UNION'
  label?: string
  sex?: string
  visibility?: string
  status?: string
}

export type GraphLink = {
  source: string
  target: string
  type: 'PARTNER' | 'CHILD'
  linkType?: 'BIOLOGICAL' | 'ADOPTED' | 'FOSTER' | string
}

export type Graph = {
  rootMemberId: string
  nodes: GraphNode[]
  links: GraphLink[]
}

export type Pos = { x: number; y: number }

export type LayoutOpts = {
  yGapGen: number        // distance between MEMBER generations (not half-steps)
  xGapMember: number
  xGapChild: number
  coupleGap: number
  minGap: number
  maxIter?: number
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))

function buildIndex(graph: Graph) {
  const nodeById = new Map<string, GraphNode>()
  for (const n of graph.nodes) nodeById.set(n.id, n)
  return nodeById
}

function median(nums: number[]) {
  if (nums.length === 0) return 0
  const a = [...nums].sort((x, y) => x - y)
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

function pack1D(ids: string[], x: Map<string, number>, minGap: number) {
  ids.sort((a, b) => (x.get(a) ?? 0) - (x.get(b) ?? 0))
  let cur = -Infinity
  for (const id of ids) {
    const xi = x.get(id) ?? 0
    if (xi < cur + minGap) x.set(id, cur + minGap)
    cur = x.get(id) ?? 0
  }
}

function centerLayer(ids: string[], x: Map<string, number>) {
  if (!ids.length) return
  const xs = ids.map(id => x.get(id) ?? 0)
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length
  for (const id of ids) x.set(id, (x.get(id) ?? 0) - avg)
}

function enforceUnionCentering(graph: Graph, pos: Map<string, Pos>, coupleGap: number) {
  const partnersByUnion = new Map<string, string[]>()
  for (const l of (graph.links || [])) {
    if (l.type !== 'PARTNER') continue
    const u = String(l.target)
    const p = String(l.source)
    const arr = partnersByUnion.get(u) || []
    arr.push(p)
    partnersByUnion.set(u, arr)
  }

  for (const [u, partners] of partnersByUnion.entries()) {
    const up = pos.get(u)
    if (!up) continue

    // ensure partners are not collapsed
    if (partners.length >= 2) {
      const aId = partners[0]
      const bId = partners[1]
      const a = pos.get(aId)
      const b = pos.get(bId)
      if (a && b) {
        const dx = Math.abs(a.x - b.x)
        if (dx < coupleGap) {
          const mid = (a.x + b.x) / 2
          pos.set(aId, { x: mid - coupleGap / 2, y: a.y })
          pos.set(bId, { x: mid + coupleGap / 2, y: b.y })
        }
      }
    }

    const ps = partners.map(id => pos.get(id)).filter(Boolean) as Pos[]
    if (!ps.length) continue
    const avgX = ps.reduce((acc, p) => acc + p.x, 0) / ps.length
    pos.set(u, { x: avgX, y: up.y })
  }
}

/**
 * PRO: compute generations only on MEMBERS (parents -> children),
 * then place UNION nodes in-between generations (half-step).
 *
 * We build parent->child edges from UNION:
 * partners (MEMBER) -> children (MEMBER)
 */
function computeMemberGenerations(graph: Graph, focusId: string, mode: Mode) {
  const nodeById = buildIndex(graph)

  // union -> partners / children
  const partnersByUnion = new Map<string, string[]>()
  const childrenByUnion = new Map<string, string[]>()

  for (const n of graph.nodes) {
    if (n.type === 'UNION') {
      partnersByUnion.set(n.id, [])
      childrenByUnion.set(n.id, [])
    }
  }
  for (const l of graph.links) {
    if (l.type === 'PARTNER') {
      const u = String(l.target)
      const p = String(l.source)
      if (!partnersByUnion.has(u)) partnersByUnion.set(u, [])
      partnersByUnion.get(u)!.push(p)
    } else if (l.type === 'CHILD') {
      const u = String(l.source)
      const c = String(l.target)
      if (!childrenByUnion.has(u)) childrenByUnion.set(u, [])
      childrenByUnion.get(u)!.push(c)
    }
  }

  // build MEMBER adjacency with weighted steps (+1 child, -1 parent)
  const adj = new Map<string, Array<{ to: string; w: number }>>()
  for (const n of graph.nodes) if (n.type === 'MEMBER') adj.set(n.id, [])

  const addEdge = (a: string, b: string, w: number) => {
    if (!adj.has(a)) adj.set(a, [])
    adj.get(a)!.push({ to: b, w })
  }

  for (const [u, partners] of partnersByUnion.entries()) {
    const kids = childrenByUnion.get(u) || []
    for (const p of partners) {
      for (const c of kids) {
        // parent -> child
        addEdge(p, c, +1)
        // child -> parent
        addEdge(c, p, -1)
      }
    }
  }

  const allowW = (w: number) => {
    if (mode === 'both') return true
    if (mode === 'descendants') return w >= 0
    if (mode === 'ancestors') return w <= 0
    return true
  }

  const layer = new Map<string, number>()
  const q: string[] = []
  const inQ = new Set<string>()

  const seed = nodeById.has(focusId) ? focusId : graph.rootMemberId
  layer.set(seed, 0)
  q.push(seed)
  inQ.add(seed)

  while (q.length) {
    const u = q.shift()!
    inQ.delete(u)
    const du = layer.get(u)!
    const neigh = adj.get(u) || []
    for (const e of neigh) {
      if (!allowW(e.w)) continue
      const v = e.to
      const cand = du + e.w
      if (!layer.has(v)) {
        layer.set(v, cand)
        if (!inQ.has(v)) { q.push(v); inQ.add(v) }
      } else {
        const dv = layer.get(v)!
        // pick smaller |layer| to stabilize around focus
        if (dv !== cand && Math.abs(cand) < Math.abs(dv)) {
          layer.set(v, cand)
          if (!inQ.has(v)) { q.push(v); inQ.add(v) }
        }
      }
    }
  }

  // normalize min -> 0
  let minL = 0
  for (const v of layer.values()) minL = Math.min(minL, v)
  if (minL !== 0) {
    for (const [id, v] of layer.entries()) layer.set(id, v - minL)
  }

  // fill missing members near focus
  const base = layer.get(seed) ?? 0
  for (const n of graph.nodes) {
    if (n.type !== 'MEMBER') continue
    if (!layer.has(n.id)) layer.set(n.id, base)
  }

  return layer
}

/**
 * Build directed "down edges" on the 2-level layout:
 * MEMBER (2g) -> UNION (2g+1) -> MEMBER (2g+2)
 */
function buildDownNeighbors2Level(graph: Graph, L: Map<string, number>) {
  const down = new Map<string, string[]>()
  const up = new Map<string, string[]>()
  for (const n of graph.nodes) { down.set(n.id, []); up.set(n.id, []) }

  for (const l of graph.links) {
    const s = String(l.source)
    const t = String(l.target)
    const ls = L.get(s)
    const lt = L.get(t)
    if (ls === undefined || lt === undefined) continue
    if (lt === ls + 1) {
      down.get(s)!.push(t)
      up.get(t)!.push(s)
    }
  }
  return { down, up }
}

export function layoutStrict(
  graph: Graph,
  focusId: string,
  mode: Mode,
  opts: LayoutOpts
): Map<string, Pos> {
  const { yGapGen, xGapMember, xGapChild, coupleGap, minGap } = opts
  const maxIter = opts.maxIter ?? 8

  const nodeById = buildIndex(graph)

  // 1) generations for MEMBERS only
  const genMember = computeMemberGenerations(graph, focusId, mode)

  // 2) assign 2-level layers L:
  // MEMBER at even layers: L=2*g
  // UNION at odd layers between parents and children: L=2*g+1
  const L = new Map<string, number>()

  // prepare union partner list
  const partnersByUnion = new Map<string, string[]>()
  for (const n of graph.nodes) if (n.type === 'UNION') partnersByUnion.set(n.id, [])
  for (const l of graph.links) {
    if (l.type !== 'PARTNER') continue
    const u = String(l.target)
    const p = String(l.source)
    if (!partnersByUnion.has(u)) partnersByUnion.set(u, [])
    partnersByUnion.get(u)!.push(p)
  }

  // members first
  for (const n of graph.nodes) {
    if (n.type !== 'MEMBER') continue
    const g = genMember.get(n.id) ?? 0
    L.set(n.id, 2 * g)
  }

  // unions: choose generation = min(partner generations) (partners should match)
  for (const n of graph.nodes) {
    if (n.type !== 'UNION') continue
    const partners = partnersByUnion.get(n.id) || []
    let g = Infinity
    for (const p of partners) g = Math.min(g, genMember.get(p) ?? 0)
    if (!Number.isFinite(g)) g = genMember.get(focusId) ?? genMember.get(graph.rootMemberId) ?? 0
    L.set(n.id, 2 * g + 1)
  }

  // 3) group by L
  const layers = new Map<number, string[]>()
  let maxL = 0
  for (const n of graph.nodes) {
    const l = L.get(n.id) ?? 0
    maxL = Math.max(maxL, l)
    if (!layers.has(l)) layers.set(l, [])
    layers.get(l)!.push(n.id)
  }

  // 4) init X
  const x = new Map<string, number>()
  for (const [l, ids] of layers.entries()) {
    ids.sort((a, b) => a.localeCompare(b))
    ids.forEach((id, i) => {
      const n = nodeById.get(id)
      const gap = n?.type === 'UNION' ? coupleGap : xGapMember
      x.set(id, i * gap)
    })
    centerLayer(ids, x)
  }

  // 5) crossing reduction on 2-level graph
  const { down, up } = buildDownNeighbors2Level(graph, L)

  for (let iter = 0; iter < maxIter; iter++) {
    // top-down
    for (let l = 1; l <= maxL; l++) {
      const ids = layers.get(l) || []
      const prev = layers.get(l - 1) || []
      const idxPrev = new Map<string, number>()
      prev.sort((a, b) => (x.get(a) ?? 0) - (x.get(b) ?? 0))
      prev.forEach((id, i) => idxPrev.set(id, i))

      const score = new Map<string, number>()
      for (const id of ids) {
        const parents = up.get(id) || []
        const nums = parents.map(p => idxPrev.get(p)).filter((v): v is number => typeof v === 'number')
        score.set(id, median(nums))
      }
      ids.sort((a, b) => (score.get(a) ?? 0) - (score.get(b) ?? 0))

      ids.forEach((id, i) => {
        const n = nodeById.get(id)
        const gap = n?.type === 'UNION' ? coupleGap : xGapChild
        x.set(id, i * gap)
      })
      pack1D(ids, x, minGap)
      centerLayer(ids, x)
      layers.set(l, ids)
    }

    // bottom-up
    for (let l = maxL - 1; l >= 0; l--) {
      const ids = layers.get(l) || []
      const next = layers.get(l + 1) || []
      const idxNext = new Map<string, number>()
      next.sort((a, b) => (x.get(a) ?? 0) - (x.get(b) ?? 0))
      next.forEach((id, i) => idxNext.set(id, i))

      const score = new Map<string, number>()
      for (const id of ids) {
        const kids = down.get(id) || []
        const nums = kids.map(c => idxNext.get(c)).filter((v): v is number => typeof v === 'number')
        score.set(id, median(nums))
      }
      ids.sort((a, b) => (score.get(a) ?? 0) - (score.get(b) ?? 0))

      ids.forEach((id, i) => {
        const n = nodeById.get(id)
        const gap = n?.type === 'UNION' ? coupleGap : xGapMember
        x.set(id, i * gap)
      })
      pack1D(ids, x, minGap)
      centerLayer(ids, x)
      layers.set(l, ids)
    }
  }

  // 6) final positions
  // IMPORTANT: L is 2-level (even/odd). We map y so that 2 steps = 1 generation.
  const pos = new Map<string, Pos>()
  for (const n of graph.nodes) {
    const l = L.get(n.id) ?? 0
    const y = (l / 2) * yGapGen
    pos.set(n.id, { x: x.get(n.id) ?? 0, y })
  }

  // 7) enforce union centered between partners (big readability win)
  enforceUnionCentering(graph, pos, coupleGap)

  // 8) center on focus
  const f = pos.get(focusId) || pos.get(graph.rootMemberId)
  if (f) {
    for (const [id, p] of pos.entries()) pos.set(id, { x: p.x - f.x, y: p.y - f.y })
  }

  return pos
}
