'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Node = {
  id: string
  type: 'MEMBER' | 'UNION'
  label?: string
  sex?: 'M' | 'F' | 'X'
  visibility?: 'PUBLIC' | 'PRIVATE'
  status?: string
}

type Link = {
  source: string
  target: string
  type: 'PARTNER' | 'CHILD'
  linkType?: 'BIOLOGICAL' | 'ADOPTED' | 'FOSTER'
}

type Graph = {
  rootMemberId: string
  nodes: Node[]
  links: Link[]
  depth?: number
  mode?: string
}

type Pos = { x: number; y: number }

function getToken() {
  return localStorage.getItem('geneasphere_token') || ''
}

export default function TreePage() {
  const [graph, setGraph] = useState<Graph | null>(null)
  const [msg, setMsg] = useState('')
  const [selected, setSelected] = useState<Node | null>(null)

  const [depth, setDepth] = useState(2)
  const [mode, setMode] = useState<'both' | 'ancestors' | 'descendants'>('both')

  const [view, setView] = useState({ x: -600, y: -420, w: 1200, h: 840 })
  const dragRef = useRef<{ down: boolean; sx: number; sy: number; vx: number; vy: number } | null>(null)

  async function load() {
    setMsg('Chargement...')
    const t = getToken()
    if (!t) {
      setMsg('Pas de token. Va sur /login')
      setGraph(null)
      return
    }

    const res = await fetch('/api/graph/subgraph?depth=' + String(depth) + '&mode=' + mode, {
      headers: { Authorization: 'Bearer ' + t }
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg('Erreur: ' + (data?.error || 'LOAD_FAILED'))
      setGraph(null)
      return
    }
    setGraph(data)
    setMsg('OK')
  }

  useEffect(() => {
    load()
  }, [])

  const positions = useMemo(() => {
    if (!graph) return new Map<string, Pos>()
    return layoutGenea(graph, mode)
  }, [graph, mode])

  function onWheel(e: any) {
    e.preventDefault()
    const delta = e.deltaY
    const factor = delta > 0 ? 1.12 : 0.89
    const mx = e.nativeEvent.offsetX
    const my = e.nativeEvent.offsetY

    const sx = view.w / 900
    const sy = view.h / 600
    const wx = view.x + mx * sx
    const wy = view.y + my * sy

    const nw = view.w * factor
    const nh = view.h * factor
    const nx = wx - (wx - view.x) * factor
    const ny = wy - (wy - view.y) * factor

    setView({ x: nx, y: ny, w: nw, h: nh })
  }

  function onMouseDown(e: any) {
    dragRef.current = { down: true, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
  }

  function onMouseMove(e: any) {
    const d = dragRef.current
    if (!d || !d.down) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    const scaleX = view.w / 900
    const scaleY = view.h / 600
    setView({ x: d.vx - dx * scaleX, y: d.vy - dy * scaleY, w: view.w, h: view.h })
  }

  function onMouseUp() {
    if (dragRef.current) dragRef.current.down = false
  }

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, padding: 16, fontFamily: 'system-ui' }}>
      <div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>GeneaSphere - Arbre (SVG)</h1>
          <a href="/login">/login</a>
          <a href="/admin">/admin</a>

          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            depth
            <input
              type="number"
              value={depth}
              min={0}
              max={6}
              onChange={e => setDepth(Number(e.target.value))}
              style={{ width: 70, padding: 6 }}
            />
          </label>

          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            mode
            <select value={mode} onChange={e => setMode(e.target.value as any)} style={{ padding: 6 }}>
              <option value="both">both</option>
              <option value="ancestors">ancestors</option>
              <option value="descendants">descendants</option>
            </select>
          </label>

          <button onClick={load} style={{ padding: 8, cursor: 'pointer' }}>Rafraîchir</button>
        </div>

        <div style={{ marginBottom: 10, whiteSpace: 'pre-wrap' }}>{msg}</div>

        <svg
          width="900"
          height="600"
          style={{ border: '1px solid #ddd', background: 'white' }}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          {graph && graph.links.map((l, idx) => {
            const a = positions.get(l.source)
            const b = positions.get(l.target)
            if (!a || !b) return null

            const strokeWidth = l.linkType === 'ADOPTED' ? 4 : 2
            const dash = l.linkType === 'FOSTER' ? '6 6' : undefined

            return (
              <line
                key={idx}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="black"
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
                opacity={0.8}
              />
            )
          })}

          {graph && graph.nodes.map(n => {
            const p = positions.get(n.id)
            if (!p) return null

            const isRoot = graph.rootMemberId === n.id
            const isUnion = n.type === 'UNION'
            const r = isUnion ? 10 : 18
            const label = isUnion ? (n.status || 'UNION') : (n.label || 'Membre')

            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: 'pointer' }} onClick={() => setSelected(n)}>
                {isUnion ? (
                  <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="white" stroke="black" strokeWidth={2} rx={3} />
                ) : (
                  <circle r={r} fill="white" stroke="black" strokeWidth={isRoot ? 4 : 2} />
                )}
                <text x={0} y={-26} textAnchor="middle" fontSize="11">
                  {label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <aside style={{ border: '1px solid #ddd', padding: 12 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Détails</h2>
        {!selected && <p>Clique sur un nœud.</p>}
        {selected && (
          <div style={{ whiteSpace: 'pre-wrap' }}>
            <div><b>Type</b> {selected.type}</div>
            <div><b>ID</b> {selected.id}</div>
            {selected.type === 'MEMBER' && (
              <>
                <div><b>Label</b> {selected.label}</div>
                <div><b>Sexe</b> {selected.sex}</div>
                <div><b>Visibilité</b> {selected.visibility}</div>
              </>
            )}
            {selected.type === 'UNION' && (
              <div><b>Statut</b> {selected.status}</div>
            )}
          </div>
        )}
        <hr />
        <p style={{ margin: 0 }}>
          Layout: membres par génération. UNION au milieu. Enfants en bas. Parents en haut.
        </p>
      </aside>
    </main>
  )
}

function layoutGenea(graph: Graph, mode: 'both' | 'ancestors' | 'descendants') {
  const pos = new Map<string, Pos>()

  const X = 220
  const Y = 160

  const nodesById = new Map<string, Node>()
  for (const n of graph.nodes) nodesById.set(n.id, n)

  const unions = graph.nodes.filter(n => n.type === 'UNION').map(n => n.id)

  const partnersOfUnion = new Map<string, string[]>()
  const childrenOfUnion = new Map<string, { id: string; linkType?: string }[]>()
  const unionsByPartner = new Map<string, string[]>()
  const unionsByChild = new Map<string, string[]>()

  for (const u of unions) {
    partnersOfUnion.set(u, [])
    childrenOfUnion.set(u, [])
  }

  for (const l of graph.links) {
    if (l.type === 'PARTNER') {
      const arr = partnersOfUnion.get(l.target) || []
      arr.push(l.source)
      partnersOfUnion.set(l.target, arr)

      const up = unionsByPartner.get(l.source) || []
      up.push(l.target)
      unionsByPartner.set(l.source, up)
    }
    if (l.type === 'CHILD') {
      const arr = childrenOfUnion.get(l.source) || []
      arr.push({ id: l.target, linkType: l.linkType })
      childrenOfUnion.set(l.source, arr)

      const uc = unionsByChild.get(l.target) || []
      uc.push(l.source)
      unionsByChild.set(l.target, uc)
    }
  }

  const root = graph.rootMemberId
  const memberLevel = new Map<string, number>()
  memberLevel.set(root, 0)

  const q: Array<{ id: string; lvl: number }> = [{ id: root, lvl: 0 }]

  const maxSteps = 2000
  let steps = 0

  while (q.length && steps < maxSteps) {
    steps++
    const cur = q.shift()!
    const curLvl = cur.lvl

    if (mode === 'both' || mode === 'descendants') {
      const uids = unionsByPartner.get(cur.id) || []
      for (const uid of uids) {
        const partners = partnersOfUnion.get(uid) || []
        for (const p of partners) {
          if (!memberLevel.has(p)) {
            memberLevel.set(p, curLvl)
            q.push({ id: p, lvl: curLvl })
          }
        }
        const kids = childrenOfUnion.get(uid) || []
        for (const k of kids) {
          const nextLvl = curLvl + 1
          const prev = memberLevel.get(k.id)
          if (prev === undefined || nextLvl < prev) {
            memberLevel.set(k.id, nextLvl)
            q.push({ id: k.id, lvl: nextLvl })
          }
        }
      }
    }

    if (mode === 'both' || mode === 'ancestors') {
      const puids = unionsByChild.get(cur.id) || []
      for (const uid of puids) {
        const parents = partnersOfUnion.get(uid) || []
        for (const p of parents) {
          const nextLvl = curLvl - 1
          const prev = memberLevel.get(p)
          if (prev === undefined || nextLvl > prev) {
            memberLevel.set(p, nextLvl)
            q.push({ id: p, lvl: nextLvl })
          }
        }
      }
    }
  }

  const levels = new Map<number, string[]>()
  for (const [mid, lvl] of memberLevel.entries()) {
    const arr = levels.get(lvl) || []
    arr.push(mid)
    levels.set(lvl, arr)
  }

  for (const [lvl, arr] of levels.entries()) {
    arr.sort()
    for (let i = 0; i < arr.length; i++) {
      const mid = arr[i]
      pos.set(mid, { x: i * X, y: lvl * Y })
    }
  }

  for (const uid of unions) {
    const partners = (partnersOfUnion.get(uid) || []).filter(pid => memberLevel.has(pid))
    const kids = (childrenOfUnion.get(uid) || []).filter(k => memberLevel.has(k.id))

    if (partners.length === 0 && kids.length === 0) continue

    let unionLvl = 0
    let unionX = 0

    if (partners.length > 0) {
      const lvls = partners.map(pid => memberLevel.get(pid) || 0)
      unionLvl = Math.round(avg(lvls))
      const xs = partners.map(pid => (pos.get(pid)?.x ?? 0))
      unionX = avg(xs)
    } else {
      const lvls = kids.map(k => (memberLevel.get(k.id) || 0) - 1)
      unionLvl = Math.round(avg(lvls))
      const xs = kids.map(k => (pos.get(k.id)?.x ?? 0))
      unionX = avg(xs)
    }

    pos.set(uid, { x: unionX, y: unionLvl * Y + Y * 0.5 })

    if (partners.length === 2) {
      const a = partners[0]
      const b = partners[1]
      const pa = pos.get(a)!
      const pb = pos.get(b)!
      const midX = (pa.x + pb.x) / 2
      pos.set(uid, { x: midX, y: unionLvl * Y + Y * 0.5 })
    }
  }

  normalizeToRoot(pos, root)

  return pos
}

function avg(arr: number[]) {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function normalizeToRoot(pos: Map<string, Pos>, rootId: string) {
  const root = pos.get(rootId)
  if (!root) return
  const dx = root.x
  const dy = root.y
  for (const [k, p] of pos.entries()) {
    pos.set(k, { x: p.x - dx, y: p.y - dy })
  }
}
