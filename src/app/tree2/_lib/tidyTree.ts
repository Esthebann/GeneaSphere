export type TidyNode = {
  id: string
  children: TidyNode[]
  // Buchheim internals
  x?: number
  y?: number
  mod?: number
  thread?: TidyNode | null
  ancestor?: TidyNode
  change?: number
  shift?: number
  _lmostSibling?: TidyNode | null
  parent?: TidyNode | null
  number?: number
}

function leftSibling(v: TidyNode): TidyNode | null {
  if (!v.parent) return null
  const sibs = v.parent.children
  const i = sibs.indexOf(v)
  return i > 0 ? sibs[i - 1] : null
}
function leftMostSibling(v: TidyNode): TidyNode | null {
  if (!v.parent) return null
  const sibs = v.parent.children
  return sibs.length ? sibs[0] : null
}
function nextLeft(v: TidyNode): TidyNode | null {
  return v.children.length ? v.children[0] : (v.thread || null)
}
function nextRight(v: TidyNode): TidyNode | null {
  return v.children.length ? v.children[v.children.length - 1] : (v.thread || null)
}
function ancestor(vil: TidyNode, v: TidyNode, defaultAncestor: TidyNode): TidyNode {
  if (vil.ancestor && vil.ancestor.parent === v.parent) return vil.ancestor
  return defaultAncestor
}
function moveSubtree(wl: TidyNode, wr: TidyNode, shift: number) {
  const sub = (wr.number || 0) - (wl.number || 0)
  wr.change = (wr.change || 0) - shift / sub
  wr.shift = (wr.shift || 0) + shift
  wl.change = (wl.change || 0) + shift / sub
  wr.x = (wr.x || 0) + shift
  wr.mod = (wr.mod || 0) + shift
}
function executeShifts(v: TidyNode) {
  let shift = 0
  let change = 0
  for (let i = v.children.length - 1; i >= 0; i--) {
    const w = v.children[i]
    w.x = (w.x || 0) + shift
    w.mod = (w.mod || 0) + shift
    change += (w.change || 0)
    shift += (w.shift || 0) + change
  }
}
function apportion(v: TidyNode, defaultAncestor: TidyNode, distance: number): TidyNode {
  const w = leftSibling(v)
  if (!w) return defaultAncestor

  let vir: TidyNode = v
  let vor: TidyNode = v
  let vil: TidyNode = w
  let vol: TidyNode = leftMostSibling(v) || w

  let sir = (vir.mod || 0)
  let sor = (vor.mod || 0)
  let sil = (vil.mod || 0)
  let sol = (vol.mod || 0)

  while (nextRight(vil) && nextLeft(vir)) {
    vil = nextRight(vil)!
    vir = nextLeft(vir)!
    vol = nextLeft(vol)!
    vor = nextRight(vor)!

    vor.ancestor = v

    const shift = ((vil.x || 0) + sil) - ((vir.x || 0) + sir) + distance
    if (shift > 0) {
      const a = ancestor(vil, v, defaultAncestor)
      moveSubtree(a, v, shift)
      sir += shift
      sor += shift
    }
    sil += (vil.mod || 0)
    sir += (vir.mod || 0)
    sol += (vol.mod || 0)
    sor += (vor.mod || 0)
  }

  if (nextRight(vil) && !nextRight(vor)) {
    vor.thread = nextRight(vil)
    vor.mod = (vor.mod || 0) + sil - sor
  }
  if (nextLeft(vir) && !nextLeft(vol)) {
    vol.thread = nextLeft(vir)
    vol.mod = (vol.mod || 0) + sir - sol
    defaultAncestor = v
  }
  return defaultAncestor
}

function firstWalk(v: TidyNode, distance: number) {
  if (!v.children.length) {
    const ls = leftSibling(v)
    v.x = ls ? (ls.x || 0) + distance : 0
  } else {
    let defaultAncestor = v.children[0]
    for (const w of v.children) {
      firstWalk(w, distance)
      defaultAncestor = apportion(w, defaultAncestor!, distance)
    }
    executeShifts(v)
    const mid = ((v.children[0].x || 0) + (v.children[v.children.length - 1].x || 0)) / 2
    const ls = leftSibling(v)
    if (ls) {
      v.x = (ls.x || 0) + distance
      v.mod = (v.x - mid)
    } else {
      v.x = mid
    }
  }
}

function secondWalk(v: TidyNode, m: number, depth: number, minX: { v: number }) {
  v.x = (v.x || 0) + m
  v.y = depth
  minX.v = Math.min(minX.v, v.x || 0)
  for (const w of v.children) {
    secondWalk(w, m + (v.mod || 0), depth + 1, minX)
  }
}

function normalize(v: TidyNode, dx: number) {
  v.x = (v.x || 0) + dx
  for (const w of v.children) normalize(w, dx)
}

export function tidyLayout(root: TidyNode, distance = 1) {
  // init numbers / parent
  const stack: TidyNode[] = [root]
  while (stack.length) {
    const n = stack.pop()!
    n.mod = 0; n.thread = null; n.ancestor = n; n.change = 0; n.shift = 0
    n._lmostSibling = null
    n.children.forEach((c, i) => { c.parent = n; c.number = i + 1; stack.push(c) })
  }
  firstWalk(root, distance)
  const minX = { v: Infinity }
  secondWalk(root, 0, 0, minX)
  if (minX.v < 0) normalize(root, -minX.v)
  return root
}

export function flatten(root: TidyNode) {
  const out = new Map<string, { x: number; y: number }>()
  const st: TidyNode[] = [root]
  while (st.length) {
    const n = st.pop()!
    out.set(n.id, { x: n.x || 0, y: n.y || 0 })
    for (const c of n.children) st.push(c)
  }
  return out
}
